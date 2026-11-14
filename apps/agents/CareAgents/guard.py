"""Safety check on language-model text before anyone sees it.

A failed check never fails the run: the model's text is withheld and the rule-based output is
returned on its own, with the reason recorded in the run log. The rules are deliberately blunt;
a false alarm costs a nicer sentence, a miss could cost a patient.

Checked for every agent:
- numbers: every number above 12 must appear in the data the model was given (no invented
  readings, doses or sizes). Indic digits are normalised first.
For text a patient reads, also:
- no instructions about medicines or doses,
- no diagnosis in the second person ("you have ...") and no reassurance that rules out care,
- no links.
The phrase rules read English. For other languages the model also returns an English version,
which is what these rules check (the number rule checks both).
"""

from __future__ import annotations

import re
import unicodedata

_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")

_MEDICINE_DIRECTIVE = re.compile(
    r"\b(take|taking|start|stop|stopping|increase|decrease|reduce|double|skip|discontinue|switch|change)\b"
    r"[^.!?\n]{0,50}\b(medicines?|medications?|tablets?|pills?|capsules?|doses?|dosage|insulin|drugs?|"
    r"\d+\s?(mg|mcg|ml|units?))\b",
    re.I,
)
_DOSE = re.compile(r"\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|units?)\b", re.I)
_SECOND_PERSON_DIAGNOSIS = re.compile(
    r"\byou (definitely |probably |likely |clearly )?(have|are suffering from|are diagnosed with|have been diagnosed)\b",
    re.I,
)
# "you have" that is not a diagnosis: "any symptoms you have", "questions you have", "if you have ...".
_HARMLESS_YOU_HAVE = re.compile(
    r"\b((symptoms?|questions?|concerns?|problems?|complaints?|worries|anything)\s+(that\s+|which\s+)?|(if|when|whether|in case)\s+)$",
    re.I,
)
_FALSE_REASSURANCE = re.compile(
    r"\b(nothing to worry about|no need to (see|visit|consult|call)|you are (fine|healthy|cured)|"
    r"don'?t need (a|to see a|your) doctor|completely normal)\b",
    re.I,
)
_LINK = re.compile(r"https?://|www\.", re.I)


def _states_diagnosis(text: str) -> bool:
    return any(
        not _HARMLESS_YOU_HAVE.search(text[max(0, m.start() - 40) : m.start()])
        for m in _SECOND_PERSON_DIAGNOSIS.finditer(text)
    )


def _ascii_digits(text: str) -> str:
    return "".join(str(unicodedata.digit(c)) if c.isdigit() and not c.isascii() else c for c in text)


def _numbers(text: str) -> set[str]:
    out = set()
    for raw in _NUMBER.findall(_ascii_digits(text)):
        value = raw.replace(",", ".")
        try:
            number = float(value)
        except ValueError:
            continue
        out.add(f"{number:g}")
    return out


def unsupported_numbers(text: str, source: str) -> list[str]:
    allowed = _numbers(source)
    return sorted(n for n in _numbers(text) if float(n) > 12 and n not in allowed)


def check(text: str, source: str, *, audience: str, english: str | None = None) -> str | None:
    """None when the text may be shown; otherwise the reason it was withheld."""
    if not text or not text.strip():
        return "empty model reply"
    invented = unsupported_numbers(text, source) + (unsupported_numbers(english, source) if english else [])
    if invented:
        return f"numbers not in the record: {', '.join(sorted(set(invented))[:5])}"
    if audience != "patient":
        return None
    if _LINK.search(text) or (english and _LINK.search(english)):
        return "contains a link"
    readable = english if english is not None else text
    for pattern, reason in (
        (_MEDICINE_DIRECTIVE, "instruction about medicines"),
        (_DOSE, "mentions a dose"),
        (_FALSE_REASSURANCE, "reassurance that could delay care"),
    ):
        if pattern.search(readable):
            return reason
    if _states_diagnosis(readable):
        return "states a diagnosis"
    return None


def plain(text: str) -> str:
    """Drop markdown the app would show literally, and typographic characters models slip in."""
    # Non-breaking and narrow spaces, non-breaking hyphens: "8 mm" must stay searchable as "8 mm".
    text = re.sub("[\u00a0\u2007\u2009\u202f]", " ", text).replace("\u2011", "-").replace("\u2010", "-")
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=re.S)
    text = re.sub(r"^#{1,6}[ \t]+", "", text, flags=re.M)
    text = re.sub(r"^[ \t]*[-*][ \t]+", "", text, flags=re.M)
    return re.sub(r"[ \t]{2,}", " ", text).strip()
