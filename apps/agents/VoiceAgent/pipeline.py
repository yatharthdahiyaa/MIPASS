"""Translate text into several languages and speak each one.

Outputs go to <VOICE_AGENT_DIR>/<voice_id>/: <lang>.wav per language and voice.json.
Defaults to <repo>/data/voice, which .gitignore excludes (the text may contain PHI).
"""

import json
import os
import re
import unicodedata
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from . import sarvam

REPO_ROOT = Path(__file__).resolve().parents[3]
VOICE_DIR = Path(os.getenv("VOICE_AGENT_DIR", REPO_ROOT / "data" / "voice"))

MAX_CHARS = 5000
DEFAULT_SOURCE = "en"
DEFAULT_TARGETS = ("en", "hi", "bn", "ta", "te")  # the frontend's UI languages
DEFAULT_STYLE = "modern-colloquial"

_ID = re.compile(r"^[0-9a-f]{32}$")
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")


def _numbers(text: str) -> Counter:
    """Numbers in any script as ASCII digits ('५००' -> '500'), commas dropped ('1,00,000' -> '100000')."""
    return Counter(
        "".join(str(unicodedata.decimal(c)) if c.isdecimal() else c for c in m.group() if c != ",")
        for m in _NUMBER.finditer(text)
    )


def _check(text, source, targets, style, speaker) -> tuple[str, list[str]]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("text is required")
    text = text.strip()
    if len(text) > MAX_CHARS:
        raise ValueError(f"text is longer than {MAX_CHARS} characters")
    if targets is None:
        targets = list(DEFAULT_TARGETS)
    if not isinstance(targets, list) or not targets:
        raise ValueError("targets must be a non-empty list of language codes")
    for code in [source, *targets]:
        if code not in sarvam.LANGUAGES:
            raise ValueError(f"unsupported language '{code}'; use one of: {', '.join(sarvam.LANGUAGES)}")
    if style not in sarvam.STYLES:
        raise ValueError(f"unsupported style '{style}'; use one of: {', '.join(sarvam.STYLES)}")
    if speaker is not None and not isinstance(speaker, str):
        raise ValueError("speaker must be a string")
    return text, list(dict.fromkeys(targets))


def _speak_one(language: str, text: str, source: str, style: str, speaker: str | None, folder: Path) -> dict:
    out: dict = {"language": language}
    try:
        out["text"] = text if language == source else sarvam.translate(text, source, language, style)
        missing = sorted(_numbers(text) - _numbers(out["text"]))
        out["warnings"] = [f"numbers missing from the translation: {', '.join(missing)}"] if missing else []
        (folder / f"{language}.wav").write_bytes(sarvam.speak(out["text"], language, speaker))
        out["audio"] = f"/voice/{folder.name}/{language}.wav"
    except sarvam.SarvamError as exc:
        out["error"] = str(exc)
    return out


def translate_and_speak(text, source=None, targets=None, style=None, speaker=None) -> dict:
    """Translate `text` into each target language and speak it. A language that fails carries an "error"."""
    source = source or DEFAULT_SOURCE
    style = style or DEFAULT_STYLE
    speaker = speaker or None
    text, targets = _check(text, source, targets, style, speaker)
    if not sarvam.configured():
        raise sarvam.SarvamError("SARVAM_API_KEY is not set")

    voice_id = uuid.uuid4().hex
    folder = VOICE_DIR / voice_id
    folder.mkdir(parents=True)
    with ThreadPoolExecutor(max_workers=min(4, len(targets))) as pool:
        outputs = list(pool.map(lambda lang: _speak_one(lang, text, source, style, speaker, folder), targets))

    record = {
        "voice_id": voice_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "machine_translation_unverified",
        "source": {"language": source, "text": text},
        "provider": {
            "name": "Sarvam AI",
            "translate_model": sarvam.TRANSLATE_MODEL,
            "tts_model": sarvam.TTS_MODEL,
            "style": style,
            "speaker": speaker,
        },
        "outputs": outputs,
    }
    (folder / "voice.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return record


def _folder(voice_id: str) -> Path:
    if not _ID.match(voice_id):
        raise ValueError("invalid voice id")
    return VOICE_DIR / voice_id


def read(voice_id: str) -> dict:
    path = _folder(voice_id) / "voice.json"
    if not path.exists():
        raise KeyError(f"unknown voice id '{voice_id}'")
    return json.loads(path.read_text(encoding="utf-8"))


def audio_path(voice_id: str, name: str) -> Path:
    """Only serve files this pipeline wrote: <supported language>.wav."""
    if not name.endswith(".wav") or name.removesuffix(".wav") not in sarvam.LANGUAGES:
        raise KeyError(f"unknown audio '{name}'")
    path = _folder(voice_id) / name
    if not path.exists():
        raise KeyError(f"unknown audio '{name}'")
    return path
