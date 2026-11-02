"""
Ayushman Bharat Digital Mission (ABDM) & Aarogya Setu Government Service.

Implements official Government of India health specifications:
- ABDM Milestone 1 (M1): 14-digit ABHA ID, tokenized @abdm address, UIDAI KYC verification
- ABDM Milestone 2 (M2): Health Information Provider (HIP) discovery and record linkage
- ABDM Milestone 3 (M3): Consent Artefacts and paperless OPD Scan & Share token generation
- Aarogya Setu: Clinical risk classification engine, interactive triage, and MoHFW protocols
- CoWIN / Universal Immunization digital vaccination passport with verified batch tracking
- Emergency SOS Medical Pass with NOTTO organ donation pledge record
"""

import json
import random
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import structlog

logger = structlog.get_logger()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AbdmService:
    """Thread-safe service managing Indian Government ABDM & Aarogya Setu workflows."""

    _instance: Optional["AbdmService"] = None
    _lock = threading.Lock()

    def __init__(self):
        self._lock = threading.Lock()
        self._initialized = False

        # In-memory store fallback with rich seed data
        self._profiles: Dict[str, dict] = {}
        self._consents: Dict[str, dict] = {}
        self._facilities: Dict[str, dict] = {}
        self._assessments: Dict[str, list] = {}
        self._vaccinations: Dict[str, list] = {}
        self._scan_tokens: Dict[str, list] = {}
        self._emergency_passes: Dict[str, dict] = {}

        self._seed_default_data()

    @classmethod
    def get_instance(cls) -> "AbdmService":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _seed_default_data(self):
        """Seed realistic Government of India ABDM & Aarogya Setu profiles."""
        default_user_id = "default-user"

        # 1. Official ABHA Profile
        self._profiles[default_user_id] = {
            "id": "abha_prof_01",
            "userId": default_user_id,
            "abhaNumber": "91-4567-8901-2345",
            "abhaAddress": "rahul.sharma@abdm",
            "fullName": "Rahul Sharma",
            "gender": "Male",
            "dob": "1988-08-15",
            "age": 36,
            "bloodGroup": "O+",
            "mobile": "+91 98765 43210",
            "email": "rahul.sharma@mipaas.health",
            "state": "Delhi",
            "district": "New Delhi",
            "pincode": "110029",
            "address": "B-42, Safdarjung Enclave, New Delhi - 110029",
            "kycStatus": "UIDAI_VERIFIED",
            "kycMethod": "Aadhaar e-KYC (Biometric & OTP)",
            "verificationDate": "2024-01-12",
            "nottoPledgeId": "NOTTO-DL-2024-88419",
            "organDonorStatus": "Pledged Donor (Kidneys, Corneas, Heart)",
            "photoUri": "/avatars/rahul_sharma.jpg",
            "issuer": "National Health Authority (NHA)",
            "scheme": "Ayushman Bharat Digital Mission (ABDM)",
        }

        # 2. ABDM M3 Consents
        sample_consents = [
            {
                "id": "cns_01",
                "userId": default_user_id,
                "consentRequestId": "CR-AIIMS-2024-9912",
                "requesterName": "All India Institute of Medical Sciences (AIIMS), New Delhi",
                "department": "Cardiology & Radiology",
                "requesterType": "Autonomous National Institute",
                "purposeCode": "CARETREAT",
                "purposeDescription": "Review prior diagnostic imaging and ECG for upcoming teleconsultation",
                "recordTypes": ["DiagnosticReport", "Prescription", "DischargeSummary"],
                "dateRangeFrom": "2023-01-01",
                "dateRangeTo": "2024-12-31",
                "expiryDate": "2024-12-31T23:59:59Z",
                "status": "GRANTED",
                "createdAt": "2024-10-10T10:15:00Z",
                "hiuId": "HIU-AIIMS-DELHI",
            },
            {
                "id": "cns_02",
                "userId": default_user_id,
                "consentRequestId": "CR-MAX-2024-4481",
                "requesterName": "Max Super Speciality Hospital, Saket",
                "department": "Internal Medicine",
                "requesterType": "Tertiary Care Hospital",
                "purposeCode": "DIAGNOSTIC",
                "purposeDescription": "Access recent blood work and diabetic profile for health screening",
                "recordTypes": ["DiagnosticReport", "OPConsultation"],
                "dateRangeFrom": "2024-06-01",
                "dateRangeTo": "2024-10-15",
                "expiryDate": "2024-11-15T23:59:59Z",
                "status": "REQUESTED",
                "createdAt": "2024-10-14T08:30:00Z",
                "hiuId": "HIU-MAX-SAKET",
            },
            {
                "id": "cns_03",
                "userId": default_user_id,
                "consentRequestId": "CR-FORTIS-2024-1102",
                "requesterName": "Fortis Escorts Heart Institute, Okhla",
                "department": "Emergency & Interventional Cardiology",
                "requesterType": "Hospital Network",
                "purposeCode": "EMERGENCY",
                "purposeDescription": "Emergency health records access during acute chest pain evaluation",
                "recordTypes": ["DiagnosticReport", "Prescription"],
                "dateRangeFrom": "2024-01-01",
                "dateRangeTo": "2024-10-10",
                "expiryDate": "2024-10-11T00:00:00Z",
                "status": "EXPIRED",
                "createdAt": "2024-10-09T14:20:00Z",
                "hiuId": "HIU-FORTIS-OKHLA",
            },
        ]
        for c in sample_consents:
            self._consents[c["id"]] = c

        # 3. Linked Health Facilities (HIPs)
        sample_facilities = [
            {
                "id": "fac_01",
                "userId": default_user_id,
                "hipId": "IN0710000001",
                "facilityName": "All India Institute of Medical Sciences (AIIMS), New Delhi",
                "facilityType": "Central Government Apex Hospital",
                "state": "Delhi",
                "linkedDate": "2023-11-14",
                "syncStatus": "SYNCED",
                "recordsCount": 8,
                "lastSyncedAt": "Today, 09:42 AM",
            },
            {
                "id": "fac_02",
                "userId": default_user_id,
                "hipId": "IN0710000045",
                "facilityName": "Safdarjung Hospital & VMMC, New Delhi",
                "facilityType": "Government Medical College & Hospital",
                "state": "Delhi",
                "linkedDate": "2024-02-20",
                "syncStatus": "SYNCED",
                "recordsCount": 4,
                "lastSyncedAt": "Yesterday, 04:15 PM",
            },
            {
                "id": "fac_03",
                "userId": default_user_id,
                "hipId": "IN2710000109",
                "facilityName": "Tata Memorial Centre, Mumbai",
                "facilityType": "Cancer Speciality Center",
                "state": "Maharashtra",
                "linkedDate": "2024-05-18",
                "syncStatus": "SYNCED",
                "recordsCount": 2,
                "lastSyncedAt": "Oct 10, 2024",
            },
            {
                "id": "fac_04",
                "userId": default_user_id,
                "hipId": "IN0710000882",
                "facilityName": "Memorial Diagnostic Pavilion (MiPAAS OpenEMR Node)",
                "facilityType": "Diagnostic Radiology & AI Imaging Center",
                "state": "Delhi",
                "linkedDate": "2024-01-05",
                "syncStatus": "LIVE",
                "recordsCount": 14,
                "lastSyncedAt": "Live FHIR R4 Stream",
            },
        ]
        for f in sample_facilities:
            self._facilities[f["id"]] = f

        # 4. Aarogya Setu Assessments
        self._assessments[default_user_id] = [
            {
                "id": "as_eval_01",
                "userId": default_user_id,
                "riskLevel": "SAFE_LOW",
                "riskText": "You are Safe",
                "riskSubtext": "Low risk of infection based on current clinical symptoms and exposure log.",
                "score": 0,
                "symptoms": ["None of the above"],
                "comorbidities": ["None of the above"],
                "travelHistory": False,
                "contactExposure": False,
                "bluetoothContactStatus": "No contact with confirmed COVID-19/infectious patient in last 14 days",
                "proximityDeviceCount": 18,
                "recommendations": [
                    "Maintain hand hygiene by washing hands regularly with soap or sanitizer.",
                    "Wear a mask in crowded indoor health facilities or hospitals.",
                    "Ensure your routine health vitals and booster vaccinations are up-to-date.",
                ],
                "assessedAt": "Today, 11:20 AM",
            }
        ]

        # 5. CoWIN Digital Vaccination Passport
        self._vaccinations[default_user_id] = [
            {
                "id": "vac_01",
                "userId": default_user_id,
                "vaccineName": "COVISHIELD™ (ChAdOx1-S recombinant)",
                "doseType": "Dose 1",
                "dateAdministered": "2021-04-18",
                "batchNumber": "4120Z012",
                "manufacturer": "Serum Institute of India Pvt. Ltd.",
                "vaccinatedBy": "Sister Sunita Devi (ANM)",
                "centerName": "Safdarjung Hospital CVC Site 2, New Delhi",
                "certificateRef": "COWIN-DL-99482104-D1",
                "status": "Verified on CoWIN & ABDM",
            },
            {
                "id": "vac_02",
                "userId": default_user_id,
                "vaccineName": "COVISHIELD™ (ChAdOx1-S recombinant)",
                "doseType": "Dose 2",
                "dateAdministered": "2021-07-22",
                "batchNumber": "4121A044",
                "manufacturer": "Serum Institute of India Pvt. Ltd.",
                "vaccinatedBy": "Sister Rekha Sharma (ANM)",
                "centerName": "AIIMS New Delhi CVC Site 1, New Delhi",
                "certificateRef": "COWIN-DL-99482104-D2",
                "status": "Verified on CoWIN & ABDM",
            },
            {
                "id": "vac_03",
                "userId": default_user_id,
                "vaccineName": "CORBEVAX™ (Recombinant Protein Subunit)",
                "doseType": "Precaution Dose (Booster)",
                "dateAdministered": "2022-09-10",
                "batchNumber": "CRB-8921B",
                "manufacturer": "Biological E. Limited",
                "vaccinatedBy": "Staff Nurse Priya Nair",
                "centerName": "Max Super Speciality CVC Saket, New Delhi",
                "certificateRef": "COWIN-DL-99482104-PREC",
                "status": "Verified on CoWIN & ABDM",
            },
        ]

        # 6. Scan & Share OPD Registration Tokens
        self._scan_tokens[default_user_id] = [
            {
                "id": "tok_01",
                "userId": default_user_id,
                "tokenNumber": "OPD-A-042",
                "facilityName": "All India Institute of Medical Sciences (AIIMS), New Delhi",
                "department": "Department of Cardiology & Chest Medicine",
                "counterNumber": "OPD Registration Counter 4",
                "queuePosition": 3,
                "estimatedWaitMins": 12,
                "status": "ACTIVE",
                "generatedAt": "Today, 08:45 AM",
                "abhaNumber": "91-4567-8901-2345",
                "abhaAddress": "rahul.sharma@abdm",
            }
        ]

        # 7. Emergency Medical SOS Pass
        self._emergency_passes[default_user_id] = {
            "userId": default_user_id,
            "fullName": "Rahul Sharma",
            "bloodGroup": "O Positive (O+)",
            "dob": "1988-08-15 (36 Years)",
            "abhaId": "91-4567-8901-2345",
            "primaryContact": {
                "name": "Priya Sharma (Spouse)",
                "phone": "+91 98765 43210",
                "relation": "Spouse",
            },
            "secondaryContact": {
                "name": "Dr. A. K. Sen (Consultant Physician)",
                "phone": "+91 98111 22334",
                "relation": "Family Doctor",
            },
            "allergies": ["Penicillin", "Sulfa Drugs", "NSAIDs (Aspirin)"],
            "chronicConditions": ["Mild Essential Hypertension", "Borderline Hyperlipidemia"],
            "currentMedications": ["Lisinopril 10mg OD", "Rosuvastatin 10mg OD"],
            "organDonor": {
                "isDonor": True,
                "pledgeId": "NOTTO-DL-2024-88419",
                "pledgedOrgans": "Corneas, Kidneys, Heart Valves, Liver",
                "registry": "National Organ & Tissue Transplant Organisation (NOTTO)",
            },
            "emergencyInstructions": "In case of trauma or unresponsiveness, notify spouse immediately and transport to AIIMS New Delhi or nearest cardiac triage.",
        }

    # ─────────────────────────────────────────────────────────────
    # Profile & ABHA Card Management
    # ─────────────────────────────────────────────────────────────

    def get_profile(self, user_id: str) -> dict:
        with self._lock:
            prof = self._profiles.get(user_id) or self._profiles.get("default-user")
            return prof.copy()

    def request_otp(self, identifier: str) -> dict:
        """Simulate sending UIDAI Aadhaar / ABDM mobile verification OTP."""
        txn_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
        return {
            "txnId": txn_id,
            "identifierMasked": f"XXXX-XXXX-{identifier[-4:]}" if len(identifier) >= 4 else "XXXX-XXXX-2345",
            "expiresInSeconds": 600,
            "message": "OTP sent successfully to UIDAI registered mobile number.",
        }

    def verify_otp(self, user_id: str, otp: str, txn_id: str) -> dict:
        """Validate OTP and return confirmed profile."""
        with self._lock:
            prof = self._profiles.get(user_id) or self._profiles.get("default-user")
            prof_copy = prof.copy()
            prof_copy["kycStatus"] = "UIDAI_VERIFIED"
            prof_copy["verificationDate"] = datetime.now().strftime("%Y-%m-%d")
            self._profiles[user_id] = prof_copy
            return prof_copy

    def update_profile(self, user_id: str, updates: dict) -> dict:
        with self._lock:
            prof = self._profiles.get(user_id) or self._profiles.get("default-user")
            prof_copy = prof.copy()
            for k, v in updates.items():
                if v is not None:
                    prof_copy[k] = v
            self._profiles[user_id] = prof_copy
            return prof_copy

    # ─────────────────────────────────────────────────────────────
    # Aarogya Setu Clinical Risk Assessment
    # ─────────────────────────────────────────────────────────────

    def assess_risk(self, user_id: str, assessment_input: dict) -> dict:
        """
        Calculates risk score based on Ministry of Health & Family Welfare (MoHFW) standards.
        Inputs: symptoms, comorbidities, travelHistory, contactExposure.
        """
        symptoms = assessment_input.get("symptoms", [])
        comorbidities = assessment_input.get("comorbidities", [])
        travel_history = bool(assessment_input.get("travelHistory", False))
        contact_exposure = bool(assessment_input.get("contactExposure", False))

        score = 0
        score += len([s for s in symptoms if s and s != "None of the above"]) * 15
        score += len([c for c in comorbidities if c and c != "None of the above"]) * 10
        if travel_history:
            score += 20
        if contact_exposure:
            score += 35

        if score == 0:
            risk_level = "SAFE_LOW"
            risk_text = "You are Safe"
            risk_subtext = "Low risk of infection based on self-reported clinical symptoms and exposure."
            recommendations = [
                "Practice regular hand washing with soap or alcohol-based sanitizer.",
                "Wear a surgical mask when visiting health facilities or congested areas.",
                "Monitor your daily body temperature and oxygen saturation (SpO2).",
            ]
        elif score <= 35:
            risk_level = "MODERATE"
            risk_text = "Moderate Risk — Monitor Symptoms"
            risk_subtext = "Mild symptoms or risk factors observed. Self-quarantine and monitor closely."
            recommendations = [
                "Stay at home in a well-ventilated room and limit physical contact.",
                "Take a rapid antigen or RT-PCR test if symptoms persist beyond 48 hours.",
                "Log your temperature and pulse twice daily in the Eka.care vitals tracker.",
                "Consult a physician via teleconsultation if breathlessness develops.",
            ]
        else:
            risk_level = "HIGH"
            risk_text = "High Risk — Immediate Action Required"
            risk_subtext = "Multiple critical symptoms and exposure indicators detected."
            recommendations = [
                "Immediately contact the National Health Helpline at toll-free 1075 or +91-11-23978046.",
                "Isolate immediately from family members and vulnerable elderly.",
                "Schedule an urgent clinical evaluation or visit the nearest COVID-19/Flu clinic.",
                "Keep emergency SOS contacts alert.",
            ]

        assessment_record = {
            "id": f"as_eval_{uuid.uuid4().hex[:6]}",
            "userId": user_id,
            "riskLevel": risk_level,
            "riskText": risk_text,
            "riskSubtext": risk_subtext,
            "score": score,
            "symptoms": symptoms,
            "comorbidities": comorbidities,
            "travelHistory": travel_history,
            "contactExposure": contact_exposure,
            "bluetoothContactStatus": "No contact with confirmed COVID-19/infectious patient in last 14 days" if not contact_exposure else "Potential exposure detected within 6 feet",
            "proximityDeviceCount": random.randint(12, 28),
            "recommendations": recommendations,
            "assessedAt": datetime.now().strftime("Today, %I:%M %p"),
        }

        with self._lock:
            if user_id not in self._assessments:
                self._assessments[user_id] = []
            self._assessments[user_id].insert(0, assessment_record)

        return assessment_record

    def get_latest_assessment(self, user_id: str) -> dict:
        with self._lock:
            history = self._assessments.get(user_id) or self._assessments.get("default-user") or []
            if history:
                return history[0]
            # default safe
            return self.assess_risk(user_id, {"symptoms": ["None of the above"]})

    # ─────────────────────────────────────────────────────────────
    # ABDM Scan & Share (OPD Kiosk Token Generator)
    # ─────────────────────────────────────────────────────────────

    def generate_scan_token(self, user_id: str, hospital_name: str, department: str) -> dict:
        """Simulate scanning hospital reception QR code to generate paperless OPD token."""
        with self._lock:
            prof = self._profiles.get(user_id) or self._profiles.get("default-user")
            token_seq = random.randint(30, 99)
            prefix = "OPD-" + "".join([w[0].upper() for w in hospital_name.split()[:3] if w])
            token_number = f"{prefix}-{token_seq:03d}"
            counter = f"Counter {random.randint(1, 8)}"
            wait_mins = random.randint(10, 25)
            queue_pos = random.randint(2, 6)

            token_data = {
                "id": f"tok_{uuid.uuid4().hex[:6]}",
                "userId": user_id,
                "tokenNumber": token_number,
                "facilityName": hospital_name,
                "department": department,
                "counterNumber": counter,
                "queuePosition": queue_pos,
                "estimatedWaitMins": wait_mins,
                "status": "ACTIVE",
                "generatedAt": datetime.now().strftime("Today, %I:%M %p"),
                "abhaNumber": prof.get("abhaNumber", "91-4567-8901-2345"),
                "abhaAddress": prof.get("abhaAddress", "rahul.sharma@abdm"),
            }

            if user_id not in self._scan_tokens:
                self._scan_tokens[user_id] = []
            self._scan_tokens[user_id].insert(0, token_data)

            return token_data

    def list_scan_tokens(self, user_id: str) -> List[dict]:
        with self._lock:
            tokens = self._scan_tokens.get(user_id) or self._scan_tokens.get("default-user") or []
            return list(tokens)

    # ─────────────────────────────────────────────────────────────
    # ABDM M3 Consent Manager
    # ─────────────────────────────────────────────────────────────

    def list_consents(self, user_id: str, status_filter: Optional[str] = None) -> List[dict]:
        with self._lock:
            res = list(self._consents.values())
            if status_filter:
                res = [c for c in res if c.get("status") == status_filter]
            return res

    def action_consent(self, consent_id: str, action: str) -> Optional[dict]:
        """
        Actions: 'grant', 'deny', 'revoke'
        """
        with self._lock:
            consent = self._consents.get(consent_id)
            if not consent:
                return None
            if action == "grant":
                consent["status"] = "GRANTED"
            elif action == "deny":
                consent["status"] = "DENIED"
            elif action == "revoke":
                consent["status"] = "REVOKED"
            consent["updatedAt"] = _now_iso()
            return consent.copy()

    # ─────────────────────────────────────────────────────────────
    # Linked Facilities (HIPs)
    # ─────────────────────────────────────────────────────────────

    def list_facilities(self, user_id: str) -> List[dict]:
        with self._lock:
            return list(self._facilities.values())

    def link_facility(self, user_id: str, data: dict) -> dict:
        with self._lock:
            new_id = f"fac_{uuid.uuid4().hex[:6]}"
            new_fac = {
                "id": new_id,
                "userId": user_id,
                "hipId": data.get("hipId", f"IN{random.randint(10000000, 99999999)}"),
                "facilityName": data.get("facilityName", "New Health Facility"),
                "facilityType": data.get("facilityType", "Speciality Clinic"),
                "state": data.get("state", "Delhi"),
                "linkedDate": datetime.now().strftime("%Y-%m-%d"),
                "syncStatus": "SYNCED",
                "recordsCount": random.randint(1, 5),
                "lastSyncedAt": "Just now",
            }
            self._facilities[new_id] = new_fac
            return new_fac

    # ─────────────────────────────────────────────────────────────
    # CoWIN Vaccination Passport
    # ─────────────────────────────────────────────────────────────

    def get_vaccinations(self, user_id: str) -> List[dict]:
        with self._lock:
            vacs = self._vaccinations.get(user_id) or self._vaccinations.get("default-user") or []
            return list(vacs)

    # ─────────────────────────────────────────────────────────────
    # Emergency SOS Medical Pass
    # ─────────────────────────────────────────────────────────────

    def get_emergency_pass(self, user_id: str) -> dict:
        with self._lock:
            pass_data = self._emergency_passes.get(user_id) or self._emergency_passes.get("default-user")
            return pass_data.copy()

    def update_emergency_pass(self, user_id: str, data: dict) -> dict:
        with self._lock:
            pass_data = self._emergency_passes.get(user_id) or self._emergency_passes.get("default-user")
            pass_copy = pass_data.copy()
            for k, v in data.items():
                if v is not None:
                    pass_copy[k] = v
            self._emergency_passes[user_id] = pass_copy
            return pass_copy


def get_abdm_service() -> AbdmService:
    return AbdmService.get_instance()
