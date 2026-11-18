"""The X-ray review client: provider choice, what it sends, rate-limit retry. No network."""

import json

import numpy as np
import pytest

cv2 = pytest.importorskip("cv2")

from XAI import grok  # noqa: E402
from XAI.prompt import REQUIRED_KEYS  # noqa: E402


class _Resp:
    def __init__(self, status=200, body=None, headers=None):
        self.status_code, self.ok = status, 200 <= status < 300
        self._body = body if body is not None else {}
        self.headers = headers or {}
        self.text = json.dumps(self._body)

    def json(self):
        return self._body


def _answer():
    review = {k: [] for k in REQUIRED_KEYS}
    text = json.dumps(review)
    return _Resp(200, {"model": "m", "usage": {"input_tokens": 1}, "output": [
        {"type": "message", "content": [{"type": "output_text", "text": text}]}]})


@pytest.fixture
def env(monkeypatch):
    for name in ("XAI_REVIEW_PROVIDER", "CHAT_PROVIDER", "XAI_REVIEW_MODEL", "XAI_MODEL",
                 "XAI_REVIEW_MAX_SIDE", "XAI_REVIEW_MAX_IMAGES"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("XAI_API_KEY", "xai-test")
    return monkeypatch


def _capture(monkeypatch, responses):
    sent = []

    def post(url, headers, json, timeout):
        sent.append((url, json))
        return responses.pop(0)

    monkeypatch.setattr(grok.requests, "post", post)
    monkeypatch.setattr(grok.time, "sleep", lambda s: None)
    return sent


def _images(n_maps: int, side: int = 2000):
    img = np.zeros((side, int(side * 0.8), 3), np.uint8)
    return [("ORIGINAL", img)] + [(f"GRAD-CAM: Finding {i}", img) for i in range(n_maps)]


def _sent_images(body):
    content = body["input"][0]["content"]
    pngs = [c["image_url"] for c in content if c["type"] == "input_image"]
    labels = [c["text"] for c in content if c["type"] == "input_text" and c["text"].startswith(("ORIGINAL", "GRAD-CAM"))]
    return pngs, labels, content[-1]["text"]


def test_follows_the_chat_provider_and_uses_a_model_that_reads_images(env):
    env.setenv("CHAT_PROVIDER", "groq")
    sent = _capture(env, [_answer()])
    out = grok.review(_images(1), "scores")
    url, body = sent[0]
    assert "api.groq.com" in url and body["model"] == "qwen/qwen3.8-27b" and "store" not in body
    assert out["provider"] == "groq"


def test_xai_still_works_when_chosen(env):
    env.setenv("XAI_REVIEW_PROVIDER", "xai")
    sent = _capture(env, [_answer()])
    grok.review(_images(1), "scores")
    url, body = sent[0]
    assert "api.x.ai" in url and body["model"] == "grok-4.7" and body["store"] is False


def test_on_groq_images_are_shrunk_and_only_the_strongest_map_is_sent(env):
    sent = _capture(env, [_answer()])
    out = grok.review(_images(5), "scores")
    pngs, labels, last_text = _sent_images(sent[0][1])
    assert labels == ["ORIGINAL", "GRAD-CAM: Finding 0"] and out["maps_reviewed"] == ["Finding 0"]
    import base64

    for url in pngs:
        img = cv2.imdecode(np.frombuffer(base64.b64decode(url.split(",", 1)[1]), np.uint8), cv2.IMREAD_UNCHANGED)
        assert max(img.shape[:2]) <= 512
    # The model is told which maps it did not see, so it cannot describe them.
    assert "None is attached for: GRAD-CAM: Finding 1, GRAD-CAM: Finding 2, GRAD-CAM: Finding 3, GRAD-CAM: Finding 4" in last_text


def test_a_request_still_too_large_drops_heat_maps_until_it_fits(env):
    env.setenv("XAI_REVIEW_MAX_IMAGES", "3")
    too_large = _Resp(413, {"error": {"message": "Request too large for model", "code": "rate_limit_exceeded"}})
    sent = _capture(env, [too_large, too_large, _answer()])
    out = grok.review(_images(4), "scores")
    assert [len(_sent_images(body)[1]) for _, body in sent] == [3, 2, 1]
    assert out["maps_reviewed"] == []
    assert "attached only for: none" in _sent_images(sent[-1][1])[2]


def test_too_large_even_with_the_original_alone_is_an_error(env):
    too_large = _Resp(413, {"error": {"message": "Request too large"}})
    sent = _capture(env, [too_large, too_large])
    with pytest.raises(grok.GrokError, match="413"):
        grok.review(_images(1), "scores")
    assert len(sent) == 2


def test_limits_can_be_lifted(env):
    env.setenv("XAI_REVIEW_MAX_IMAGES", "0")
    env.setenv("XAI_REVIEW_MAX_SIDE", "0")
    sent = _capture(env, [_answer()])
    grok.review(_images(5, side=600), "scores")
    pngs, labels, last_text = _sent_images(sent[0][1])
    assert len(labels) == 6 and "NOTE" not in last_text


def test_waits_once_for_a_short_rate_limit(env):
    sent = _capture(env, [_Resp(429, {"error": {"message": "Please try again in 2.1s."}}), _answer()])
    assert grok.review(_images(1), "scores")["provider"] == "groq"
    assert len(sent) == 2


def test_gives_up_on_a_long_rate_limit(env):
    sent = _capture(env, [_Resp(429, {}, {"retry-after": "120"})])
    with pytest.raises(grok.GrokError, match="429"):
        grok.review(_images(1), "scores")
    assert len(sent) == 1


def test_off_or_missing_key_is_reported(env):
    env.setenv("XAI_REVIEW_PROVIDER", "off")
    assert not grok.configured() and "turned off" in grok.not_configured_reason()
    env.setenv("XAI_REVIEW_PROVIDER", "groq")
    env.delenv("GROQ_API_KEY")
    assert not grok.configured() and grok.not_configured_reason() == "GROQ_API_KEY is not set"
