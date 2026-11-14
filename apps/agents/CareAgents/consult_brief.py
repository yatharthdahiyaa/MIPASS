"""Pre-consultation brief for a doctor: what the patient shared, sorted by what needs attention.

Input (built by the backend from the care link, already limited to the areas the patient shared
and stripped of identifiers): days, scopes, patient {age, sex}, and any of profile, vitals,
medications, xrays, documents, consult, unread_messages.

Every line is computed by rules. With the patient's consent, a model then writes a short opening
paragraph from those lines only; guard.py withholds it if it adds a number the lines don't have.
"""

from __future__ import annotations

import json
import re
from datetime import date
from statistics import mean

from . import guard, llm

SCOPE_LABELS = {"profile": "Profile", "vitals": "Vitals", "medications": "Medicines", "documents": "Records", "xrays": "X-rays"}
MODES = {"video": "video call", "in_person": "in person", "chat": "chat"}


def _f(v: float, digits: int = 0) -> str:
    return f"{v:.{digits}f}" if digits else str(int(round(v)))


def _date(iso: str | None) -> str:
    if not iso:
        return "unknown date"
    try:
        d = date.fromisoformat(iso[:10])
    except ValueError:
        return iso[:10]
    return f"{d.day} {d.strftime('%b %Y')}"


def _share(n: int, total: int) -> str:
    return f"{n} of {total} check-in{'s' if total != 1 else ''}"


def _vitals(v: dict, days: int, attention: list[str]) -> list[str]:
    logs = sorted(v.get("logs") or [], key=lambda x: x.get("log_date") or "")
    if not logs:
        return [f"No check-ins in the last {days} days."]
    lines = [f"{len(logs)} check-in{'s' if len(logs) != 1 else ''} in the last {days} days, latest {_date(logs[-1].get('log_date'))}."]

    bp = [(x["systolic"], x["diastolic"]) for x in logs if x.get("systolic") is not None and x.get("diastolic") is not None]
    if bp:
        sys_, dia = [s for s, _ in bp], [d for _, d in bp]
        lines.append(
            f"Blood pressure averaged {_f(mean(sys_))}/{_f(mean(dia))} mmHg "
            f"(range {_f(min(sys_))}-{_f(max(sys_))} / {_f(min(dia))}-{_f(max(dia))})."
        )
        crisis = sum(1 for s, d in bp if s >= 180 or d >= 120)
        high = sum(1 for s, d in bp if s >= 140 or d >= 90)
        if crisis:
            attention.append(f"Blood pressure at or above 180/120 on {_share(crisis, len(bp))}.")
        elif high:
            attention.append(f"Blood pressure at or above 140/90 on {_share(high, len(bp))}.")
        if len(sys_) >= 6:
            half = len(sys_) // 2
            change = mean(sys_[half:]) - mean(sys_[:half])
            if abs(change) >= 5:
                direction = "rising" if change > 0 else "falling"
                lines.append(f"Systolic pressure {direction}: about {_f(abs(change))} mmHg between the first and second half of the period.")

    hr = [x["heart_rate"] for x in logs if x.get("heart_rate") is not None]
    if hr:
        lines.append(f"Heart rate averaged {_f(mean(hr))} bpm (range {_f(min(hr))}-{_f(max(hr))}).")
        fast = sum(1 for h in hr if h > 100)
        slow = sum(1 for h in hr if h < 50)
        if fast:
            attention.append(f"Heart rate above 100 bpm on {_share(fast, len(hr))} (highest {_f(max(hr))}).")
        if slow:
            attention.append(f"Heart rate below 50 bpm on {_share(slow, len(hr))} (lowest {_f(min(hr))}).")

    glucose = [(x["glucose"], x.get("glucose_context")) for x in logs if x.get("glucose") is not None]
    if glucose:
        fasting = [g for g, c in glucose if c == "fasting"]
        lines.append(
            f"Glucose: {len(glucose)} reading{'s' if len(glucose) != 1 else ''}"
            + (f", fasting average {_f(mean(fasting))} mg/dL" if fasting else "")
            + "."
        )
        low = sum(1 for g, _ in glucose if g < 70)
        high_fasting = sum(1 for g, c in glucose if c == "fasting" and g >= 126)
        high_other = sum(1 for g, c in glucose if c != "fasting" and g >= 200)
        if low:
            attention.append(f"Glucose below 70 mg/dL on {_share(low, len(glucose))}.")
        if high_fasting:
            attention.append(f"Fasting glucose at or above 126 mg/dL on {_share(high_fasting, len(fasting))}.")
        if high_other:
            attention.append(f"Non-fasting glucose at or above 200 mg/dL on {_share(high_other, len(glucose) - len(fasting))}.")

    spo2 = [x["spo2"] for x in logs if x.get("spo2") is not None]
    if spo2:
        lines.append(f"Oxygen saturation lowest {_f(min(spo2))}%.")
        low = sum(1 for s in spo2 if s < 94)
        if low:
            attention.append(f"Oxygen saturation below 94% on {_share(low, len(spo2))}.")

    temps = [x["temperature_c"] for x in logs if x.get("temperature_c") is not None]
    fever = sum(1 for t in temps if t >= 38)
    if fever:
        attention.append(f"Temperature of 38 °C or more on {_share(fever, len(temps))}.")

    weights = [(x["log_date"], x["weight_kg"]) for x in logs if x.get("weight_kg") is not None]
    if len(weights) >= 2:
        change = weights[-1][1] - weights[0][1]
        if abs(change) >= 2:
            attention.append(f"Weight {'up' if change > 0 else 'down'} {_f(abs(change), 1)} kg since {_date(weights[0][0])}.")
        else:
            lines.append(f"Weight steady around {_f(weights[-1][1], 1)} kg.")

    symptoms: dict[str, int] = {}
    for x in logs:
        for s in x.get("symptoms") or []:
            symptoms[s] = symptoms.get(s, 0) + 1
    if symptoms:
        top = sorted(symptoms.items(), key=lambda kv: -kv[1])[:5]
        lines.append("Symptoms logged: " + ", ".join(f"{name.replace('_', ' ')} ({n})" for name, n in top) + ".")
    return lines


def _medications(m: dict, attention: list[str]) -> list[str]:
    active = [i for i in m.get("items") or [] if i.get("is_active")]
    lines = [
        f"{i['name']}{' ' + i['dosage'] if i.get('dosage') else ''}" + (f" at {', '.join(i['times'])}" if i.get("times") else "")
        for i in active
    ] or ["No active medicines listed."]
    for label, a in (("7 days", m.get("adherence_7d")), ("30 days", m.get("adherence_30d"))):
        if a and a.get("scheduled"):
            pct = round(a["rate"] * 100)
            lines.append(f"Doses marked taken over {label}: {pct}% ({a['taken']} of {a['scheduled']}).")
    week, month = m.get("adherence_7d"), m.get("adherence_30d")
    if month and month.get("scheduled") and not month.get("taken"):
        # Nothing ticked off in a month is far more often "doesn't use the checklist" than "takes nothing".
        attention.append("No doses marked taken in 30 days: the patient may not be using the dose checklist. Ask about adherence.")
    elif week and week.get("scheduled") and week["rate"] < 0.8:
        attention.append(f"Only {round(week['rate'] * 100)}% of scheduled doses marked taken in the last 7 days.")
    return lines


def _xrays(xrays: list[dict], attention: list[str]) -> list[str]:
    if not xrays:
        return ["No X-rays uploaded."]
    lines = []
    for x in xrays[:5]:
        finding = (x.get("primary_finding") or "no main finding").replace("_", " ")
        lines.append(
            f"{_date(x.get('date'))}: AI screen {(x.get('severity') or x.get('status') or 'unknown').lower()}, {finding}"
            + (", reviewed by you" if x.get("reviewed_by_you") else "")
            + "."
        )
        if x.get("severity") in ("HIGH", "CRITICAL") and not x.get("reviewed_by_you"):
            attention.append(f"X-ray of {_date(x.get('date'))} flagged {x['severity'].lower()} by the AI screen and not reviewed yet.")
    return lines


def build(data: dict) -> dict:
    days = int(data.get("days") or 30)
    scopes = data.get("scopes") or []
    attention: list[str] = []
    sections: list[dict] = []

    consult = data.get("consult")
    if consult:
        when = consult.get("scheduled_at") or consult.get("preferred_at")
        sections.append(
            {
                "title": "Reason for the consultation",
                "items": [
                    f"“{consult.get('reason', '').strip()}”",
                    f"{MODES.get(consult.get('mode'), consult.get('mode') or 'unspecified').capitalize()} consultation"
                    + (f", {'scheduled for' if consult.get('scheduled_at') else 'patient prefers'} {_date(when)}" if when else ", no time set yet"),
                ],
            }
        )

    patient = data.get("patient") or {}
    profile = data.get("profile")
    background = []
    if patient.get("age") is not None or patient.get("sex"):
        background.append(" · ".join(str(p) for p in (f"{patient['age']} years" if patient.get("age") is not None else None, patient.get("sex")) if p))
    if profile:
        if profile.get("conditions"):
            background.append(f"Conditions: {profile['conditions']}")
        if profile.get("allergies"):
            background.append(f"Allergies: {profile['allergies']}")
            attention.append(f"Allergies recorded: {profile['allergies']}.")
        if profile.get("blood_group"):
            background.append(f"Blood group {profile['blood_group']}")

    if "vitals" in data:
        sections.append({"title": f"Vitals, last {days} days", "items": _vitals(data["vitals"], days, attention)})
    if "medications" in data:
        sections.append({"title": "Medicines", "items": _medications(data["medications"], attention)})
    if "xrays" in data:
        sections.append({"title": "X-rays the patient uploaded", "items": _xrays(data["xrays"], attention)})
    if "documents" in data:
        docs = data["documents"]
        counts: dict[str, int] = {}
        for d in docs:
            counts[d.get("category") or "other"] = counts.get(d.get("category") or "other", 0) + 1
        sections.append(
            {
                "title": "Records",
                "items": [", ".join(f"{n} {k.replace('_', ' ')}" for k, n in sorted(counts.items()))] if docs else ["No records uploaded."],
            }
        )
    if background:
        sections.append({"title": "Background", "items": background})
    if data.get("unread_messages"):
        n = data["unread_messages"]
        attention.append(f"{n} unread message{'s' if n != 1 else ''} from the patient.")
    hidden = [SCOPE_LABELS[s] for s in SCOPE_LABELS if s not in scopes]
    if hidden:
        sections.append({"title": "Not shared with you", "items": [", ".join(hidden)]})

    sections.insert(1 if consult else 0, {"title": "Needs attention", "items": attention or ["Nothing in the shared record crossed the alert limits."]})
    return {"attention": attention, "sections": sections}


NARRATIVE_INSTRUCTIONS = """You write the opening of a pre-consultation brief for a doctor.
You receive FACTS: lines computed from the record the patient shared. Write 2 to 4 sentences
that tell the doctor the most important points first. Rules:
- Use only the FACTS. Do not add readings, numbers, diagnoses, causes or treatment advice.
- Keep numbers exactly as they appear in the FACTS, in digits.
- Lead with the reason for the consultation if there is one, then what needs attention, most
  serious first. Mention a trend ("rising", "falling") or logged symptoms when the FACTS give them.
- These are the patient's own home readings: say "self-reported" or "logged" rather than "measured".
- Report, do not judge. No evaluative or interpretive words ("concerning", "suboptimal",
  "indicating", "suggesting", "poorly controlled", "stable") and no advice about what the doctor
  should do. The doctor draws the conclusions.
- If the FACTS contain an "Allergies recorded" line, include it. If they do not, do not mention
  allergies at all.
- Never say something is absent or normal ("no allergies", "no symptoms", "no medicines") unless a
  FACT says exactly that. Anything not in the FACTS is unknown: the patient may not have shared it.
- Plain clinical English, ordinary hyphens and spaces, no markdown, no greeting.
Reply with one JSON object: {"narrative": "..."}"""


# "No allergies" is only true if the record says so; an area the patient didn't share is unknown.
_ABSENCE = re.compile(r"\bno (known |recorded |reported |listed )?(drug )?(allerg\w*|symptoms?|medic\w*)", re.I)


def run(inputs: dict) -> dict:
    data = inputs.get("input") or {}
    brief = build(data)
    meta = {"llm_used": False, "llm_model": None, "guard": None}
    narrative = None
    if inputs.get("llm_allowed") and llm.available():
        facts = json.dumps(brief, ensure_ascii=False)
        try:
            reply = llm.complete_json(NARRATIVE_INSTRUCTIONS, f"FACTS:\n{facts}")
            meta.update(llm_used=True, llm_model=llm.model_name())
            text = guard.plain(str(reply.get("narrative") or ""))
            reason = guard.check(text, facts, audience="doctor")
            claimed = _ABSENCE.search(text)
            if not reason and claimed and claimed.group(0).lower() not in facts.lower():
                reason = f"claims an absence the record doesn't state: {claimed.group(0)!r}"
            if reason:
                meta["guard"] = reason
            else:
                narrative = text
        except llm.LLMUnavailable as exc:
            meta["guard"] = None
            meta["llm_error"] = str(exc)[:200]
    elif not inputs.get("llm_allowed"):
        meta["llm_skipped"] = "patient has not allowed AI processing"
    return {
        **brief,
        "narrative": narrative,
        "notice": "Computed from what the patient shared. Check the record before acting on it.",
        "_meta": meta,
    }
