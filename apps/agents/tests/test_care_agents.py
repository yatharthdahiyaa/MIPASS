"""Behaviour of the care agents: rule-based output, the safety check, and the model path (with a fake model).

These are the agents' test cases. Every change to a prompt, a rule or a threshold should keep them
passing, and a new failure mode found in use should become a case here.
"""

import json

import pytest

from CareAgents import consult_brief, guard, llm, report_draft, report_explainer


def _logs(*bps, glucose=None):
    out = []
    for i, (s, d) in enumerate(bps):
        out.append(
            {
                "log_date": f"2026-11-{i + 1:02d}",
                "systolic": s,
                "diastolic": d,
                "heart_rate": 72,
                "glucose": glucose,
                "glucose_context": "fasting" if glucose else None,
                "spo2": 97,
                "temperature_c": None,
                "weight_kg": 64.0,
                "symptoms": [],
            }
        )
    return out


@pytest.fixture
def fake_model(monkeypatch):
    """Replace the language model: tests set `fake_model.reply` to what it 'says'."""

    class Fake:
        reply: dict = {}
        calls: list = []

    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "model_name", lambda: "fake-model")

    def complete(instructions, payload):
        Fake.calls.append(payload)
        return Fake.reply

    monkeypatch.setattr(llm, "complete_json", complete)
    Fake.calls = []
    return Fake


# --------------------------------------------------------------------------- guard


@pytest.mark.parametrize(
    "text",
    [
        "Take 5 mg of amlodipine every morning.",
        "You should stop your tablets until you see the doctor.",
        "You have pneumonia.",
        "There is nothing to worry about.",
        "Read more at https://example.org",
        "Your heart is 18 cm wide.",  # a number the report doesn't have
    ],
)
def test_guard_blocks_unsafe_patient_text(text):
    assert guard.check(text, "Mild cardiomegaly. No effusion.", audience="patient") is not None


def test_guard_allows_a_faithful_explanation():
    text = (
        "The report says the heart looks larger than usual. There is no fluid around the lungs. "
        "Your doctor can explain what this means for you."
    )
    assert guard.check(text, "Mild cardiomegaly. No effusion.", audience="patient") is None


@pytest.mark.parametrize(
    "text",
    [
        "Your doctor will weigh this against any symptoms you have.",
        "Write down the questions you have for your doctor.",
        "If you have chest pain, tell your doctor.",
    ],
)
def test_guard_allows_you_have_when_it_is_not_a_diagnosis(text):
    assert guard.check(text, "Mild cardiomegaly.", audience="patient") is None


def test_guard_still_blocks_a_reported_diagnosis():
    assert guard.check("The report says that you have pneumonia.", "Pneumonia.", audience="patient") == "states a diagnosis"


def test_guard_checks_the_english_version_and_indic_digits():
    # Devanagari digits that are not in the source
    assert guard.check("दिल का आकार १८ सेमी है।", "Mild cardiomegaly.", audience="patient", english="The heart is 18 cm.")
    # The English version carries the unsafe claim even if the translation looks harmless
    assert guard.check("रिपोर्ट में दिल बड़ा दिखता है।", "Mild cardiomegaly.", audience="patient", english="You have heart disease.")


def test_guard_numbers_for_clinicians():
    facts = "Blood pressure averaged 134/84 mmHg"
    assert guard.check("BP averaged 134/84.", facts, audience="doctor") is None
    assert guard.check("BP averaged 150/95.", facts, audience="doctor") == "numbers not in the record: 150, 95"


# --------------------------------------------------------------------------- consult brief


def test_brief_flags_what_needs_attention():
    data = {
        "days": 30,
        "scopes": ["vitals", "medications", "profile"],
        "patient": {"age": 40, "sex": "female"},
        "profile": {"conditions": "Hypertension", "allergies": "Penicillin"},
        "vitals": {"logs": _logs((128, 82), (142, 91), (150, 95), (131, 84))},
        "medications": {
            "items": [{"name": "Amlodipine", "dosage": "5 mg", "times": ["08:00"], "is_active": True}],
            "adherence_7d": {"taken": 3, "scheduled": 7, "rate": 0.43, "days": 7},
        },
        "consult": {"reason": "Blood pressure follow-up", "mode": "video", "scheduled_at": "2026-11-14T10:00:00+00:00"},
        "unread_messages": 2,
    }
    out = consult_brief.run({"input": data, "llm_allowed": False})
    attention = " ".join(out["attention"])
    assert "140/90 on 2 of 4" in attention
    assert "43%" in attention and "Penicillin" in attention and "2 unread messages" in attention
    titles = [s["title"] for s in out["sections"]]
    assert titles[:2] == ["Reason for the consultation", "Needs attention"]
    assert "Not shared with you" in titles  # documents and X-rays weren't shared
    assert out["narrative"] is None and out["_meta"]["llm_used"] is False


def test_brief_with_nothing_recorded_says_so():
    out = consult_brief.run({"input": {"days": 30, "scopes": ["vitals"], "vitals": {"logs": []}}, "llm_allowed": False})
    assert out["attention"] == []
    assert any("No check-ins" in i for s in out["sections"] for i in s["items"])


def test_brief_narrative_is_kept_only_when_faithful(fake_model):
    data = {"days": 30, "scopes": ["vitals"], "vitals": {"logs": _logs((150, 95), (152, 96))}}
    fake_model.reply = {"narrative": "Blood pressure was at or above 140/90 on 2 of 2 check-ins."}
    ok = consult_brief.run({"input": data, "llm_allowed": True})
    assert ok["narrative"] and ok["_meta"] == {"llm_used": True, "llm_model": "fake-model", "guard": None}

    fake_model.reply = {"narrative": "Blood pressure peaked at 190/120; start a second agent."}
    withheld = consult_brief.run({"input": data, "llm_allowed": True})
    assert withheld["narrative"] is None and withheld["_meta"]["guard"].startswith("numbers not in the record")
    assert withheld["attention"]  # the rule-based brief is still there


def test_brief_withholds_an_invented_absence(fake_model):
    data = {"days": 30, "scopes": ["vitals"], "vitals": {"logs": _logs((118, 76), (116, 74))}}
    fake_model.reply = {"narrative": "Blood pressure averaged 117/75 mmHg. No allergies were listed."}
    out = consult_brief.run({"input": data, "llm_allowed": True})
    assert out["narrative"] is None and "claims an absence" in out["_meta"]["guard"]


def test_brief_never_calls_the_model_without_consent(fake_model):
    consult_brief.run({"input": {"days": 30, "scopes": []}, "llm_allowed": False})
    assert fake_model.calls == []


# --------------------------------------------------------------------------- report draft

STUDY = {
    "analyzer_name": "Chest X-ray",
    "findings": {
        "pathologies": [
            {"name": "Cardiomegaly", "probability": 0.82, "threshold": 0.5, "positive": True},
            {"name": "Effusion", "probability": 0.5, "threshold": 0.4, "positive": True},
            {"name": "Nodule", "probability": 0.31, "threshold": 0.35, "positive": False},
            {"name": "Pneumothorax", "probability": 0.02, "threshold": 0.3, "positive": False},
        ]
    },
}


def test_draft_grades_certainty_and_lists_borderline():
    out = report_draft.run({"input": {"study": STUDY}, "llm_allowed": False})
    assert "1. Appearances consistent with cardiomegaly." in out["draft"]
    assert "2. Appearances suspicious for pleural effusion." in out["draft"]
    assert [b["finding"] for b in out["borderline"]] == ["Nodule"]
    assert "pneumothorax" not in out["draft"].lower()


def test_draft_reads_chexpert_labels_and_keeps_devices_out_of_findings():
    study = {"findings": {"pathologies": [
        {"name": "Pleural Effusion", "probability": 0.81, "threshold": 0.45, "positive": True},
        {"name": "Lung Opacity", "probability": 0.62, "threshold": 0.53, "positive": True},
        {"name": "Support Devices", "probability": 0.9, "threshold": 0.58, "positive": True},
        {"name": "Edema", "probability": 0.30, "threshold": 0.33, "positive": False},
    ]}}
    out = report_draft.run({"input": {"study": study}, "llm_allowed": False})
    assert "1. Appearances consistent with pleural effusion." in out["draft"]
    assert "2. Appearances suspicious for pulmonary opacity." in out["draft"]
    assert "3. Support devices appear to be present." in out["draft"]
    assert [f["finding"] for f in out["flagged"]] == ["Pleural Effusion", "Lung Opacity"]
    assert [b["finding"] for b in out["borderline"]] == ["Edema"]
    assert "Confirm the position of lines and tubes on the image." in out["recommendations"]


def test_draft_with_nothing_flagged():
    study = {"findings": {"pathologies": [{"name": "Mass", "probability": 0.01, "threshold": 0.4, "positive": False}]}}
    out = report_draft.run({"input": {"study": study}, "llm_allowed": False})
    assert "No abnormality above the screening threshold" in out["draft"] and out["flagged"] == []


def test_draft_never_uses_a_model(fake_model):
    out = report_draft.run({"input": {"study": STUDY}, "llm_allowed": True})
    assert fake_model.calls == [] and out["_meta"]["llm_used"] is False
    assert out["draft"].startswith("Technique: Chest X-ray.")


def test_brief_separates_fast_and_slow_heart_rates():
    logs = _logs((120, 80), (120, 80), (120, 80))
    logs[0]["heart_rate"], logs[1]["heart_rate"], logs[2]["heart_rate"] = 108, 46, 72
    out = consult_brief.run({"input": {"days": 30, "scopes": ["vitals"], "vitals": {"logs": logs}}, "llm_allowed": False})
    attention = " ".join(out["attention"])
    assert "above 100 bpm on 1 of 3 check-ins (highest 108)" in attention
    assert "below 50 bpm on 1 of 3 check-ins (lowest 46)" in attention


def test_brief_does_not_cry_wolf_when_the_dose_checklist_is_unused():
    meds = {"items": [{"name": "Amlodipine", "dosage": "5 mg", "times": ["08:00"], "is_active": True}],
            "adherence_7d": {"taken": 0, "scheduled": 7, "rate": 0.0, "days": 7},
            "adherence_30d": {"taken": 0, "scheduled": 30, "rate": 0.0, "days": 30}}
    out = consult_brief.run({"input": {"days": 30, "scopes": ["medications"], "medications": meds}, "llm_allowed": False})
    attention = " ".join(out["attention"])
    assert "may not be using the dose checklist" in attention and "Only 0%" not in attention


def test_plain_normalises_typography():
    assert guard.plain("an 8\u202fmm nodule, follow\u2011up in 6\u00a0weeks") == "an 8 mm nodule, follow-up in 6 weeks"


# --------------------------------------------------------------------------- report explainer

REPORT = {
    "impression": "1. Mild cardiomegaly.\n2. Small left pleural effusion. Correlate clinically.",
    "severity": "MODERATE",
    "findings": {"positive_findings": ["Cardiomegaly", "Effusion"]},
}


def test_explainer_terms_and_questions_without_a_model():
    out = report_explainer.run({"input": {"report": REPORT, "language": "en"}, "llm_allowed": False})
    terms = {t["term"]: t["meaning"] for t in out["terms"]}
    assert {"cardiomegaly", "pleural effusion", "correlate clinically"} <= set(terms)
    assert out["summary"] is None and out["attention"] is None
    assert len(out["questions"]) <= 5 and any("cardiomegaly" in q for q in out["questions"])


def test_explainer_points_to_the_doctor_for_serious_reports():
    out = report_explainer.run({"input": {"report": {**REPORT, "severity": "CRITICAL"}}, "llm_allowed": False})
    assert "contact them" in out["attention"] and "112" in out["attention"]


def test_explainer_summary_in_hindi_checked_in_english(fake_model):
    fake_model.reply = {
        "summary": "रिपोर्ट के अनुसार दिल सामान्य से थोड़ा बड़ा दिखता है।",
        "summary_en": "The report says the heart looks a little larger than usual. Your doctor can explain what it means for you.",
    }
    out = report_explainer.run({"input": {"report": REPORT, "language": "hi"}, "llm_allowed": True})
    assert out["summary"].startswith("रिपोर्ट") and out["_meta"]["guard"] is None

    fake_model.reply = {"summary": "आपको दिल की बीमारी है।", "summary_en": "You have heart disease."}
    out = report_explainer.run({"input": {"report": REPORT, "language": "hi"}, "llm_allowed": True})
    assert out["summary"] is None and out["_meta"]["guard"] == "states a diagnosis"
    assert out["terms"]  # still useful without the summary


def test_explainer_sends_the_model_only_the_impression(fake_model):
    fake_model.reply = {"summary": "The report says the heart looks larger than usual. Your doctor can explain it."}
    report_explainer.run({"input": {"report": REPORT, "language": "en"}, "llm_allowed": True})
    sent = json.loads(fake_model.calls[-1])
    assert set(sent) == {"REPORT", "LANGUAGE"}
