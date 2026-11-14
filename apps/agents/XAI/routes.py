"""HTTP routes for XAI. Images arrive through UploadAgent, so every analysed image has an upload_id."""

from flask import Blueprint, jsonify, request, send_file

from UploadAgent import process_upload
from UploadAgent.enhance import ImageLoadError

from . import pipeline
from .model import ModelUnavailable

xai_bp = Blueprint("xai", __name__)


def _flag(value, default=True) -> bool:
    if value is None:
        return default
    return str(value).lower() not in ("0", "false", "no", "off")


@xai_bp.post("/xai/analyze")
def analyze():
    """multipart 'file' (stored via UploadAgent first) or JSON {"upload_id": ...}. Optional grok=false."""
    file = request.files.get("file")
    body = request.get_json(silent=True) or {}
    use_grok = _flag(request.args.get("grok", request.form.get("grok", body.get("grok"))))
    try:
        if file is not None and file.filename:
            upload_id = process_upload(file.read(), file.filename)["upload_id"]
        else:
            upload_id = body.get("upload_id")
            if not upload_id:
                return jsonify(error="send multipart field 'file' or JSON {'upload_id': ...}"), 400
        return jsonify(pipeline.analyze(upload_id, use_grok=use_grok)), 201
    except ModelUnavailable as exc:
        return jsonify(error=str(exc)), 503
    except KeyError as exc:
        return jsonify(error=str(exc).strip("'\"")), 404
    except (ValueError, ImageLoadError) as exc:
        return jsonify(error=str(exc)), 400


@xai_bp.get("/xai/<upload_id>")
def get_analysis(upload_id: str):
    try:
        return jsonify(pipeline.read(upload_id))
    except (KeyError, ValueError) as exc:
        return jsonify(error=str(exc).strip("'\"")), 404


@xai_bp.get("/xai/<upload_id>/image/<name>")
def get_image(upload_id: str, name: str):
    try:
        return send_file(pipeline.image_path(upload_id, name), mimetype="image/png")
    except (KeyError, ValueError) as exc:
        return jsonify(error=str(exc).strip("'\"")), 404
