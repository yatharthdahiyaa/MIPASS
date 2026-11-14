"""HTTP routes for VoiceAgent."""

from flask import Blueprint, jsonify, request, send_file

from . import pipeline, sarvam

voice_bp = Blueprint("voice", __name__)


@voice_bp.post("/voice/translate")
def translate():
    """JSON {"text", "source"?, "targets"?, "style"?, "speaker"?}. 502 when no language could be produced."""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(error="send a JSON object with 'text'"), 400
    try:
        record = pipeline.translate_and_speak(
            body.get("text"),
            source=body.get("source"),
            targets=body.get("targets"),
            style=body.get("style"),
            speaker=body.get("speaker"),
        )
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except sarvam.SarvamError as exc:
        return jsonify(error=str(exc)), 503
    ok = any("audio" in o for o in record["outputs"])
    return jsonify(record), 201 if ok else 502


@voice_bp.get("/voice/<voice_id>")
def get_record(voice_id: str):
    try:
        return jsonify(pipeline.read(voice_id))
    except (KeyError, ValueError) as exc:
        return jsonify(error=exc.args[0]), 404


@voice_bp.get("/voice/<voice_id>/<name>")
def get_audio(voice_id: str, name: str):
    try:
        return send_file(pipeline.audio_path(voice_id, name), mimetype="audio/wav")
    except (KeyError, ValueError) as exc:
        return jsonify(error=exc.args[0]), 404
