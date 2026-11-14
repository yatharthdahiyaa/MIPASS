"""UploadAgent: quality checks and enhancement for uploaded images (PNG, JPEG, BMP, TIFF, DICOM).

- POST /upload            multipart field 'file' -> stores original, returns quality report + links
- GET  /upload/<id>       quality report
- GET  /upload/<id>/enhanced | /original
- agent 'upload_enhance'  {"upload_id": ...} re-runs enhancement on a stored original
"""

from registry import agent

from .pipeline import process_upload, reprocess
from .routes import upload_bp

__all__ = ["upload_bp", "process_upload", "reprocess"]


@agent(
    "upload_enhance",
    description="Checks image quality and enhances an uploaded image (denoise, contrast, CLAHE, sharpen).",
    inputs={
        "type": "object",
        "properties": {"upload_id": {"type": "string", "description": "Id returned when the image was uploaded."}},
        "required": ["upload_id"],
    },
)
def upload_enhance(inputs, backend):
    upload_id = inputs.get("upload_id")
    if not upload_id:
        raise ValueError("inputs.upload_id is required")
    return reprocess(upload_id)
