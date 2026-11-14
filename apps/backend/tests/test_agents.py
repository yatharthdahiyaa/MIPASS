"""AI agents through the API: consent, minimisation, permissions, the kill switch, reviews and measurement.

The agents service runs in-process: its real code (apps/agents/CareAgents) is called instead of
an HTTP request, so these tests exercise both the gateway and the agents.
"""

import json
import sys
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from tests.conftest import PASSWORD, login, make_admin, register, unwrap

AGENTS_DIR = Path(__file__).resolve().parents[2] / "agents"


@pytest.fixture
def agents_service(app, monkeypatch):
    """Route agent runs to the real agents code, in-process; record what the backend sent."""
    if str(AGENTS_DIR) not in sys.path:
        sys.path.insert(0, str(AGENTS_DIR))
    from CareAgents import consult_brief, llm, report_draft, report_explainer

    from app.services import agents

    modules = {"consult_brief": consult_brief, "report_draft": report_draft, "report_explainer": report_explainer}
    sent: list[tuple[str, dict]] = []

    def call(key, body):
        sent.append((key, json.loads(json.dumps(body))))
        return modules[key].run(body)

    monkeypatch.setenv("AGENTS_URL", "http://agents.test")
    monkeypatch.delenv("AGENTS_DISABLED", raising=False)
    monkeypatch.setattr(agents, "_call_agents_service", call)
    # No real model in tests: rules only, unless a test fakes one.
    monkeypatch.setattr(llm, "available", lambda: False)
    app.config["AGENTS_INLINE"] = True
    yield sent
    app.config.pop("AGENTS_INLINE", None)


def _connect(client, patient_email, doctor_email, doctor_user, scopes):
    assert login(client, patient_email).status_code == 200
    res = client.post(
        "/api/v1/patient/care-team/invite",
        json={"doctor_code": doctor_user["clinician"]["share_code"], "scopes": scopes},
    )
    link = unwrap(res)["data"]["link"]
    client.post("/api/v1/auth/logout")
    assert login(client, doctor_email).status_code == 200
    client.post(f"/api/v1/doctor/patients/{link['id']}/respond", json={"accept": True})
    client.post("/api/v1/auth/logout")
    return link


def _run(client, key, params):
    res = client.post(f"/api/v1/agents/{key}/runs", json={"params": params})
    return res, (unwrap(res).get("data") or {}).get("run")


def _study(doctor_id, patient_id=None, *, signed=False, impression=None):
    from app.database.models.doctor_panel import DoctorStudy
    from app.database.session import get_db

    findings = {
        "pathologies": [
            {"name": "Cardiomegaly", "probability": 0.82, "threshold": 0.5, "positive": True},
            {"name": "Effusion", "probability": 0.2, "threshold": 0.4, "positive": False},
        ],
        "positive_findings": ["Cardiomegaly"],
    }
    with get_db() as db:
        study = DoctorStudy(
            user_id=doctor_id,
            patient_name="Priya Sharma",  # must never reach an agent
            patient_ref="MRN-0042",
            clinical_notes="Priya Sharma, 9876543210, breathless on stairs",
            original_filename="cxr.png",
            content_type="image/png",
            size_bytes=10,
            sha256="0" * 64,
            storage_path="x/cxr.png",
            analyzer_id="chest_xray",
            modality="CXR",
            status="completed",
            severity="HIGH",
            primary_finding="Cardiomegaly",
            model_name="DenseNet-121",
            findings_json=json.dumps(findings),
            patient_user_id=patient_id,
            impression=impression,
            report_status="signed" if signed else "draft",
            signed_at=datetime.now(UTC) if signed else None,
            signed_by="Dr Test" if signed else None,
        )
        db.add(study)
        db.flush()
        return study.id


def test_assistant_reads_the_record_only_with_consent(client, agents_service, patient):
    email, user = patient
    assert login(client, email).status_code == 200
    client.put("/api/v1/patient/profile", json={"date_of_birth": "1986-04-12", "phone": "+91 98765 43210", "allergies": "Penicillin"})
    client.post("/api/v1/patient/logs", json={"systolic": 150, "diastolic": 95, "notes": "felt dizzy at Priya's wedding"})

    res = client.get("/api/v1/agents/context/patient?section=overview")
    assert res.status_code == 409 and unwrap(res)["error"]["type"] == "consent_required"

    state = unwrap(client.put("/api/v1/agents/consent", json={"allow": True}))["data"]
    assert state["consented"] is True and state["provider_notice"]
    overview = unwrap(client.get("/api/v1/agents/context/patient?section=overview"))["data"]
    vitals = unwrap(client.get("/api/v1/agents/context/patient?section=vitals"))["data"]
    text = json.dumps([overview, vitals])
    assert overview["profile"]["allergies"] == "Penicillin" and overview["profile"]["age"] is not None
    assert vitals["logs"][0]["systolic"] == 150
    for secret in ("1986-04-12", "98765", email, "wedding", user["name"]):
        assert secret not in text

    listing = unwrap(client.get("/api/v1/agents"))["data"]
    assert [a["key"] for a in listing["agents"]] == ["record_assistant", "report_explainer"]

    unwrap(client.put("/api/v1/agents/consent", json={"allow": False}))
    assert client.get("/api/v1/agents/context/patient?section=vitals").status_code == 409


def test_consult_brief_respects_scopes_and_consent(client, agents_service, patient, doctor):
    patient_email, patient_user = patient
    doctor_email, doctor_user = doctor
    link = _connect(client, patient_email, doctor_email, doctor_user, ["vitals", "profile"])

    assert login(client, patient_email).status_code == 200
    today = date.today()
    for i, (s, d) in enumerate([(150, 95), (148, 92), (132, 84)]):
        client.post("/api/v1/patient/logs", json={"systolic": s, "diastolic": d, "log_date": (today - timedelta(days=i)).isoformat(), "notes": "private note"})
    client.put("/api/v1/patient/profile", json={"conditions": "Hypertension", "phone": "+91 98765 43210"})
    consult = unwrap(client.post("/api/v1/patient/consults", json={"link_id": link["id"], "reason": "BP check", "mode": "video"}))["data"]["consult"]
    client.post("/api/v1/auth/logout")

    assert login(client, doctor_email).status_code == 200
    res, run = _run(client, "consult_brief", {"link_id": link["id"], "consult_id": consult["id"]})
    assert res.status_code == 202 and run["status"] == "succeeded", run
    out = run["output"]
    assert any("140/90 on 2 of 3" in a for a in out["attention"])
    assert out["sections"][0]["title"] == "Reason for the consultation"
    assert run["llm_used"] is False  # the patient hasn't consented

    key, body = agents_service[-1]
    assert key == "consult_brief" and body["llm_allowed"] is False
    sent = json.dumps(body)
    for secret in (patient_email, patient_user["name"], "98765", "private note"):
        assert secret not in sent
    assert "medications" not in body["input"] and "xrays" not in body["input"]  # not shared

    # someone else can't read the run; the doctor can review it
    rid = run["id"]
    assert unwrap(client.post(f"/api/v1/agents/runs/{rid}/review", json={"decision": "accepted"}))["data"]["run"]["review_decision"] == "accepted"
    client.post("/api/v1/auth/logout")
    assert login(client, patient_email).status_code == 200
    assert client.get(f"/api/v1/agents/runs/{rid}").status_code == 404
    assert _run(client, "consult_brief", {"link_id": link["id"]})[0].status_code == 403  # wrong audience
    # with consent, the model may see the minimised input
    client.put("/api/v1/agents/consent", json={"allow": True})
    client.post("/api/v1/auth/logout")
    assert login(client, doctor_email).status_code == 200
    _run(client, "consult_brief", {"link_id": link["id"]})
    assert agents_service[-1][1]["llm_allowed"] is True


def test_consult_brief_needs_an_active_link_of_this_doctor(client, agents_service, patient, doctor):
    patient_email, _ = patient
    doctor_email, doctor_user = doctor
    link = _connect(client, patient_email, doctor_email, doctor_user, ["vitals"])
    other_email, _ = register(client, "doctor", license_number="MCI-99999", specialty="Cardiology")
    assert login(client, other_email).status_code == 200
    assert _run(client, "consult_brief", {"link_id": link["id"]})[0].status_code == 403  # unverified doctor
    assert login(client, patient_email).status_code == 200
    client.delete(f"/api/v1/patient/care-team/{link['id']}")
    assert login(client, doctor_email).status_code == 200
    res, _ = _run(client, "consult_brief", {"link_id": link["id"]})
    assert res.status_code == 409  # link ended


def test_report_draft_uses_findings_only(client, agents_service, doctor):
    doctor_email, doctor_user = doctor
    study_id = _study(doctor_user["id"])
    assert login(client, doctor_email).status_code == 200
    res, run = _run(client, "report_draft", {"study_id": study_id})
    assert run["status"] == "succeeded", run
    assert "Appearances consistent with cardiomegaly." in run["output"]["draft"]
    sent = json.dumps(agents_service[-1][1])
    for secret in ("Priya", "MRN-0042", "9876543210", "breathless"):
        assert secret not in sent
    assert agents_service[-1][1]["llm_allowed"] is False  # not linked to a consenting patient

    review = unwrap(client.post(f"/api/v1/agents/runs/{run['id']}/review", json={"decision": "edited", "final_text": "1. Mild cardiomegaly."}))
    assert review["data"]["run"]["review_decision"] == "edited"
    assert client.post(f"/api/v1/agents/runs/{run['id']}/review", json={"decision": "maybe"}).status_code == 400

    signed_id = _study(doctor_user["id"], signed=True, impression="Done.")
    assert _run(client, "report_draft", {"study_id": signed_id})[0].status_code == 409
    assert _run(client, "report_draft", {"study_id": str(uuid.uuid4())})[0].status_code == 404


def test_report_explainer_only_for_reports_shared_with_the_patient(client, agents_service, patient, doctor):
    patient_email, patient_user = patient
    doctor_email, doctor_user = doctor
    shared = _study(doctor_user["id"], patient_user["id"], signed=True, impression="1. Mild cardiomegaly. Correlate clinically.")
    unsigned = _study(doctor_user["id"], patient_user["id"])
    assert login(client, patient_email).status_code == 200

    res, run = _run(client, "report_explainer", {"report_id": shared, "language": "hi"})
    assert run["status"] == "succeeded", run
    terms = {t["term"] for t in run["output"]["terms"]}
    assert {"cardiomegaly", "correlate clinically"} <= terms
    assert run["output"]["attention"]  # the report is marked HIGH
    body = agents_service[-1][1]
    assert body["input"]["language"] == "hi" and "patient_name" not in json.dumps(body)

    assert _run(client, "report_explainer", {"report_id": unsigned})[0].status_code == 404
    assert login(client, doctor_email).status_code == 200
    assert _run(client, "report_explainer", {"report_id": shared})[0].status_code == 403


def test_kill_switch_and_missing_service(client, agents_service, monkeypatch, doctor):
    doctor_email, doctor_user = doctor
    study_id = _study(doctor_user["id"])
    assert login(client, doctor_email).status_code == 200
    monkeypatch.setenv("AGENTS_DISABLED", "report_draft")
    res, _ = _run(client, "report_draft", {"study_id": study_id})
    assert res.status_code == 503 and unwrap(res)["error"]["type"] == "agent_disabled"
    listing = {a["key"]: a["enabled"] for a in unwrap(client.get("/api/v1/agents"))["data"]["agents"]}
    assert listing == {"consult_brief": True, "report_draft": False}
    monkeypatch.delenv("AGENTS_DISABLED")
    monkeypatch.setenv("AGENTS_URL", "")  # explicitly off
    assert _run(client, "report_draft", {"study_id": study_id})[0].status_code == 503
    assert _run(client, "unknown_agent", {})[0].status_code == 404


def test_admin_sees_agent_measurement(client, agents_service, doctor):
    doctor_email, doctor_user = doctor
    study_id = _study(doctor_user["id"])
    assert login(client, doctor_email).status_code == 200
    _, run = _run(client, "report_draft", {"study_id": study_id})
    client.post(f"/api/v1/agents/runs/{run['id']}/review", json={"decision": "discarded"})
    assert client.get("/api/v1/admin/agents").status_code == 403
    client.post("/api/v1/auth/logout")

    assert login(client, make_admin(client)).status_code == 200
    data = unwrap(client.get("/api/v1/admin/agents"))["data"]
    draft = next(a for a in data["agents"] if a["key"] == "report_draft")
    assert draft["runs"] >= 1 and draft["discarded"] >= 1 and data["service_configured"] is True


def test_patient_deletion_removes_runs_about_them(client, agents_service, patient):
    from app.database.models.agents import AgentRun
    from app.database.session import get_db

    email, user = patient
    assert login(client, email).status_code == 200
    client.put("/api/v1/agents/consent", json={"allow": True})
    client.get("/api/v1/agents/context/patient?section=overview")
    with get_db() as db:
        assert db.query(AgentRun).filter_by(subject_id=user["id"]).count() == 1
    assert client.delete("/api/v1/auth/account", json={"password": PASSWORD}).status_code == 200
    with get_db() as db:
        assert db.query(AgentRun).filter_by(subject_id=user["id"]).count() == 0
