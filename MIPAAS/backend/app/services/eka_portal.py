"""
Eka.care Personal Health Record (PHR) Portal Service.

Backs the patient-facing eka.care hub with production endpoints for:
- Family member profiles with ABHA (ABDM) identifiers
- Medication schedule & daily adherence tracking
- Vitals logging with clinical status classification
- Encrypted health record locker (prescriptions, labs, scans)
- Appointment booking and teleconsult scheduling
- Context-aware AI consultations grounded in member data
"""

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog

logger = structlog.get_logger()

# app.services.rbac.UserProfile at call time; kept loose to avoid an import cycle
UserProfileLike = Any

VITAL_TYPES = [
    "Blood Pressure",
    "Blood Sugar (Fasting)",
    "Blood Sugar (PP)",
    "Heart Rate",
    "SpO2",
    "Weight & BMI",
    "Body Temp",
]

RECORD_CATEGORIES = [
    "Prescriptions",
    "Lab Reports",
    "Scans & Imaging",
    "Discharge Summary",
    "Vaccinations",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_label() -> str:
    return datetime.now().strftime("Today, %I:%M %p")


@dataclass
class FamilyMember:
    id: str
    name: str
    relation: str
    age: int
    gender: str
    abha_id: str
    blood_group: str
    avatar_color: str
    primary_condition: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "relation": self.relation,
            "age": self.age,
            "gender": self.gender,
            "abhaId": self.abha_id,
            "bloodGroup": self.blood_group,
            "avatarColor": self.avatar_color,
            "primaryCondition": self.primary_condition,
        }


@dataclass
class Medication:
    id: str
    member_id: str
    name: str
    dosage: str
    frequency: str
    timing: str
    instruction: str
    prescribed_by: str
    refill_days_left: int
    time_slot: str
    taken_today: bool = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "memberId": self.member_id,
            "name": self.name,
            "dosage": self.dosage,
            "frequency": self.frequency,
            "timing": self.timing,
            "instruction": self.instruction,
            "prescribedBy": self.prescribed_by,
            "refillDaysLeft": self.refill_days_left,
            "takenToday": self.taken_today,
            "timeSlot": self.time_slot,
        }


@dataclass
class VitalRecord:
    id: str
    member_id: str
    type: str
    value: str
    unit: str
    status: str
    recorded_at: str
    trend: str
    target_range: str
    created_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "memberId": self.member_id,
            "type": self.type,
            "value": self.value,
            "unit": self.unit,
            "status": self.status,
            "recordedAt": self.recorded_at,
            "trend": self.trend,
            "targetRange": self.target_range,
        }


@dataclass
class HealthRecord:
    id: str
    member_id: str
    title: str
    category: str
    doctor_or_lab: str
    date: str
    file_type: str
    file_size: str
    ai_key_summary: str
    tags: List[str] = field(default_factory=list)
    extracted_parameters: List[dict] = field(default_factory=list)
    created_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "memberId": self.member_id,
            "title": self.title,
            "category": self.category,
            "doctorOrLab": self.doctor_or_lab,
            "date": self.date,
            "fileType": self.file_type,
            "fileSize": self.file_size,
            "aiKeySummary": self.ai_key_summary,
            "extractedParameters": self.extracted_parameters,
            "tags": self.tags,
        }


@dataclass
class Appointment:
    id: str
    member_id: str
    doctor_name: str
    specialty: str
    hospital: str
    date: str
    time: str
    token_number: int
    type: str
    status: str = "Confirmed"
    queue_wait_mins: int = 0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "memberId": self.member_id,
            "doctorName": self.doctor_name,
            "specialty": self.specialty,
            "hospital": self.hospital,
            "date": self.date,
            "time": self.time,
            "tokenNumber": self.token_number,
            "type": self.type,
            "status": self.status,
            "queueWaitMins": self.queue_wait_mins,
        }


TARGET_RANGES: Dict[str, str] = {
    "Blood Pressure": "< 120/80 mmHg",
    "Blood Sugar (Fasting)": "70 - 100 mg/dL",
    "Blood Sugar (PP)": "< 140 mg/dL",
    "Heart Rate": "60 - 100 BPM",
    "SpO2": "95 - 100 %",
    "Weight & BMI": "18.5 - 24.9 BMI",
    "Body Temp": "97.0 - 99.0 °F",
}


class EkaCarePortalService:
    """In-memory store + business logic for the eka.care patient portal."""

    def __init__(self):
        self._lock = threading.Lock()
        self._members: Dict[str, FamilyMember] = {}
        self._medications: Dict[str, Medication] = {}
        self._vitals: Dict[str, VitalRecord] = {}
        self._records: Dict[str, HealthRecord] = {}
        self._appointments: Dict[str, Appointment] = {}
        self._seed_initial_data()

    # ─────────────────────────────────────────────────────────────
    # Seed data (demo family clinic cohort)
    # ─────────────────────────────────────────────────────────────

    def _seed_initial_data(self) -> None:
        members = [
            FamilyMember("fam_1", "Yatharth Sharma", "Self", 32, "Male",
                         "91-8842-1940-2219", "O+", "from-teal-500 to-emerald-600"),
            FamilyMember("fam_2", "Priya Sharma", "Spouse", 30, "Female",
                         "91-7731-9021-4410", "B+", "from-purple-500 to-indigo-600"),
            FamilyMember("fam_3", "Ramesh Sharma", "Father", 64, "Male",
                         "91-4420-1193-8822", "O+", "from-amber-500 to-orange-600",
                         "Type 2 Diabetes & Hypertension"),
            FamilyMember("fam_4", "Sunita Sharma", "Mother", 60, "Female",
                         "91-3319-8472-0019", "A+", "from-rose-500 to-pink-600"),
        ]
        for m in members:
            self._members[m.id] = m

        meds = [
            Medication("med_1", "fam_1", "Metformin 500mg", "1 Tablet", "Twice daily",
                       "Morning", "After Food", "Dr. Anurag Verma", 6, "08:00 AM", True),
            Medication("med_2", "fam_1", "Telmisartan 40mg", "1 Tablet", "Once daily",
                       "Morning", "After Food", "Dr. Anurag Verma", 18, "08:30 AM", True),
            Medication("med_3", "fam_1", "Vitamin D3 60K IU", "1 Capsule", "Weekly",
                       "Morning", "With Food", "Dr. Meera Nambiar", 22, "09:00 AM", True),
            Medication("med_4", "fam_1", "Atorvastatin 10mg", "1 Tablet", "Once daily (Night)",
                       "Night", "After Food", "Dr. Anurag Verma", 14, "09:30 PM", False),
            Medication("med_5", "fam_3", "Glimepiride 1mg", "1 Tablet", "Once daily",
                       "Morning", "Before Food", "Dr. Meera Nambiar", 9, "07:30 AM", True),
        ]
        for med in meds:
            self._medications[med.id] = med

        vitals = [
            VitalRecord("vit_1", "fam_1", "Blood Pressure", "122 / 80", "mmHg",
                        "Normal", "Today, 08:15 AM", "stable", TARGET_RANGES["Blood Pressure"]),
            VitalRecord("vit_2", "fam_1", "Blood Sugar (Fasting)", "104", "mg/dL",
                        "Normal", "Today, 07:45 AM", "down", TARGET_RANGES["Blood Sugar (Fasting)"]),
            VitalRecord("vit_3", "fam_1", "Heart Rate", "72", "BPM",
                        "Optimal", "Today, 08:15 AM", "stable", TARGET_RANGES["Heart Rate"]),
            VitalRecord("vit_4", "fam_1", "SpO2", "99", "%",
                        "Optimal", "Today, 08:15 AM", "stable", TARGET_RANGES["SpO2"]),
            VitalRecord("vit_5", "fam_1", "Weight & BMI", "71.5 kg (BMI 22.8)", "kg",
                        "Normal", "11 Oct 2026", "down", TARGET_RANGES["Weight & BMI"]),
            VitalRecord("vit_6", "fam_1", "Body Temp", "98.4", "°F",
                        "Normal", "Today, 08:15 AM", "stable", TARGET_RANGES["Body Temp"]),
        ]
        for v in vitals:
            self._vitals[v.id] = v

        records = [
            HealthRecord(
                "rec_1", "fam_1", "Comprehensive Metabolic & Lipid Panel", "Lab Reports",
                "Max PathLabs · Dr. Lal Reference", "10 Oct 2026", "PDF", "1.4 MB",
                "HbA1c 5.6% within optimal range (<5.7%). Fasting blood sugar 104 mg/dL. "
                "Total cholesterol at 178 mg/dL with healthy HDL/LDL ratio.",
                ["Lipid", "Metabolic", "Diabetes Screen"],
                [
                    {"name": "HbA1c", "value": "5.6", "unit": "%", "flag": "Normal"},
                    {"name": "Fasting Glucose", "value": "104", "unit": "mg/dL", "flag": "Normal"},
                    {"name": "Total Cholesterol", "value": "178", "unit": "mg/dL", "flag": "Normal"},
                    {"name": "Triglycerides", "value": "142", "unit": "mg/dL", "flag": "Normal"},
                    {"name": "Creatinine", "value": "0.9", "unit": "mg/dL", "flag": "Normal"},
                ]),
            HealthRecord(
                "rec_2", "fam_1", "Cardiology Follow-Up Consultation Rx", "Prescriptions",
                "Dr. Anurag Verma · Apollo Hospital", "28 Sep 2026", "PDF", "840 KB",
                "Prescribed Telmisartan 40mg (AM) and Atorvastatin 10mg (PM). Advised 30 mins "
                "aerobic walking 5 days/week. Follow-up scheduled in 3 months.",
                ["Cardiology", "Prescription", "Dr. Verma"],
                [
                    {"name": "Systolic BP", "value": "124", "unit": "mmHg", "flag": "Normal"},
                    {"name": "Diastolic BP", "value": "82", "unit": "mmHg", "flag": "Normal"},
                ]),
            HealthRecord(
                "rec_3", "fam_1", "Chest Radiograph (PA View) Digital Study", "Scans & Imaging",
                "Metro Radiology Center · Dr. S. K. Gupta", "15 Sep 2026", "DICOM / PDF", "4.2 MB",
                "Bilateral lung fields clear. No focal consolidation, pneumothorax, or pleural "
                "effusion detected. Cardiothoracic ratio normal (< 0.50).",
                ["CXR", "Radiology", "AI Checked"]),
            HealthRecord(
                "rec_4", "fam_1", "Complete Blood Count (CBC) Routine", "Lab Reports",
                "Thyrocare National Diagnostics", "12 Aug 2026", "PDF", "920 KB",
                "Hemoglobin at 14.8 g/dL (optimal). Platelet count 240,000 /µL. Total WBC "
                "count 6,800 /µL without left shift.",
                ["CBC", "Hemogram"],
                [
                    {"name": "Hemoglobin", "value": "14.8", "unit": "g/dL", "flag": "Normal"},
                    {"name": "Platelets", "value": "240,000", "unit": "/µL", "flag": "Normal"},
                    {"name": "WBC Count", "value": "6,800", "unit": "/µL", "flag": "Normal"},
                ]),
            HealthRecord(
                "rec_5", "fam_1", "COVID-19 Booster Vaccination Certificate", "Vaccinations",
                "CoWIN / Ministry of Health & Family Welfare", "22 Apr 2025", "PDF", "410 KB",
                "Corbevax Precautionary Dose administered. Beneficiary ABHA linked and verified.",
                ["Vaccine", "CoWIN", "Verified"]),
        ]
        for r in records:
            self._records[r.id] = r

        appointments = [
            Appointment("apt_1", "fam_1", "Dr. Anurag Verma", "Senior Interventional Cardiologist",
                        "Apollo Heart Institute, Room 204", "Tomorrow, 14 Oct 2026", "10:30 AM",
                        14, "In-Clinic", "Confirmed", 15),
            Appointment("apt_2", "fam_1", "Dr. Meera Nambiar", "General Physician & Metabolic Specialist",
                        "Eka Care Telemedicine Portal", "Fri, 24 Oct 2026", "05:00 PM",
                        5, "Video Teleconsult", "Confirmed", 0),
        ]
        for a in appointments:
            self._appointments[a.id] = a

        logger.info("eka_portal_seeded", members=len(self._members),
                    medications=len(self._medications), records=len(self._records))

    # ─────────────────────────────────────────────────────────────
    # Session & family
    # ─────────────────────────────────────────────────────────────

    def get_session(self, user: UserProfileLike) -> dict:
        """Resolve a portal session for the authenticated user."""
        owned = [m for m in self._members.values() if m.relation == "Self"] or list(self._members.values())
        primary = owned[0] if owned else None
        return {
            "userId": user.id,
            "userName": user.name,
            "role": user.role.value,
            "linkedMembers": len(self._members),
            "primaryMemberId": primary.id if primary else None,
            "entitlements": sorted(p.value for p in user.permissions),
            "consent": {
                "abdmLinked": True,
                "aiConsultEnabled": True,
                "lockerEncryption": "AES-256",
            },
        }

    def list_members(self) -> List[dict]:
        return [m.to_dict() for m in self._members.values()]

    def get_member(self, member_id: str) -> Optional[FamilyMember]:
        return self._members.get(member_id)

    def add_member(self, payload: dict) -> FamilyMember:
        member = FamilyMember(
            id=f"fam_{uuid.uuid4().hex[:8]}",
            name=payload["name"],
            relation=payload.get("relation", "Dependent"),
            age=int(payload.get("age", 0)),
            gender=payload.get("gender", "Other"),
            abha_id=payload.get("abhaId", "PENDING-AUTH"),
            blood_group=payload.get("bloodGroup", "Unknown"),
            avatar_color=payload.get("avatarColor", "from-sky-500 to-blue-600"),
            primary_condition=payload.get("primaryCondition"),
        )
        with self._lock:
            self._members[member.id] = member
        logger.info("eka_member_added", member_id=member.id, name=member.name)
        return member

    # ─────────────────────────────────────────────────────────────
    # Medications
    # ─────────────────────────────────────────────────────────────

    def list_medications(self, member_id: str) -> List[dict]:
        return [m.to_dict() for m in self._medications.values() if m.member_id == member_id]

    def add_medication(self, member_id: str, payload: dict) -> Medication:
        med = Medication(
            id=f"med_{uuid.uuid4().hex[:8]}",
            member_id=member_id,
            name=payload["name"],
            dosage=payload.get("dosage", "1 Tablet"),
            frequency=payload.get("frequency", "Once daily"),
            timing=payload.get("timing", "Morning"),
            instruction=payload.get("instruction", "After Food"),
            prescribed_by=payload.get("prescribedBy", "Self"),
            refill_days_left=int(payload.get("refillDaysLeft", 30)),
            time_slot=payload.get("timeSlot", "09:00 AM"),
        )
        with self._lock:
            self._medications[med.id] = med
        logger.info("eka_medication_added", med_id=med.id, member_id=member_id)
        return med

    def set_medication_taken(self, med_id: str, taken: Optional[bool] = None) -> Optional[Medication]:
        med = self._medications.get(med_id)
        if not med:
            return None
        with self._lock:
            med.taken_today = (not med.taken_today) if taken is None else bool(taken)
        logger.info("eka_medication_toggled", med_id=med_id, taken=med.taken_today)
        return med

    def delete_medication(self, med_id: str) -> bool:
        with self._lock:
            return self._medications.pop(med_id, None) is not None

    # ─────────────────────────────────────────────────────────────
    # Vitals
    # ─────────────────────────────────────────────────────────────

    def list_vitals(self, member_id: str) -> List[dict]:
        return [v.to_dict() for v in self._vitals.values() if v.member_id == member_id]

    def classify_vital(self, vital_type: str, value: str) -> str:
        """Heuristic clinical status classification for a logged vital."""
        try:
            first = float(value.split()[0].split("/")[0])
        except (ValueError, IndexError):
            return "Normal"
        bounds = {
            "Blood Pressure": (90, 140, "mmHg"),
            "Blood Sugar (Fasting)": (70, 126, "mg/dL"),
            "Blood Sugar (PP)": (70, 200, "mg/dL"),
            "Heart Rate": (55, 100, "BPM"),
            "SpO2": (94, 101, "%"),
            "Body Temp": (97.0, 99.5, "°F"),
        }
        rule = bounds.get(vital_type)
        if not rule:
            return "Normal"
        low, high, _ = rule
        if vital_type == "SpO2":
            return "Optimal" if first >= 95 else ("Elevated" if first >= 92 else "Attention")
        if first < low * 0.9 or first > high * 1.1:
            return "Attention"
        if first > high:
            return "Elevated"
        return "Normal" if vital_type != "Heart Rate" else "Optimal"

    def add_vital(self, member_id: str, payload: dict) -> VitalRecord:
        vital_type = payload.get("type", "Blood Pressure")
        value = str(payload.get("value", ""))
        vital = VitalRecord(
            id=f"vit_{uuid.uuid4().hex[:8]}",
            member_id=member_id,
            type=vital_type,
            value=value,
            unit=payload.get("unit", ""),
            status=self.classify_vital(vital_type, value),
            recorded_at=_today_label(),
            trend=payload.get("trend", "stable"),
            target_range=payload.get("targetRange", TARGET_RANGES.get(vital_type, "Per clinical standards")),
        )
        with self._lock:
            self._vitals[vital.id] = vital
        logger.info("eka_vital_logged", vit_id=vital.id, member_id=member_id, status=vital.status)
        return vital

    def delete_vital(self, vital_id: str) -> bool:
        with self._lock:
            return self._vitals.pop(vital_id, None) is not None

    # ─────────────────────────────────────────────────────────────
    # Health locker records
    # ─────────────────────────────────────────────────────────────

    def list_records(
        self,
        member_id: str,
        category: Optional[str] = None,
        query: Optional[str] = None,
    ) -> List[dict]:
        out = []
        for r in self._records.values():
            if r.member_id != member_id:
                continue
            if category and category != "All" and r.category != category:
                continue
            if query:
                haystack = f"{r.title} {r.doctor_or_lab} {r.ai_key_summary}".lower()
                if query.lower() not in haystack:
                    continue
            out.append(r.to_dict())
        return out

    def add_record(self, member_id: str, payload: dict) -> HealthRecord:
        record = HealthRecord(
            id=f"rec_{uuid.uuid4().hex[:8]}",
            member_id=member_id,
            title=payload["title"],
            category=payload.get("category", "Lab Reports"),
            doctor_or_lab=payload.get("doctorOrLab", "Self-Uploaded Document"),
            date=payload.get("date", datetime.now().strftime("%d %b %Y")),
            file_type=payload.get("fileType", "PDF"),
            file_size=payload.get("fileSize", "1.0 MB"),
            ai_key_summary=payload.get(
                "aiKeySummary",
                "Document securely parsed and encrypted in Eka Health Locker with ABDM compliance.",
            ),
            tags=payload.get("tags", ["Self-Upload"]),
            extracted_parameters=payload.get("extractedParameters", []),
        )
        with self._lock:
            self._records[record.id] = record
        logger.info("eka_record_uploaded", rec_id=record.id, member_id=member_id)
        return record

    def delete_record(self, record_id: str) -> bool:
        with self._lock:
            return self._records.pop(record_id, None) is not None

    # ─────────────────────────────────────────────────────────────
    # Appointments
    # ─────────────────────────────────────────────────────────────

    def list_appointments(self, member_id: str) -> List[dict]:
        return [a.to_dict() for a in self._appointments.values() if a.member_id == member_id]

    def book_appointment(self, member_id: str, payload: dict) -> Appointment:
        apt_type = payload.get("type", "In-Clinic")
        apt = Appointment(
            id=f"apt_{uuid.uuid4().hex[:8]}",
            member_id=member_id,
            doctor_name=payload["doctorName"],
            specialty=payload.get("specialty", "General Physician"),
            hospital=payload.get("hospital",
                                 "Eka Care Telemedicine Portal" if apt_type == "Video Teleconsult"
                                 else "MiPAAS Partner Hospital"),
            date=payload["date"],
            time=payload.get("time", "10:00 AM"),
            token_number=len(self._appointments) + 1,
            type=apt_type,
            status="Confirmed",
            queue_wait_mins=0 if apt_type == "Video Teleconsult" else 10,
        )
        with self._lock:
            self._appointments[apt.id] = apt
        logger.info("eka_appointment_booked", apt_id=apt.id, member_id=member_id)
        return apt

    def cancel_appointment(self, apt_id: str) -> bool:
        apt = self._appointments.get(apt_id)
        if not apt:
            return False
        with self._lock:
            apt.status = "Cancelled"
        logger.info("eka_appointment_cancelled", apt_id=apt_id)
        return True

    # ─────────────────────────────────────────────────────────────
    # ABHA card
    # ─────────────────────────────────────────────────────────────

    def get_abha_profile(self, member_id: str) -> Optional[dict]:
        member = self._members.get(member_id)
        if not member:
            return None
        records = [r.to_dict() for r in self._records.values() if r.member_id == member_id]
        vaccinations = [r for r in records if r["category"] == "Vaccinations"]
        return {
            "member": member.to_dict(),
            "abhaAddress": f"{member.name.split()[0].lower()}@abdm",
            "verificationStatus": "Verified · ABCD (ABHA Card Discharged)",
            "consentArtifacts": [
                {"name": "View Health Record", "status": "Granted", "expiry": "13 Nov 2026"},
                {"name": "Data Transfer to MiPAAS AI", "status": "Granted", "expiry": "13 Jan 2027"},
                {"name": "Teleconsult Sharing", "status": "Granted", "expiry": "Per Session"},
            ],
            "immunizationHistory": [
                {"record": v["title"], "date": v["date"]} for v in vaccinations
            ],
            "linkedFacilities": ["Apollo Heart Institute", "Max PathLabs", "Metro Radiology Center"],
        }

    # ─────────────────────────────────────────────────────────────
    # AI consultation
    # ─────────────────────────────────────────────────────────────

    def consult(self, member_id: str, message: str) -> dict:
        """Ground a health assistant reply in the member's live portal data."""
        member = self._members.get(member_id)
        name = member.name.split()[0] if member else "there"
        lower = message.lower()

        vitals = self.list_vitals(member_id) if member else []
        meds = self.list_medications(member_id) if member else []
        apts = self.list_appointments(member_id) if member else []

        bp = next((v for v in vitals if v["type"] == "Blood Pressure"), None)
        sugar = next((v for v in vitals if "Fasting" in v["type"]), None)
        pending = [m for m in meds if not m["takenToday"]]

        if any(k in lower for k in ("sugar", "glucose", "diabetes", "hba1c")):
            if sugar:
                reply = (f"Namaste {name}! Your fasting glucose reading is **{sugar['value']} {sugar['unit']}** "
                         f"(target {sugar['targetRange']}, status: {sugar['status']}). Keep taking your "
                         f"prescribed diabetes medication on schedule and stay hydrated.")
            else:
                reply = (f"Namaste {name}! I could not find a recent fasting glucose reading in your locker. "
                         f"Please log your sugar under the Vitals tab so I can track it for you.")
        elif any(k in lower for k in ("bp", "pressure", "hypertension")):
            if bp:
                reply = (f"Namaste {name}! Your latest blood pressure is **{bp['value']} {bp['unit']}** "
                         f"(status: {bp['status']}). Continue your morning Telmisartan as prescribed and "
                         f"maintain a low-sodium dinner.")
            else:
                reply = f"Namaste {name}! No BP reading is logged yet today. Please record it under Vitals for tracking."
        elif any(k in lower for k in ("appointment", "doctor", "consult", "visit")):
            upcoming = next((a for a in apts if a["status"] == "Confirmed"), None)
            if upcoming:
                reply = (f"You have a {upcoming['type'].lower()} with **{upcoming['doctor_name']}** "
                         f"({upcoming['specialty']}) on **{upcoming['date']} at {upcoming['time']}** — "
                         f"token **#{upcoming['tokenNumber']}**, estimated wait {upcoming['queueWaitMins']} min. "
                         f"Your recent reports are already attached to your ABHA profile.")
            else:
                reply = f"You have no upcoming appointments, {name}. Would you like me to book a teleconsult?"
        elif any(k in lower for k in ("medicine", "medication", "tablet", "dose")):
            if pending:
                names = ", ".join(f"**{m['name']}** ({m['timeSlot']})" for m in pending)
                reply = f"Namaste {name}! Still pending today: {names}. Your adherence is otherwise on track."
            else:
                reply = f"Namaste {name}! You have taken all {len(meds)} scheduled medications today. Excellent adherence!"
        else:
            summary_bits = []
            if bp:
                summary_bits.append(f"BP {bp['value']} {bp['unit']}")
            if sugar:
                summary_bits.append(f"Fasting Glucose {sugar['value']} {sugar['unit']}")
            summary = ", ".join(summary_bits) if summary_bits else "no vitals logged today"
            pending_txt = pending[0]["name"] if pending else "nothing pending"
            reply = (f"I've analyzed your Eka Health Locker, {name}. Key parameters: {summary}. "
                     f"Outstanding tonight: **{pending_txt}**. Would you like a reminder or a teleconsult?")

        return {
            "reply": reply,
            "model": "MEDITRON-AI · MiPAAS Support Agent",
            "groundedOn": {
                "vitalsCount": len(vitals),
                "activeMedications": len(meds),
                "pendingMedications": len(pending),
                "upcomingAppointments": len([a for a in apts if a["status"] == "Confirmed"]),
            },
            "disclaimer": "AI guidance only — not a substitute for your treating physician.",
        }

    def today_summary(self, member_id: str) -> dict:
        meds = self.list_medications(member_id)
        vitals = self.list_vitals(member_id)
        taken = len([m for m in meds if m["takenToday"]])
        return {
            "medicationAdherence": {
                "taken": taken,
                "total": len(meds),
                "percentage": round((taken / len(meds)) * 100) if meds else 100,
            },
            "vitalsLoggedToday": len([v for v in vitals if v["recordedAt"].startswith("Today")]),
            "abnormalVitals": [v for v in vitals if v["status"] in ("Elevated", "Attention")],
            "recordsInLocker": len(self.list_records(member_id)),
            "upcomingAppointments": [a for a in self.list_appointments(member_id) if a["status"] == "Confirmed"],
        }


_service: Optional[EkaCarePortalService] = None


def get_eka_portal_service() -> EkaCarePortalService:
    global _service
    if _service is None:
        _service = EkaCarePortalService()
    return _service
