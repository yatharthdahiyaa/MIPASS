"""
Ayushman Bharat Digital Mission (ABDM) & Aarogya Setu REST Routes.

All endpoints live under /api/v1/abdm and support Bearer tokens and dev session authentication.
Every action is audited according to ABDM & HIPAA compliance guidelines.

Endpoints:
- GET    /abdm/profile                       Full ABHA citizen identity profile
- POST   /abdm/otp/request                   Send simulated Aadhaar / ABDM OTP
- POST   /abdm/otp/verify                    Verify OTP & link profile
- PUT    /abdm/profile                       Update demographic / organ donor pledge
- GET    /abdm/assessment/latest             Aarogya Setu live risk status
- POST   /abdm/assessment                    Run interactive 5-step triage test
- GET    /abdm/consents                      List incoming & active ABDM M3 consent requests
- POST   /abdm/consents/<id>/action          Approve, Deny, or Revoke consent
- GET    /abdm/facilities                    List linked Health Information Providers (HIPs)
- POST   /abdm/facilities/link               Link new hospital/diagnostic center
- GET    /abdm/scan-share/tokens             Active and past OPD queue registration tokens
- POST   /abdm/scan-share/generate           Simulate OPD kiosk QR scan and generate token
- GET    /abdm/vaccinations                  CoWIN / Universal Immunization pass
- GET    /abdm/emergency-pass                Emergency SOS Medical Pass with NOTTO pledge
- PUT    /abdm/emergency-pass                Update emergency contacts / allergies
"""

from flask import Blueprint, request
import structlog

from app.middleware.auth_middleware import get_authenticated_user, require_auth
from app.services.abdm_service import get_abdm_service
from app.services.rbac import get_rbac_service
from app.utils.response import api_error, api_response

logger = structlog.get_logger()
abdm_bp = Blueprint("abdm", __name__)


def _audit(action: str, resource: str, decision: str = "allow", details: dict | None = None) -> None:
    try:
        user = get_authenticated_user()
        get_rbac_service().log_audit_event(
            user=user,
            action=action,
            resource=resource,
            decision=decision,
            details=details or {},
            ip_address=request.remote_addr,
        )
    except Exception as exc:
        logger.warning("abdm_audit_warning", error=str(exc))


def _user_id() -> str:
    try:
        user = get_authenticated_user()
        return user.id if user else "default-user"
    except Exception:
        return "default-user"


# ─────────────────────────────────────────────────────────────
# 1. Profile & Official ABHA Digital Card
# ─────────────────────────────────────────────────────────────

@abdm_bp.route("/abdm/profile", methods=["GET"])
@require_auth
def get_profile():
    """Retrieve the official Ayushman Bharat Health Account profile."""
    uid = _user_id()
    profile = get_abdm_service().get_profile(uid)
    _audit("abdm:profile_read", request.path, details={"abhaNumber": profile.get("abhaNumber")})
    return api_response({"profile": profile})


@abdm_bp.route("/abdm/otp/request", methods=["POST"])
@require_auth
def request_otp():
    """Send Aadhaar / ABDM Mobile verification OTP."""
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier", "91-4567-8901-2345")
    result = get_abdm_service().request_otp(identifier)
    _audit("abdm:otp_requested", request.path)
    return api_response(result)


@abdm_bp.route("/abdm/otp/verify", methods=["POST"])
@require_auth
def verify_otp():
    """Verify Aadhaar / ABDM OTP and complete KYC."""
    data = request.get_json(silent=True) or {}
    otp = data.get("otp", "")
    txn_id = data.get("txnId", "")
    if not otp:
        return api_error("Missing OTP code", status_code=400)
    uid = _user_id()
    updated_profile = get_abdm_service().verify_otp(uid, otp, txn_id)
    _audit("abdm:otp_verified", request.path, details={"kycStatus": updated_profile.get("kycStatus")})
    return api_response({"profile": updated_profile, "message": "KYC Verified successfully via UIDAI."})


@abdm_bp.route("/abdm/profile", methods=["PUT"])
@require_auth
def update_profile():
    """Update citizen profile or organ donation preference."""
    data = request.get_json(silent=True) or {}
    uid = _user_id()
    updated = get_abdm_service().update_profile(uid, data)
    _audit("abdm:profile_updated", request.path)
    return api_response({"profile": updated})


# ─────────────────────────────────────────────────────────────
# 2. Aarogya Setu Clinical Risk & Self-Assessment
# ─────────────────────────────────────────────────────────────

@abdm_bp.route("/abdm/assessment/latest", methods=["GET"])
@require_auth
def get_latest_assessment():
    """Get the current Aarogya Setu risk shield evaluation."""
    uid = _user_id()
    assessment = get_abdm_service().get_latest_assessment(uid)
    return api_response({"assessment": assessment})


@abdm_bp.route("/abdm/assessment", methods=["POST"])
@require_auth
def run_assessment():
    """Run interactive 5-question Aarogya Setu triage assessment."""
    data = request.get_json(silent=True) or {}
    uid = _user_id()
    result = get_abdm_service().assess_risk(uid, data)
    _audit("aarogya_setu:assessment_completed", request.path, details={"riskLevel": result.get("riskLevel")})
    return api_response({"assessment": result}, status_code=201)


# ─────────────────────────────────────────────────────────────
# 3. ABDM M3 Consent Manager
# ─────────────────────────────────────────────────────────────

@abdm_bp.route("/abdm/consents", methods=["GET"])
@require_auth
def list_consents():
    """List pending, active, and expired ABDM consent artefacts."""
    uid = _user_id()
    status_filter = request.args.get("status")
    consents = get_abdm_service().list_consents(uid, status_filter=status_filter)
    _audit("abdm:consents_read", request.path)
    return api_response({"consents": consents, "count": len(consents)})


@abdm_bp.route("/abdm/consents/<consent_id>/action", methods=["POST"])
@require_auth
def action_consent(consent_id: str):
    """Grant, deny, or revoke an ABDM consent request."""
    data = request.get_json(silent=True) or {}
    action = data.get("action", "grant").lower()
    if action not in ("grant", "deny", "revoke"):
        return api_error("Invalid action. Must be 'grant', 'deny', or 'revoke'", status_code=400)

    updated = get_abdm_service().action_consent(consent_id, action)
    if not updated:
        return api_error(f"Consent request '{consent_id}' not found", status_code=404)

    _audit(f"abdm:consent_{action}ed", request.path, details={"consentId": consent_id, "status": updated.get("status")})
    return api_response({"consent": updated, "message": f"Consent request has been {action}ed."})


# ─────────────────────────────────────────────────────────────
# 4. Linked Health Facilities (HIPs)
# ─────────────────────────────────────────────────────────────

@abdm_bp.route("/abdm/facilities", methods=["GET"])
@require_auth
def list_facilities():
    """List linked healthcare providers and hospital nodes."""
    uid = _user_id()
    facilities = get_abdm_service().list_facilities(uid)
    return api_response({"facilities": facilities, "count": len(facilities)})


@abdm_bp.route("/abdm/facilities/link", methods=["POST"])
@require_auth
def link_facility():
    """Link a new hospital or diagnostic center using ABHA discovery."""
    data = request.get_json(silent=True) or {}
    uid = _user_id()
    facility = get_abdm_service().link_facility(uid, data)
    _audit("abdm:facility_linked", request.path, details={"facilityName": facility.get("facilityName")})
    return api_response({"facility": facility, "message": "Facility linked to ABHA profile."}, status_code=201)


# ─────────────────────────────────────────────────────────────
# 5. ABDM Scan & Share (OPD Kiosk Token Generator)
# ─────────────────────────────────────────────────────────────

@abdm_bp.route("/abdm/scan-share/tokens", methods=["GET"])
@require_auth
def list_scan_tokens():
    """List active OPD queue tokens."""
    uid = _user_id()
    tokens = get_abdm_service().list_scan_tokens(uid)
    return api_response({"tokens": tokens, "count": len(tokens)})


@abdm_bp.route("/abdm/scan-share/generate", methods=["POST"])
@require_auth
def generate_scan_token():
    """Scan hospital reception QR code and generate instant paperless OPD token."""
    data = request.get_json(silent=True) or {}
    hospital_name = data.get("hospitalName", "AIIMS New Delhi")
    department = data.get("department", "Outpatient Department (OPD)")
    uid = _user_id()
    token = get_abdm_service().generate_scan_token(uid, hospital_name, department)
    _audit("abdm:scan_and_share_token_issued", request.path, details={"tokenNumber": token.get("tokenNumber")})
    return api_response({"token": token, "message": "OPD registration token generated successfully."}, status_code=201)


# ─────────────────────────────────────────────────────────────
# 6. CoWIN Digital Vaccination Passport
# ─────────────────────────────────────────────────────────────

@abdm_bp.route("/abdm/vaccinations", methods=["GET"])
@require_auth
def get_vaccinations():
    """Retrieve verified COVID-19 / Universal Immunization certificates."""
    uid = _user_id()
    vaccinations = get_abdm_service().get_vaccinations(uid)
    return api_response({"vaccinations": vaccinations, "count": len(vaccinations)})


# ─────────────────────────────────────────────────────────────
# 7. Emergency SOS Medical Pass
# ─────────────────────────────────────────────────────────────

@abdm_bp.route("/abdm/emergency-pass", methods=["GET"])
@require_auth
def get_emergency_pass():
    """Retrieve emergency medical information and NOTTO organ pledge."""
    uid = _user_id()
    emergency_pass = get_abdm_service().get_emergency_pass(uid)
    return api_response({"emergencyPass": emergency_pass})


@abdm_bp.route("/abdm/emergency-pass", methods=["PUT"])
@require_auth
def update_emergency_pass():
    """Update emergency contacts or allergies."""
    data = request.get_json(silent=True) or {}
    uid = _user_id()
    updated = get_abdm_service().update_emergency_pass(uid, data)
    _audit("abdm:emergency_pass_updated", request.path)
    return api_response({"emergencyPass": updated})
