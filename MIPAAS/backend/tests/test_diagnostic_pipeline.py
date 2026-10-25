"""
Automated Integration and Safety Tests for 7-Agent Diagnostic Pipeline.
Validates:
1. Full 7-stage deterministic execution on valid DICOM studies.
2. Immediate rejection of corrupt / zero-byte payloads (Agent 1 Gatekeeper).
3. Quality metric calculation (Laplacian blur, SNR, Dynamic Range) (Agent 3).
4. Non-biasing EHR context isolation (Agent 2).
5. Calibrated neural network probabilities & severity stratification (Agent 5).
6. Grad-CAM explainability heatmap overlay generation (Agent 6).
7. Certified report integrity, digital signature, and medical disclaimer (Agent 7).
8. Patient privacy & pseudonymization integrity (DPDP Act 2023 / HIPAA).
"""

import os
import pytest
import numpy as np
from run_diagnostic_pipeline import run_pipeline, compute_laplacian_variance, compute_snr_db
from app.services.dicom_service import (
    CHEST_CLASSES,
    CHEST_HIGH_CONFIDENCE_THRESHOLDS,
    classify_chest_probabilities,
)


def test_pipeline_valid_dicom_execution():
    """Verify full end-to-end execution of all 7 agents on sample_cxr.dcm."""
    sample_path = os.path.join(os.path.dirname(__file__), "..", "sample_cxr.dcm")
    assert os.path.exists(sample_path), "sample_cxr.dcm must exist in backend root"

    result = run_pipeline(sample_path, service_id="qxr", patient_id="TEST-PATIENT")

    # Top-level status
    assert result["status"] == "success"
    assert result["patient_id"] == "TEST-PATIENT"
    assert result["service_id"] == "qxr"
    assert result["demo_mode"] is False
    assert result["model_availability"]["available"] is True
    assert result["total_duration_ms"] > 0

    # Verify all 7 stages exist
    stages = result["stages"]
    assert "agent_1_validation" in stages
    assert "agent_2_clinical_compatibility" in stages
    assert "agent_3_quality_assessment" in stages
    assert "agent_4_preprocessing" in stages
    assert "agent_5_ai_inference" in stages
    assert "agent_6_explainability" in stages
    assert "agent_7_report_generation" in stages

    # Agent 1: Validation
    a1 = stages["agent_1_validation"]
    assert a1["decision"] == "accepted"
    assert a1["is_dicom"] is True
    assert "DICOM" in a1["file_signature"]
    assert a1["authenticity_score"] >= 0.95

    # Agent 2: Clinical Compatibility & Non-biasing context
    a2 = stages["agent_2_clinical_compatibility"]
    assert a2["decision"] == "compatible"
    assert a2["detected_modality"] == "CXR"
    assert a2["patient_context"]["patient_pseudonym"] == "TEST-PATIENT"
    assert "non_biasing_enforcement" in a2["patient_context"]

    # Agent 3: Quality Assessment
    a3 = stages["agent_3_quality_assessment"]
    assert a3["decision"] == "suitable_for_analysis"
    assert a3["laplacian_variance"] > 0
    assert a3["snr_db"] >= 0

    # Agent 4: Preprocessing
    a4 = stages["agent_4_preprocessing"]
    assert a4["immutable_source_archived"] is True
    assert a4["enhanced_preview_generated"] is True
    assert len(result["original_image_b64"]) > 100
    assert len(result["preprocessed_image_b64"]) > 100

    # Agent 5: AI Inference
    a5 = stages["agent_5_ai_inference"]
    assert a5["model_architecture"] == "TorchXRayVision DenseNet-121"
    assert a5["primary_diagnosis"] != ""
    assert 0.0 <= a5["primary_confidence"] <= 1.0
    assert a5["severity"] in ("CRITICAL", "HIGH", "MODERATE", "NORMAL")
    assert len(a5["all_pathologies"]) == 18
    assert a5["demo_mode"] is False
    assert a5["operating_threshold"] == 0.5
    assert a5["calibrated_threshold"] > 0.5
    assert isinstance(a5["positive_findings"], list)
    assert isinstance(a5["indeterminate_findings"], list)
    assert isinstance(a5["no_high_confidence_finding"], bool)

    # Agent 6: Explainability — location must come from the heatmap
    a6 = stages["agent_6_explainability"]
    assert a6["method"] == "Grad-CAM (Gradient-Weighted Class Activation Mapping)"
    assert len(result["gradcam_heatmap_b64"]) > 100
    assert len(result["heatmap_annotated_b64"]) > 100
    assert a6["saliency_analysis"] is not None
    assert a6["saliency_analysis"]["dominant_zone"]
    assert a6["saliency_analysis"]["dominant_share_pct"] > 0
    assert a6["anatomical_localization"]
    assert "patient" in a6["laterality_note"].lower()
    assert "Grad-CAM saliency represents feature importance" in a6["uncertainty_caveat"]

    # Agent 7: Report Generation
    a7 = stages["agent_7_report_generation"]
    assert a7["report_id"].startswith("REP-MIP-")
    assert a7["digital_signature"].startswith("MIP-SIG-")
    assert a7["verification_status"] == "DRAFT_AI_ASSISTED"
    assert "NOTICE: This diagnostic report is an artificial intelligence decision-support output" in a7["medical_disclaimer"]
    assert len(a7["recommendations"]) > 0
    assert a7["no_high_confidence_finding"] is True
    assert a7["patient_report"]["headline"]
    assert a7["patient_report"]["what_we_found"]
    assert a7["patient_report"]["how_serious"]
    assert len(a7["patient_report_text"]) > 200
    assert result["patient_report"]["no_high_confidence_finding"] is True
    assert result["primary_diagnosis"] == "No high-confidence abnormality detected"
    assert result["candidate_diagnosis"] is not None
    assert result["confidence_percentage"] < 100.0


def test_pipeline_rejects_truncated_file(tmp_path):
    """Verify that Agent 1 rejects empty or truncated files immediately."""
    corrupt_file = tmp_path / "corrupt_scan.dcm"
    corrupt_file.write_bytes(b"TooSmallToBAMedicalScan")

    result = run_pipeline(str(corrupt_file), service_id="qxr", patient_id="TEST-PATIENT")

    assert result["status"] == "rejected"
    assert result["agent_failed"] == "Agent 1: Upload Validation & Authenticity"
    assert result["rejection_code"] == "EMPTY_OR_TRUNCATED_FILE"


def test_laplacian_variance_calculation():
    """Verify Laplacian variance focus metric correctly discriminates between sharp and flat images."""
    flat_img = np.zeros((100, 100), dtype=np.uint8)
    var_flat = compute_laplacian_variance(flat_img)
    assert var_flat == 0.0

    # High frequency noise / sharp pattern
    np.random.seed(42)
    sharp_img = np.random.randint(0, 255, (100, 100), dtype=np.uint8)
    var_sharp = compute_laplacian_variance(sharp_img)
    assert var_sharp > 1000.0


def test_snr_calculation():
    """Verify SNR dB calculation behaves predictably."""
    pure_img = np.ones((50, 50), dtype=np.uint8) * 128
    snr = compute_snr_db(pure_img)
    assert snr >= 20.0


def test_op_norm_threshold_classification():
    """op_norm maps the raw operating point to 0.5; high-confidence uses PPV80.

    This test guards against the original bug where raw CHEST_THRESHOLDS
    (values like 0.002) were compared to op_norm model outputs.
    """
    probs = np.full(len(CHEST_CLASSES), 0.40, dtype=np.float32)
    probs[CHEST_CLASSES.index("Atelectasis")] = 0.99
    probs[CHEST_CLASSES.index("Consolidation")] = 0.60

    all_results, positive, indeterminate = classify_chest_probabilities(probs)

    assert any(p["name"] == "Atelectasis" for p in positive)
    assertion = next(p for p in positive if p["name"] == "Atelectasis")
    assert assertion["threshold"] == CHEST_HIGH_CONFIDENCE_THRESHOLDS["Atelectasis"]
    assert assertion["threshold"] > 0.5
    assert any(p["name"] == "Consolidation" for p in indeterminate)
    assert all(p["tier"] == "low" for p in all_results if p["probability"] < 0.5)


def test_demo_service_is_explicitly_not_diagnostic():
    """Non-qXR services without checkpoints must be labelled demo/unavailable."""
    sample_path = os.path.join(os.path.dirname(__file__), "..", "sample_cxr.dcm")
    assert os.path.exists(sample_path)

    result = run_pipeline(sample_path, service_id="skin-cancer", patient_id="TEST-PATIENT")

    assert result["status"] == "success"
    assert result["demo_mode"] is True
    assert result["model_availability"]["available"] is False
    assert result["model_availability"]["mode"] == "demo"
    assert result["no_high_confidence_finding"] is True
    assert result["positive_findings"] == []
    assert result["indeterminate_findings"] == []
    assert result["candidate_diagnosis"] is None
    assert result["severity"] == "NOT_ASSESSED"
    assert result["confidence_percentage"] == 0.0
    assert result["primary_diagnosis"].startswith("Demo only")
    assert result["demo_top_signal"]
    assert all(p["tier"] == "demo" for p in result["all_pathologies"])
    assert result["patient_report"]["demo_mode"] is True
    assert result["patient_report"]["demo_notice"]
    assert "DEMO MODE" in result["patient_report"]["demo_notice"]
    assert result["report"]["verification_status"] == "DEMO_ONLY"
    assert result["stages"]["agent_5_ai_inference"]["positive_findings"] == []
    assert result["stages"]["agent_6_explainability"]["target_is_high_confidence"] is False
    assert any("DEMO ONLY" in r for r in result["report"]["recommendations"])
    assert not any("STAT" in r for r in result["report"]["recommendations"])
