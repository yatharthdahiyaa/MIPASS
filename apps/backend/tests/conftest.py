"""
Shared fixtures.

Route tests need PostgreSQL. They use ``MIPAAS_TEST_DATABASE_URL`` (default: the
``mipaas_test`` database on the local Docker stack) and are skipped when it is unreachable.
Pure-logic tests (security, services without a session) always run.
"""

import os
import re
import tempfile
import uuid
from datetime import UTC, datetime

import pytest

TEST_DB = os.getenv(
    "MIPAAS_TEST_DATABASE_URL",
    "postgresql://mipaas:mipaas_dev_pass@127.0.0.1:5432/mipaas_test",
)


def _db_available() -> bool:
    try:
        from app.database.session import create_db_engine, ensure_database_exists, normalize_url

        ensure_database_exists(normalize_url(TEST_DB))
        engine = create_db_engine(TEST_DB)
        with engine.connect():
            pass
        engine.dispose()
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def app():
    if not _db_available():
        pytest.skip("PostgreSQL test database is not reachable")
    os.environ["DATABASE_URL"] = TEST_DB
    os.environ["MAIL_BACKEND"] = "outbox"
    os.environ.pop("REDIS_URL", None)
    tmp = tempfile.mkdtemp(prefix="mipaas-test-")
    os.environ["PATIENT_FILES_DIR"] = os.path.join(tmp, "patients")
    os.environ["DOCTOR_FILES_DIR"] = os.path.join(tmp, "doctors")

    from app import create_app
    from app.database.session import init_db

    init_db(drop_first=True, db_url=TEST_DB)
    application = create_app("testing")
    application.config["PATIENT_FILES_DIR"] = os.environ["PATIENT_FILES_DIR"]
    application.config["DOCTOR_FILES_DIR"] = os.environ["DOCTOR_FILES_DIR"]
    yield application


@pytest.fixture
def client(app):
    # Every test comes from the same IP: start each with a clean in-memory rate limiter so the
    # per-hour limits (e.g. 10 sign-ups per IP) count within one test, not across the suite.
    from app.services import security

    security._limiter = None
    return app.test_client()


def unwrap(response):
    body = response.get_json()
    assert body is not None, response.data
    return body


def last_email_link(to: str, path: str) -> str:
    """The token from the most recent outbox e-mail to ``to`` whose link contains ``path``."""
    from app.database.models.iam import EmailOutbox
    from app.database.session import get_db

    with get_db() as db:
        rows = (
            db.query(EmailOutbox)
            .filter(EmailOutbox.to_address == to)
            .order_by(EmailOutbox.created_at.desc())
            .all()
        )
        for row in rows:
            match = re.search(path + r"\?token=([A-Za-z0-9_\-]+)", row.text_body)
            if match:
                return match.group(1)
    raise AssertionError(f"no e-mail with {path} link sent to {to}")

# --------------------------------------------------------------------------- accounts

PASSWORD = "Str0ngPassw0rd!"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.test"


def register(client, account_type: str, **extra):
    email = _email(account_type)
    payload = {"name": f"{account_type.title()} Person", "email": email, "password": PASSWORD, "account_type": account_type, **extra}
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201, res.data
    return email, unwrap(res)["data"]["user"]


def login(client, email, password=PASSWORD, **extra):
    client.delete_cookie("mipaas_session")
    res = client.post("/api/v1/auth/login", json={"identifier": email, "password": password, **extra})
    return res


def verify_email(client, email):
    token = last_email_link(email, "/verify-email")
    res = client.post("/api/v1/auth/verify-email/confirm", json={"token": token})
    assert res.status_code == 200, res.data
    assert unwrap(res)["data"]["user"]["email_verified"] is True


def make_admin(client):
    from app.database.session import get_db
    from app.services import accounts
    from app.services.rbac import Role

    email = _email("admin")
    with get_db() as db:
        user = accounts.create_account(db, name="Site Admin", email=email, password=PASSWORD, role=Role.ADMIN)
        user.email_verified_at = datetime.now(UTC)
    return email


@pytest.fixture
def patient(client):
    email, user = register(client, "patient")
    verify_email(client, email)
    return email, user


@pytest.fixture
def doctor(client):
    email, user = register(client, "doctor", license_number="MCI-12345", specialty="Radiology")
    assert user["verification_pending"] is True
    verify_email(client, email)
    admin = make_admin(client)
    assert login(client, admin).status_code == 200
    pending = unwrap(client.get("/api/v1/admin/doctors/pending"))["data"]["doctors"]
    assert any(d["email"] == email for d in pending)
    res = client.post(f"/api/v1/admin/doctors/{user['id']}/verify", json={"note": "Checked against the register"})
    assert res.status_code == 200, res.data
    client.post("/api/v1/auth/logout")
    assert login(client, email).status_code == 200
    me = unwrap(client.get("/api/v1/doctor/profile"))["data"]["user"]
    assert me["role"] == "doctor" and me["clinician"]["share_code"].startswith("DR-")
    client.post("/api/v1/auth/logout")
    return email, me
