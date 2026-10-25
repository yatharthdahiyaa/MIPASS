"""
Indic Language & Clinical AI Routes.
Exposes AI4Bharat IndicTrans2 engine and AIIMS/ABDM clinical terminology.
"""

from flask import Blueprint, jsonify, request
from app.services.indic_service import get_indic_engine

indic_bp = Blueprint("indic", __name__)


@indic_bp.route("/indic/languages", methods=["GET"])
def get_languages():
    """Returns the list of supported Indian languages and Flores-200 tags."""
    engine = get_indic_engine()
    return jsonify({
        "success": True,
        "languages": engine.get_supported_languages(),
        "toolkit": "AI4Bharat IndicTrans2 & IndicTransToolkit",
        "reference": "https://github.com/AI4Bharat/IndicTrans2"
    })


@indic_bp.route("/indic/translate", methods=["POST"])
def translate_text():
    """Translates text or clinical findings into an Indian target language."""
    data = request.get_json() or {}
    text = data.get("text", "")
    target_lang = data.get("target_lang", "hi")
    source_lang = data.get("source_lang", "en")

    if not text:
        return jsonify({"success": False, "error": "Field 'text' is required"}), 400

    engine = get_indic_engine()
    translated = engine.translate(text, source_lang=source_lang, target_lang=target_lang)
    explanation = engine.explain_medical_term(text, target_lang=target_lang)

    return jsonify({
        "success": True,
        "original": text,
        "translated": translated,
        "target_lang": target_lang,
        "clinical_explanation": explanation
    })


@indic_bp.route("/indic/explain", methods=["POST"])
def explain_finding():
    """Provides plain language explanation of a clinical diagnosis in an Indian language."""
    data = request.get_json() or {}
    term = data.get("term", "")
    target_lang = data.get("target_lang", "hi")

    if not term:
        return jsonify({"success": False, "error": "Field 'term' is required"}), 400

    engine = get_indic_engine()
    explanation = engine.explain_medical_term(term, target_lang=target_lang)

    return jsonify({
        "success": True,
        "term": term,
        "target_lang": target_lang,
        "explanation": explanation
    })
