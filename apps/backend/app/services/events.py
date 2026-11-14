"""Record events for other MIPAAS services, over Redis Streams.

When something changes in a patient's record that the patient assistant should know about (an X-ray added,
reviewed by a doctor, or deleted), the API appends a small event to that patient's stream:

    mipaas:patient:<user_id>:events      XADD fields: type, study_id, at, and a few status fields

The patient chat service (apps/agents/chat_server.py) reads the stream before each turn. Events carry ids and
status only, never findings or names: the chat service fetches the details from this API with the patient's
own session, which checks their AI consent and logs the read (GET /api/v1/agents/context/patient?section=xrays).

* Events are sent only after the database transaction commits, so a reader never sees an event for a row
  that was rolled back. Queue them with ``publish_on_commit(db, ...)``.
* Redis is optional: without ``REDIS_URL``, or when Redis is down, nothing is sent and the request still
  succeeds. The assistant can still read the record through its tool; it just isn't told about changes.
* Each stream keeps its last ``MAX_EVENTS`` events and expires ``RETENTION_SECONDS`` after the last one.
  ``forget(user_id)`` removes it when the account is deleted.
"""

from __future__ import annotations

import os
import threading
from datetime import UTC, datetime

import structlog
from sqlalchemy import event as sa_event
from sqlalchemy.orm import Session

logger = structlog.get_logger()

MAX_EVENTS = 100
RETENTION_SECONDS = 7 * 24 * 3600
_PENDING = "mipaas_pending_events"

_lock = threading.Lock()
_client = None
_client_url: str | None = None


def stream_key(user_id: str) -> str:
    return f"mipaas:patient:{user_id}:events"


def _redis():
    """A Redis client for REDIS_URL, or None. Recreated if the URL changes (tests)."""
    global _client, _client_url
    url = os.getenv("REDIS_URL") or None
    with _lock:
        if url != _client_url:
            _client, _client_url = None, url
            if url:
                import redis

                _client = redis.Redis.from_url(url, socket_timeout=1, socket_connect_timeout=1)
        return _client


def set_client(client) -> None:
    """Use this client instead of one built from REDIS_URL (tests)."""
    global _client, _client_url
    with _lock:
        _client, _client_url = client, os.getenv("REDIS_URL") or None


def publish(user_id: str, type_: str, **fields) -> str | None:
    """Append one event now. Returns its stream id, or None if it wasn't sent."""
    client = _redis()
    if client is None or not user_id:
        return None
    data = {"type": type_, "at": datetime.now(UTC).isoformat()}
    data.update({k: str(v) for k, v in fields.items() if v is not None})
    key = stream_key(user_id)
    try:
        pipe = client.pipeline()
        pipe.xadd(key, data, maxlen=MAX_EVENTS, approximate=True)
        pipe.expire(key, RETENTION_SECONDS)
        event_id = pipe.execute()[0]
    except Exception as exc:  # Redis down must never fail the request that changed the record
        logger.warning("record_event_not_sent", event_type=type_, error=str(exc))
        return None
    return event_id.decode() if isinstance(event_id, bytes) else event_id


def publish_on_commit(db: Session, user_id: str, type_: str, **fields) -> None:
    """Queue an event on this session; it is sent if and when the transaction commits."""
    db.info.setdefault(_PENDING, []).append((user_id, type_, fields))


def forget(user_id: str) -> None:
    """Delete a patient's stream (account deletion)."""
    client = _redis()
    if client is None or not user_id:
        return
    try:
        client.delete(stream_key(user_id))
    except Exception as exc:
        logger.warning("record_events_not_removed", user_id=user_id, error=str(exc))


@sa_event.listens_for(Session, "after_commit")
def _send_pending(session: Session) -> None:
    # Runs inside commit(): an exception here would turn a saved change into an error response.
    for user_id, type_, fields in session.info.pop(_PENDING, []):
        try:
            publish(user_id, type_, **fields)
        except Exception as exc:  # pragma: no cover - publish already catches Redis errors
            logger.warning("record_event_not_sent", event_type=type_, error=str(exc))


@sa_event.listens_for(Session, "after_rollback")
def _drop_pending(session: Session) -> None:
    session.info.pop(_PENDING, None)
