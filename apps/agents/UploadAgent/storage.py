"""On-disk storage for uploads: <UPLOAD_AGENT_DIR>/<upload_id>/{original.*, enhanced.png, meta.json}.

Defaults to <repo>/data/uploads, which .gitignore excludes (uploads may contain PHI).
"""

import json
import os
import re
from pathlib import Path

import cv2
import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_DIR = Path(os.getenv("UPLOAD_AGENT_DIR", REPO_ROOT / "data" / "uploads"))

_ID = re.compile(r"^[0-9a-f]{32}$")


def _dir(upload_id: str) -> Path:
    if not _ID.match(upload_id):
        raise ValueError("invalid upload id")
    return UPLOAD_DIR / upload_id


def upload_dir(upload_id: str) -> Path:
    """Folder for an upload's files; other agents write their outputs in subfolders of it."""
    return _dir(upload_id)


def save(upload_id: str, original: bytes, ext: str, enhanced: np.ndarray, meta: dict) -> None:
    folder = _dir(upload_id)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"original{ext}").write_bytes(original)
    write_enhanced(upload_id, enhanced)
    write_meta(upload_id, meta)


def write_enhanced(upload_id: str, enhanced: np.ndarray) -> None:
    ok, buf = cv2.imencode(".png", enhanced)
    if not ok:
        raise RuntimeError("could not encode enhanced image")
    (_dir(upload_id) / "enhanced.png").write_bytes(buf.tobytes())


def write_meta(upload_id: str, meta: dict) -> None:
    (_dir(upload_id) / "meta.json").write_text(json.dumps(meta, indent=2))


def read_meta(upload_id: str) -> dict:
    path = _dir(upload_id) / "meta.json"
    if not path.exists():
        raise KeyError(f"unknown upload '{upload_id}'")
    return json.loads(path.read_text())


def original_path(upload_id: str) -> Path:
    matches = list(_dir(upload_id).glob("original.*"))
    if not matches:
        raise KeyError(f"unknown upload '{upload_id}'")
    return matches[0]


def enhanced_path(upload_id: str) -> Path:
    path = _dir(upload_id) / "enhanced.png"
    if not path.exists():
        raise KeyError(f"unknown upload '{upload_id}'")
    return path
