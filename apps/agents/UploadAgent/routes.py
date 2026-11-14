"""HTTP routes for uploads. Every uploaded image is sent through the UploadAgent pipeline."""

from flask import Blueprint, jsonify, request, send_file

from . import storage
from .enhance import ImageLoadError
from .pipeline import process_upload

upload_bp = Blueprint("upload_agent", __name__)


def _links(upload_id: str) -> dict:
    return {
        "self": f"/upload/{upload_id}",
        "original": f"/upload/{upload_id}/original",
        "enhanced": f"/upload/{upload_id}/enhanced",
    }


@upload_bp.post("/upload")
def upload():
    file = request.files.get("file")
    if file is None or not file.filename:
        return jsonify(error="send the image as multipart form field 'file'"), 400
    try:
        meta = process_upload(file.read(), file.filename)
    except (ValueError, ImageLoadError) as exc:
        return jsonify(error=str(exc)), 400
    return jsonify(**meta, links=_links(meta["upload_id"])), 201


@upload_bp.get("/upload/<upload_id>")
def get_upload(upload_id: str):
    try:
        meta = storage.read_meta(upload_id)
    except (KeyError, ValueError) as exc:
        return jsonify(error=str(exc)), 404
    return jsonify(**meta, links=_links(upload_id))


@upload_bp.get("/upload/<upload_id>/<kind>")
def get_image(upload_id: str, kind: str):
    try:
        if kind == "enhanced":
            return send_file(storage.enhanced_path(upload_id), mimetype="image/png")
        if kind == "original":
            path = storage.original_path(upload_id)
            return send_file(path, as_attachment=path.suffix == ".dcm", download_name=f"{upload_id}{path.suffix}")
    except (KeyError, ValueError) as exc:
        return jsonify(error=str(exc)), 404
    return jsonify(error="kind must be 'original' or 'enhanced'"), 404
