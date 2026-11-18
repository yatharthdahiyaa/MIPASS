"""Vision-model client (OpenAI-style Responses API) for reviewing Grad-CAM maps and drafting the report.

The provider follows the chat by default, so one key serves both:

    XAI_REVIEW_PROVIDER  groq | xai | off   (default: CHAT_PROVIDER, else groq)
    XAI_REVIEW_MODEL     default qwen/qwen3.8-27b on Groq (reads images), grok-4.7 on xAI
    GROQ_API_KEY / XAI_API_KEY to match;  XAI_TIMEOUT (seconds, default 600)
    XAI_REVIEW_MAX_SIDE, XAI_REVIEW_MAX_IMAGES   what is sent (0 = no limit); defaults: 512 px and
                         the original + the strongest heat map on Groq (free tier: 7,000 input tokens
                         a minute; fewer maps are tried if a request is still too large), no limit on xAI

The model must accept images: on Groq, openai/gpt-oss-120b (the chat model) does not.

Only pixels are sent: images are re-encoded as PNG, so no DICOM header or patient metadata leaves the
server. Text burned into the pixels is still visible to the model. (Module and result names keep
"grok" from when xAI was the only provider.)
"""

import base64
import json
import os
import re
import time

import cv2
import numpy as np
import requests

from .prompt import INSTRUCTIONS, REQUIRED_KEYS

# name -> (Responses API URL, key variable, default vision model, extra request fields)
_PROVIDERS = {
    "groq": ("https://api.groq.com/openai/v1/responses", "GROQ_API_KEY", "qwen/qwen3.8-27b", {}),
    "xai": ("https://api.x.ai/v1/responses", "XAI_API_KEY", "grok-4.7", {"store": False}),  # xAI keeps nothing
}
TIMEOUT = float(os.getenv("XAI_TIMEOUT", "600"))


class GrokError(RuntimeError):
    pass


def _provider() -> tuple[str, tuple] | None:
    name = (os.getenv("XAI_REVIEW_PROVIDER") or os.getenv("CHAT_PROVIDER") or "groq").strip().lower()
    if name == "off" or name not in _PROVIDERS:
        return None
    return name, _PROVIDERS[name]


def _model(cfg: tuple) -> str:
    # XAI_MODEL is the older name, honoured for xAI only.
    return os.getenv("XAI_REVIEW_MODEL") or (os.getenv("XAI_MODEL") if cfg[1] == "XAI_API_KEY" else None) or cfg[2]


def configured() -> bool:
    p = _provider()
    return bool(p and os.getenv(p[1][1]))


def not_configured_reason() -> str:
    p = _provider()
    if p is None:
        return "the X-ray review model is turned off (XAI_REVIEW_PROVIDER)"
    return f"{p[1][1]} is not set"


def _png_data_url(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise GrokError("could not encode image")
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def _output_text(data: dict) -> str:
    return "".join(
        c.get("text", "")
        for item in data.get("output", [])
        if item.get("type") == "message"
        for c in item.get("content", [])
        if c.get("type") == "output_text"
    )


def _parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise
        return json.loads(text[start : end + 1])


# Per-provider defaults for what is sent: (longest image side in px, images per request; None = no limit).
# Groq's free tier allows 7,000 input tokens a minute for qwen/qwen3.8-27b, and Groq counts about
# 2,000 tokens per image whatever its size, plus about 2,500 for the text. So on Groq: the original and
# the strongest heat map, at 512 px (smaller uploads; the model sees no more detail than that anyway).
# If a request is still too large, review() drops heat maps one at a time until it fits.
_LIMITS = {"groq": (512, 2), "xai": (None, None)}
MAX_RATE_LIMIT_WAIT = 30.0  # seconds; a longer wait fails the review (the scores and maps still stand)


def _limit(name: str, default: int | None) -> int | None:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    value = int(raw)
    return value if value > 0 else None  # 0 = no limit


def _fit(img: np.ndarray, max_side: int | None) -> np.ndarray:
    h, w = img.shape[:2]
    if not max_side or max(h, w) <= max_side:
        return img
    scale = max_side / max(h, w)
    return cv2.resize(img, (max(1, round(w * scale)), max(1, round(h * scale))), interpolation=cv2.INTER_AREA)


def _retry_after(resp: requests.Response) -> float | None:
    """Seconds Groq/xAI ask us to wait on a 429, if they say."""
    try:
        return float(resp.headers.get("retry-after", "")) + 0.5
    except ValueError:
        m = re.search(r"try again in ([\d.]+)s", resp.text)
        return float(m.group(1)) + 0.5 if m else None


def review(images: list[tuple[str, np.ndarray]], model_output: str) -> dict:
    """images: [(label, uint8 image)], the original first, then heat maps strongest first.

    Returns the parsed JSON review plus usage.
    """
    p = _provider()
    if p is None:
        raise GrokError(not_configured_reason())
    provider, cfg = p
    api_url, key_var, _, extra = cfg
    key = os.getenv(key_var)
    if not key:
        raise GrokError(f"{key_var} is not set")
    model = _model(cfg)

    side_default, count_default = _LIMITS.get(provider, (None, None))
    max_side = _limit("XAI_REVIEW_MAX_SIDE", side_default)
    max_images = _limit("XAI_REVIEW_MAX_IMAGES", count_default)
    keep = min(len(images), max_images) if max_images else len(images)
    encoded = [(label, _png_data_url(_fit(img, max_side))) for label, img in images[:keep]]

    def body_for(n: int) -> dict:
        """The request with the original and the n - 1 strongest heat maps."""
        text = model_output
        if n < len(images):
            text += (
                "\n\nNOTE: to fit the request, heat maps are attached only for: "
                + (", ".join(label for label, _ in encoded[1:n]) or "none")
                + ". None is attached for: "
                + ", ".join(label for label, _ in images[n:])
                + ". Do not describe heat maps you were not shown; say they were not reviewed."
            )
        content: list[dict] = [{"type": "input_text", "text": INSTRUCTIONS}]
        for label, url in encoded[:n]:
            content.append({"type": "input_text", "text": label})
            content.append({"type": "input_image", "image_url": url, "detail": "high"})
        content.append({"type": "input_text", "text": text})
        return {"model": model, "input": [{"role": "user", "content": content}], **extra}

    def post(body: dict) -> requests.Response:
        try:
            return requests.post(
                api_url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=body,
                timeout=TIMEOUT,
            )
        except requests.RequestException as exc:
            raise GrokError(f"{provider} API unreachable: {exc}") from exc

    waited = False
    while True:
        resp = post(body_for(keep))
        if resp.status_code == 413 and keep > 1:
            keep -= 1  # too large for the per-minute token limit: drop the weakest heat map
            continue
        wait = _retry_after(resp) if resp.status_code == 429 and not waited else None
        if wait is None or wait > MAX_RATE_LIMIT_WAIT:
            break
        waited = True
        time.sleep(wait)  # rate limited for a few seconds: wait once, then give up
    if not resp.ok:
        raise GrokError(f"{provider} API {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    text = _output_text(data)
    try:
        parsed = _parse_json(text)
    except json.JSONDecodeError as exc:
        raise GrokError(f"{model} did not return valid JSON: {text[:500]}") from exc
    missing = REQUIRED_KEYS - parsed.keys()
    if missing:
        raise GrokError(f"{model} response is missing keys: {sorted(missing)}")
    return {
        "provider": provider,
        "model": data.get("model", model),
        "usage": data.get("usage"),
        # Heat maps the model actually saw (the rest were left out to fit the request).
        "maps_reviewed": [label.removeprefix("GRAD-CAM: ") for label, _ in encoded[1:keep]],
        "review": parsed,
    }
