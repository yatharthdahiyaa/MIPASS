import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mipaas_central.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Check or update pat-01
pat01 = c.execute("SELECT id FROM clinical_patients WHERE id = 'pat-01'").fetchone()
if not pat01:
    c.execute("""
    INSERT INTO clinical_patients (
        id, mrn, fname, lname, dob, gender, blood_group, phone, email,
        allergies_json, conditions_json, created_at, updated_at
    ) VALUES (
        'pat-01', 'MRN-100999', 'Yatharth', 'Dahiya', '1998-04-12', 'Male', 'O+',
        '+1 (555) 782-9901', 'yatharth@mipaas.health',
        '["Penicillin G", "Sulfonamides"]',
        '["Right Basilar Pleural Effusion (97.4% TorchXRayVision DenseNet-121)"]',
        datetime('now'), datetime('now')
    )
    """)
    print("[+] Inserted patient pat-01 (Yatharth Dahiya)")
else:
    c.execute("""
    UPDATE clinical_patients SET
        fname = 'Yatharth',
        lname = 'Dahiya',
        mrn = 'MRN-100999',
        email = 'yatharth@mipaas.health',
        conditions_json = '["Right Basilar Pleural Effusion (97.4% TorchXRayVision DenseNet-121)"]'
    WHERE id = 'pat-01'
    """)
    print("[+] Updated patient pat-01 (Yatharth Dahiya)")

# Provider rad-01
prov = c.execute("SELECT id FROM clinical_providers WHERE id = 'rad-01'").fetchone()
if not prov:
    c.execute("""
    INSERT INTO clinical_providers (
        id, user_id, username, fname, lname, title, specialty,
        npi, email, phone, facility_name, is_active, created_at, updated_at
    ) VALUES (
        'rad-01', 'usr-rad-01', 'radiologist', 'Sarah', 'Mitchell', 'MD, FACR', 'Thoracic Radiology',
        '1992837465', 'radiologist@mipaas.health', '+1 (555) 345-6789', 'Mount Sinai Health System',
        1, datetime('now'), datetime('now')
    )
    """)
    print("[+] Seeded provider rad-01")

# Vitals for pat-01
c.execute("DELETE FROM vital_records WHERE member_id = 'pat-01'")
c.execute("""
INSERT INTO vital_records (id, member_id, vital_type, value, unit, status, recorded_at, trend, created_at, updated_at)
VALUES 
('vit-bp-01', 'pat-01', 'Blood Pressure', '120/80', 'mmHg', 'Optimal', 'Today 09:30 AM', 'stable', datetime('now'), datetime('now')),
('vit-hr-01', 'pat-01', 'Heart Rate', '74', 'bpm', 'Normal', 'Today 09:30 AM', 'stable', datetime('now'), datetime('now')),
('vit-sp-01', 'pat-01', 'SpO2', '98', '%', 'Optimal', 'Today 09:30 AM', 'stable', datetime('now'), datetime('now')),
('vit-bmi-01', 'pat-01', 'BMI', '22.8', 'kg/m²', 'Normal', 'Today 09:30 AM', 'stable', datetime('now'), datetime('now'))
""")
print("[+] Inserted vitals for pat-01")

# Order for pat-01
ord_row = c.execute("SELECT id FROM procedure_orders WHERE id = 'ord-cxr-2026-001'").fetchone()
if not ord_row:
    c.execute("""
    INSERT INTO procedure_orders (
        id, order_number, patient_id, procedure_code, procedure_name, modality,
        priority, status, order_date, created_at, updated_at
    ) VALUES (
        'ord-cxr-2026-001', 'ORD-CXR-2026-001', 'pat-01', '71045', 'Chest Radiograph AI Screening', 'CXR',
        'urgent', 'completed', datetime('now'), datetime('now'), datetime('now')
    )
    """)
    print("[+] Inserted procedure_order ord-cxr-2026-001")

# Report for pat-01
rpts = c.execute("SELECT id FROM procedure_reports WHERE patient_id = 'pat-01'").fetchall()
if not rpts:
    c.execute("""
    INSERT INTO procedure_reports (
        id, order_id, report_number, patient_id, radiologist_id, status, findings, impression, recommendations,
        critical_findings_alert, signed_by, signed_at, created_at, updated_at,
        service_id, service_name, confidence, risk_level, modality, summary
    ) VALUES (
        'rep-pat-init-01', 'ord-cxr-2026-001', 'REP-CXR-2026-001', 'pat-01', 'rad-01', 'Final',
        'Right Basilar Pleural Effusion',
        'Immediate clinical correlation for acute right basilar pleural effusion. Diagnostic thoracentesis advised.',
        'Pulmonology consultation within 24 hours. Consider diagnostic thoracentesis.',
        1, 'TorchXRayVision DenseNet-121 (Certified)', datetime('now'), datetime('now'), datetime('now'),
        'qxr', 'TorchXRayVision Deep DenseNet-121', 0.974, 'High', 'CXR',
        'Automated 18-pathology deep screening on chest radiograph. High-probability blunting of right costophrenic angle.'
    )
    """)
    print("[+] Inserted initial diagnostic report for pat-01")

conn.commit()
conn.close()
print("[+] Database seeding complete.")
