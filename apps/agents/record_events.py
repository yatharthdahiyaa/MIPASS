"""Reads the record events the MIPAAS API writes to Redis (apps/backend/app/services/events.py).

One stream per patient, `mipaas:patient:<user_id>:events`, with entries such as
{type: "xray.added", study_id, status, severity, at}. The chat service keeps a cursor per conversation and,
before each turn, asks for the events after it. Events hold ids and status only; the details come from the
API, which checks the patient's consent.

Without REDIS_URL, or with Redis down, there are simply no events: the assistant still reads the record
through its my_health_record tool, but isn't told what changed.
"""

from __future__ import annotations

import logging
import os
import time

log = logging.getLogger("mipaas.chat.events")

LOOKBACK_SECONDS = 24 * 3600  # a new conversation hears about the last day's changes
MAX_READ = 20

_client = None
_client_url: str | None = None


def stream_key(user_id: str) -> str:
    return f"mipaas:patient:{user_id}:events"


def _redis():
    global _client, _client_url
    url = os.getenv("REDIS_URL") or None
    if url != _client_url:
        _client, _client_url = None, url
        if url:
            import redis

            _client = redis.Redis.from_url(url, socket_timeout=1, socket_connect_timeout=1, decode_responses=True)
    return _client


def set_client(client) -> None:
    """Use this client instead of one built from REDIS_URL (tests)."""
    global _client, _client_url
    _client, _client_url = client, os.getenv("REDIS_URL") or None


def enabled() -> bool:
    return _redis() is not None


def start_cursor(now: float | None = None) -> str:
    """Cursor for a new conversation: events from the last LOOKBACK_SECONDS count as new."""
    return f"{int(((now or time.time()) - LOOKBACK_SECONDS) * 1000)}-0"


def read_after(user_id: str, cursor: str) -> tuple[list[dict], str]:
    """Events after `cursor`, oldest first, and the cursor to use next time. Never raises."""
    client = _redis()
    if client is None:
        return [], cursor
    try:
        entries = client.xrange(stream_key(user_id), min=f"({cursor}", max="+", count=MAX_READ)
    except Exception as exc:
        log.warning("record events unavailable: %s", exc)
        return [], cursor
    events = []
    for event_id, fields in entries:
        event_id = event_id.decode() if isinstance(event_id, bytes) else event_id
        fields = {
            (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
            for k, v in fields.items()
        }
        events.append({"id": event_id, **fields})
    return events, (events[-1]["id"] if events else cursor)
