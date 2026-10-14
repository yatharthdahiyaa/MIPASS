"""
Tests for MIPAAS Autonomous Agent Architecture & Framework.

Validates:
1. Autonomy levels (L0, L1, L2) and the Clinical Safety Invariant ("No agent may reach L2 on anything clinical").
2. Tool allowlisting enforcement and security isolation.
3. Behavior of all 9 agents:
   - Agent 1: Intake & Quality (L2)
   - Agent 2: Routing (L2)
   - Agent 3: Triage & Escalation (L1 with Monotonic Escalation)
   - Agent 4: Report Drafting (L0 with Sentence Grounding & Prose Suppression on failure)
   - Agent 5: Longitudinal Comparison (L0 with RECIST & VDT)
   - Agent 6: Referral & Follow-up (L1 with Physician Sign-off Gate)
   - Agent 7: Consent & Privacy (L2 Fail-Secure & Erasure)
   - Agent 8: Model QA (L0 Overrides & Drift Monitoring)
   - Agent 9: Support (L0 Zero-PHI barrier)
4. Workflow endpoints (worklist priority, STAT acknowledgment, finding review override capture, e-sign).
"""

import pytest
from app.agents.base import AgentAutonomy, AgentBase, ClinicalSafetyViolation, ToolExecutionError
from app.agents.registry import agent_orchestrator


def test_clinical_safety_invariant():
    """Test that creating a clinical agent with L2 autonomy is strictly prohibited."""
    with pytest.raises(ClinicalSafetyViolation, match="No agent may reach L2 on anything clinical"):
        AgentBase(
            name="Rogue Clinical Diagnostic Agent",
            goal="Autonomous clinical diagnosis without doctor",
            autonomy=AgentAutonomy.L2,
            is_clinical=True,  # VIOLATION!
        )


def test_agent_tool_allowlist_security():
    """Test that agents cannot invoke tools outside their allowlist."""
    agent = AgentBase(
        name="Sandboxed Agent",
        goal="Test sandboxing",
        autonomy=AgentAutonomy.L0,
        is_clinical=False,
        allowed_tools={"allowed_tool_a"},
    )
    with pytest.raises(ToolExecutionError, match="not in the allowlist"):
        agent.register_tool("unapproved_tool_b", lambda: None)


def test_agent_1_intake_and_quality():
    """Test Intake & Quality Agent (L2 non-clinical)."""
    # 1. High quality scan passes
    res = agent_orchestrator.dispatch("intake_quality", {
        "case_id": "test_case_1",
        "metadata": {"modality": "CXR", "body_part_examined": "CHEST", "view_position": "PA"},
        "pixel_stats": {"laplacian_variance": 62.4, "snr_db": 25.1, "motion_detected": False},
        "detected_body_part": "CHEST",
    })
    assert res["validation_status"] == "PASSED"
    assert res["rejection_code"] == "NONE"

    # 2. Blurry scan is rejected immediately with retake message
    res_blurry = agent_orchestrator.dispatch("intake_quality", {
        "case_id": "test_case_blurry",
        "metadata": {"modality": "CXR", "body_part_examined": "CHEST", "view_position": "PA"},
        "pixel_stats": {"laplacian_variance": 18.2, "snr_db": 12.0, "motion_detected": False},
        "detected_body_part": "CHEST",
    })
    assert res_blurry["validation_status"] == "REJECTED"
    assert res_blurry["rejection_code"] == "BLUR_EXCESSIVE"
    assert "Re-take" in res_blurry["technician_message"]


def test_agent_2_routing():
    """Test Routing Agent (L2 non-clinical)."""
    res = agent_orchestrator.dispatch("routing", {
        "case_id": "test_case_route",
        "tenant_id": "tenant_st_marys",
        "modality": "CXR",
        "body_part": "CHEST",
    })
    assert "routing_plan" in res
    assert res["routing_plan"]["primary_target"]["model_id"] == "DenseNet121_ChestXray14"
    assert res["routing_plan"]["xai_pipeline_required"] is True


def test_agent_3_triage_and_escalation():
    """Test Triage & Escalation Agent (L1 clinical with monotonic escalation)."""
    # Critical Tension Pneumothorax -> STAT escalation & pager triggered
    res = agent_orchestrator.dispatch("triage_escalation", {
        "case_id": "case_stat_01",
        "requested_priority": "ROUTINE",
        "findings": [
            {"name": "Tension_Pneumothorax", "probability": 0.94, "positive": True}
        ],
    })
    assert res["assigned_priority"] == "STAT"
    assert res["critical_alert"]["triggered"] is True
    assert res["critical_alert"]["sla_minutes"] == 15
    assert res["acknowledgement_required"] is True


def test_agent_4_report_drafting_and_grounding():
    """Test Report Drafting Agent (L0 clinical) with sentence grounding."""
    # Grounded finding citations
    findings = [
        {"id": "fnd_rul_nodule", "name": "Solid Nodule", "probability": 0.88, "location": "Right Upper Lobe", "dimensions_mm": 8.4}
    ]
    res = agent_orchestrator.dispatch("report_drafting", {
        "case_id": "case_report_01",
        "template_id": "CHEST_XR_STANDARD",
        "findings": findings,
    })
    assert res["grounding_check_passed"] is True
    assert "AI-drafted, requires clinician review" in res["disclaimer"]
    findings_sec = next(s for s in res["sections"] if s["name"] == "FINDINGS")
    assert "fnd_rul_nodule" in findings_sec["source_finding_ids"]


def test_agent_5_longitudinal_comparison():
    """Test Longitudinal Comparison Agent (L0 clinical RECIST delta)."""
    res = agent_orchestrator.dispatch("longitudinal", {
        "case_id": "case_longitudinal",
        "pseudonym_id": "MIP-8842-X",
        "findings": [
            {"id": "cur_nodule", "dimensions_mm": 8.4, "location": "Right Upper Lobe"}
        ],
    })
    assert "findings_comparison" in res
    comp = res["findings_comparison"][0]
    assert comp["prior_measurement_mm"] == 5.4
    assert comp["current_measurement_mm"] == 8.4
    assert comp["delta_percentage"] > 20.0
    assert comp["recist_classification"] == "PROGRESSION"


def test_agent_6_referral_followup():
    """Test Referral & Follow-up Agent (L1 clinical requires physician e-signature)."""
    # Locked without signature
    res_err = agent_orchestrator.dispatch("referral_followup", {
        "case_id": "case_unsigned",
        "diagnostic_code": "LUNG_NODULE",
        "lesion_size_mm": 8.4,
    })
    assert res_err["applied_guideline"] == "MANUAL_REVIEW_REQUIRED"

    # With signature, matches Fleischner guideline
    res_signed = agent_orchestrator.dispatch("referral_followup", {
        "case_id": "case_signed",
        "signed_by_doctor_id": "DR-RAD-4412",
        "diagnostic_code": "LUNG_NODULE",
        "lesion_size_mm": 8.4,
        "patient_consented_to_reminders": True,
    })
    assert res_signed["applied_guideline"] == "FLEISCHNER_2017_SOLID_NODULE"
    assert res_signed["recommended_interval_months"] == 3
    assert res_signed["order_draft"]["status"] == "PENDING_PHYSICIAN_SIGNATURE"


def test_agent_7_consent_and_privacy():
    """Test Consent & Privacy Agent (L2 non-clinical zero-trust gate)."""
    # Access evaluation with pseudonymization
    res = agent_orchestrator.dispatch("consent_privacy", {
        "action": "EVALUATE_ACCESS",
        "actor_id": "RESEARCH_STUDENT_01",
        "purpose": "SECONDARY_RESEARCH",
        "patient_id": "REAL_PATIENT_SSN_12345",
    })
    assert res["decision"] == "PERMIT"
    assert "MIP-" in res["pseudonym_id"]
    assert "PatientName" in res["redacted_fields"]

    # Erasure request execution
    res_erasure = agent_orchestrator.dispatch("consent_privacy", {
        "action": "EXECUTE_ERASURE",
        "actor_id": "PATIENT_PORTAL",
        "patient_id": "REAL_PATIENT_SSN_12345",
    })
    assert res_erasure["decision"] == "COMPLETED"


def test_agent_8_model_qa():
    """Test Model QA Agent (L0 override & drift monitoring)."""
    res = agent_orchestrator.dispatch("model_qa", {
        "tenant_id": "metro_general",
        "model_id": "DenseNet121_ChestXray14",
        "current_mean_prediction": 0.48,
    })
    assert "model_evaluations" in res
    eval_item = res["model_evaluations"][0]
    assert eval_item["override_rate"] > 0
    assert "top_override_reasons" in eval_item


def test_agent_9_support_zero_phi_barrier():
    """Test Support Agent (L0 technical) enforces strict Zero-PHI barrier."""
    # Technical question answered
    res_tech = agent_orchestrator.dispatch("support", {
        "query": "How do I configure the PACS C-STORE AE title and port?",
    })
    assert res_tech["zero_phi_block_applied"] is False
    assert "11112" in res_tech["response_text"]

    # Clinical / PHI question is blocked
    res_phi = agent_orchestrator.dispatch("support", {
        "query": "Does patient John Doe have cancer in his scan result?",
    })
    assert res_phi["zero_phi_block_applied"] is True
    assert "restricted to" in res_phi["response_text"]


def test_workflow_routes(client):
    """Test API routes for clinician worklist, STAT ack, finding review, e-signing."""
    # 1. Get worklist
    res = client.get("/api/v1/worklist")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["total_cases"] >= 3
    assert data["cases"][0]["priority"] == "STAT"

    # 2. Acknowledge STAT finding
    res_ack = client.post("/api/v1/worklist/MIP-9901-STAT/acknowledge-stat", json={
        "doctor_id": "DR-SARAH-LIN",
    })
    assert res_ack.status_code == 200
    assert res_ack.get_json()["data"]["acknowledged"] is True

    # 3. Review finding with mandatory override
    res_rev = client.post("/api/v1/cases/MIP-9901-STAT/review-finding", json={
        "finding_id": "fnd_02",
        "action": "REJECT",
        "override_reason": "FALSE_POSITIVE_MOTION_ARTIFACT",
        "notes": "Diaphragm shadow misclassified as atelectasis.",
    })
    assert res_rev.status_code == 200
    assert res_rev.get_json()["data"]["review_recorded"]["action"] == "REJECT"

    # 4. Mandatory override rejected if reason missing
    res_missing_reason = client.post("/api/v1/cases/MIP-9901-STAT/review-finding", json={
        "finding_id": "fnd_01",
        "action": "REJECT",
        # override_reason omitted
    })
    assert res_missing_reason.status_code == 400

    # 5. e-Sign report
    res_sign = client.post("/api/v1/cases/MIP-9901-STAT/e-sign", json={
        "doctor_id": "DR-SARAH-LIN",
        "doctor_name": "Dr. Sarah Lin, MD",
        "license_id": "MED-NY-88192",
        "report_text": "Right tension pneumothorax confirmed. Immediate chest tube thoracostomy indicated.",
    })
    assert res_sign.status_code == 200
    assert "MIP-SIG-" in res_sign.get_json()["data"]["digital_signature"]
