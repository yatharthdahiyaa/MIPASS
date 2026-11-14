"""Draft impression for a doctor's study, from the AI screen's own scores.

Input: study {modality, analyzer_name, severity, primary_finding, model_name, findings:
{pathologies: [{name, probability, threshold, positive}], positive_findings}}. No patient details
and no indication text: the backend keeps those.

The draft is rule-based, and deliberately so. Each finding above the model's threshold becomes an
impression line with graded certainty ("consistent with", "suspicious for", "possible"), findings
just under the threshold are listed for the doctor to check, and common follow-up suggestions are
offered separately.

No language model is used. One was tried (evals/run_live.py, Nov 2026): without the image it can
only reshuffle these lines, and it produced worse text ("Cardiomegaly consistent with
cardiomegaly"). The prose of a report has to come from someone who has looked at the film.
"""

from __future__ import annotations

from . import findings as F

BORDERLINE = 0.85  # score / threshold


def build(study: dict) -> dict:
    pathologies = (study.get("findings") or {}).get("pathologies") or []
    flagged, borderline = [], []
    devices = False
    for p in pathologies:
        prob, thr = p.get("probability"), p.get("threshold")
        if prob is None or not thr:
            continue
        grade = F.certainty(prob, thr)
        if p["name"] in F.NON_PATHOLOGY:
            if grade:
                devices = True
            continue
        item = {"finding": p["name"], "wording": F.wording(p["name"]), "probability": round(prob, 3), "threshold": round(thr, 3)}
        if grade:
            flagged.append({**item, "certainty": grade})
        elif prob / thr >= BORDERLINE:
            borderline.append(item)
    flagged.sort(key=lambda x: x["probability"] / x["threshold"], reverse=True)

    impression = [f"{i}. Appearances {f['certainty']} {f['wording']}." for i, f in enumerate(flagged, 1)]
    if not impression:
        impression = ["1. No abnormality above the screening threshold. Correlate with the image and the clinical picture."]
    recommendations = [F.RECOMMENDATIONS[f["finding"]] for f in flagged if f["finding"] in F.RECOMMENDATIONS]
    if devices:
        impression.append(f"{len(impression) + 1}. Support devices appear to be present.")
        recommendations.append(F.RECOMMENDATIONS["Support Devices"])

    modality = study.get("analyzer_name") or study.get("modality") or "Not stated"
    lines = [f"Technique: {modality}.", "", "Impression:", *impression]
    if recommendations:
        lines += ["", "Recommendations:", *[f"- {r}" for r in recommendations]]
    return {
        "draft": "\n".join(lines),
        "flagged": flagged,
        "borderline": borderline,
        "recommendations": recommendations,
    }


def run(inputs: dict) -> dict:
    study = (inputs.get("input") or {}).get("study") or {}
    return {
        **build(study),
        "notice": "Draft from the AI screen. Check it against the image and edit it before signing.",
        "_meta": {"llm_used": False, "llm_model": None, "guard": None},
    }
