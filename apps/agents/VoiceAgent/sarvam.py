"""Sarvam AI client: Mayura translation and Bulbul text-to-speech.

The text is sent to Sarvam AI as-is. Text longer than an API's per-request limit is split at sentence ends.
"""

import base64
import io
import os
import re
import wave

import requests

API_URL = "https://api.sarvam.ai"
TRANSLATE_MODEL = "mayura:v1"
TTS_MODEL = "bulbul:v3"
TRANSLATE_MAX_CHARS = 1000
TTS_MAX_CHARS = 2500
TIMEOUT = 60

# Languages both Mayura and Bulbul support; the API codes add "-IN".
LANGUAGES = ("en", "hi", "bn", "ta", "te", "kn", "ml", "mr", "gu", "pa", "od")
STYLES = ("formal", "modern-colloquial", "classic-colloquial", "code-mixed")

_SENTENCE_END = re.compile(r"(?<=[.?!।])\s+|\n+")


class SarvamError(RuntimeError):
    pass


def configured() -> bool:
    return bool(os.getenv("SARVAM_API_KEY"))


def _post(path: str, body: dict) -> dict:
    key = os.getenv("SARVAM_API_KEY")
    if not key:
        raise SarvamError("SARVAM_API_KEY is not set")
    try:
        resp = requests.post(API_URL + path, headers={"api-subscription-key": key}, json=body, timeout=TIMEOUT)
    except requests.RequestException as exc:
        raise SarvamError(f"Sarvam API unreachable: {exc}") from exc
    if not resp.ok:
        try:
            message = resp.json()["error"]["message"]
        except (ValueError, KeyError, TypeError):
            message = resp.text[:500]
        raise SarvamError(f"Sarvam {path} {resp.status_code}: {message}")
    try:
        return resp.json()
    except ValueError as exc:
        raise SarvamError(f"Sarvam {path} did not return JSON: {resp.text[:200]}") from exc


def split_text(text: str, limit: int) -> list[str]:
    """Whole sentences packed into chunks of at most `limit` characters. Text within the limit is returned as-is."""
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    current = ""
    for sentence in _SENTENCE_END.split(text):
        for piece in _split_long(sentence.strip(), limit):
            if current and len(current) + 1 + len(piece) > limit:
                chunks.append(current)
                current = piece
            else:
                current = f"{current} {piece}" if current else piece
    if current:
        chunks.append(current)
    return chunks


def _split_long(sentence: str, limit: int) -> list[str]:
    pieces = []
    while len(sentence) > limit:
        cut = sentence.rfind(" ", 0, limit + 1)
        cut = cut if cut > 0 else limit
        pieces.append(sentence[:cut].rstrip())
        sentence = sentence[cut:].lstrip()
    return pieces + [sentence] if sentence else pieces


def translate(text: str, source: str, target: str, style: str) -> str:
    parts = []
    for chunk in split_text(text, TRANSLATE_MAX_CHARS):
        data = _post(
            "/translate",
            {
                "input": chunk,
                "source_language_code": f"{source}-IN",
                "target_language_code": f"{target}-IN",
                "model": TRANSLATE_MODEL,
                "mode": style,
                "numerals_format": "international",
            },
        )
        translated = data.get("translated_text")
        if not isinstance(translated, str):
            raise SarvamError("Sarvam /translate response has no translated_text")
        parts.append(translated)
    return " ".join(parts)


def speak(text: str, language: str, speaker: str | None = None) -> bytes:
    """One WAV for the whole text: each chunk is synthesised separately and the clips are joined."""
    clips = []
    for chunk in split_text(text, TTS_MAX_CHARS):
        body = {"text": chunk, "language_code": f"{language}-IN", "model": TTS_MODEL}
        if speaker:
            body["speaker"] = speaker
        audios = _post("/text-to-speech", body).get("audios") or []
        if not audios:
            raise SarvamError("Sarvam /text-to-speech returned no audio")
        clips.extend(_decode(a) for a in audios)
    return join_wav(clips)


def _decode(audio: str) -> bytes:
    try:
        return base64.b64decode(audio)
    except ValueError as exc:
        raise SarvamError("Sarvam returned audio that is not valid base64") from exc


def join_wav(clips: list[bytes]) -> bytes:
    if len(clips) == 1:
        return clips[0]
    fmt, frames = None, []
    try:
        for clip in clips:
            with wave.open(io.BytesIO(clip), "rb") as w:
                clip_fmt = (w.getnchannels(), w.getsampwidth(), w.getframerate())
                if fmt is None:
                    fmt = clip_fmt
                elif clip_fmt != fmt:
                    raise SarvamError("Sarvam audio clips have different formats")
                frames.append(w.readframes(w.getnframes()))
    except (wave.Error, EOFError) as exc:
        raise SarvamError(f"could not read Sarvam audio: {exc}") from exc
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(fmt[0])
        w.setsampwidth(fmt[1])
        w.setframerate(fmt[2])
        w.writeframes(b"".join(frames))
    return out.getvalue()
