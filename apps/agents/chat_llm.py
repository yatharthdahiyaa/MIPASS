"""The patient chat's LLM: the system prompt and the function-calling loop over the Responses API.

CHAT_PROVIDER picks who answers: "groq" (the default; GROQ_API_KEY) or "xai" (Grok; XAI_API_KEY). Both
speak the OpenAI-style Responses API. The conversation history is append-only: every response's `output`
items (reasoning included) are kept unchanged, followed by our function_call_output items. xAI gets all
of it on each request; Groq gets earlier turns as plain chat (see Provider.past_turns_as_chat).
The only system message is the first one; the app language rides on each patient message, because
gpt-oss on Groq produced garbled replies when system notes appeared mid-conversation.
The patient's messages are sent to that provider.
"""

import json
import os
import re
import time
from dataclasses import dataclass, field

import anyio
import requests


@dataclass(frozen=True)
class Provider:
    name: str
    url: str
    key_var: str
    model: str
    console: str
    extra: dict = field(default_factory=dict)
    # Whether the closing round can forbid tools with tool_choice "none". On Groq that garbles gpt-oss replies
    # (and Groq rejects the request if the model calls a tool anyway), so there the closing round is a normal one.
    tool_choice_none: bool = True
    # Send earlier turns as plain chat: the patient's messages and the replies, without their tool calls,
    # tool results and reasoning. gpt-oss-120b on Groq garbled its replies (runs of invisible characters,
    # leaked reasoning) once a few past tool exchanges were in the prompt.
    past_turns_as_chat: bool = False


PROVIDERS = {
    # Groq rejects `include`, and keeps no inference data by default.
    "groq": Provider(
        "Groq", "https://api.groq.com/openai/v1/responses", "GROQ_API_KEY", "openai/gpt-oss-120b",
        "console.groq.com", tool_choice_none=False, past_turns_as_chat=True,
    ),
    # xAI: store nothing, and return reasoning encrypted so it can be sent back.
    "xai": Provider(
        "xAI", "https://api.x.ai/v1/responses", "XAI_API_KEY", "grok-4.7",
        "console.x.ai", {"store": False, "include": ["reasoning.encrypted_content"]},
    ),
}

_choice = os.getenv("CHAT_PROVIDER", "groq").strip().lower()
if _choice not in PROVIDERS:
    raise RuntimeError(f"CHAT_PROVIDER must be one of {', '.join(PROVIDERS)}, not {_choice!r}")
PROVIDER = PROVIDERS[_choice]
MODEL = os.getenv("CHAT_MODEL") or PROVIDER.model
EFFORT = "medium"
TIMEOUT = (10, 180)  # connect, read
MAX_TOOL_ROUNDS = 5
MAX_RETRY_WAIT = 45  # seconds; a longer rate-limit wait fails the turn instead

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu"}

SYSTEM_PROMPT = """\
You are the MIPAAS patient assistant. You talk with patients in the patient portal of an Indian medical-imaging platform.

How to answer
- Use simple, everyday words. Keep answers to a few short sentences unless the patient asks for more.
- Write plain text only: no markdown, tables, links or file paths. The app shows images and plays audio by itself.
- Each patient message starts with their app language in brackets, such as "(App language: Hindi. Reply in Hindi.)". Reply in that language, even if earlier replies used another. Keep common English medical words, such as X-ray, where they are clearer.

Safety
- You are not a doctor. Do not diagnose, prescribe, or tell anyone to start, stop or change a medicine or dose; those decisions belong with their doctor.
- If the patient describes an emergency, such as chest pain, severe difficulty breathing, fainting, heavy bleeding, signs of a stroke, or thoughts of self-harm, first tell them to call 112 (or 108 for an ambulance) or go to the nearest emergency department now.
- Never invent results. Only describe what a tool returned in this conversation.

Tools
- my_health_record: when the patient asks about their own readings, medicines, doses, reports or appointments, read the matching section first and answer from it, naming the dates. Describe what the record shows; do not interpret it as a diagnosis. For a report from their doctor, keep the doctor's level of certainty ("looks like", "may be") and say the Records page has an "Explain in plain words" button for it. If it says the patient hasn't allowed the assistant to read their record, tell them they can turn it on under Account, then AI assistance, and answer generally meanwhile.
- X-rays the patient added on the X-rays page: their AI screening and any doctor's review are in my_health_record, section xrays, and the app adds a "Record update" note when one is added, reviewed or deleted. Explain the flagged findings and the AI summary in plain words, keeping how confident it says it is. A doctor's review comes first. Say that a doctor must review the AI screening, give no percentages, and never call anything a diagnosis. The screening does not look for some problems (it says which), so never tell the patient something is absent. If the screening's severity is HIGH, or a doctor marked their review urgent, suggest they show it to their doctor soon, and to get urgent care now if they feel unwell or short of breath.
- xai_cxr_report: when a message says the patient attached a chest X-ray with an upload_id, call it with that upload_id. Its findings are a preliminary AI screen that a radiologist must review, so say that. Explain in plain words which findings the AI flagged and where its heat maps look. Do not give percentages and do not call anything a diagnosis. If the tool fails, say the X-ray check is not available right now and suggest the X-rays page or their doctor.
- voice_translate: when the patient asks to hear an answer, or wants it in another Indian language, call it with the text to speak, the text's language as source, and as targets only the languages the patient wants (usually just their app language). Then say briefly that the audio is ready.
"""


NOT_RUN = json.dumps({"error": "not run: this turn has used all its tool calls"})


class LLMError(RuntimeError):
    pass


class LLMSetupError(LLMError):
    """The provider refused the key or the account (wrong key, no credits), so retrying won't help."""


class ToolUseFailed(LLMError):
    """Groq: the model wrote a tool call the request didn't allow or that didn't parse, even after a retry."""


class LLMBusy(LLMError):
    """The provider's rate limit (per minute or per day) still applies after the one retry, if any."""


def configured() -> bool:
    return bool(os.getenv(PROVIDER.key_var))


def user_message(text: str, upload_id: str | None, language: str) -> dict:
    name = LANGUAGE_NAMES[language]
    text = f"(App language: {name}. Reply in {name}.)\n{text}".strip()
    if upload_id:
        text = f"{text}\n\n[The patient attached a chest X-ray. upload_id: {upload_id}]"
    return {"role": "user", "content": text}


def _retry_wait(resp: requests.Response) -> float | None:
    """Seconds to wait before the one retry, or None when a retry won't help."""
    if resp.status_code == 429:
        try:
            wait = float(resp.headers.get("retry-after", "1"))
        except ValueError:
            wait = 1.0
        return wait if wait <= MAX_RETRY_WAIT else None
    if resp.status_code == 400 and "tool_use_failed" in resp.text:
        return 0.0  # Groq: the model wrote a malformed tool call; a fresh try usually works
    return None


def _error(resp: requests.Response) -> LLMError:
    if resp.status_code in (401, 403) or "api key" in resp.text.lower():
        kind = LLMSetupError
    elif "tool_use_failed" in resp.text:
        kind = ToolUseFailed
    elif resp.status_code == 429:
        kind = LLMBusy
    else:
        kind = LLMError
    return kind(f"{PROVIDER.name} API {resp.status_code}: {resp.text[:300]}")


def _post(items: list, tools: list, tool_choice: str) -> dict:
    key = os.getenv(PROVIDER.key_var)
    if not key:
        raise LLMError(f"{PROVIDER.key_var} is not set")
    body = {"model": MODEL, "input": items, "reasoning": {"effort": EFFORT}, **PROVIDER.extra}
    if tools:
        body.update(tools=tools, tool_choice=tool_choice)
    for attempt in (1, 2):
        last = attempt == 2
        started = time.monotonic()
        try:
            resp = requests.post(PROVIDER.url, headers={"Authorization": f"Bearer {key}"}, json=body, timeout=TIMEOUT)
        except requests.RequestException as exc:
            # Failing within the connect timeout means the connection never came up (refused, DNS, a stalled
            # TLS handshake), so the provider saw nothing and one more try is safe.
            if not last and time.monotonic() - started < TIMEOUT[0] + 2:
                continue
            raise LLMError(f"{PROVIDER.name} API unreachable: {exc}") from exc
        if resp.ok:
            break
        wait = _retry_wait(resp)
        if last or wait is None:
            raise _error(resp)
        time.sleep(wait)
    try:
        return resp.json()
    except ValueError as exc:
        raise LLMError(f"{PROVIDER.name} API did not return JSON") from exc


def _plain(text: str) -> str:
    """The app shows replies as plain text, so drop the markdown and stray invisible characters models slip in.

    Zero-width joiners (U+200C, U+200D) stay: Indic scripts need them.
    """
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=re.S)  # **bold**
    text = re.sub(r"\[([^\]]+)\]\([^)\s]*\)", r"\1", text)  # [text](link)
    text = re.sub(r"^#{1,6}[ \t]+", "", text, flags=re.M)  # headings
    text = re.sub(r"[​⁠﻿]", "", text)  # zero-width space, word joiner, BOM
    text = re.sub(r"[  ]", " ", text)  # no-break spaces
    return re.sub(r"[ \t]{2,}", " ", text)


_TOOL_ITEMS = {"reasoning", "function_call", "function_call_output"}


def _request_items(history: list) -> list:
    """What the provider sees. The history itself stays whole (append-only)."""
    if not PROVIDER.past_turns_as_chat:
        return list(history)
    current = max(i for i, item in enumerate(history) if item.get("role") == "user")
    return [item for i, item in enumerate(history) if i >= current or item.get("type") not in _TOOL_ITEMS]


def _reply_text(output: list) -> str:
    return _plain(
        "".join(
            part.get("text", "")
            for item in output
            if item.get("type") == "message"
            for part in item.get("content") or []
            if part.get("type") == "output_text"
        )
    ).strip()


async def run_turn(history: list, tools: list, call_tool) -> tuple[str, list[dict]]:
    """Run one patient turn, appending the model's output and the tool results to `history` (append-only).

    call_tool(name, arguments) is awaited and returns (output text, is_error).
    Returns the reply text and the tool calls made, as [{"name", "ok"}].
    """
    calls: list[dict] = []
    for round_no in range(MAX_TOOL_ROUNDS + 1):
        # The closing round runs no tools, so every turn ends. It keeps sending them, because gpt-oss on Groq
        # garbles its reply when earlier calls name tools it can't see.
        closing = round_no == MAX_TOOL_ROUNDS
        choice = "none" if closing and PROVIDER.tool_choice_none else "auto"
        try:
            data = await anyio.to_thread.run_sync(_post, _request_items(history), tools, choice)
        except ToolUseFailed:
            # Groq rejected a malformed tool call twice. In the closing round, keep what the tools made this
            # turn (the app shows it, with its own "no answer" line) rather than fail the whole turn.
            if closing and calls:
                return "", calls
            raise
        output = data.get("output") or []
        history.extend(output)
        pending = [item for item in output if item.get("type") == "function_call"]
        if not pending or closing:
            # Out of rounds: answer any last calls as not run, so the history stays valid for the next turn.
            for call in pending:
                history.append({"type": "function_call_output", "call_id": call.get("call_id"), "output": NOT_RUN})
            return _reply_text(output), calls
        for call in pending:
            try:
                arguments = json.loads(call.get("arguments") or "{}")
            except json.JSONDecodeError:
                arguments = None
            if isinstance(arguments, dict):
                text, is_error = await call_tool(call.get("name"), arguments)
            else:
                text, is_error = "the arguments were not a JSON object", True
            calls.append({"name": call.get("name"), "ok": not is_error})
            history.append(
                {
                    "type": "function_call_output",
                    "call_id": call.get("call_id"),
                    "output": json.dumps({"error": text}) if is_error else text,
                }
            )
    raise AssertionError("unreachable: the closing round always returns")
