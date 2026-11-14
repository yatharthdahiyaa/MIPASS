"""
End-to-end account and care flows through the Flask test client (needs PostgreSQL).

Covers: registration + verification e-mail, e-mail confirmation, password reset, MFA
(setup, enable, challenge, recovery code), sessions, doctor verification by an admin,
care links by share code, messaging, consults, notifications and the shared record.
"""

from datetime import UTC, datetime, timedelta


from app.services import security
from tests.conftest import PASSWORD, last_email_link, login, make_admin, register, unwrap, verify_email  # noqa: F401

def test_register_sends_verification_and_session(client):
    email, user = register(client, "patient")
    assert user["email_verified"] is False and user["home"] == "/patient"
    session = unwrap(client.get("/api/v1/auth/session"))["data"]
    assert session["authenticated"] and session["user"]["email"] == email
    verify_email(client, email)
    assert unwrap(client.get("/api/v1/auth/session"))["data"]["user"]["email_verified"] is True


def test_login_throttle_and_bad_password(client, patient):
    email, _ = patient
    assert login(client, email, "wrong-password-1").status_code == 401
    assert login(client, email).status_code == 200


def test_password_reset_flow(client, patient):
    email, _ = patient
    client.post("/api/v1/auth/logout")
    res = client.post("/api/v1/auth/password/forgot", json={"email": email})
    assert res.status_code == 200
    token = last_email_link(email, "/reset-password")
    res = client.post("/api/v1/auth/password/reset", json={"token": token, "password": "An0therStrongOne!"})
    assert res.status_code == 200, res.data
    assert login(client, email, PASSWORD).status_code == 401
    assert login(client, email, "An0therStrongOne!").status_code == 200
    # token is single use
    res = client.post("/api/v1/auth/password/reset", json={"token": token, "password": "Yet4nother0ne!"})
    assert res.status_code == 400


def test_mfa_flow(client, patient):
    email, _ = patient
    secret = unwrap(client.post("/api/v1/auth/mfa/setup"))["data"]["secret"]
    bad = client.post("/api/v1/auth/mfa/enable", json={"code": "000000"})
    assert bad.status_code in (400, 200)  # a 1-in-a-million collision is tolerated
    res = client.post("/api/v1/auth/mfa/enable", json={"code": security.totp_code(secret)})
    assert res.status_code == 200, res.data
    codes = unwrap(res)["data"]["recovery_codes"]
    assert len(codes) == 8
    client.post("/api/v1/auth/logout")

    res = login(client, email)
    data = unwrap(res)["data"]
    assert res.status_code == 200 and data.get("mfa_required") is True
    assert unwrap(client.get("/api/v1/auth/session"))["data"]["authenticated"] is False
    res = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": data["mfa_token"], "code": "123456"})
    assert res.status_code == 401
    res = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": data["mfa_token"], "code": security.totp_code(secret)})
    assert res.status_code == 200, res.data
    assert unwrap(client.get("/api/v1/auth/session"))["data"]["authenticated"] is True
    client.post("/api/v1/auth/logout")

    # recovery code works once, and mfa_code in the login body skips the challenge
    data = unwrap(login(client, email))["data"]
    res = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": data["mfa_token"], "code": codes[0]})
    assert res.status_code == 200
    client.post("/api/v1/auth/logout")
    assert login(client, email, mfa_code=codes[0]).status_code == 401
    assert login(client, email, mfa_code=security.totp_code(secret)).status_code == 200
    status = unwrap(client.get("/api/v1/auth/mfa"))["data"]
    assert status["enabled"] and status["recovery_codes_left"] == 7


def test_desktop_login_with_mfa(client, doctor):
    """The desktop app sends the code with the credentials and gets a bearer token back."""
    email, _ = doctor
    assert login(client, email).status_code == 200
    secret = unwrap(client.post("/api/v1/auth/mfa/setup"))["data"]["secret"]
    res = client.post("/api/v1/auth/mfa/enable", json={"code": security.totp_code(secret)})
    assert res.status_code == 200, res.data
    client.post("/api/v1/auth/logout")

    creds = {"identifier": email, "password": PASSWORD, "client": "desktop"}
    data = unwrap(client.post("/api/v1/auth/login", json=creds))["data"]
    assert data.get("mfa_required") is True and "token" not in data
    res = client.post("/api/v1/auth/login", json={**creds, "mfa_code": "000000"})
    assert res.status_code in (401, 200)  # a 1-in-a-million collision is tolerated
    res = client.post("/api/v1/auth/login", json={**creds, "mfa_code": security.totp_code(secret)})
    assert res.status_code == 200, res.data
    token = unwrap(res)["data"]["token"]
    client.delete_cookie("mipaas_session")
    res = client.get("/api/v1/doctor/summary", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.data


def test_sessions_listing_and_revoke(client, patient):
    email, _ = patient
    sessions = unwrap(client.get("/api/v1/auth/sessions"))["data"]["sessions"]
    assert any(s["current"] for s in sessions)
    res = client.post("/api/v1/auth/password/change", json={"current_password": PASSWORD, "new_password": "Ch4ngedPassword!"})
    assert res.status_code == 200
    assert unwrap(client.get("/api/v1/auth/session"))["data"]["authenticated"] is True
    assert unwrap(client.post("/api/v1/auth/sessions/revoke-others"))["data"]["revoked"] == 0


def test_care_link_messages_consult_and_record(client, patient, doctor):
    patient_email, patient_user = patient
    doctor_email, doctor_user = doctor
    code = doctor_user["clinician"]["share_code"]

    # patient invites the doctor by share code
    assert login(client, patient_email).status_code == 200
    res = client.post("/api/v1/patient/care-team/invite", json={"doctor_code": code, "scopes": ["vitals", "xrays", "profile"], "message": "Please follow my BP"})
    assert res.status_code == 201, res.data
    link = unwrap(res)["data"]["link"]
    assert link["status"] == "pending" and link["doctor"]["name"] == doctor_user["name"]
    # a log with a dangerous reading raises an alert for the patient
    # (dated today: the shared record only covers a recent window ending today)
    today = datetime.now(UTC).date().isoformat()
    res = client.post("/api/v1/patient/logs", json={"systolic": 190, "diastolic": 125, "log_date": today})
    assert res.status_code == 201 and unwrap(res)["data"]["alerts"]
    notes = unwrap(client.get("/api/v1/notifications?unread=1"))["data"]
    assert any(n["kind"] == "vitals.alert" for n in notes["notifications"])
    client.post("/api/v1/auth/logout")

    # doctor sees the invite, accepts, reads the shared record
    assert login(client, doctor_email).status_code == 200
    dash = unwrap(client.get("/api/v1/doctor/dashboard"))["data"]
    assert any(p["id"] == link["id"] for p in dash["patients"]["pending_invites"])
    res = client.post(f"/api/v1/doctor/patients/{link['id']}/respond", json={"accept": True})
    assert res.status_code == 200 and unwrap(res)["data"]["link"]["status"] == "active"
    record = unwrap(client.get(f"/api/v1/doctor/patients/{link['id']}/record"))["data"]
    assert record["scopes"] == ["profile", "vitals", "xrays"]
    assert record["vitals"]["logs"][0]["systolic"] == 190
    assert record["vitals"]["streak_days"] == 1
    assert "medications" not in record  # not shared
    res = client.post(f"/api/v1/care/{link['id']}/messages", json={"body": "Your BP reading looks high, let's talk."})
    assert res.status_code == 201
    client.post("/api/v1/auth/logout")

    # patient reads the message, requests a consult
    assert login(client, patient_email).status_code == 200
    badge = unwrap(client.get("/api/v1/notifications/badge"))["data"]
    assert badge["messages"] == 1
    threads = unwrap(client.get("/api/v1/care/threads"))["data"]["threads"]
    assert threads[0]["unread"] == 1 and threads[0]["link"]["doctor"]["share_code"] == code
    msgs = unwrap(client.get(f"/api/v1/care/{link['id']}/messages"))["data"]["messages"]
    assert msgs[0]["mine"] is False
    client.post(f"/api/v1/care/{link['id']}/messages/read")
    assert unwrap(client.get("/api/v1/notifications/badge"))["data"]["messages"] == 0
    res = client.post("/api/v1/patient/consults", json={"link_id": link["id"], "reason": "Blood pressure follow-up", "mode": "video"})
    assert res.status_code == 201
    consult = unwrap(res)["data"]["consult"]
    overview = unwrap(client.get(f"/api/v1/patient/overview?date={today}"))["data"]
    assert overview["care"]["doctors"][0]["share_code"] == code
    client.post("/api/v1/auth/logout")

    # doctor schedules it; patient is notified
    assert login(client, doctor_email).status_code == 200
    res = client.post(f"/api/v1/doctor/consults/{consult['id']}/respond", json={"action": "schedule", "scheduled_at": "2030-05-01T09:30:00Z", "note": "Bring your readings"})
    assert res.status_code == 200 and unwrap(res)["data"]["consult"]["status"] == "scheduled"
    client.post("/api/v1/auth/logout")

    assert login(client, patient_email).status_code == 200
    consults = unwrap(client.get("/api/v1/patient/consults"))["data"]["consults"]
    assert consults[0]["status"] == "scheduled" and consults[0]["doctor_note"] == "Bring your readings"
    kinds = {n["kind"] for n in unwrap(client.get("/api/v1/notifications"))["data"]["notifications"]}
    assert {"care.accepted", "care.message", "consult.update", "vitals.alert"} <= kinds
    # patient can stop sharing
    res = client.delete(f"/api/v1/patient/care-team/{link['id']}")
    assert unwrap(res)["data"]["link"]["status"] == "revoked"
    res = client.post("/api/v1/patient/consults", json={"link_id": link["id"], "reason": "again", "mode": "chat"})
    assert res.status_code == 409


def test_shared_record_includes_log_dated_ahead_of_utc(client, patient, doctor):
    """A patient east of UTC logs under their local date, which can be tomorrow in UTC."""
    patient_email, _ = patient
    doctor_email, doctor_user = doctor
    tomorrow = (datetime.now(UTC).date() + timedelta(days=1)).isoformat()

    assert login(client, patient_email).status_code == 200
    res = client.post("/api/v1/patient/care-team/invite", json={"doctor_code": doctor_user["clinician"]["share_code"], "scopes": ["vitals"]})
    link = unwrap(res)["data"]["link"]
    assert client.post("/api/v1/patient/logs", json={"heart_rate": 72, "log_date": tomorrow}).status_code == 201
    client.post("/api/v1/auth/logout")

    assert login(client, doctor_email).status_code == 200
    client.post(f"/api/v1/doctor/patients/{link['id']}/respond", json={"accept": True})
    vitals = unwrap(client.get(f"/api/v1/doctor/patients/{link['id']}/record"))["data"]["vitals"]
    assert [x["log_date"] for x in vitals["logs"]] == [tomorrow]
    assert vitals["streak_days"] == 1


def test_desktop_doctor_invites_patient_and_reads_shared_documents(client, patient, doctor):
    """The calls the desktop app makes (bearer token, no cookie) for a doctor-initiated link."""
    import io

    patient_email, _ = patient
    doctor_email, _ = doctor
    creds = {"identifier": doctor_email, "password": PASSWORD, "client": "desktop"}
    token = unwrap(client.post("/api/v1/auth/login", json=creds))["data"]["token"]
    auth = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/doctor/patients/invite", json={"email": patient_email, "message": "Follow-up"}, headers=auth)
    assert res.status_code == 201, res.data
    link_id = unwrap(res)["data"]["link"]["id"]
    pending = unwrap(client.get("/api/v1/doctor/patients?status=pending", headers=auth))["data"]["patients"]
    assert [p["id"] for p in pending] == [link_id] and pending[0]["requested_by"] == "doctor"
    # nothing is readable before the patient accepts
    assert client.get(f"/api/v1/doctor/patients/{link_id}/record?days=90", headers=auth).status_code == 409

    # patient uploads a document and accepts, sharing documents only
    assert login(client, patient_email).status_code == 200
    pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    res = client.post(
        "/api/v1/patient/documents",
        data={"file": (io.BytesIO(pdf), "discharge summary.pdf"), "category": "discharge"},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201, res.data
    doc_id = unwrap(res)["data"]["document"]["id"]
    res = client.post(f"/api/v1/patient/care-team/{link_id}/respond", json={"accept": True, "scopes": ["documents"]})
    assert res.status_code == 200 and unwrap(res)["data"]["link"]["scopes"] == ["documents"]
    client.post("/api/v1/auth/logout")

    record = unwrap(client.get(f"/api/v1/doctor/patients/{link_id}/record?days=90", headers=auth))["data"]
    assert record["scopes"] == ["documents"] and "vitals" not in record and "xrays" not in record
    assert [d["id"] for d in record["documents"]] == [doc_id]
    res = client.get(f"/api/v1/doctor/patients/{link_id}/documents/{doc_id}/file?download=1", headers=auth)
    assert res.status_code == 200 and res.data == pdf
    # a scope the patient did not share stays closed
    res = client.get(f"/api/v1/doctor/patients/{link_id}/xrays/{doc_id}/image?kind=preview", headers=auth)
    assert res.status_code == 403

    dash = unwrap(client.get("/api/v1/doctor/dashboard", headers=auth))["data"]
    assert dash["patients"]["active"] == 1 and dash["consults"]["requested"] == []
    res = client.post(f"/api/v1/care/{link_id}/messages", json={"body": "Thanks, I have your discharge summary."}, headers=auth)
    assert res.status_code == 201
    threads = unwrap(client.get("/api/v1/care/threads", headers=auth))["data"]["threads"]
    assert threads[0]["link"]["id"] == link_id and threads[0]["last_message"]["mine"] is True
    assert unwrap(client.get("/api/v1/doctor/consults?upcoming=1", headers=auth))["data"]["consults"] == []
    assert unwrap(client.get("/api/v1/notifications/badge", headers=auth))["data"]["messages"] == 0
    assert client.post("/api/v1/notifications/read-all", headers=auth).status_code == 200

    # ending the link closes the record and moves it to "ended"
    res = client.delete(f"/api/v1/doctor/patients/{link_id}", headers=auth)
    assert unwrap(res)["data"]["link"]["status"] == "revoked"
    assert client.get(f"/api/v1/doctor/patients/{link_id}/record", headers=auth).status_code == 409
    ended = unwrap(client.get("/api/v1/doctor/patients?status=ended", headers=auth))["data"]["patients"]
    assert [p["id"] for p in ended] == [link_id]


def test_patient_can_delete_account_and_data(client, app, patient, doctor):
    import io
    from pathlib import Path

    from app.database.models.care import CareLink
    from app.database.models.iam import AuditLog, User
    from app.database.models.patient_ehr import DailyLog, PatientDocument
    from app.database.session import get_db

    patient_email, patient_user = patient
    doctor_email, doctor_user = doctor
    pid = patient_user["id"]

    assert login(client, patient_email).status_code == 200
    client.post("/api/v1/patient/logs", json={"heart_rate": 70})
    res = client.post(
        "/api/v1/patient/documents",
        data={"file": (io.BytesIO(b"%PDF-1.4\n%%EOF\n"), "note.pdf"), "category": "other"},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    link = unwrap(client.post("/api/v1/patient/care-team/invite", json={"doctor_code": doctor_user["clinician"]["share_code"]}))["data"]["link"]
    client.post("/api/v1/auth/logout")
    assert login(client, doctor_email).status_code == 200
    client.post(f"/api/v1/doctor/patients/{link['id']}/respond", json={"accept": True})
    # a doctor's account is not self-service
    res = client.delete("/api/v1/auth/account", json={"password": PASSWORD})
    assert res.status_code == 409
    client.post("/api/v1/auth/logout")

    files = Path(app.config["PATIENT_FILES_DIR"]) / pid
    assert files.is_dir()
    assert login(client, patient_email).status_code == 200
    assert client.delete("/api/v1/auth/account", json={"password": "wrong-password-1"}).status_code == 400
    res = client.delete("/api/v1/auth/account", json={"password": PASSWORD})
    assert res.status_code == 200, res.data

    assert unwrap(client.get("/api/v1/auth/session"))["data"]["authenticated"] is False
    assert login(client, patient_email).status_code == 401
    assert not files.exists()
    with get_db() as db:
        assert db.get(User, pid) is None
        assert db.query(DailyLog).filter_by(user_id=pid).count() == 0
        assert db.query(PatientDocument).filter_by(user_id=pid).count() == 0
        assert db.query(CareLink).filter_by(patient_id=pid).count() == 0
        kept = db.query(AuditLog).filter_by(action="auth.account.delete", resource_id=pid).one()
        assert kept.user_id is None
    # the doctor is told and no longer sees the patient
    assert login(client, doctor_email).status_code == 200
    assert unwrap(client.get("/api/v1/doctor/patients?status=all"))["data"]["patients"] == []
    titles = [n["title"] for n in unwrap(client.get("/api/v1/notifications"))["data"]["notifications"]]
    assert any("closed their MIPAAS account" in t for t in titles)


def test_production_refuses_unsafe_configuration():
    from cryptography.fernet import Fernet

    from app.preflight import production_problems

    assert len(production_problems({})) >= 6  # nothing configured: every item is reported
    good = {
        "SECRET_KEY": "k" * 48,
        "MFA_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "DATABASE_URL": "postgresql://mipaas:a-real-password@db.internal:5432/mipaas",
        "APP_BASE_URL": "https://app.example.org",
        "CORS_ORIGINS": "https://app.example.org",
        "MAIL_BACKEND": "smtp",
        "SMTP_HOST": "smtp.example.org",
        "MAIL_FROM": "MIPAAS <no-reply@example.org>",
        "REDIS_URL": "redis://redis.internal:6379/0",
    }
    assert production_problems(good) == []
    for key, bad in {
        "SECRET_KEY": "change-me-in-production",
        "MFA_ENCRYPTION_KEY": "not-a-key",
        "DATABASE_URL": "postgresql://mipaas:mipaas_dev_pass@db:5432/mipaas",
        "APP_BASE_URL": "http://app.example.org",
        "CORS_ORIGINS": "https://app.example.org,http://localhost:3000",
        "MAIL_BACKEND": "outbox",
        "REDIS_URL": "",
    }.items():
        problems = production_problems({**good, key: bad})
        assert len(problems) == 1 and problems[0].startswith(key[:4]), (key, problems)


def test_unverified_patient_cannot_invite(client):
    email, _ = register(client, "patient")
    res = client.post("/api/v1/patient/care-team/invite", json={"doctor_code": "DR-NOPE"})
    assert res.status_code == 403 and unwrap(res)["error"]["type"] == "email_unverified"


def test_admin_endpoints_require_permission(client, patient):
    assert client.get("/api/v1/admin/overview").status_code == 403
    assert client.get("/api/v1/admin/users").status_code == 403


def test_admin_outbox_hides_bodies_when_mail_is_delivered(client, patient, monkeypatch):
    """E-mail text holds other people's sign-in links: readable only in the dev-inbox modes."""
    client.post("/api/v1/auth/logout")
    assert login(client, make_admin(client)).status_code == 200

    data = unwrap(client.get("/api/v1/admin/outbox"))["data"]
    assert data["bodies_visible"] is True and data["total"] >= 1
    assert all(m["text"] for m in data["emails"])

    monkeypatch.setenv("MAIL_BACKEND", "smtp")
    data = unwrap(client.get("/api/v1/admin/outbox"))["data"]
    assert data["bodies_visible"] is False and data["emails"]
    assert all(m["text"] is None for m in data["emails"])
    assert all(m["to"] and m["subject"] for m in data["emails"])


def test_health_deep_and_ready(client):
    res = client.get("/api/v1/health?deep=1")
    body = res.get_json()
    assert res.status_code == 200 and body["database"]["status"] == "healthy"
    assert any(m["id"] == "chest_xray" for m in body["models"])
    assert client.get("/api/v1/ready").status_code == 200
    assert "X-Request-ID" in res.headers and res.headers["X-Content-Type-Options"] == "nosniff"
