"""
Government of India Ayushman Bharat Digital Mission (ABDM) & Aarogya Setu Models.

Implements database persistence for:
- ABHA 14-digit digital identities and KYC records
- ABDM Consent Manager requests and approval artefacts (M3)
- Linked Health Information Providers (HIPs) & networks (M2)
- Aarogya Setu clinical risk assessments & triage logs
- CoWIN / Universal Immunization digital vaccination passes
- ABDM Scan & Share paperless OPD registration tokens
"""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text

from app.database.models.base import Base, TimestampMixin


class AbhaProfile(Base, TimestampMixin):
    """Ayushman Bharat Health Account (ABHA) official identity profile."""

    __tablename__ = "abha_profiles"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    abha_number = Column(String(20), unique=True, nullable=False, index=True)
    abha_address = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    gender = Column(String(20), nullable=False)
    dob = Column(String(20), nullable=False)
    blood_group = Column(String(10), nullable=True)
    mobile = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    state = Column(String(100), default="Delhi", nullable=False)
    district = Column(String(100), default="New Delhi", nullable=False)
    pincode = Column(String(20), default="110029", nullable=False)
    kyc_status = Column(String(50), default="UIDAI_VERIFIED", nullable=False)
    notto_pledge_id = Column(String(100), nullable=True)
    photo_uri = Column(String(500), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "userId": self.user_id,
            "abhaNumber": self.abha_number,
            "abhaAddress": self.abha_address,
            "fullName": self.full_name,
            "gender": self.gender,
            "dob": self.dob,
            "bloodGroup": self.blood_group,
            "mobile": self.mobile,
            "email": self.email,
            "state": self.state,
            "district": self.district,
            "pincode": self.pincode,
            "kycStatus": self.kyc_status,
            "nottoPledgeId": self.notto_pledge_id,
            "photoUri": self.photo_uri,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class AbdmConsent(Base, TimestampMixin):
    """ABDM M3 Consent Request and Consent Artefact."""

    __tablename__ = "abdm_consents"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    consent_request_id = Column(String(64), unique=True, nullable=False, index=True)
    requester_name = Column(String(150), nullable=False)
    requester_type = Column(String(50), default="Hospital", nullable=False)
    purpose_code = Column(String(50), nullable=False)
    purpose_description = Column(String(255), nullable=True)
    record_types_json = Column(
        Text, nullable=False
    )  # JSON array: ["DiagnosticReport", "Prescription"]
    date_range_from = Column(String(50), nullable=True)
    date_range_to = Column(String(50), nullable=True)
    expiry_date = Column(String(50), nullable=False)
    status = Column(
        String(50), default="REQUESTED", nullable=False, index=True
    )  # REQUESTED, GRANTED, DENIED, REVOKED

    def to_dict(self) -> dict:
        import json

        records = []
        try:
            records = json.loads(self.record_types_json) if self.record_types_json else []
        except Exception:
            records = [self.record_types_json]

        return {
            "id": self.id,
            "userId": self.user_id,
            "consentRequestId": self.consent_request_id,
            "requesterName": self.requester_name,
            "requesterType": self.requester_type,
            "purposeCode": self.purpose_code,
            "purposeDescription": self.purpose_description,
            "recordTypes": records,
            "dateRangeFrom": self.date_range_from,
            "dateRangeTo": self.date_range_to,
            "expiryDate": self.expiry_date,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class AbdmLinkedFacility(Base, TimestampMixin):
    """Linked Health Information Provider (HIP) facility."""

    __tablename__ = "abdm_linked_facilities"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hip_id = Column(String(64), nullable=False, index=True)
    facility_name = Column(String(200), nullable=False)
    facility_type = Column(String(100), default="General Hospital", nullable=False)
    state = Column(String(100), default="Delhi", nullable=False)
    linked_date = Column(String(50), nullable=False)
    sync_status = Column(String(50), default="SYNCED", nullable=False)
    records_count = Column(Integer, default=0, nullable=False)
    last_synced_at = Column(String(50), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "userId": self.user_id,
            "hipId": self.hip_id,
            "facilityName": self.facility_name,
            "facilityType": self.facility_type,
            "state": self.state,
            "linkedDate": self.linked_date,
            "syncStatus": self.sync_status,
            "recordsCount": self.records_count,
            "lastSyncedAt": self.last_synced_at,
        }


class AarogyaSetuAssessment(Base, TimestampMixin):
    """Aarogya Setu COVID-19 / Infectious Disease clinical risk assessment."""

    __tablename__ = "aarogya_setu_assessments"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    risk_level = Column(String(50), default="SAFE_LOW", nullable=False)  # SAFE_LOW, MODERATE, HIGH
    score = Column(Integer, default=0, nullable=False)
    symptoms_json = Column(Text, nullable=True)
    comorbidities_json = Column(Text, nullable=True)
    travel_history = Column(Boolean, default=False, nullable=False)
    contact_exposure = Column(Boolean, default=False, nullable=False)
    recommendations_json = Column(Text, nullable=True)

    def to_dict(self) -> dict:
        import json

        def _parse(val):
            try:
                return json.loads(val) if val else []
            except Exception:
                return []

        return {
            "id": self.id,
            "userId": self.user_id,
            "riskLevel": self.risk_level,
            "score": self.score,
            "symptoms": _parse(self.symptoms_json),
            "comorbidities": _parse(self.comorbidities_json),
            "travelHistory": self.travel_history,
            "contactExposure": self.contact_exposure,
            "recommendations": _parse(self.recommendations_json),
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class VaccinationRecord(Base, TimestampMixin):
    """CoWIN / Universal Immunization digital vaccination passport record."""

    __tablename__ = "vaccination_records"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vaccine_name = Column(String(100), nullable=False)
    dose_type = Column(String(50), nullable=False)  # Dose 1, Dose 2, Precaution Dose
    date_administered = Column(String(50), nullable=False)
    batch_number = Column(String(50), nullable=False)
    vaccinated_by = Column(String(150), nullable=True)
    center_name = Column(String(200), nullable=False)
    certificate_ref = Column(String(100), unique=True, nullable=False, index=True)
    qr_payload = Column(Text, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "userId": self.user_id,
            "vaccineName": self.vaccine_name,
            "doseType": self.dose_type,
            "dateAdministered": self.date_administered,
            "batchNumber": self.batch_number,
            "vaccinatedBy": self.vaccinated_by,
            "centerName": self.center_name,
            "certificateRef": self.certificate_ref,
            "qrPayload": self.qr_payload,
        }


class ScanShareToken(Base, TimestampMixin):
    """ABDM Scan & Share instant OPD registration token."""

    __tablename__ = "scan_and_share_tokens"

    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_number = Column(String(50), nullable=False, index=True)
    facility_name = Column(String(200), nullable=False)
    department = Column(String(100), nullable=False)
    counter_number = Column(String(20), default="Counter 4", nullable=False)
    queue_position = Column(Integer, default=3, nullable=False)
    estimated_wait_mins = Column(Integer, default=15, nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, COMPLETED, EXPIRED

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "userId": self.user_id,
            "tokenNumber": self.token_number,
            "facilityName": self.facility_name,
            "department": self.department,
            "counterNumber": self.counter_number,
            "queuePosition": self.queue_position,
            "estimatedWaitMins": self.estimated_wait_mins,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
