"""Upload processing: decode -> measure -> enhance -> measure -> store."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from . import storage
from .enhance import enhance, is_dicom, load_image, measure, quality_warnings

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".dcm"}


def _ext(data: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if not ext and is_dicom(data):
        return ".dcm"  # DICOM files often have no extension
    if ext not in ALLOWED_EXT:
        raise ValueError(f"unsupported file type '{ext or 'none'}'; allowed: {', '.join(sorted(ALLOWED_EXT))}")
    return ext


def _run(data: bytes, filename: str) -> dict:
    img = load_image(data, filename)
    before = measure(img)
    enhanced, steps = enhance(img)
    after = measure(enhanced)
    return {
        "enhanced_image": enhanced,
        "quality": {"before": before, "after": after, "warnings": quality_warnings(before)},
        "steps": steps,
    }


def process_upload(data: bytes, filename: str) -> dict:
    if not data:
        raise ValueError("empty file")
    ext = _ext(data, filename)
    result = _run(data, filename)
    upload_id = uuid4().hex
    meta = {
        "upload_id": upload_id,
        "filename": Path(filename).name,
        "format": "dicom" if ext == ".dcm" else ext.lstrip("."),
        "size_bytes": len(data),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "quality": result["quality"],
        "steps": result["steps"],
    }
    storage.save(upload_id, data, ext, result["enhanced_image"], meta)
    return meta


def reprocess(upload_id: str) -> dict:
    """Re-run enhancement on a stored original (e.g. after the pipeline changes)."""
    meta = storage.read_meta(upload_id)
    path = storage.original_path(upload_id)
    result = _run(path.read_bytes(), path.name)
    storage.write_enhanced(upload_id, result["enhanced_image"])
    meta.update(quality=result["quality"], steps=result["steps"], reprocessed_at=datetime.now(timezone.utc).isoformat())
    storage.write_meta(upload_id, meta)
    return meta
