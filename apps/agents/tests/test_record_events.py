"""Record events read by the patient chat (record_events.py) and the note the model gets (chat_server.py)."""

import json

import pytest

import record_events


class FakeStreams:
    """XRANGE over in-memory streams, with Redis's exclusive "(id" lower bound."""

    def __init__(self, entries: dict[str, list[tuple[str, dict]]], fail: bool = False):
        self.entries, self.fail = entries, fail

    def xrange(self, key, min="-", max="+", count=None):
        if self.fail:
            raise ConnectionError("redis is down")

        def seq(event_id):
            ms, n = event_id.split("-")
            return int(ms), int(n)

        rows = self.entries.get(key, [])
        if min.startswith("("):
            rows = [r for r in rows if seq(r[0]) > seq(min[1:])]
        return rows[:count] if count else rows


@pytest.fixture
def streams():
    def use(entries, fail=False):
        record_events.set_client(FakeStreams(entries, fail))

    yield use
    record_events.set_client(None)


def test_reads_only_events_after_the_cursor(streams):
    key = record_events.stream_key("u1")
    streams({key: [("100-0", {"type": "xray.added", "study_id": "a"}), ("200-0", {"type": "xray.reviewed", "study_id": "a"})]})
    events, cursor = record_events.read_after("u1", "100-0")
    assert [e["type"] for e in events] == ["xray.reviewed"] and cursor == "200-0"
    assert record_events.read_after("u1", cursor) == ([], "200-0")
    assert record_events.read_after("someone-else", "0-0") == ([], "0-0")


def test_a_new_conversation_looks_back_one_day():
    assert record_events.start_cursor(now=100_000.0) == f"{(100_000 - 24 * 3600) * 1000}-0"


def test_no_redis_means_no_events(streams):
    record_events.set_client(None)
    assert record_events.read_after("u1", "5-0") == ([], "5-0")
    streams({}, fail=True)
    assert record_events.read_after("u1", "5-0") == ([], "5-0")


XRAY = {
    "id": "x1",
    "status": "completed",
    "severity": "MODERATE",
    "flagged_findings": ["Cardiomegaly"],
    "ai_summary": "The model flagged: cardiomegaly (low confidence).",
    "doctor_reviews": [],
}


@pytest.fixture
def chat_server(monkeypatch):
    pytest.importorskip("mcp")
    pytest.importorskip("starlette")
    pytest.importorskip("uvicorn")
    import chat_server

    return chat_server


def test_record_update_describes_the_new_xray(chat_server, monkeypatch):
    reads = []

    def record(cookie, section):
        reads.append((cookie, section))
        return json.dumps({"xrays": [XRAY, {**XRAY, "id": "older"}]}), False

    monkeypatch.setattr(chat_server, "_record", record)
    note = chat_server._record_update(
        [{"type": "xray.added", "study_id": "x1", "status": "completed", "at": "2026-11-13T11:00:00+00:00"}], "c=1"
    )
    assert reads == [("c=1", "xrays")]  # through the API, with the patient's own session
    assert "added a chest X-ray" in note and "finished" in note and "2026-11-13 11:00 UTC" in note
    assert "Cardiomegaly" in note and "older" not in note


def test_no_note_without_consent_or_for_unknown_events(chat_server, monkeypatch):
    monkeypatch.setattr(chat_server, "_record", lambda cookie, section: ("not allowed", True))
    assert chat_server._record_update([{"type": "xray.added", "study_id": "x1"}], "c=1") is None

    monkeypatch.setattr(chat_server, "_record", lambda cookie, section: pytest.fail("no record read needed"))
    assert chat_server._record_update([{"type": "vitals.logged"}], "c=1") is None


def test_a_deleted_xray_is_flagged_as_gone(chat_server, monkeypatch):
    monkeypatch.setattr(chat_server, "_record", lambda cookie, section: (json.dumps({"xrays": []}), False))
    note = chat_server._record_update([{"type": "xray.deleted", "study_id": "x1", "at": ""}], "c=1")
    assert "deleted" in note and "Don't discuss its results" in note and "none of them is on record" in note
