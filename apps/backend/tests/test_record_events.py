"""X-ray record events for the patient assistant (app/services/events.py) and the assistant's xrays section."""

import io
import json
from datetime import UTC, datetime

import pytest
from PIL import Image

from tests.conftest import PASSWORD, login, unwrap


class FakeRedis:
    """The few Redis Stream calls events.py makes, in memory."""

    def __init__(self, fail: bool = False):
        self.streams: dict[str, list[tuple[str, dict]]] = {}
        self.expiry: dict[str, int] = {}
        self.fail = fail
        self._n = 0

    def pipeline(self):
        return _Pipe(self)

    def delete(self, key):
        self.streams.pop(key, None)

    def events(self, user_id: str) -> list[dict]:
        from app.services.events import stream_key

        return [fields for _, fields in self.streams.get(stream_key(user_id), [])]


class _Pipe:
    def __init__(self, redis: FakeRedis):
        self.redis, self.ops = redis, []

    def xadd(self, key, fields, maxlen=None, approximate=True):
        self.ops.append(("xadd", key, dict(fields)))

    def expire(self, key, seconds):
        self.ops.append(("expire", key, seconds))

    def execute(self):
        if self.redis.fail:
            raise ConnectionError("redis is down")
        out = []
        for op, key, arg in self.ops:
            if op == "xadd":
                self.redis._n += 1
                event_id = f"{self.redis._n}-0"
                self.redis.streams.setdefault(key, []).append((event_id, arg))
                out.append(event_id.encode())
            else:
                self.redis.expiry[key] = arg
                out.append(True)
        return out


@pytest.fixture
def redis_events():
    from app.services import events

    fake = FakeRedis()
    events.set_client(fake)
    yield fake
    events.set_client(None)


@pytest.fixture
def screening(monkeypatch):
    """Stands in for the chest X-ray model: these tests are about what happens after a reading."""
    from app.services import patient_ehr as ehr

    def analyze(study, blob, store):
        study.status, study.severity, study.primary_finding = "completed", "MODERATE", "Cardiomegaly"
        study.model_name = "test model"
        study.analyzed_at = datetime.now(UTC)
        study.findings_json = json.dumps(
            {
                "pathologies": [{"name": "Cardiomegaly", "probability": 0.6, "threshold": 0.5, "positive": True}],
                "positive_findings": ["Cardiomegaly"],
                "clinical_summary": "The model flagged: cardiomegaly (low confidence).",
                "recommended_actions": ["Compare with prior films."],
                "disclaimer": "A preliminary AI screen for clinician review.",
            }
        )

    monkeypatch.setattr(ehr, "analyze_xray", analyze)


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("L", (64, 64), 128).save(buf, format="PNG")
    return buf.getvalue()


def _upload(client, title="Priya chest film"):
    res = client.post(
        "/api/v1/patient/xrays",
        data={"file": (io.BytesIO(_png()), "my-chest.png"), "title": title},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201, res.data
    return unwrap(res)["data"]["xray"]


def test_upload_and_delete_publish_events_with_ids_only(client, patient, redis_events, screening):
    _, user = patient
    xray = _upload(client)
    added = redis_events.events(user["id"])
    assert added == [
        {"type": "xray.added", "at": added[0]["at"], "study_id": xray["id"], "status": "completed", "severity": "MODERATE"}
    ]
    assert redis_events.expiry  # the stream expires on its own
    assert "Priya" not in json.dumps(added) and "Cardiomegaly" not in json.dumps(added)

    assert client.delete(f"/api/v1/patient/xrays/{xray['id']}").status_code == 200
    assert redis_events.events(user["id"])[-1]["type"] == "xray.deleted"
    assert redis_events.events(user["id"])[-1]["study_id"] == xray["id"]


def test_an_upload_succeeds_when_redis_is_down(client, patient, screening):
    from app.services import events

    events.set_client(FakeRedis(fail=True))
    try:
        _upload(client)
    finally:
        events.set_client(None)


def test_events_wait_for_the_commit(app, redis_events):
    from app.database.session import get_db
    from app.services import events

    with pytest.raises(RuntimeError), get_db() as db:
        events.publish_on_commit(db, "user-1", "xray.added", study_id="a")
        raise RuntimeError("the request failed")
    assert redis_events.events("user-1") == []

    with get_db() as db:
        events.publish_on_commit(db, "user-1", "xray.added", study_id="b")
        assert redis_events.events("user-1") == []  # not before the commit
    assert [e["study_id"] for e in redis_events.events("user-1")] == ["b"]


def test_assistant_reads_xrays_and_doctor_reviews_with_consent(client, patient, doctor, redis_events, screening):
    patient_email, patient_user = patient
    doctor_email, doctor_user = doctor
    assert login(client, patient_email).status_code == 200
    xray = _upload(client)
    assert client.get("/api/v1/agents/context/patient?section=xrays").status_code == 409  # no consent yet

    res = client.post(
        "/api/v1/patient/care-team/invite",
        json={"doctor_code": doctor_user["clinician"]["share_code"], "scopes": ["xrays"]},
    )
    link = unwrap(res)["data"]["link"]
    client.post("/api/v1/auth/logout")
    assert login(client, doctor_email).status_code == 200
    client.post(f"/api/v1/doctor/patients/{link['id']}/respond", json={"accept": True})
    res = client.post(
        f"/api/v1/doctor/patients/{link['id']}/xrays/{xray['id']}/review",
        json={"impression": "Heart size at the upper limit of normal.", "urgency": "routine"},
    )
    assert res.status_code == 201, res.data
    client.post("/api/v1/auth/logout")
    reviewed = redis_events.events(patient_user["id"])[-1]
    assert reviewed["type"] == "xray.reviewed" and reviewed["study_id"] == xray["id"]

    assert login(client, patient_email, PASSWORD).status_code == 200
    client.put("/api/v1/agents/consent", json={"allow": True})
    data = unwrap(client.get("/api/v1/agents/context/patient?section=xrays"))["data"]
    [item] = data["xrays"]
    assert item["id"] == xray["id"] and item["status"] == "completed"
    assert item["flagged_findings"] == ["Cardiomegaly"]
    assert item["ai_summary"].startswith("The model flagged")
    assert item["doctor_reviews"][0]["impression"] == "Heart size at the upper limit of normal."
    text = json.dumps(data)
    # Free text the patient typed, the file name and the doctor's name stay out.
    assert "Priya" not in text and "my-chest" not in text and doctor_user["name"] not in text


def test_deleting_the_account_removes_the_stream(client, patient, redis_events, screening):
    _, user = patient
    _upload(client)
    assert redis_events.events(user["id"])
    res = client.delete("/api/v1/auth/account", json={"password": PASSWORD})
    assert res.status_code == 200, res.data
    assert redis_events.events(user["id"]) == []
