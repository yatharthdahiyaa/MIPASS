"""
Tests for the Eka.care PHR Portal endpoints (/api/v1/eka/*).
"""

AUTH = {"X-User-ID": "eka-patient-01", "X-User-Role": "technician"}
BASE = "/api/v1/eka"


class TestEkaPortalAuth:
    def test_session_requires_authentication(self, client):
        res = client.get(f"{BASE}/session")
        assert res.status_code == 401
        assert res.get_json()["success"] is False

    def test_session_returns_entitlements(self, client):
        res = client.get(f"{BASE}/session", headers=AUTH)
        assert res.status_code == 200
        session = res.get_json()["data"]["session"]
        assert session["userId"] == "eka-patient-01"
        assert session["linkedMembers"] >= 4
        assert session["consent"]["lockerEncryption"] == "AES-256"


class TestEkaFamily:
    def test_list_family(self, client):
        res = client.get(f"{BASE}/family", headers=AUTH)
        assert res.status_code == 200
        members = res.get_json()["data"]["members"]
        assert any(m["abhaId"] for m in members)

    def test_add_family_member(self, client):
        res = client.post(
            f"{BASE}/family",
            headers=AUTH,
            json={"name": "Test Kid", "relation": "Son", "age": 5, "bloodGroup": "B+"},
        )
        assert res.status_code == 201
        assert res.get_json()["data"]["member"]["name"] == "Test Kid"

    def test_add_family_member_requires_name(self, client):
        res = client.post(f"{BASE}/family", headers=AUTH, json={"relation": "Son"})
        assert res.status_code == 400

    def test_unknown_member_404(self, client):
        res = client.get(f"{BASE}/members/fam_nope/vitals", headers=AUTH)
        assert res.status_code == 404


class TestEkaMedications:
    def test_list_medications(self, client):
        res = client.get(f"{BASE}/members/fam_1/medications", headers=AUTH)
        meds = res.get_json()["data"]["medications"]
        assert len(meds) >= 4
        assert all(m["memberId"] == "fam_1" for m in meds)

    def test_add_and_toggle_medication(self, client):
        res = client.post(
            f"{BASE}/members/fam_2/medications",
            headers=AUTH,
            json={"name": "Thyroxine 50mcg", "timing": "Morning", "instruction": "Before Food"},
        )
        assert res.status_code == 201
        med = res.get_json()["data"]["medication"]
        assert med["takenToday"] is False

        toggle = client.post(f"{BASE}/medications/{med['id']}/taken", headers=AUTH, json={"taken": True})
        assert toggle.get_json()["data"]["medication"]["takenToday"] is True

        delete = client.delete(f"{BASE}/medications/{med['id']}", headers=AUTH)
        assert delete.get_json()["data"]["deleted"] == med["id"]

    def test_toggle_unknown_medication_404(self, client):
        res = client.post(f"{BASE}/medications/med_ghost/taken", headers=AUTH, json={})
        assert res.status_code == 404


class TestEkaVitals:
    def test_log_vital_classifies_status(self, client):
        res = client.post(
            f"{BASE}/members/fam_3/vitals",
            headers=AUTH,
            json={"type": "Blood Sugar (Fasting)", "value": "180", "unit": "mg/dL"},
        )
        assert res.status_code == 201
        vital = res.get_json()["data"]["vital"]
        assert vital["status"] in ("Elevated", "Attention")

        listing = client.get(f"{BASE}/members/fam_3/vitals", headers=AUTH)
        assert any(v["id"] == vital["id"] for v in listing.get_json()["data"]["vitals"])

        delete = client.delete(f"{BASE}/vitals/{vital['id']}", headers=AUTH)
        assert delete.status_code == 200

    def test_log_vital_requires_value(self, client):
        res = client.post(f"{BASE}/members/fam_1/vitals", headers=AUTH, json={"type": "SpO2"})
        assert res.status_code == 400


class TestEkaRecords:
    def test_locker_filter_and_search(self, client):
        res = client.get(f"{BASE}/members/fam_1/records?category=Lab Reports", headers=AUTH)
        records = res.get_json()["data"]["records"]
        assert records and all(r["category"] == "Lab Reports" for r in records)

        search = client.get(f"{BASE}/members/fam_1/records?q=lipid", headers=AUTH)
        assert search.get_json()["data"]["count"] >= 1

    def test_upload_and_delete_record(self, client):
        res = client.post(
            f"{BASE}/members/fam_1/records",
            headers=AUTH,
            json={"title": "Annual Eye Exam", "category": "Prescriptions", "doctorOrLab": "Dr. Rao"},
        )
        assert res.status_code == 201
        rec_id = res.get_json()["data"]["record"]["id"]
        delete = client.delete(f"{BASE}/records/{rec_id}", headers=AUTH)
        assert delete.status_code == 200


class TestEkaAppointments:
    def test_book_and_cancel(self, client):
        res = client.post(
            f"{BASE}/members/fam_1/appointments",
            headers=AUTH,
            json={"doctorName": "Dr. Meera Nambiar", "date": "Tue, 20 Oct 2026",
                  "time": "11:00 AM", "type": "Video Teleconsult"},
        )
        assert res.status_code == 201
        apt = res.get_json()["data"]["appointment"]
        assert apt["status"] == "Confirmed"

        cancel = client.post(f"{BASE}/appointments/{apt['id']}/cancel", headers=AUTH)
        assert cancel.status_code == 200

        listing = client.get(f"{BASE}/members/fam_1/appointments", headers=AUTH)
        statuses = {a["id"]: a["status"] for a in listing.get_json()["data"]["appointments"]}
        assert statuses[apt["id"]] == "Cancelled"

    def test_booking_requires_doctor_and_date(self, client):
        res = client.post(f"{BASE}/members/fam_1/appointments", headers=AUTH, json={"time": "9 AM"})
        assert res.status_code == 400


class TestEkaConsult:
    def test_consult_grounded_in_member_data(self, client):
        res = client.post(
            f"{BASE}/members/fam_1/consult",
            headers=AUTH,
            json={"message": "How is my sugar control?"},
        )
        assert res.status_code == 200
        consult = res.get_json()["data"]["consult"]
        assert "104" in consult["reply"]
        assert consult["groundedOn"]["activeMedications"] >= 4
        assert "not a substitute" in consult["disclaimer"]

    def test_consult_requires_message(self, client):
        res = client.post(f"{BASE}/members/fam_1/consult", headers=AUTH, json={"message": "  "})
        assert res.status_code == 400


class TestEkaSummaryAndAbha:
    def test_today_summary(self, client):
        res = client.get(f"{BASE}/members/fam_1/summary", headers=AUTH)
        summary = res.get_json()["data"]["summary"]
        assert 0 <= summary["medicationAdherence"]["percentage"] <= 100
        assert summary["recordsInLocker"] >= 5

    def test_abha_profile(self, client):
        res = client.get(f"{BASE}/members/fam_1/abha", headers=AUTH)
        abha = res.get_json()["data"]["abha"]
        assert abha["abhaAddress"].endswith("@abdm")
        assert abha["consentArtifacts"]

    def test_meta_enums(self, client):
        res = client.get(f"{BASE}/meta", headers=AUTH)
        data = res.get_json()["data"]
        assert "Blood Pressure" in data["vitalTypes"]
        assert "Vaccinations" in data["recordCategories"]
