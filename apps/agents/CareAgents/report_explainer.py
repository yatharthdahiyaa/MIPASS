"""Explains a report the patient's doctor signed, in plain words.

Input: language, report {modality, analyzer_name, study_date, impression (the doctor's signed
text), primary_finding, severity, findings}. The explainer never adds to the report.

Rule-based part (always): the medical terms in the report with a plain meaning, questions to take
to the doctor, and a prompt to contact the doctor when the report marked something serious.
Model part (with the patient's consent): a short plain-language summary in the patient's language,
plus an English version that guard.py checks.
"""

from __future__ import annotations

import json
import re

from . import findings as F
from . import guard, llm

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu"}

# Common words in chest imaging reports (findings labels are added from findings.LABELS).
TERMS: dict[str, str] = {
    "opacity": "An area that looks whiter (denser) than normal on the X-ray.",
    "opacities": "Areas that look whiter (denser) than normal on the X-ray.",
    "infiltrate": "An area of the lung that looks denser than normal. It has many possible causes.",
    "costophrenic angle": "The lower corner of the lung on the X-ray, where fluid often shows first.",
    "bilateral": "On both sides.",
    "unremarkable": "Normal: nothing of concern was seen.",
    "no acute": "Nothing new or sudden that needs urgent treatment was seen.",
    "cardiopulmonary": "The heart and lungs.",
    "radiograph": "An X-ray image.",
    "ct": "A detailed scan that uses X-rays to make cross-section pictures of the body.",
    "lobe": "One of the sections of the lung (three on the right, two on the left).",
    "hilar": "The area where the airways and blood vessels enter the lung.",
    "mediastinum": "The space in the middle of the chest that holds the heart and large blood vessels.",
    "interstitial": "The tissue around the tiny air sacs of the lung.",
    "calcified": "Has calcium deposits, often from an old, healed problem.",
    "calcification": "Calcium deposits, often from an old, healed problem.",
    "correlate clinically": "Your doctor will compare this with your symptoms and examination.",
    "clinical correlation": "Your doctor will compare this with your symptoms and examination.",
    "follow-up": "Another check later to see whether anything has changed.",
}

QUESTIONS_GENERAL = [
    "What does this report mean for me?",
    "Do I need any more tests or a follow-up visit?",
    "Is there anything I should watch for, and when should I get help?",
]


def _terms(text: str, labels: list[str]) -> list[dict]:
    low = f" {text.lower()} "
    found: dict[str, str] = {}
    for label in labels:
        meaning = F.plain(label)
        if meaning:
            found[F.wording(label).replace("a pulmonary ", "")] = meaning[0].upper() + meaning[1:] + "."
    for label in F.LABELS:
        term = F.wording(label).replace("a pulmonary ", "")
        if term not in found and re.search(rf"\b{re.escape(term)}\b", low):
            found[term] = F.plain(label)[0].upper() + F.plain(label)[1:] + "."
    for term, meaning in TERMS.items():
        if term not in found and re.search(rf"(?<![a-z]){re.escape(term)}(?![a-z])", low):
            found[term] = meaning
    return [{"term": t, "meaning": m} for t, m in found.items()]


def build(report: dict) -> dict:
    impression = (report.get("impression") or "").strip()
    labels = list((report.get("findings") or {}).get("positive_findings") or [])
    terms = _terms(impression, labels)
    questions = list(QUESTIONS_GENERAL)
    for t in terms[:2]:
        questions.insert(0, f"What does “{t['term']}” mean in my case?")
    out = {"terms": terms, "questions": questions[:5], "attention": None}
    if report.get("severity") in ("HIGH", "CRITICAL"):
        out["attention"] = (
            "Your doctor's report marks findings that need attention. If your doctor hasn't talked with you about "
            "it yet, contact them. If you feel very unwell, call 112."
        )
    return out


SUMMARY_INSTRUCTIONS = """You explain a medical imaging report to a patient in plain, kind, everyday words.
You receive REPORT: the impression their doctor signed, and LANGUAGE.

What to write
- Say what the report describes, in words a person with no medical training uses. Replace jargon
  with its meaning instead of repeating it: "no acute cardiopulmonary abnormality" becomes
  "nothing new or urgent was seen in the heart or lungs"; "pleural effusion" becomes "some fluid
  around the lung".
- Keep the doctor's level of certainty. Radiology hedges are deliberate:
  "consistent with", "in keeping with", "suggests", "suspicious for", "possible" all mean the
  picture LOOKS LIKE something, not that it is confirmed. Write "the picture looks like it could
  be ..." or "may be ...", never a flat statement that the condition is present.
  "Correlate clinically" and "in the appropriate clinical setting" mean the doctor will weigh the
  picture against the patient's symptoms and examination. Say that.
- Keep every number, measurement and time span exactly as written, in digits ("6 weeks", "8 mm",
  "30%"). Do not spell numbers out and do not add any.
- If the report mentions a follow-up test or review, say that the report mentions it.
- End with one sentence saying their doctor is the right person to explain what this means for them.
- 3 to 5 short sentences. Vary the sentence openings. No markdown, no links.

What never to write
- Anything the report does not say: no extra findings, causes, risks, tests or treatment.
- "You have ..." or any statement that the patient has a condition.
- Advice about medicines, or reassurance that they need no care.

Reply with one JSON object: {"summary": "<in LANGUAGE>", "summary_en": "<the same in English>"}"""


def run(inputs: dict) -> dict:
    data = inputs.get("input") or {}
    report = data.get("report") or {}
    language = data.get("language") if data.get("language") in LANGUAGE_NAMES else "en"
    out = build(report)
    meta = {"llm_used": False, "llm_model": None, "guard": None}
    summary = None
    impression = (report.get("impression") or "").strip()
    if not impression:
        out["notice"] = "This report has no written impression to explain."
    elif inputs.get("llm_allowed") and llm.available():
        source = json.dumps({"REPORT": impression, "LANGUAGE": LANGUAGE_NAMES[language]}, ensure_ascii=False)
        try:
            reply = llm.complete_json(SUMMARY_INSTRUCTIONS, source)
            meta.update(llm_used=True, llm_model=llm.model_name())
            text = guard.plain(str(reply.get("summary") or ""))
            english = text if language == "en" else guard.plain(str(reply.get("summary_en") or ""))
            reason = guard.check(text, impression, audience="patient", english=english)
            if not english:
                reason = reason or "no English version to check"
            if reason:
                meta["guard"] = reason
            else:
                summary = text
        except llm.LLMUnavailable as exc:
            meta["llm_error"] = str(exc)[:200]
    elif not inputs.get("llm_allowed"):
        meta["llm_skipped"] = "patient has not allowed AI processing"
    out.update(
        summary=summary,
        language=language,
        notice=out.get("notice") or "This explanation is not medical advice. Your doctor can tell you what the report means for you.",
        _meta=meta,
    )
    return out
