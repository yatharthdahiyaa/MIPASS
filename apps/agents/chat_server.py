"""Patient-portal chat service: an LLM (Groq or xAI's Grok), with our agents reached through the MCP server.

The browser calls it through the Next.js rewrite /api/chat/* (apps/frontend/next.config.ts), which forwards
the patient's session cookie. Every request is checked against the backend's /api/v1/auth/session and must
come from a patient account. The model may call two MCP tools, xai_cxr_report and voice_translate, and one
local tool, my_health_record, which reads the patient's own record from the backend with their session (the
backend refuses unless the patient allowed AI processing, and logs each read). Patient messages, and any
record data the model reads, are sent to the chat provider. Conversations live in memory only and expire after 2 hours.

Record updates: when the patient adds, deletes or gets a doctor's review on an X-ray in the portal, the API
appends an event to the patient's Redis stream (record_events.py). Before each turn this service reads the
events after the conversation's cursor, fetches the X-rays from the backend with the patient's session (same
consent check as the tool), and gives the model a short "record update" note, so it knows about an X-ray the
patient uploaded on the X-rays page without being asked. Without consent, nothing is added.

Runs in the MCP venv and starts mcp_server.py itself. From the repo root:

    .venv-mcp\\Scripts\\python apps\\agents\\chat_server.py

Env (apps/agents/.env): CHAT_PROVIDER (groq, the default, or xai), GROQ_API_KEY or XAI_API_KEY to match,
CHAT_MODEL (default openai/gpt-oss-120b on Groq, grok-4.7 on xAI), MIPAAS_BACKEND_URL, MIPAAS_AGENTS_URL,
CHAT_PORT (default 8200), REDIS_URL (the same Redis as the API; without it there are no record updates).
"""

import json
import logging
import os
import re
import sys
import time
import uuid
from collections import OrderedDict
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path

import anyio
import requests
import uvicorn
from dotenv import load_dotenv
from mcp import Client, MCPError, StdioServerParameters
from starlette.applications import Starlette
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

load_dotenv(Path(__file__).with_name(".env"))

import chat_llm  # noqa: E402  (reads CHAT_PROVIDER and CHAT_MODEL at import, so after .env is loaded)
import record_events  # noqa: E402

BACKEND_URL = os.getenv("MIPAAS_BACKEND_URL", "http://127.0.0.1:8080").rstrip("/")
AGENTS_URL = os.getenv("MIPAAS_AGENTS_URL", "http://127.0.0.1:8100").rstrip("/")
PORT = int(os.getenv("CHAT_PORT", "8200"))
MCP_SERVER = Path(__file__).with_name("mcp_server.py")

CHAT_TOOLS = {"xai_cxr_report", "voice_translate"}
SERVICE_HEADERS = {"X-Agents-Key": os.environ["AGENTS_SERVICE_KEY"]} if os.getenv("AGENTS_SERVICE_KEY") else {}

RECORD_TOOL = {
    "type": "function",
    "name": "my_health_record",
    "description": (
        "Reads this patient's own MIPAAS record. Use it whenever they ask about their readings, medicines, "
        "doses, reports from their doctor, X-rays or appointments, instead of guessing. Sections: overview "
        "(profile, latest readings, streak, adherence), vitals (last 30 days of check-ins), medications (today's "
        "doses and adherence), reports (reports their doctors signed), consultations, xrays (the chest X-rays "
        "they added on the X-rays page, newest first: the AI screening and any doctor's review)."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "section": {
                "type": "string",
                "enum": ["overview", "vitals", "medications", "reports", "consultations", "xrays"],
            }
        },
        "required": ["section"],
    },
}
TOOL_TIMEOUT = 900
MAX_MESSAGE = 4000
MAX_SPEAK = 5000
MAX_UPLOAD = 25 * 1024 * 1024
CONVERSATION_TTL = 2 * 3600
MAX_CONVERSATIONS = 1000

log = logging.getLogger("mipaas.chat")


@dataclass
class PatientFiles:
    """Agent outputs this patient created through the chat; /media serves only these."""

    uploads: set[str] = field(default_factory=set)
    voices: set[str] = field(default_factory=set)


@dataclass
class Conversation:
    user_id: str
    history: list = field(default_factory=lambda: [{"role": "system", "content": chat_llm.SYSTEM_PROMPT}])
    updated: float = 0.0
    lock: anyio.Lock = field(default_factory=anyio.Lock)
    # Redis stream id of the last record event this conversation has been told about.
    events_cursor: str = field(default_factory=record_events.start_cursor)


FILES: dict[str, PatientFiles] = {}
CONVERSATIONS: OrderedDict[str, Conversation] = OrderedDict()


def _files(user: dict) -> PatientFiles:
    return FILES.setdefault(user["id"], PatientFiles())


def _conversation(conversation_id, user_id: str) -> tuple[str, Conversation, bool]:
    """The patient's conversation, or a new one. The flag says a requested conversation had expired."""
    now = time.monotonic()
    for cid in [cid for cid, c in CONVERSATIONS.items() if now - c.updated > CONVERSATION_TTL]:
        del CONVERSATIONS[cid]
    conv = CONVERSATIONS.get(conversation_id) if isinstance(conversation_id, str) else None
    if conv is not None and conv.user_id != user_id:
        conv = None
    restarted = bool(conversation_id) and conv is None
    if conv is None:
        conversation_id, conv = uuid.uuid4().hex, Conversation(user_id)
        CONVERSATIONS[conversation_id] = conv
        while len(CONVERSATIONS) > MAX_CONVERSATIONS:
            CONVERSATIONS.popitem(last=False)
    conv.updated = now
    CONVERSATIONS.move_to_end(conversation_id)
    return conversation_id, conv, restarted


def _session_user(cookie: str) -> dict | None:
    resp = requests.get(f"{BACKEND_URL}/api/v1/auth/session", headers={"Cookie": cookie}, timeout=10)
    resp.raise_for_status()
    data = resp.json().get("data") or {}
    return data.get("user") if data.get("authenticated") else None


async def _patient(request: Request) -> dict:
    cookie = request.headers.get("cookie")
    if not cookie:
        raise HTTPException(401, "Please sign in again.")
    try:
        user = await anyio.to_thread.run_sync(_session_user, cookie)
    except (requests.RequestException, ValueError, AttributeError) as exc:
        raise HTTPException(503, "Can't check your sign-in right now. Please try again shortly.") from exc
    if not user:
        raise HTTPException(401, "Please sign in again.")
    if user.get("account_type") != "patient":
        raise HTTPException(403, "The assistant is for patient accounts.")
    return user


async def _json_body(request: Request) -> dict:
    try:
        body = await request.json()
    except ValueError:
        body = None
    if not isinstance(body, dict):
        raise HTTPException(400, "Send a JSON object.")
    return body


def _text(result) -> str:
    return getattr(result.content[0], "text", "") if result.content else ""


async def _tools(mcp: Client) -> list[dict]:
    try:
        listing = await mcp.list_tools()
    except MCPError:
        return [RECORD_TOOL]  # agents server down: the model still answers, with the record only
    return [RECORD_TOOL] + [
        {"type": "function", "name": t.name, "description": t.description or "", "parameters": t.input_schema}
        for t in listing.tools
        if t.name in CHAT_TOOLS
    ]


def _attachments(name: str, text: str, files: PatientFiles) -> list[dict]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    if name == "voice_translate":
        voice_id = data.get("voice_id")
        if not voice_id:
            return []
        files.voices.add(voice_id)
        return [
            {"kind": "audio", "language": o["language"], "url": f"/media/voice/{voice_id}/{o['language']}.wav"}
            for o in data.get("outputs", [])
            if "audio" in o
        ]
    upload_id = data.get("upload_id")
    # The agent's own overlay path (finding names with spaces are stored with "_").
    return [
        {"kind": "image", "label": m["name"], "url": "/media" + m["overlay"]}
        for m in data.get("gradcam", [])
        if isinstance(m.get("overlay"), str) and m["overlay"].startswith(f"/xai/{upload_id}/image/")
    ]


SHOWN_IN_CHAT = "(shown to the patient in the chat)"
_FILE_LINK = re.compile(r"^(https?://|/(upload|xai|voice)/)")


def _for_model(text: str) -> str:
    """A tool result as the model sees it. File links are replaced so it can't read them out to the patient."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return text

    def strip(value):
        if isinstance(value, dict):
            return {k: strip(v) for k, v in value.items()}
        if isinstance(value, list):
            return [strip(v) for v in value]
        if isinstance(value, str) and _FILE_LINK.match(value):
            return SHOWN_IN_CHAT
        return value

    return json.dumps(strip(data), ensure_ascii=False)


def _record(cookie: str, section: str) -> tuple[str, bool]:
    try:
        resp = requests.get(
            f"{BACKEND_URL}/api/v1/agents/context/patient",
            params={"section": section},
            headers={"Cookie": cookie},
            timeout=15,
        )
    except requests.RequestException:
        return "the record can't be read right now", True
    try:
        body = resp.json()
    except ValueError:
        body = {}
    if not resp.ok:
        return str((body.get("error") or {}).get("message") or f"record not available ({resp.status_code})"), True
    return json.dumps(body.get("data") or {}, ensure_ascii=False), False


RECORD_UPDATE = """\
Record update from the MIPAAS app, not written by the patient. Since the last message:
{changes}
The X-rays concerned, from the patient's record (the same data my_health_record gives for section xrays):
{details}
Use this when the patient asks about their X-ray or seems to mean it. If they haven't mentioned it, you may say once,
briefly, that you can see the new X-ray or review and offer to explain it. The AI screening is preliminary and a
doctor must review it: keep its level of confidence, give no percentages, and never call it a diagnosis. A doctor's
review comes before the AI screening."""

_SCREENING_STATUS = {"completed": "finished", "failed": "could not be done", "processing": "is still running"}


def _change_line(event: dict) -> str | None:
    study = event.get("study_id") or "unknown"
    when = (event.get("at") or "")[:16].replace("T", " ")
    kind = event.get("type")
    if kind == "xray.added":
        status = _SCREENING_STATUS.get(event.get("status") or "", "has an unknown status")
        return f"- {when} UTC: the patient added a chest X-ray on the X-rays page (id {study}); the AI screening {status}."
    if kind == "xray.reviewed":
        return f"- {when} UTC: a doctor reviewed the patient's chest X-ray (id {study})."
    if kind == "xray.deleted":
        return f"- {when} UTC: the patient deleted the chest X-ray with id {study}. Don't discuss its results any more."
    return None


def _record_update(events: list[dict], cookie: str) -> str | None:
    """The note for the model about these events, or None (nothing relevant, no consent, or API down)."""
    lines = [line for line in (_change_line(e) for e in events) if line]
    if not lines:
        return None
    text, failed = _record(cookie, "xrays")
    if failed:
        return None  # e.g. no consent: nothing from the record goes to the model
    try:
        xrays = json.loads(text).get("xrays") or []
    except (ValueError, AttributeError):
        return None
    mentioned = {e.get("study_id") for e in events}
    details = [x for x in xrays if x.get("id") in mentioned]
    return RECORD_UPDATE.format(
        changes="\n".join(lines),
        details=json.dumps(details, ensure_ascii=False) if details else "(none of them is on record any more)",
    )


def _tool_runner(mcp: Client, files: PatientFiles, attachments: list, language: str, cookie: str):
    async def call(name: str, arguments: dict) -> tuple[str, bool]:
        if name == RECORD_TOOL["name"]:
            return await anyio.to_thread.run_sync(_record, cookie, str(arguments.get("section") or "overview"))
        if name not in CHAT_TOOLS:
            return f"unknown tool '{name}'", True
        if name == "xai_cxr_report" and arguments.get("upload_id") not in files.uploads:
            return "that upload_id is not an X-ray this patient attached in this chat", True
        if name == "voice_translate":
            # The agent's own defaults are English and all five languages; in the chat, the patient's language.
            arguments.setdefault("source", language)
            arguments.setdefault("targets", [language])
        try:
            result = await mcp.call_tool(name, arguments)
        except MCPError as exc:
            return str(exc), True
        text = _text(result)
        if result.is_error:
            return text, True
        attachments.extend(_attachments(name, text, files))
        return _for_model(text), False

    return call


async def health(request: Request) -> Response:
    return JSONResponse(
        {
            "status": "ok",
            "provider": chat_llm.PROVIDER.name,
            "llm_configured": chat_llm.configured(),
            "model": chat_llm.MODEL,
            "record_events": "redis" if record_events.enabled() else "off",
        }
    )


async def chat(request: Request) -> Response:
    """JSON {conversation_id?, message, language, upload_id?} -> {conversation_id, restarted, reply, attachments, tools}."""
    user = await _patient(request)
    body = await _json_body(request)
    message = str(body.get("message") or "").strip()
    language = body.get("language") if body.get("language") in chat_llm.LANGUAGE_NAMES else "en"
    upload_id = body.get("upload_id") or None
    files = _files(user)
    if len(message) > MAX_MESSAGE:
        raise HTTPException(400, f"Messages can be up to {MAX_MESSAGE} characters.")
    if upload_id is not None and upload_id not in files.uploads:
        raise HTTPException(400, "Attach the X-ray again.")
    if not message and not upload_id:
        raise HTTPException(400, "Type a message.")
    if not chat_llm.configured():
        raise HTTPException(503, f"The assistant isn't set up yet ({chat_llm.PROVIDER.key_var} is missing).")

    mcp = request.app.state.mcp
    conversation_id, conv, restarted = _conversation(body.get("conversation_id"), user["id"])
    attachments: list[dict] = []
    cookie = request.headers.get("cookie", "")
    async with conv.lock:
        mark = len(conv.history)
        events, cursor = await anyio.to_thread.run_sync(record_events.read_after, user["id"], conv.events_cursor)
        note = await anyio.to_thread.run_sync(_record_update, events, cookie) if events else None
        if note:
            conv.history.append({"role": "system", "content": note})
        conv.history.append(chat_llm.user_message(message, upload_id, language))
        try:
            reply, tools_used = await chat_llm.run_turn(
                conv.history, await _tools(mcp), _tool_runner(mcp, files, attachments, language, cookie)
            )
        except chat_llm.LLMError as exc:
            del conv.history[mark:]
            if isinstance(exc, chat_llm.LLMSetupError):
                provider = chat_llm.PROVIDER
                log.error(
                    "%s refused %s from apps/agents/.env. Check the key and the account at %s, "
                    "then restart this service. %s",
                    provider.name, provider.key_var, provider.console, exc,
                )
                raise HTTPException(503, "The assistant isn't set up correctly yet.") from exc
            if isinstance(exc, chat_llm.LLMBusy):
                log.warning("%s rate limit reached (per-minute or per-day tokens): %s", chat_llm.PROVIDER.name, exc)
                raise HTTPException(503, "The assistant is busy right now. Please try again later.") from exc
            log.warning("chat turn failed: %s", exc)
            raise HTTPException(502, "The assistant couldn't answer just now. Please try again.") from exc
        # Only after a successful turn: a failed one is retried with the same record update.
        conv.events_cursor = cursor
    return JSONResponse(
        {
            "conversation_id": conversation_id,
            "restarted": restarted,
            "reply": reply,
            "attachments": attachments,
            "tools": tools_used,
        }
    )


async def upload(request: Request) -> Response:
    """multipart 'file' -> the agents server's /upload. Returns {upload_id, filename, warnings, preview}."""
    user = await _patient(request)
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > MAX_UPLOAD + 64 * 1024:
        raise HTTPException(413, "That file is larger than 25 MB.")
    async with request.form(max_files=1, max_fields=1) as form:
        file = form.get("file")
        if not isinstance(file, UploadFile) or not file.filename:
            raise HTTPException(400, "Choose an image file to attach.")
        filename, data = file.filename, await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "That file is larger than 25 MB.")
    try:
        resp = await anyio.to_thread.run_sync(
            lambda: requests.post(f"{AGENTS_URL}/upload", files={"file": (filename, data)}, headers=SERVICE_HEADERS, timeout=120)
        )
    except requests.RequestException as exc:
        raise HTTPException(503, "Uploads are not available right now.") from exc
    try:
        result = resp.json()
    except ValueError:
        result = {}
    if not resp.ok:
        status = 400 if resp.status_code in (400, 413) else 502
        raise HTTPException(status, result.get("error") or "That file could not be read as an image.")
    upload_id = result["upload_id"]
    _files(user).uploads.add(upload_id)
    return JSONResponse(
        {
            "upload_id": upload_id,
            "filename": result.get("filename"),
            "warnings": result.get("quality", {}).get("warnings", []),
            "preview": f"/media/upload/{upload_id}/enhanced",
        },
        status_code=201,
    )


async def speak(request: Request) -> Response:
    """JSON {text, language} -> {audio}: speaks the text in its own language (no translation)."""
    user = await _patient(request)
    body = await _json_body(request)
    text = str(body.get("text") or "").strip()
    language = body.get("language")
    if not text or language not in chat_llm.LANGUAGE_NAMES:
        raise HTTPException(400, "Nothing to read aloud.")
    if len(text) > MAX_SPEAK:
        raise HTTPException(400, "That message is too long to read aloud.")
    try:
        result = await request.app.state.mcp.call_tool("voice_translate", {"text": text, "source": language, "targets": [language]})
    except MCPError as exc:
        raise HTTPException(502, "Listening isn't available right now.") from exc
    try:
        data = {} if result.is_error else json.loads(_text(result))
    except json.JSONDecodeError:
        data = {}
    output = (data.get("outputs") or [{}])[0]
    if "audio" not in output:
        log.warning("speak failed: %s", _text(result)[:300] if result.is_error else output.get("error"))
        raise HTTPException(502, "Listening isn't available right now.")
    _files(user).voices.add(data["voice_id"])
    return JSONResponse({"audio": f"/media/voice/{data['voice_id']}/{language}.wav"})


MEDIA = (
    (re.compile(r"voice/([0-9a-f]{32})/[a-z]{2}\.wav"), "voices"),
    (re.compile(r"xai/([0-9a-f]{32})/image/\w+\.png"), "uploads"),
    (re.compile(r"upload/([0-9a-f]{32})/enhanced"), "uploads"),
)


async def media(request: Request) -> Response:
    """Audio and images from the agents server, only for ids this patient created in the chat."""
    user = await _patient(request)
    path = request.path_params["path"]
    files = FILES.get(user["id"])
    for pattern, kind in MEDIA:
        match = pattern.fullmatch(path)
        if not (match and files and match.group(1) in getattr(files, kind)):
            continue
        try:
            resp = await anyio.to_thread.run_sync(lambda: requests.get(f"{AGENTS_URL}/{path}", headers=SERVICE_HEADERS, timeout=30))
        except requests.RequestException as exc:
            raise HTTPException(503, "That file is not available right now.") from exc
        if resp.ok:
            return Response(
                resp.content,
                media_type=resp.headers.get("Content-Type"),
                headers={"Cache-Control": "private, max-age=3600"},
            )
        break
    raise HTTPException(404, "Not found.")


async def _http_error(request: Request, exc: HTTPException) -> Response:
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@asynccontextmanager
async def lifespan(app: Starlette):
    server = StdioServerParameters(command=sys.executable, args=[str(MCP_SERVER)], env=dict(os.environ))
    async with Client(server, read_timeout_seconds=TOOL_TIMEOUT) as mcp:
        app.state.mcp = mcp
        yield


app = Starlette(
    routes=[
        Route("/health", health),
        Route("/chat", chat, methods=["POST"]),
        Route("/upload", upload, methods=["POST"]),
        Route("/speak", speak, methods=["POST"]),
        Route("/media/{path:path}", media),
    ],
    lifespan=lifespan,
    exception_handlers={HTTPException: _http_error},
)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
