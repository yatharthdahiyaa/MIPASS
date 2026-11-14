"""The language model the care agents use for wording, and nothing else.

Same providers as the patient chat (Groq or xAI, OpenAI-style Responses API). The agents decide
facts with rules; the model only rephrases those facts, and its text then goes through guard.py.

Env:
  AGENT_LLM_PROVIDER  groq | xai | off (default: CHAT_PROVIDER, else groq). "off" disables model use.
  AGENT_LLM_MODEL     default: the provider's default below
  GROQ_API_KEY / XAI_API_KEY
"""

from __future__ import annotations

import json
import os
import re
import time

import requests

_PROVIDERS = {
    "groq": ("https://api.groq.com/openai/v1/responses", "GROQ_API_KEY", "openai/gpt-oss-120b", {}),
    # store=False: xAI keeps nothing.
    "xai": ("https://api.x.ai/v1/responses", "XAI_API_KEY", "grok-4.7", {"store": False}),
}
TIMEOUT = (10, 120)
ATTEMPTS = 3
MAX_WAIT = 20.0  # seconds to wait out a rate limit before giving up (the agent then answers from rules)


class LLMUnavailable(RuntimeError):
    """No model configured, or the call failed. Agents fall back to their rule-based output."""


def _provider():
    name = (os.getenv("AGENT_LLM_PROVIDER") or os.getenv("CHAT_PROVIDER") or "groq").strip().lower()
    if name == "off":
        return None
    if name not in _PROVIDERS:
        raise LLMUnavailable(f"AGENT_LLM_PROVIDER must be groq, xai or off, not {name!r}")
    return name, _PROVIDERS[name]


def model_name() -> str | None:
    p = _provider()
    if p is None:
        return None
    return os.getenv("AGENT_LLM_MODEL") or p[1][2]


def available() -> bool:
    p = _provider()
    return bool(p and os.getenv(p[1][1]))


def _retry_after(resp: requests.Response) -> float:
    """Seconds the provider asks us to wait: the Retry-After header, else its "try again in 1.2s" hint."""
    try:
        return float(resp.headers.get("retry-after", "")) + 0.2
    except ValueError:
        pass
    hint = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", resp.text)
    if hint:
        return int(hint.group(1) or 0) * 60 + float(hint.group(2)) + 0.2
    return 2.0


def _output_text(data: dict) -> str:
    return "".join(
        part.get("text", "")
        for item in data.get("output") or []
        if item.get("type") == "message"
        for part in item.get("content") or []
        if part.get("type") == "output_text"
    ).strip()


def complete_json(instructions: str, payload: str) -> dict:
    """One call, one JSON object back. Raises LLMUnavailable on any problem."""
    p = _provider()
    if p is None:
        raise LLMUnavailable("model use is switched off (AGENT_LLM_PROVIDER=off)")
    _, (url, key_var, default_model, extra) = p
    key = os.getenv(key_var)
    if not key:
        raise LLMUnavailable(f"{key_var} is not set")
    body = {
        "model": os.getenv("AGENT_LLM_MODEL") or default_model,
        "input": [{"role": "system", "content": instructions}, {"role": "user", "content": payload}],
        "reasoning": {"effort": "low"},
        **extra,
    }
    resp = None
    for attempt in range(1, ATTEMPTS + 1):
        last = attempt == ATTEMPTS
        try:
            resp = requests.post(url, headers={"Authorization": f"Bearer {key}"}, json=body, timeout=TIMEOUT)
        except requests.RequestException as exc:
            if last:
                raise LLMUnavailable(f"model unreachable: {exc}") from exc
            time.sleep(1.0)
            continue
        if resp.ok:
            break
        # Rate limits and brief provider trouble are worth waiting for; anything else is not.
        if resp.status_code == 429:
            wait = _retry_after(resp)
        elif resp.status_code >= 500:
            wait = 1.5 * attempt
        else:
            wait = None
        if last or wait is None or wait > MAX_WAIT:
            kind = "rate limit" if resp.status_code == 429 else f"error {resp.status_code}"
            raise LLMUnavailable(f"model {kind}: {resp.text[:160]}")
        time.sleep(wait)
    try:
        text = _output_text(resp.json())
    except ValueError as exc:
        raise LLMUnavailable("model did not return JSON") from exc
    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        raise LLMUnavailable("model reply had no JSON object")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise LLMUnavailable("model reply was not valid JSON") from exc
    if not isinstance(data, dict):
        raise LLMUnavailable("model reply was not a JSON object")
    return data
