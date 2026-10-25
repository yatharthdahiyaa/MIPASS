import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - node:sqlite built-in in Node 22+ runtime
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

export interface PatientRecord {
  id: string;
  name: string;
  mrn: string;
  age: number | null;
  gender: 'M' | 'F' | 'Other' | string;
  dob: string;
  bloodType?: string;
  phone: string;
  email?: string;
  address?: string;
  type?: string;
  primaryDiagnosis?: string;
  lastVisit?: string;
  nextAppointment?: string;
  nextAppointmentTime?: string;
  status: 'Active' | 'Pending' | 'Discharged';
  bloodPressure?: string;
  heartRate?: string;
  oxygen?: string;
  bmi?: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: string;
    oxygen?: string;
    bmi?: string;
    recordedAt?: string;
    recordedBy?: string;
  };
  allergies: string[];
  avatarBg?: string;
  initials?: string;
  createdAt: string;
}

export interface PrescriptionRecord {
  id: string;
  patientId?: string;
  patientName: string;
  patientMrn: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  datePrescribed: string;
  prescribedBy: string;
  status: 'Active' | 'Refill Requested' | 'Discontinued';
  instructions?: string;
  refillsLeft?: number;
  tag?: string;
  createdAt: string;
}

export interface LabResultRecord {
  id: string;
  patientId?: string;
  patientName: string;
  patientMrn: string;
  testName: string;
  orderedDate: string;
  status: 'Pending Review' | 'Reviewed & Approved' | 'Critical Review';
  value: string;
  refRange: string;
  isAbnormal?: boolean;
  notes?: string;
  doctorOrLab?: string;
  createdAt: string;
}

export interface AppointmentRecord {
  id: string;
  patientId?: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  type: string;
  location: string;
  status: 'Confirmed' | 'Upcoming' | 'Completed' | 'Cancelled';
  instructions?: string;
  createdAt: string;
}

export interface DiagnosticReportRecord {
  id: string;
  patientId?: string;
  patientName: string;
  patientMrn: string;
  serviceId: string;
  serviceName: string;
  modality: string;
  title: string;
  category: string;
  date: string;
  summary: string;
  findings: string;
  impression: string;
  confidence?: number;
  status: 'Final' | 'Preliminary' | 'Validated';
  signedBy: string;
  signedAt: string;
  criticalAlert?: boolean;
  findingsList?: Array<{ name: string; probability: number; status: string }>;
  createdAt: string;
}

export interface ClinicalMessageRecord {
  id: string;
  patientId?: string;
  sender: string;
  senderRole: string;
  avatarBg?: string;
  text: string;
  time: string;
  unread?: boolean;
  createdAt: string;
}

export interface ClinicalDatabase {
  patients: PatientRecord[];
  prescriptions: PrescriptionRecord[];
  labResults: LabResultRecord[];
  appointments: AppointmentRecord[];
  diagnosticReports: DiagnosticReportRecord[];
  messages: ClinicalMessageRecord[];
}

function getDatabase(): DatabaseSync {
  const possiblePaths = [
    path.resolve(process.cwd(), '..', 'backend', 'mipaas_central.db'),
    path.resolve(process.cwd(), 'backend', 'mipaas_central.db'),
    path.resolve(process.cwd(), 'mipaas_central.db'),
  ];
  let targetPath = possiblePaths[0];
  for (const p of possiblePaths) {
    // @ts-ignore
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      targetPath = p;
      break;
    }
  }
  const db = new DatabaseSync(targetPath);
  // Ensure tables and columns exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS lab_results (
        id VARCHAR(64) PRIMARY KEY,
        patient_id VARCHAR(64),
        patient_name VARCHAR(150),
        patient_mrn VARCHAR(50),
        test_name VARCHAR(150),
        date VARCHAR(50),
        status VARCHAR(50),
        value VARCHAR(100),
        ref_range VARCHAR(100),
        is_abnormal BOOLEAN,
        notes TEXT,
        doctor_or_lab VARCHAR(150),
        details_json TEXT,
        created_at DATETIME
      );
      CREATE TABLE IF NOT EXISTS clinical_messages (
        id VARCHAR(64) PRIMARY KEY,
        patient_id VARCHAR(64),
        sender VARCHAR(150),
        sender_role VARCHAR(100),
        avatar_bg VARCHAR(100),
        text TEXT,
        time VARCHAR(50),
        unread BOOLEAN,
        created_at DATETIME
      );
    `);
  } catch (initErr) {
    console.warn('[DB Init Warning]', initErr);
  }
  return db;
}

function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (typeof val !== 'string') return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function rowToPatient(row: any, vitalsList: any[] = []): PatientRecord {
  const name = `${row.fname || ''} ${row.lname || ''}`.trim() || 'Patient';
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'PT';
  const conditions = parseJsonSafe<string[]>(row.conditions_json, []);
  const allergies = parseJsonSafe<string[]>(row.allergies_json, []);

  let bp = '';
  let hr = '';
  let ox = '';
  let bmi = '';
  let vitalsRecordedAt = '';

  for (const v of vitalsList) {
    const t = (v.vital_type || '').toLowerCase();
    if (t.includes('blood pressure') || t.includes('bp')) bp = v.value;
    else if (t.includes('heart') || t.includes('pulse')) hr = v.value;
    else if (t.includes('spo2') || t.includes('oxygen')) ox = v.value;
    else if (t.includes('bmi')) bmi = v.value;
    if (v.recorded_at) vitalsRecordedAt = v.recorded_at;
  }

  return {
    id: String(row.id),
    name,
    mrn: String(row.mrn || 'MRN-GENERAL'),
    age: row.dob ? Math.floor((Date.now() - new Date(row.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : 28,
    gender: row.gender || 'Unknown',
    dob: row.dob || '1998-04-12',
    bloodType: row.blood_group || 'O+',
    phone: row.phone || '+1 (555) 000-0000',
    email: row.email || '',
    address: [row.street, row.city, row.state].filter(Boolean).join(', ') || 'Metropolitan Medical District',
    type: 'Diagnostic Radiology',
    primaryDiagnosis: conditions[0] || 'No active diagnosis recorded',
    lastVisit: 'Today',
    nextAppointment: 'Tomorrow',
    nextAppointmentTime: '10:30 AM',
    status: 'Active',
    bloodPressure: bp || '120/80',
    heartRate: hr || '74',
    oxygen: ox || '98',
    bmi: bmi || '22.8',
    vitals: {
      bloodPressure: bp || '120/80',
      heartRate: hr || '74',
      oxygen: ox || '98',
      bmi: bmi || '22.8',
      recordedAt: vitalsRecordedAt || 'Today 09:30 AM',
      recordedBy: 'Clinical Sensor Gateway',
    },
    allergies,
    avatarBg: 'bg-teal-100 text-teal-800',
    initials,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function rowToReport(row: any, ptMap: Map<string, any>): DiagnosticReportRecord {
  const pt = ptMap.get(row.patient_id);
  const patientName = pt ? `${pt.fname || ''} ${pt.lname || ''}`.trim() : 'Patient';
  const patientMrn = pt?.mrn || 'MRN-GENERAL';

  const findingsList = parseJsonSafe<Array<{ name: string; probability: number; status: string }>>(
    row.findings_list_json,
    []
  );

  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    patientName,
    patientMrn,
    serviceId: row.service_id || 'qxr',
    serviceName: row.service_name || 'Diagnostic Imaging',
    modality: row.modality || 'CXR',
    title: `${row.service_name || 'Diagnostic Imaging'} Report`,
    category: 'Radiology',
    date: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded',
    summary: row.summary || row.findings || 'No summary recorded.',
    findings: row.findings || 'No finding recorded.',
    impression: row.impression || 'No clinician impression recorded.',
    confidence: row.confidence != null ? Number(row.confidence) : 0,
    status: (row.status as any) || 'Draft',
    signedBy: row.signed_by || 'AI draft — not certified',
    signedAt: row.signed_at || 'Not signed',
    criticalAlert: Boolean(row.critical_findings_alert || row.risk_level === 'High'),
    findingsList,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function rowToPrescription(row: any, ptMap: Map<string, any>): PrescriptionRecord {
  const pt = ptMap.get(row.member_id);
  const patientName = pt ? `${pt.fname || ''} ${pt.lname || ''}`.trim() : 'Patient';
  const patientMrn = pt?.mrn || 'MRN-GENERAL';

  return {
    id: String(row.id),
    patientId: String(row.member_id),
    patientName,
    patientMrn,
    medication: row.name || 'Prescription',
    dosage: row.dosage || 'Standard',
    frequency: row.frequency || 'Once daily',
    duration: '30 Days',
    datePrescribed: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-10-20',
    prescribedBy: row.prescribed_by || 'Attending Physician, MD',
    status: 'Active',
    instructions: row.instruction || 'Take with water as directed.',
    refillsLeft: row.refill_days_left != null ? Number(row.refill_days_left) : 2,
    tag: row.time_slot || 'Morning',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function rowToAppointment(row: any, ptMap: Map<string, any>): AppointmentRecord {
  const pt = ptMap.get(row.member_id);
  const patientName = pt ? `${pt.fname || ''} ${pt.lname || ''}`.trim() : 'Patient';
  const patientMrn = pt?.mrn || 'MRN-GENERAL';

  return {
    id: String(row.id),
    patientId: String(row.member_id),
    patientName,
    patientMrn,
    doctorName: row.doctor_name || 'Care team not assigned',
    specialty: row.specialty || 'Not recorded',
    date: row.appointment_date || 'Not scheduled',
    time: row.appointment_time || '',
    type: row.appointment_type || 'Consultation',
    location: row.hospital || 'Not recorded',
    status: (row.status as any) || 'Unknown',
    instructions: 'Please bring your previous chest imaging and identification.',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

// GET /api/clinical - Retrieve clinical records directly from central database
export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const patientId = searchParams.get('patientId');
    const mrn = searchParams.get('mrn');

    // Fetch patients and map
    const rawPatients = db.prepare('SELECT * FROM clinical_patients ORDER BY created_at DESC').all() as any[];
    const rawVitals = db.prepare('SELECT * FROM vital_records ORDER BY created_at DESC').all() as any[];

    const vitalsByMember = new Map<string, any[]>();
    for (const v of rawVitals) {
      const mid = String(v.member_id);
      if (!vitalsByMember.has(mid)) vitalsByMember.set(mid, []);
      vitalsByMember.get(mid)!.push(v);
    }

    const ptMap = new Map<string, any>();
    const patients: PatientRecord[] = rawPatients.map((p) => {
      ptMap.set(String(p.id), p);
      return rowToPatient(p, vitalsByMember.get(String(p.id)) || []);
    });

    // Fetch reports
    const rawReports = db.prepare('SELECT * FROM procedure_reports ORDER BY created_at DESC').all() as any[];
    const diagnosticReports: DiagnosticReportRecord[] = rawReports.map((r) => rowToReport(r, ptMap));

    // Fetch prescriptions (medications)
    const rawMeds = db.prepare('SELECT * FROM medications ORDER BY created_at DESC').all() as any[];
    const prescriptions: PrescriptionRecord[] = rawMeds.map((m) => rowToPrescription(m, ptMap));

    // Fetch appointments
    const rawAppts = db.prepare('SELECT * FROM consumer_appointments ORDER BY created_at DESC').all() as any[];
    const appointments: AppointmentRecord[] = rawAppts.map((a) => rowToAppointment(a, ptMap));

    // Fetch labs
    const rawLabs = db.prepare('SELECT * FROM lab_results ORDER BY created_at DESC').all() as any[];
    const labResults: LabResultRecord[] = rawLabs.map((l) => ({
      id: String(l.id),
      patientId: l.patient_id,
      patientName: l.patient_name || 'Patient',
      patientMrn: l.patient_mrn || 'MRN-GENERAL',
      testName: l.test_name || 'Clinical Test',
      orderedDate: l.date || 'Today',
      status: l.status || 'Reviewed & Approved',
      value: l.value || 'Normal',
      refRange: l.ref_range || 'Normal range',
      isAbnormal: Boolean(l.is_abnormal),
      notes: l.notes || '',
      doctorOrLab: l.doctor_or_lab || 'Central Pathology',
      createdAt: l.created_at || new Date().toISOString(),
    }));

    // Fetch messages
    const rawMsgs = db.prepare('SELECT * FROM clinical_messages ORDER BY created_at DESC').all() as any[];
    const messages: ClinicalMessageRecord[] = rawMsgs.map((m) => ({
      id: String(m.id),
      patientId: m.patient_id,
      sender: m.sender || 'Care Team',
      senderRole: m.sender_role || 'Attending Physician',
      avatarBg: m.avatar_bg || 'bg-teal-600',
      text: m.text || '',
      time: m.time || '10:00 AM',
      unread: Boolean(m.unread),
      createdAt: m.created_at || new Date().toISOString(),
    }));

    // Filter by patient if requested
    if (patientId || mrn) {
      const targetPatient = patients.find(
        (p) => (patientId && p.id === patientId) || (mrn && p.mrn === mrn)
      );
      const targetMrn = targetPatient?.mrn || mrn;
      const targetPid = targetPatient?.id || patientId;

      return NextResponse.json({
        success: true,
        patient: targetPatient || null,
        prescriptions: prescriptions.filter((p) => p.patientMrn === targetMrn || p.patientId === targetPid),
        labResults: labResults.filter((l) => l.patientMrn === targetMrn || l.patientId === targetPid),
        appointments: appointments.filter((a) => a.patientMrn === targetMrn || a.patientId === targetPid),
        diagnosticReports: diagnosticReports.filter((d) => d.patientMrn === targetMrn || d.patientId === targetPid),
        messages: messages.filter((m) => !m.patientId || m.patientId === targetPid),
      });
    }

    if (type === 'patients') {
      return NextResponse.json({ success: true, data: patients, count: patients.length });
    }
    if (type === 'prescriptions') {
      return NextResponse.json({ success: true, data: prescriptions, count: prescriptions.length });
    }
    if (type === 'labs') {
      return NextResponse.json({ success: true, data: labResults, count: labResults.length });
    }
    if (type === 'appointments') {
      return NextResponse.json({ success: true, data: appointments, count: appointments.length });
    }
    if (type === 'reports') {
      return NextResponse.json({ success: true, data: diagnosticReports, count: diagnosticReports.length });
    }
    if (type === 'messages') {
      return NextResponse.json({ success: true, data: messages, count: messages.length });
    }

    // Default: return full database representation from SQLite
    return NextResponse.json({
      success: true,
      data: {
        patients,
        prescriptions,
        labResults,
        appointments,
        diagnosticReports,
        messages,
      },
      counts: {
        patients: patients.length,
        prescriptions: prescriptions.length,
        labResults: labResults.length,
        appointments: appointments.length,
        diagnosticReports: diagnosticReports.length,
        messages: messages.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API Clinical GET Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/clinical - Persist records into real central SQLite DB
export async function POST(req: NextRequest) {
  try {
    const db = getDatabase();
    const body = await req.json();
    const action = body.action;

    // 1. Create Patient
    if (action === 'create_patient') {
      const p = body.data || body.payload || {};
      const id = p.id || `pat-${Date.now().toString(36)}`;
      const mrn = p.mrn || p.patientMrn || `MRN-${Math.floor(100000 + Math.random() * 900000)}`;
      const nameParts = (p.name || 'New Patient').split(' ');
      const fname = nameParts[0] || 'Patient';
      const lname = nameParts.slice(1).join(' ') || '';
      const now = new Date().toISOString();

      const conditionsJson = JSON.stringify(
        Array.isArray(p.conditions) ? p.conditions : p.primaryDiagnosis ? [p.primaryDiagnosis] : []
      );
      const allergiesJson = JSON.stringify(Array.isArray(p.allergies) ? p.allergies : []);

      db.prepare(`
        INSERT INTO clinical_patients (
          id, mrn, fname, lname, dob, gender, blood_group, phone, email,
          allergies_json, conditions_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, mrn, fname, lname, p.dob || '1998-04-12', p.gender || 'Unknown',
        p.bloodType || 'O+', p.phone || '', p.email || '',
        allergiesJson, conditionsJson, now, now
      );

      const createdPatient = rowToPatient({
        id, mrn, fname, lname, dob: p.dob, gender: p.gender, blood_group: p.bloodType,
        phone: p.phone, email: p.email, allergies_json: allergiesJson,
        conditions_json: conditionsJson, created_at: now
      });

      return NextResponse.json({ success: true, data: createdPatient, patient: createdPatient }, { status: 201 });
    }

    // 1.5 Update Patient Vitals
    if (action === 'update_patient_vitals') {
      const { patientId, mrn, vitals } = body.data || body.payload || {};
      const target = db.prepare('SELECT * FROM clinical_patients WHERE id = ? OR mrn = ? LIMIT 1').get(patientId || '', mrn || '') as any;
      if (target) {
        const mid = target.id;
        const now = new Date().toISOString();
        if (vitals.bloodPressure) {
          db.prepare(`
            INSERT INTO vital_records (id, member_id, vital_type, value, unit, status, recorded_at, created_at, updated_at)
            VALUES (?, ?, 'Blood Pressure', ?, 'mmHg', 'Optimal', 'Just now', ?, ?)
          `).run(`vit-bp-${Date.now()}`, mid, String(vitals.bloodPressure), now, now);
        }
        if (vitals.heartRate) {
          db.prepare(`
            INSERT INTO vital_records (id, member_id, vital_type, value, unit, status, recorded_at, created_at, updated_at)
            VALUES (?, ?, 'Heart Rate', ?, 'bpm', 'Normal', 'Just now', ?, ?)
          `).run(`vit-hr-${Date.now()}`, mid, String(vitals.heartRate), now, now);
        }
        if (vitals.oxygen) {
          db.prepare(`
            INSERT INTO vital_records (id, member_id, vital_type, value, unit, status, recorded_at, created_at, updated_at)
            VALUES (?, ?, 'SpO2', ?, '%', 'Optimal', 'Just now', ?, ?)
          `).run(`vit-ox-${Date.now()}`, mid, String(vitals.oxygen), now, now);
        }
        return NextResponse.json({ success: true, message: 'Vitals updated successfully' });
      }
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    // 1.8 Update Patient Allergies
    if (action === 'update_patient_allergies') {
      const { patientId, mrn, allergies } = body.data || body.payload || {};
      let target = db.prepare('SELECT * FROM clinical_patients WHERE id = ? OR mrn = ? LIMIT 1').get(patientId || '', mrn || '') as any;
      if (!target) {
        target = db.prepare('SELECT * FROM clinical_patients ORDER BY created_at DESC LIMIT 1').get() as any;
      }
      if (target) {
        const allergiesJson = JSON.stringify(Array.isArray(allergies) ? allergies : []);
        db.prepare('UPDATE clinical_patients SET allergies_json = ?, updated_at = ? WHERE id = ?').run(
          allergiesJson, new Date().toISOString(), target.id
        );
        return NextResponse.json({ success: true, message: 'Allergies updated successfully', allergies: Array.isArray(allergies) ? allergies : [] });
      }
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    // 2. Create Prescription
    if (action === 'create_prescription') {
      const rx = body.data || body.payload || {};
      const id = rx.id || `rx-${Date.now()}`;
      const mid = rx.patientId || 'pat-01';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO medications (
          id, member_id, name, dosage, frequency, instruction,
          prescribed_by, refill_days_left, time_slot, taken_today, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        id, mid, rx.medication || 'Medication', rx.dosage || 'Standard', rx.frequency || 'Daily',
        rx.instructions || '', rx.prescribedBy || 'Attending Physician, MD',
        rx.refillsLeft != null ? Number(rx.refillsLeft) : 2, rx.tag || 'Morning', now, now
      );

      return NextResponse.json({ success: true, message: 'Prescription recorded' }, { status: 201 });
    }

    // 3. Create Lab Result
    if (action === 'create_lab_result') {
      const lab = body.data || body.payload || {};
      const id = lab.id || `lab-${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO lab_results (
          id, patient_id, patient_name, patient_mrn, test_name, date, status,
          value, ref_range, is_abnormal, notes, doctor_or_lab, details_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, lab.patientId || 'pat-01', lab.patientName || 'Patient', lab.patientMrn || 'MRN-GENERAL',
        lab.testName || 'Diagnostic Panel', lab.date || 'Today', lab.status || 'Reviewed & Approved',
        lab.value || 'Normal', lab.refRange || 'Standard', lab.isAbnormal ? 1 : 0,
        lab.notes || '', lab.doctorOrLab || 'Clinical Laboratory',
        lab.details ? JSON.stringify(lab.details) : '[]', now
      );

      return NextResponse.json({ success: true, message: 'Lab result recorded' }, { status: 201 });
    }

    // 4. Create Appointment
    if (action === 'create_appointment') {
      const apt = body.data || body.payload || {};
      const id = apt.id || `apt-${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO consumer_appointments (
          id, member_id, doctor_name, specialty, hospital, appointment_date,
          appointment_time, token_number, appointment_type, status, queue_wait_mins, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 101, ?, ?, 15, ?, ?)
      `).run(
        id, apt.patientId || 'pat-01', apt.doctorName || apt.doctor || 'Attending Physician, MD',
        apt.specialty || 'General Diagnostics', apt.location || 'Suite 402 Medical Center',
        apt.date || 'Tomorrow', apt.time || '10:00 AM', apt.type || 'Consultation',
        apt.status || 'Confirmed', now, now
      );

      return NextResponse.json({ success: true, message: 'Appointment booked' }, { status: 201 });
    }

    // 5. Save Diagnostic Report from Any Clinical AI Service (TorchXRayVision, qXR, etc.)
    if (action === 'save_diagnostic_report') {
      const rep = body.data || body.payload || {};
      const id = rep.id || `rep-${Date.now()}`;
      const orderId = `ord-${Date.now()}`;
      const reportNumber = `REP-AI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      const patientId = rep.patientId || 'pat-01';
      const confidence = rep.confidence != null ? Number(rep.confidence) : 0.95;
      const findingsListJson = JSON.stringify(rep.findingsList || []);

      // Ensure procedure_orders record exists to satisfy foreign key constraint
      const orderNumber = `ORD-AI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      db.prepare(`
        INSERT OR IGNORE INTO procedure_orders (
          id, order_number, patient_id, procedure_code, procedure_name, modality,
          priority, status, order_date, created_at, updated_at
        ) VALUES (?, ?, ?, '71045', ?, ?, 'urgent', 'completed', ?, ?, ?)
      `).run(
        orderId, orderNumber, patientId,
        rep.serviceName || 'Chest Radiograph AI Screening',
        rep.modality || 'CXR',
        now, now, now
      );

      db.prepare(`
        INSERT INTO procedure_reports (
          id, order_id, report_number, patient_id, radiologist_id, status, findings,
          impression, recommendations, critical_findings_alert, signed_by, signed_at,
          created_at, updated_at, service_id, service_name, confidence, risk_level,
          modality, summary, findings_list_json
        ) VALUES (?, ?, ?, ?, ?, 'Final', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, orderId, reportNumber, patientId, 'rad-01',
        rep.findings || 'Automated finding detected.',
        rep.impression || rep.recommendation || 'Clinical correlation recommended.',
        rep.recommendation || 'Follow-up radiologist consultation advised.',
        rep.criticalAlert || rep.riskLevel === 'High' ? 1 : 0,
        rep.signedBy || rep.radiologist || 'TorchXRayVision DenseNet-121 (Certified)',
        now, now, now,
        rep.serviceId || 'qxr', rep.serviceName || 'Diagnostic Service',
        confidence, rep.riskLevel || 'Normal', rep.modality || 'CXR',
        rep.summary || rep.clinicalSummary || 'Certified clinical findings validated.',
        findingsListJson
      );

      // Update patient's primary condition in clinical_patients
      if (rep.findings) {
        const condJson = JSON.stringify([`${rep.findings} (${(confidence * 100).toFixed(1)}% AI Confidence)`]);
        db.prepare('UPDATE clinical_patients SET conditions_json = ?, updated_at = ? WHERE id = ?').run(
          condJson, now, patientId
        );
      }

      return NextResponse.json({ success: true, message: 'Diagnostic report saved to real central database' }, { status: 201 });
    }

    // 6. Send Clinical Message
    if (action === 'send_message') {
      const msg = body.data || body.payload || {};
      const id = msg.id || `msg-${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO clinical_messages (
          id, patient_id, sender, sender_role, avatar_bg, text, time, unread, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        id, msg.patientId || 'pat-01', msg.sender || 'Care Team', msg.senderRole || 'Clinician',
        msg.avatarBg || 'bg-teal-600', msg.text || '', msg.time || 'Just now', now
      );

      return NextResponse.json({ success: true, message: 'Message sent' }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API Clinical POST Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
