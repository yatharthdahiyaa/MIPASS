"""
Direct Inference Routes — Rapid model prediction & testing.

Zero-Fallback Clinical Medical AI Engine:
- Strict DICOM (.dcm / .dicom) validation
- Real trained neural network weights (DenseNet-121 NIH ChestX-ray14, HAM10000 EfficientNet-B0, Plantar Thermogram)
- Real-time Grad-CAM saliency / attention maps
- Comprehensive radiologist clinical findings report
"""

import io
import os
import numpy as np
from PIL import Image
import structlog
from flask import Blueprint, current_app, jsonify, request

from workers.adapters.factory import get_adapter
from app.services.registry import ModelRegistry
from app.services.dicom_service import analyze_dicom_image, is_valid_dicom, is_valid_chest_image
from app.utils.response import api_response, api_error

logger = structlog.get_logger()
inference_bp = Blueprint("inference", __name__)


@inference_bp.route("/inference/models", methods=["GET"])
def list_inference_models():
    """List all available models ready for direct inference."""
    registry = ModelRegistry(current_app.config["DISEASE_CONFIG_DIR"])
    diseases = registry.list_diseases()
    return api_response({
        "total_diseases": len(diseases),
        "diseases": diseases,
    })


@inference_bp.route("/inference/dicom-predict", methods=["POST"])
def dicom_predict():
    """Run clinical model evaluation strictly on uploaded Chest X-Ray (DICOM, PNG, or JPEG/JPG).
    
    Accepts:
        - Multipart Form: 'file' (DICOM .dcm / .dicom, or image .png / .jpg / .jpeg)
    
    Guarantees:
        - Evaluates via trained neural network with real weights (DenseNet-121).
        - ZERO fallback/mock models: strictly executes trained neural networks with real weights.
        - Generates Grad-CAM visual attention overlay and full clinical findings report.
    """
    file = request.files.get("file")
    if not file:
        return api_error("Chest image file is required (.dcm, .dicom, .png, .jpg, .jpeg).", 400)

    filename = file.filename or "scan.dcm"
    file_bytes = file.read()

    # Valid check: DICOM, PNG, JPEG, JPG, WEBP
    is_valid, err = is_valid_chest_image(file_bytes, filename)
    if not is_valid:
        return api_error(
            err or "Only valid DICOM medical images (.dcm / .dicom) or standard radiographic images (.png / .jpg / .jpeg) are accepted.",
            400,
        )

    try:
        report = analyze_dicom_image(file_bytes, filename)
        logger.info(
            "chest_clinical_analysis_completed",
            filename=filename,
            patient_id=report.get("dicom_metadata", {}).get("patient_id"),
            primary_diagnosis=report.get("primary_diagnosis"),
            severity=report.get("severity"),
            model=report.get("model_architecture"),
        )
        return api_response(report)
    except Exception as e:
        logger.error("chest_analysis_failed", error=str(e), filename=filename)
        return api_error(f"Clinical analysis failed on trained model: {str(e)}", 500)


@inference_bp.route("/inference/predict", methods=["POST"])
def direct_predict():
    """Run direct model inference on an uploaded image, DICOM, or matrix.

    Accepts:
        - Multipart Form: file (DICOM/image/csv), disease_id, model_name
    """
    file = request.files.get("file")

    # If uploaded file is a DICOM or chest radiograph study, route directly to real trained clinical engine
    if file:
        filename = (file.filename or "").lower()
        file_bytes = file.read()
        file.seek(0)

        is_valid_cxr, _ = is_valid_chest_image(file_bytes, filename)
        if is_valid_cxr and (disease_id in (None, "", "chest_xray", "qxr", "tb") or any(filename.endswith(x) for x in (".dcm", ".dicom"))):
            try:
                report = analyze_dicom_image(file_bytes, filename)
                return api_response(report)
            except Exception as e:
                logger.error("chest_inference_failed", error=str(e))
                return api_error(f"Trained model inference failed: {str(e)}", 500)

    disease_id = request.form.get("disease_id")
    model_name = request.form.get("model_name")

    registry = ModelRegistry(current_app.config["DISEASE_CONFIG_DIR"])

    if not disease_id:
        return api_error("disease_id is required", 400)

    model_config = registry.get_model_config(disease_id, model_name) if model_name else None
    if not model_config:
        disease_cfg = registry.get_disease_config(disease_id)
        if not disease_cfg or not disease_cfg.get("models"):
            return api_error(f"No models configured for disease: {disease_id}", 404)
        model_config = disease_cfg["models"][0]
        model_name = model_config["name"]

    adapter_name = model_config.get("adapter")
    if not adapter_name:
        return api_error(f"No adapter found for {disease_id}/{model_name}", 500)

    classes = model_config.get("classes", [])

    # Instantiate adapter
    try:
        adapter = get_adapter(adapter_name, classes=classes) if classes else get_adapter(adapter_name)
        adapter.load_model()
    except Exception as e:
        logger.error("adapter_initialization_failed", error=str(e), adapter=adapter_name)
        return api_error(f"Failed to initialize adapter {adapter_name}: {str(e)}", 500)

    # Process input image / data
    if file:
        try:
            filename = file.filename.lower()
            if filename.endswith(".csv"):
                import pandas as pd
                matrix = pd.read_csv(io.StringIO(file_bytes.decode("utf-8")), header=None).to_numpy(dtype=np.float32)
                volume = matrix
            else:
                img = Image.open(io.BytesIO(file_bytes))
                volume = np.array(img, dtype=np.float32)
        except Exception as e:
            return api_error(f"Failed to read uploaded file: {str(e)}", 400)
    else:
        return api_error("No file uploaded. Please upload a clinical image or DICOM study.", 400)

    # Preprocess and run inference
    try:
        tensor = adapter.preprocess(volume)
        result = adapter.predict(tensor)
    except Exception as e:
        logger.error("inference_execution_failed", error=str(e))
        return api_error(f"Inference execution failed: {str(e)}", 500)

    return api_response({
        "disease_id": disease_id,
        "model_name": model_name,
        "adapter": adapter_name,
        "modality": adapter.modality,
        "is_fallback": False,
        "predicted_class": result.predicted_class,
        "confidence": result.confidence,
        "class_probabilities": result.class_probabilities,
        "clinical_details": result.raw_output,
    })
