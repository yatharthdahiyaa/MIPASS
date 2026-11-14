"""xAI Grok client (Responses API) for reviewing Grad-CAM maps and drafting the report.

Only pixels are sent: images are re-encoded as PNG, so no DICOM header or patient metadata leaves the
server. Text burned into the pixels is still visible to the model.
"""

import base64
import json
import os
import re

import cv2
import numpy as np
import requests

from .prompt import INSTRUCTIONS, REQUIRED_KEYS

API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/responses")
MODEL = os.getenv("XAI_MODEL", "grok-4.7")
TIMEOUT = float(os.getenv("XAI_TIMEOUT", "600"))


class GrokError(RuntimeError):
    pass


def configured() -> bool:
    return bool(os.getenv("XAI_API_KEY"))


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


def review(images: list[tuple[str, np.ndarray]], model_output: str) -> dict:
    """images: [(label, uint8 image)]. Returns the parsed JSON review plus usage."""
    key = os.getenv("XAI_API_KEY")
    if not key:
        raise GrokError("XAI_API_KEY is not set")

    content: list[dict] = [{"type": "input_text", "text": INSTRUCTIONS}]
    for label, img in images:
        content.append({"type": "input_text", "text": label})
        content.append({"type": "input_image", "image_url": _png_data_url(img), "detail": "high"})
    content.append({"type": "input_text", "text": model_output})

    try:
        resp = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": MODEL, "input": [{"role": "user", "content": content}], "store": False},
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        raise GrokError(f"xAI API unreachable: {exc}") from exc
    if not resp.ok:
        raise GrokError(f"xAI API {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    text = _output_text(data)
    try:
        parsed = _parse_json(text)
    except json.JSONDecodeError as exc:
        raise GrokError(f"Grok did not return valid JSON: {text[:500]}") from exc
    missing = REQUIRED_KEYS - parsed.keys()
    if missing:
        raise GrokError(f"Grok response is missing keys: {sorted(missing)}")
    return {"model": data.get("model", MODEL), "usage": data.get("usage"), "review": parsed}
