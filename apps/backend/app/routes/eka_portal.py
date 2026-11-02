"""
Eka.care PHR Portal REST Routes.

All endpoints live under /api/v1/eka and require an authenticated
MiPAAS session (Bearer token or X-User-ID dev header). Every PHI read
and write is captured in the RBAC audit trail.

Endpoints:
- GET    /eka/session                       Portal access & entitlements
- GET    /eka/family                        List linked family members
- POST   /eka/family                        Link a new family member
- GET    /eka/members/<id>/summary          Today's dashboard summary
- GET    /eka/members/<id>/abha             ABHA / ABDM card profile
- GET    /eka/members/<id>/medications      Medication schedule
- POST   /eka/members/<id>/medications      Prescribe/add medication
- DELETE /eka/medications/<med_id>          Remove medication
- POST   /eka/medications/<med_id>/taken    Toggle dose taken
- GET    /eka/members/<id>/vitals           Vitals history
- POST   /eka/members/<id>/vitals           Log a vital
- DELETE /eka/vitals/<vital_id>             Delete a vital entry
- GET    /eka/members/<id>/records          Health locker (category/q filters)
- POST   /eka/members/<id>/records          Upload a record
- DELETE /eka/records/<record_id>           Delete a record
- GET    /eka/members/<id>/appointments     Appointments
- POST   /eka/members/<id>/appointments     Book appointment
- POST   /eka/appointments/<apt_id>/cancel  Cancel appointment
- POST   /eka/members/<id>/consult          AI health consultation
- GET    /eka/meta                          Enums for form configuration
"""

from flask import Blueprint, request

import structlog

from app.middleware.auth_middleware import require_auth
from app.services.eka_portal import (
    RECORD_CATEGORIES,
    VITAL_TYPES,
    get_eka_portal_service,
)
from app.services.rbac import get_rbac_service
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
eka_bp = Blueprint("eka_portal", __name__)


def _audit(action: str, resource: str, decision: str = "allow", details: dict | None = None) -> None:
    from app.middleware.auth_middleware import get_authenticated_user

    user = get_authenticated_user()
    get_rbac_service().log_audit_event(
        user=user,
        action=action,
        resource=resource,
        decision=decision,
        details=details or {},
        ip_address=request.remote_addr,
    )


def _member_or_404(member_id: str):
    member = get_eka_portal_service().get_member(member_id)
    if not member:
        return None
    return member


# ─────────────────────────────────────────────────────────────
# Session & metadata
# ─────────────────────────────────────────────────────────────

@eka_bp.route("/eka/session", methods=["GET"])
@require_auth
def get_session():
    """Resolve the authenticated user's eka.care portal session."""
    from app.middleware.auth_middleware import get_authenticated_user

    user = get_authenticated_user()
    session = get_eka_portal_service().get_session(user)
    _audit("eka:portal_access", request.path, details={"userId": user.id})
    return api_response({"session": session})


@eka_bp.route("/eka/meta", methods=["GET"])
@require_auth
def get_meta():
    """Enumeration values used by portal forms."""
    return api_response({
        "vitalTypes": VITAL_TYPES,
        "recordCategories": RECORD_CATEGORIES,
        "medicationTimings": ["Morning", "Afternoon", "Night", "Morning & Night"],
        "medicationInstructions": ["Before Food", "After Food", "With Food"],
        "appointmentTypes": ["In-Clinic", "Video Teleconsult"],
    })


# ─────────────────────────────────────────────────────────────
# Family members
# ─────────────────────────────────────────────────────────────

@eka_bp.route("/eka/family", methods=["GET"])
@require_auth
def list_family():
    members = get_eka_portal_service().list_members()
    _audit("eka:family_read", request.path)
    return api_response({"members": members, "count": len(members)})


@eka_bp.route("/eka/family", methods=["POST"])
@require_auth
def add_family():
    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return api_error("Missing required field: 'name'", status_code=400)
    member = get_eka_portal_service().add_member(data)
    _audit("eka:family_added", request.path, details={"memberId": member.id})
    return api_response({"member": member.to_dict()}, status_code=201)


@eka_bp.route("/eka/members/<member_id>/summary", methods=["GET"])
@require_auth
def member_summary(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    return api_response({"summary": get_eka_portal_service().today_summary(member_id)})


@eka_bp.route("/eka/members/<member_id>/abha", methods=["GET"])
@require_auth
def member_abha(member_id: str):
    profile = get_eka_portal_service().get_abha_profile(member_id)
    if not profile:
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    _audit("eka:abha_read", request.path, details={"memberId": member_id})
    return api_response({"abha": profile})


# ─────────────────────────────────────────────────────────────
# Medications
# ─────────────────────────────────────────────────────────────

@eka_bp.route("/eka/members/<member_id>/medications", methods=["GET"])
@require_auth
def list_medications(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    meds = get_eka_portal_service().list_medications(member_id)
    return api_response({"medications": meds, "count": len(meds)})


@eka_bp.route("/eka/members/<member_id>/medications", methods=["POST"])
@require_auth
def add_medication(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return api_error("Missing required field: 'name'", status_code=400)
    med = get_eka_portal_service().add_medication(member_id, data)
    _audit("eka:medication_added", request.path, details={"medId": med.id})
    return api_response({"medication": med.to_dict()}, status_code=201)


@eka_bp.route("/eka/medications/<med_id>/taken", methods=["POST"])
@require_auth
def toggle_medication_taken(med_id: str):
    data = request.get_json(silent=True) or {}
    taken = data.get("taken")
    med = get_eka_portal_service().set_medication_taken(med_id, taken)
    if not med:
        return api_error(f"Medication '{med_id}' not found", status_code=404)
    return api_response({"medication": med.to_dict()})


@eka_bp.route("/eka/medications/<med_id>", methods=["DELETE"])
@require_auth
def delete_medication(med_id: str):
    if not get_eka_portal_service().delete_medication(med_id):
        return api_error(f"Medication '{med_id}' not found", status_code=404)
    _audit("eka:medication_deleted", request.path, details={"medId": med_id})
    return api_response({"deleted": med_id})


# ─────────────────────────────────────────────────────────────
# Vitals
# ─────────────────────────────────────────────────────────────

@eka_bp.route("/eka/members/<member_id>/vitals", methods=["GET"])
@require_auth
def list_vitals(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    vitals = get_eka_portal_service().list_vitals(member_id)
    return api_response({"vitals": vitals, "count": len(vitals)})


@eka_bp.route("/eka/members/<member_id>/vitals", methods=["POST"])
@require_auth
def add_vital(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    data = request.get_json(silent=True) or {}
    if not data.get("value"):
        return api_error("Missing required field: 'value'", status_code=400)
    vital = get_eka_portal_service().add_vital(member_id, data)
    return api_response({"vital": vital.to_dict()}, status_code=201)


@eka_bp.route("/eka/vitals/<vital_id>", methods=["DELETE"])
@require_auth
def delete_vital(vital_id: str):
    if not get_eka_portal_service().delete_vital(vital_id):
        return api_error(f"Vital record '{vital_id}' not found", status_code=404)
    return api_response({"deleted": vital_id})


# ─────────────────────────────────────────────────────────────
# Health locker records
# ─────────────────────────────────────────────────────────────

@eka_bp.route("/eka/members/<member_id>/records", methods=["GET"])
@require_auth
def list_records(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    records = get_eka_portal_service().list_records(
        member_id,
        category=request.args.get("category"),
        query=request.args.get("q"),
    )
    _audit("eka:locker_read", request.path, details={"memberId": member_id, "returned": len(records)})
    return api_response({"records": records, "count": len(records)})


@eka_bp.route("/eka/members/<member_id>/records", methods=["POST"])
@require_auth
def add_record(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    data = request.get_json(silent=True) or {}
    if not data.get("title"):
        return api_error("Missing required field: 'title'", status_code=400)
    record = get_eka_portal_service().add_record(member_id, data)
    _audit("eka:locker_upload", request.path, details={"recordId": record.id})
    return api_response({"record": record.to_dict()}, status_code=201)


@eka_bp.route("/eka/records/<record_id>", methods=["DELETE"])
@require_auth
def delete_record(record_id: str):
    if not get_eka_portal_service().delete_record(record_id):
        return api_error(f"Health record '{record_id}' not found", status_code=404)
    _audit("eka:locker_delete", request.path, details={"recordId": record_id})
    return api_response({"deleted": record_id})


# ─────────────────────────────────────────────────────────────
# Appointments
# ─────────────────────────────────────────────────────────────

@eka_bp.route("/eka/members/<member_id>/appointments", methods=["GET"])
@require_auth
def list_appointments(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    apts = get_eka_portal_service().list_appointments(member_id)
    return api_response({"appointments": apts, "count": len(apts)})


@eka_bp.route("/eka/members/<member_id>/appointments", methods=["POST"])
@require_auth
def book_appointment(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    data = request.get_json(silent=True) or {}
    if not data.get("doctorName") or not data.get("date"):
        return api_error("Missing required fields: 'doctorName', 'date'", status_code=400)
    apt = get_eka_portal_service().book_appointment(member_id, data)
    return api_response({"appointment": apt.to_dict()}, status_code=201)


@eka_bp.route("/eka/appointments/<apt_id>/cancel", methods=["POST"])
@require_auth
def cancel_appointment(apt_id: str):
    if not get_eka_portal_service().cancel_appointment(apt_id):
        return api_error(f"Appointment '{apt_id}' not found", status_code=404)
    _audit("eka:appointment_cancelled", request.path, details={"appointmentId": apt_id})
    return api_response({"cancelled": apt_id})


# ─────────────────────────────────────────────────────────────
# AI consultation
# ─────────────────────────────────────────────────────────────

@eka_bp.route("/eka/members/<member_id>/consult", methods=["POST"])
@require_auth
def consult(member_id: str):
    if not _member_or_404(member_id):
        return api_error(f"Family member '{member_id}' not found", status_code=404)
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return api_error("Missing required field: 'message'", status_code=400)
    result = get_eka_portal_service().consult(member_id, message)
    logger.info("eka_consult_served", member_id=member_id, model=result["model"])
    return api_response({"consult": result})
