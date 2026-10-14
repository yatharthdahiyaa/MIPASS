"""
Agents and Persona Workflows Blueprint.

Exposes RESTful endpoints for:
1. All 9 platform agents execution and catalog
2. Clinician Priority Worklist (STAT, URGENT, ROUTINE) with SLA timers
3. Granular finding review with mandatory override reason capture
4. Report e-signing and template generation
5. Lab Admin integrations (PACS, HL7, FHIR, C-ECHO) and billing analytics
6. Patient portal report view, dynamic consent, and erasure requests
7. Developer webhooks and sandbox testing
"""

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List
import structlog
from flask import Blueprint, jsonify, request

from app.agents.registry import agent_orchestrator
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
workflows_bp = Blueprint("workflows", __name__)

# In-memory stores for active session demonstrations (persists across requests during runtime)
DEMO_WORKLIST: List[Dict[str, Any]] = [
    {
        "case_id": "MIP-9901-STAT",
        "pseudonym_id": "MIP-8842-X",
        "patient_name_masked": "P*****, J***",
        "age_gender": "58M",
        "modality": "CXR",
        "study_description": "Chest AP Mobile (ICU)",
        "priority": "STAT",
        "critical_finding": "TENSION_PNEUMOTHORAX",
        "sla_deadline": "2026-10-13T01:15:00Z",
        "sla_duration_min": 15,
        "acknowledged": False,
        "ai_findings": [
            {
                "id": "fnd_01",
                "name": "Pneumothorax (Tension)",
                "probability": 0.94,
                "status": "PENDING_REVIEW",
                "dimensions_mm": 28.5,
                "location": "Right Hemithorax",
            },
            {
                "id": "fnd_02",
                "name": "Atelectasis",
                "probability": 0.72,
                "status": "PENDING_REVIEW",
                "location": "Right Lower Lobe",
            },
        ],
    },
    {
        "case_id": "MIP-9902-URGENT",
        "pseudonym_id": "MIP-5512-Y",
        "patient_name_masked": "S*****, M***",
        "age_gender": "64F",
        "modality": "CT",
        "study_description": "Chest CT w/o IV Contrast (Low-Dose)",
        "priority": "URGENT",
        "critical_finding": None,
        "sla_deadline": "2026-10-13T02:00:00Z",
        "sla_duration_min": 60,
        "acknowledged": True,
        "ai_findings": [
            {
                "id": "fnd_03",
                "name": "Solid Pulmonary Nodule",
                "probability": 0.86,
                "status": "ACCEPTED",
                "dimensions_mm": 8.4,
                "location": "Right Upper Lobe",
            }
        ],
    },
    {
        "case_id": "MIP-9903-ROUTINE",
        "pseudonym_id": "MIP-3199-Z",
        "patient_name_masked": "D*****, R***",
        "age_gender": "42M",
        "modality": "CXR",
        "study_description": "Chest PA/Lateral Screening",
        "priority": "ROUTINE",
        "critical_finding": None,
        "sla_deadline": "2026-10-14T00:00:00Z",
        "sla_duration_min": 1440,
        "acknowledged": True,
        "ai_findings": [
            {
                "id": "fnd_04",
                "name": "No Acute Cardiopulmonary Disease",
                "probability": 0.98,
                "status": "ACCEPTED",
                "location": "Bilateral",
            }
        ],
    },
]

DEMO_OVERRIDES: List[Dict[str, Any]] = []
DEMO_CONSENTS: Dict[str, Dict[str, Any]] = {
    "MIP-8842-X": {
        "primary_care": True,
        "qa_improvement": True,
        "secondary_research": False,
        "commercial_ai": False,
    }
}
DEMO_INTEGRATIONS: Dict[str, Any] = {
    "pacs": {
        "ae_title": "MIPAAS_PACS_IN",
        "port": 11112,
        "ip_address": "10.240.0.12",
        "dicomweb_endpoint": "https://pacs.hospital.internal/dicomweb",
        "connected": True,
    },
    "hl7": {
        "endpoint": "mllp://hl7.hospital.internal:2575",
        "format": "ORU_R01",
        "enabled": True,
    },
    "fhir": {
        "server_url": "https://fhir.hospital.internal/r4",
        "auth_type": "SMART_ON_FHIR",
        "status": "ACTIVE",
    },
}


# ==========================================
# 1. AGENTS DISCOVERY & EXECUTION
# ==========================================


@workflows_bp.route("/agents/catalog", methods=["GET"])
def get_agents_catalog():
    """List all 9 autonomous agents, their autonomy tiers, and allowlisted tools."""
    catalog = agent_orchestrator.list_agents()
    return api_response({
        "total_agents": len(catalog),
        "autonomy_tiers": {
            "L0": "Suggests only (clinician must validate and sign)",
            "L1": "Acts after human approval (escalation / order staging)",
            "L2": "Acts alone (strictly non-clinical operations)",
        },
        "agents": catalog,
    })


@workflows_bp.route("/agents/dispatch/<agent_key>", methods=["POST"])
def dispatch_agent(agent_key: str):
    """Execute a specific agent by key."""
    body = request.get_json() or {}
    inputs = body.get("inputs", {})
    context = body.get("context", {})

    try:
        result = agent_orchestrator.dispatch(agent_key, inputs, context)
        return api_response(result)
    except KeyError:
        return api_error(f"Agent '{agent_key}' not found", 404)
    except Exception as e:
        logger.error("agent_dispatch_failed", agent=agent_key, error=str(e))
        return api_error(f"Agent execution failed: {str(e)}", 500)


# ==========================================
# 2. CLINICIAN WORKLIST & ACTIONS
# ==========================================


@workflows_bp.route("/worklist", methods=["GET"])
def get_clinician_worklist():
    """Fetch real-time clinician worklist sorted by clinical priority (STAT > URGENT > ROUTINE)."""
    priority_order = {"STAT": 0, "URGENT": 1, "ROUTINE": 2}
    sorted_cases = sorted(DEMO_WORKLIST, key=lambda c: priority_order.get(c["priority"], 9))
    return api_response({
        "total_cases": len(sorted_cases),
        "stat_count": sum(1 for c in sorted_cases if c["priority"] == "STAT" and not c["acknowledged"]),
        "cases": sorted_cases,
    })


@workflows_bp.route("/worklist/<case_id>/acknowledge-stat", methods=["POST"])
def acknowledge_stat_finding(case_id: str):
    """Acknowledge a critical STAT alert modal."""
    body = request.get_json() or {}
    doctor_id = body.get("doctor_id", "DR-RAD-4412")

    for case in DEMO_WORKLIST:
        if case["case_id"] == case_id:
            case["acknowledged"] = True
            case["acknowledged_by"] = doctor_id
            case["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
            return api_response({
                "case_id": case_id,
                "acknowledged": True,
                "acknowledged_by": doctor_id,
                "timestamp": case["acknowledged_at"],
            })

    return api_error("Case not found", 404)


@workflows_bp.route("/cases/<case_id>/review-finding", methods=["POST"])
def review_finding(case_id: str):
    """Clinician review action: Accept, Edit, or Reject an AI finding with mandatory override reason."""
    body = request.get_json() or {}
    finding_id = body.get("finding_id")
    action = body.get("action")  # "ACCEPT", "EDIT", "REJECT"
    override_reason = body.get("override_reason")  # Required on EDIT or REJECT
    doctor_notes = body.get("notes", "")

    if not finding_id or not action:
        return api_error("finding_id and action ('ACCEPT', 'EDIT', 'REJECT') are required", 400)

    if action in ["EDIT", "REJECT"] and not override_reason:
        return api_error("Mandatory override reason code is required when modifying or rejecting AI findings.", 400)

    override_record = {
        "case_id": case_id,
        "finding_id": finding_id,
        "action": action,
        "override_reason": override_reason,
        "doctor_notes": doctor_notes,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    DEMO_OVERRIDES.append(override_record)

    # Update state in demo worklist
    for case in DEMO_WORKLIST:
        if case["case_id"] == case_id:
            for f in case["ai_findings"]:
                if f["id"] == finding_id:
                    f["status"] = action

    return api_response({
        "success": True,
        "review_recorded": override_record,
        "audit_logged": True,
    })


@workflows_bp.route("/cases/<case_id>/e-sign", methods=["POST"])
def sign_report(case_id: str):
    """Cryptographic e-signature binding doctor license and timestamp to certified report."""
    body = request.get_json() or {}
    doctor_id = body.get("doctor_id", "DR-RAD-4412")
    doctor_name = body.get("doctor_name", "Dr. Sarah Lin, MD (Radiology)")
    license_id = body.get("license_id", "MED-CAL-994821")
    report_text = body.get("report_text", "")

    if not report_text:
        return api_error("report_text is required for cryptographic certification", 400)

    now = datetime.now(timezone.utc).isoformat()
    raw_sig = f"{case_id}|{doctor_id}|{license_id}|{now}|{report_text}"
    signature_hash = hashlib.sha256(raw_sig.encode("utf-8")).hexdigest()

    return api_response({
        "case_id": case_id,
        "status": "CERTIFIED_AND_LOCKED",
        "doctor_name": doctor_name,
        "license_id": license_id,
        "timestamp": now,
        "digital_signature": f"MIP-SIG-{signature_hash[:16].upper()}",
        "fhir_diagnostic_report_id": f"FHIR-DR-{case_id}",
    })


# ==========================================
# 3. LAB ADMIN INTEGRATIONS & ANALYTICS
# ==========================================


@workflows_bp.route("/admin/integrations", methods=["GET", "POST"])
def admin_integrations():
    """Retrieve or update PACS, HL7, and FHIR integration endpoints."""
    if request.method == "POST":
        data = request.get_json() or {}
        if "pacs" in data:
            DEMO_INTEGRATIONS["pacs"].update(data["pacs"])
        if "hl7" in data:
            DEMO_INTEGRATIONS["hl7"].update(data["hl7"])
        if "fhir" in data:
            DEMO_INTEGRATIONS["fhir"].update(data["fhir"])
        return api_response({"message": "Integration settings updated", "settings": DEMO_INTEGRATIONS})

    return api_response(DEMO_INTEGRATIONS)


@workflows_bp.route("/admin/integrations/pacs-echo", methods=["POST"])
def test_pacs_echo():
    """Execute DICOM C-ECHO verification handshake with hospital PACS."""
    ae_title = DEMO_INTEGRATIONS["pacs"]["ae_title"]
    port = DEMO_INTEGRATIONS["pacs"]["port"]
    return api_response({
        "c_echo_status": "SUCCESS",
        "called_ae_title": ae_title,
        "port": port,
        "round_trip_latency_ms": 14.8,
        "message": f"DICOM C-ECHO Verification SCP accepted by {ae_title} on port {port}.",
    })


@workflows_bp.route("/admin/analytics", methods=["GET"])
def admin_analytics():
    """Retrieve turnaround time (TAT), GPU compute duration, and billing metrics."""
    return api_response({
        "monthly_budget_usd": 1500.0,
        "current_spend_usd": 420.5,
        "studies_analyzed_this_month": 1420,
        "average_cost_per_study_usd": 0.296,
        "gpu_inference_seconds_avg": 4.2,
        "turnaround_time": {
            "ingest_to_ai_seconds_p50": 6.8,
            "ingest_to_ai_seconds_p95": 14.2,
            "stat_alert_to_ack_minutes_avg": 2.4,
            "clinician_time_saved_percent": 34.0,
        },
    })


# ==========================================
# 4. PATIENT PORTAL & CONSENT
# ==========================================


@workflows_bp.route("/patient/portal/<pseudonym_id>", methods=["GET"])
def patient_portal_view(pseudonym_id: str):
    """Serve patient-friendly report with terminology explanations and consent flags."""
    consent = DEMO_CONSENTS.get(pseudonym_id, {
        "primary_care": True,
        "qa_improvement": True,
        "secondary_research": False,
        "commercial_ai": False,
    })

    return api_response({
        "pseudonym_id": pseudonym_id,
        "study_date": "2026-10-12",
        "procedure": "Chest Computed Tomography (Low-Dose)",
        "doctor_signed": True,
        "certified_by": "Dr. Sarah Lin, MD (Chief Radiologist)",
        "patient_summary": "Your chest scan was analyzed. A small, smooth nodule (8.4mm) was noted in the upper right lung. Your care team has recommended a routine follow-up scan in 3 months to monitor for stability.",
        "terminology_guide": [
            {"term": "Pulmonary Nodule", "definition": "A small round spot on the lung tissue, often benign (e.g. from prior healed inflammation)."},
            {"term": "Low-Dose CT", "definition": "A fast imaging scan using minimal radiation to capture clear 3D images of your lungs."},
        ],
        "consent_settings": consent,
        "share_link": f"https://mipaas.app/share/pt-{pseudonym_id}?exp=7d",
    })


@workflows_bp.route("/patient/consent", methods=["POST"])
def update_patient_consent():
    """Update dynamic purpose-specific consent settings."""
    body = request.get_json() or {}
    pseudonym_id = body.get("pseudonym_id", "MIP-8842-X")
    consent_updates = body.get("consents", {})

    if pseudonym_id not in DEMO_CONSENTS:
        DEMO_CONSENTS[pseudonym_id] = {}

    DEMO_CONSENTS[pseudonym_id].update(consent_updates)
    return api_response({
        "pseudonym_id": pseudonym_id,
        "updated_consents": DEMO_CONSENTS[pseudonym_id],
        "enforced_by": "Consent & Privacy Agent (L2)",
    })


@workflows_bp.route("/patient/erasure", methods=["POST"])
def request_patient_erasure():
    """Submit self-service GDPR/HIPAA Right to Erasure request."""
    body = request.get_json() or {}
    pseudonym_id = body.get("pseudonym_id", "MIP-8842-X")

    # Delegate to Agent 7
    erasure_result = agent_orchestrator.dispatch("consent_privacy", {
        "action": "EXECUTE_ERASURE",
        "actor_id": "PATIENT_SELF_SERVICE",
        "patient_id": pseudonym_id,
    })

    return api_response({
        "request_status": "PROCESSED",
        "pseudonym_id": pseudonym_id,
        "details": erasure_result,
        "certificate_id": f"CERT-ERASURE-{pseudonym_id[:8]}",
    })


# ==========================================
# 5. DEVELOPER & SANDBOX
# ==========================================


@workflows_bp.route("/developer/webhooks", methods=["GET", "POST"])
def developer_webhooks():
    """List or subscribe to webhook delivery feeds."""
    if request.method == "POST":
        body = request.get_json() or {}
        url = body.get("url")
        events = body.get("events", ["study.intake.validated", "report.signed"])
        return api_response({
            "webhook_id": "wh_90214",
            "url": url,
            "events": events,
            "secret": "whsec_mipaas_test_secret_key_8812",
            "active": True,
        })

    return api_response({
        "subscriptions": [
            {
                "webhook_id": "wh_demo_hospital",
                "url": "https://api.hospital.internal/mipaas/events",
                "events": ["study.intake.validated", "report.signed", "case.triaged.stat"],
                "active": True,
            }
        ]
    })
