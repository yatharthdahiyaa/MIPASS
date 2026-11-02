"""
OpenEMR Management System REST & FHIR R4 Routes.

Exposes endpoints for:
- Practitioners and OpenEMR users (/api/v1/emr/users)
- Hybrid IAM-RBAC synchronization (/api/v1/emr/sync-rbac)
- Master Patient Index and DICOM tag reconciliation (/api/v1/emr/patients)
- Encounters & Clinical Visits (/api/v1/emr/encounters)
- Imaging Procedure Orders Worklist (/api/v1/emr/orders)
- Diagnostic Reports & Closed-loop AI Feedback (/api/v1/emr/reports)
- Standard HL7 FHIR R4 resources (/api/v1/emr/fhir/*)
"""

import structlog
from flask import Blueprint, g, jsonify, request

from app.middleware.auth_middleware import get_authenticated_user
from app.services.openemr.fhir_mapper import OpenEMRFhirMapper
from app.services.openemr.service import get_openemr_service
from app.services.rbac import (
    Permission,
    Role,
    UserProfile,
    get_rbac_service,
)
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
openemr_bp = Blueprint("openemr", __name__)


@openemr_bp.route("/emr/status", methods=["GET"])
def get_openemr_status():
    """Return OpenEMR service health and basic counts."""
    service = get_openemr_service()
    patients = service.list_patients()
    orders = service.list_orders()

    def _status_value(order):
        status = getattr(order, "order_status", None)
        return str(getattr(status, "value", status)).lower()

    active_orders = [
        order for order in orders if _status_value(order) in {"pending", "in_progress"}
    ]

    return api_response({
        "status": "healthy",
        "service": "openemr",
        "version": "1.0",
        "registered_patients": len(patients),
        "active_orders": len(active_orders),
    })


# ─────────────────────────────────────────────────────────────
# 1. Practitioners & Users (OpenEMR users table)
# ─────────────────────────────────────────────────────────────

@openemr_bp.route("/emr/users", methods=["GET"])
def list_openemr_users():
    """List OpenEMR practitioners, optionally filtered by role."""
    role = request.args.get("role")
    service = get_openemr_service()
    users = service.list_users(role=role)
    return api_response({
        "users": [u.to_dict() for u in users],
        "count": len(users),
    })


@openemr_bp.route("/emr/users/<user_id>", methods=["GET"])
def get_openemr_user(user_id: str):
    """Get single OpenEMR practitioner profile."""
    service = get_openemr_service()
    user = service.get_user(user_id)
    if not user:
        return api_error(f"OpenEMR user '{user_id}' not found", status_code=404)
    return api_response({"user": user.to_dict()})


@openemr_bp.route("/emr/users", methods=["POST"])
def create_openemr_user():
    """Create a new OpenEMR practitioner."""
    data = request.get_json() or {}
    for req in ("username", "fname", "lname", "email"):
        if not data.get(req):
            return api_error(f"Missing required field: '{req}'", status_code=400)

    service = get_openemr_service()
    user = service.create_user(data)
    return api_response({"user": user.to_dict()}, status_code=201)


@openemr_bp.route("/emr/sync-rbac", methods=["POST"])
def sync_openemr_to_rbac():
    """Hybrid SSO: Sync OpenEMR practitioners into MiPAAS IAM-RBAC system.
    
    Translates OpenEMR users table records into active MiPAAS UserProfiles
    and RBAC personas so they can sign reports, inspect Grad-CAM, and view worklists.
    """
    emr_service = get_openemr_service()
    rbac_service = get_rbac_service()
    emr_users = emr_service.list_users()

    synced = []
    role_map = {
        "radiologist": Role.RADIOLOGIST,
        "technician": Role.TECHNICIAN,
        "admin": Role.ADMIN,
        "auditor": Role.AUDITOR,
        "researcher": Role.RESEARCHER,
    }

    for u in emr_users:
        mapped_role = role_map.get(u.role_mapping, Role.RADIOLOGIST)
        profile = UserProfile(
            id=u.id,
            name=u.full_name,
            email=u.email,
            role=mapped_role,
            organization="MiPAAS & OpenEMR Integrated Health System",
            department=u.specialty,
        )
        rbac_service._users[u.id] = profile
        synced.append({
            "emr_id": u.id,
            "username": u.username,
            "name": u.full_name,
            "mipaas_role": mapped_role.value,
            "permissions": sorted([p.value for p in profile.permissions]),
        })

    logger.info("openemr_rbac_synced", total_synced=len(synced))
    return api_response({
        "message": f"Successfully synchronized {len(synced)} OpenEMR practitioners to MiPAAS RBAC",
        "synced_users": synced,
    })


# ─────────────────────────────────────────────────────────────
# 2. Patients & Master Patient Index (OpenEMR patient_data table)
# ─────────────────────────────────────────────────────────────

@openemr_bp.route("/emr/patients", methods=["GET"])
def list_openemr_patients():
    """List or search OpenEMR patient records."""
    query = request.args.get("search")
    service = get_openemr_service()
    patients = service.list_patients(search=query)
    return api_response({
        "patients": [p.to_dict() for p in patients],
        "count": len(patients),
    })


@openemr_bp.route("/emr/patients/<patient_id>", methods=["GET"])
def get_openemr_patient(patient_id: str):
    """Get single OpenEMR patient profile, demographics, and clinical history."""
    service = get_openemr_service()
    patient = service.get_patient(patient_id)
    if not patient:
        return api_error(f"OpenEMR patient '{patient_id}' not found", status_code=404)

    # Attach patient's clinical encounters and imaging orders
    encounters = service.list_encounters(patient_id=patient.id)
    orders = service.list_orders(patient_id=patient.id)

    return api_response({
        "patient": patient.to_dict(),
        "encounters": [e.to_dict() for e in encounters],
        "procedure_orders": [o.to_dict() for o in orders],
    })


@openemr_bp.route("/emr/patients", methods=["POST"])
def register_openemr_patient():
    """Register a new patient into OpenEMR demographics."""
    data = request.get_json() or {}
    for req in ("fname", "lname", "dob"):
        if not data.get(req):
            return api_error(f"Missing required field: '{req}'", status_code=400)

    service = get_openemr_service()
    patient = service.create_patient(data)
    return api_response({"patient": patient.to_dict()}, status_code=201)


@openemr_bp.route("/emr/patients/reconcile-dicom", methods=["POST"])
def reconcile_dicom_tags():
    """Reconcile incoming DICOM tags with OpenEMR master patient records.
    
    Request Body:
        {
            "patient_id": "MRN-89421",     // DICOM Tag (0010, 0020)
            "patient_name": "Doe^John",     // DICOM Tag (0010, 0010)
            "dob": "19680412"              // DICOM Tag (0010, 0030)
        }
    """
    data = request.get_json() or {}
    service = get_openemr_service()

    matched = service.reconcile_dicom_patient(
        patient_id_tag=data.get("patient_id"),
        patient_name_tag=data.get("patient_name"),
        dob_tag=data.get("dob"),
    )

    if not matched:
        return api_response({
            "matched": False,
            "message": "No matching OpenEMR patient found for provided DICOM tags",
            "patient": None,
        })

    # Retrieve patient's active orders
    pending_orders = service.list_orders(status="pending", patient_id=matched.id)

    return api_response({
        "matched": True,
        "patient": matched.to_dict(),
        "pending_orders": [o.to_dict() for o in pending_orders],
    })


# ─────────────────────────────────────────────────────────────
# 3. Clinical Encounters (OpenEMR form_encounter table)
# ─────────────────────────────────────────────────────────────

@openemr_bp.route("/emr/encounters", methods=["GET"])
def list_openemr_encounters():
    """List clinical encounters."""
    patient_id = request.args.get("patient_id")
    service = get_openemr_service()
    encounters = service.list_encounters(patient_id=patient_id)
    return api_response({
        "encounters": [e.to_dict() for e in encounters],
        "count": len(encounters),
    })


@openemr_bp.route("/emr/encounters", methods=["POST"])
def create_openemr_encounter():
    """Create a new clinical visit/encounter."""
    data = request.get_json() or {}
    for req in ("pid", "reason", "provider_id"):
        if not data.get(req):
            return api_error(f"Missing required field: '{req}'", status_code=400)

    service = get_openemr_service()
    encounter = service.create_encounter(data)
    return api_response({"encounter": encounter.to_dict()}, status_code=201)


# ─────────────────────────────────────────────────────────────
# 4. Procedure Orders & Worklist (OpenEMR procedure_order table)
# ─────────────────────────────────────────────────────────────

@openemr_bp.route("/emr/orders", methods=["GET"])
def list_openemr_orders():
    """Fetch imaging procedure orders for the diagnostic radiology worklist."""
    status = request.args.get("status")
    modality = request.args.get("modality")
    patient_id = request.args.get("patient_id")

    service = get_openemr_service()
    orders = service.list_orders(status=status, modality=modality, patient_id=patient_id)
    return api_response({
        "orders": [o.to_dict() for o in orders],
        "count": len(orders),
    })


@openemr_bp.route("/emr/orders/<order_id>", methods=["GET"])
def get_openemr_order(order_id: str):
    """Get single procedure order details."""
    service = get_openemr_service()
    order = service.get_order(order_id)
    if not order:
        return api_error(f"Procedure order '{order_id}' not found", status_code=404)

    # Attach diagnostic report if completed
    report = service.get_report_for_order(order_id)
    return api_response({
        "order": order.to_dict(),
        "report": report.to_dict() if report else None,
    })


@openemr_bp.route("/emr/orders", methods=["POST"])
def create_openemr_order():
    """Place a new imaging procedure order in OpenEMR."""
    data = request.get_json() or {}
    for req in ("patient_id", "provider_id", "procedure_code", "procedure_name", "modality"):
        if not data.get(req):
            return api_error(f"Missing required field: '{req}'", status_code=400)

    service = get_openemr_service()
    order = service.create_order(data)
    return api_response({"order": order.to_dict()}, status_code=201)


@openemr_bp.route("/emr/orders/<order_id>/link-job", methods=["POST"])
def link_order_to_job(order_id: str):
    """Link an active MiPAAS AI processing job to an OpenEMR procedure order."""
    data = request.get_json() or {}
    job_id = data.get("job_id")
    if not job_id:
        return api_error("Missing required field: 'job_id'", status_code=400)

    service = get_openemr_service()
    order = service.link_job_to_order(
        procedure_order_id=order_id,
        job_id=job_id,
        dicom_study_instance_uid=data.get("dicom_study_instance_uid"),
    )
    if not order:
        return api_error(f"Procedure order '{order_id}' not found", status_code=404)

    return api_response({"order": order.to_dict()})


# ─────────────────────────────────────────────────────────────
# 5. Procedure Reports & AI Results (procedure_report table)
# ─────────────────────────────────────────────────────────────

@openemr_bp.route("/emr/orders/<order_id>/file-report", methods=["POST"])
def file_procedure_report(order_id: str):
    """File finalized AI diagnostic report back into OpenEMR.
    
    Completes the clinical loop: attaches narrative impression, AI predictions,
    and Grad-CAM heatmap link, and updates order status to COMPLETE.
    """
    data = request.get_json() or {}
    user = get_authenticated_user()

    service = get_openemr_service()
    order = service.get_order(order_id)
    if not order:
        return api_error(f"Procedure order '{order_id}' not found", status_code=404)

    provider_id = data.get("signed_by_provider_id") or user.id
    provider_name = data.get("signed_by_provider_name") or user.name

    report = service.file_diagnostic_report(
        procedure_order_id=order_id,
        report_notes=data.get("report_notes", "Clinically validated by attending radiologist."),
        ai_prediction_summary=data.get("ai_prediction_summary", {}),
        signed_by_provider_id=provider_id,
        signed_by_provider_name=provider_name,
        gradcam_heatmap_url=data.get("gradcam_heatmap_url"),
        dicom_study_instance_uid=data.get("dicom_study_instance_uid", order.dicom_study_instance_uid),
    )

    return api_response({
        "report": report.to_dict(),
        "order": order.to_dict(),
        "message": "Diagnostic report filed successfully in OpenEMR",
    }, status_code=201)


@openemr_bp.route("/emr/reports/<report_id>", methods=["GET"])
def get_procedure_report(report_id: str):
    """Get single diagnostic report."""
    service = get_openemr_service()
    report = service.get_report(report_id)
    if not report:
        return api_error(f"Diagnostic report '{report_id}' not found", status_code=404)
    return api_response({"report": report.to_dict()})


# ─────────────────────────────────────────────────────────────
# 6. Standard HL7 FHIR R4 Endpoints
# ─────────────────────────────────────────────────────────────

@openemr_bp.route("/emr/fhir/Patient/<patient_id>", methods=["GET"])
def fhir_get_patient(patient_id: str):
    """HL7 FHIR R4 Patient resource endpoint."""
    service = get_openemr_service()
    patient = service.get_patient(patient_id)
    if not patient:
        return jsonify({"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "not-found"}]}), 404
    return jsonify(OpenEMRFhirMapper.patient_to_fhir(patient))


@openemr_bp.route("/emr/fhir/Practitioner/<user_id>", methods=["GET"])
def fhir_get_practitioner(user_id: str):
    """HL7 FHIR R4 Practitioner resource endpoint."""
    service = get_openemr_service()
    user = service.get_user(user_id)
    if not user:
        return jsonify({"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "not-found"}]}), 404
    return jsonify(OpenEMRFhirMapper.practitioner_to_fhir(user))


@openemr_bp.route("/emr/fhir/ServiceRequest/<order_id>", methods=["GET"])
def fhir_get_service_request(order_id: str):
    """HL7 FHIR R4 ServiceRequest resource endpoint."""
    service = get_openemr_service()
    order = service.get_order(order_id)
    if not order:
        return jsonify({"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "not-found"}]}), 404
    return jsonify(OpenEMRFhirMapper.order_to_fhir(order))


@openemr_bp.route("/emr/fhir/DiagnosticReport/<report_id>", methods=["GET"])
def fhir_get_diagnostic_report(report_id: str):
    """HL7 FHIR R4 DiagnosticReport resource endpoint."""
    service = get_openemr_service()
    report = service.get_report(report_id)
    if not report:
        return jsonify({"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "not-found"}]}), 404
    order = service.get_order(report.procedure_order_id)
    if not order:
        return jsonify({"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "not-found"}]}), 404
    return jsonify(OpenEMRFhirMapper.report_to_fhir(report, order))
