/**
 * Clinical API Service for MiPAAS
 * Connects frontend Doctor and Patient portals with the persistent clinical records engine.
 */

export interface Patient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: 'M' | 'F' | 'Other' | 'Female' | 'Male' | string;
  dob: string;
  bloodType?: string;
  phone: string;
  email?: string;
  address?: string;
  type?: string;
  primaryDiagnosis?: string;
  condition?: string;
  riskLevel?: string;
  primaryDoctor?: string;
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
  allergies?: string[];
  avatarBg?: string;
  initials?: string;
  createdAt?: string;
}

export interface Prescription {
  id: string;
  patientId?: string;
  patientName: string;
  patientMrn?: string;
  mrn?: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration?: string;
  datePrescribed?: string;
  prescribedBy: string;
  status: 'Active' | 'Refill Requested' | 'Discontinued' | string;
  instructions?: string;
  refillsLeft?: number;
  refills?: number;
  tag?: string;
}

export interface LabResult {
  id: string;
  patientId?: string;
  patientName: string;
  patientMrn?: string;
  mrn?: string;
  testName: string;
  orderedDate?: string;
  date?: string;
  status: 'Pending Review' | 'Reviewed & Approved' | 'Critical Review' | 'Normal & Stable' | string;
  value?: string;
  refRange?: string;
  isAbnormal?: boolean;
  notes?: string;
  doctorOrLab?: string;
  orderedBy?: string;
  findings?: string;
  details?: Array<{ test: string; value: string; status: string }>;
}

export interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  patientMrn?: string;
  mrn?: string;
  doctorName?: string;
  doctor?: string;
  specialty?: string;
  date: string;
  time: string;
  type: string;
  location: string;
  status: 'Confirmed' | 'Upcoming' | 'Completed' | 'Cancelled';
  instructions?: string;
}

export interface DiagnosticReport {
  id: string;
  patientId?: string;
  patientName: string;
  patientMrn?: string;
  mrn?: string;
  serviceId: string;
  serviceName: string;
  modality?: string;
  title?: string;
  category?: string;
  date: string;
  summary?: string;
  findings: string;
  impression?: string;
  confidence?: number;
  status?: 'Final' | 'Preliminary' | 'Validated' | string;
  signedBy?: string;
  signedAt?: string;
  criticalAlert?: boolean;
  findingsList?: Array<{ name: string; probability: number; status: string }>;
  riskLevel?: string;
  recommendation?: string;
  clinicalSummary?: string;
  certified?: boolean;
  radiologist?: string;
}

export interface ClinicalMessage {
  id: string;
  patientId?: string;
  sender: string;
  senderRole?: string;
  role?: string;
  avatarBg?: string;
  text: string;
  time: string;
  unread?: boolean;
  isMe?: boolean;
}

export type ClinicalPatient = Patient;
export type ClinicalPrescription = Prescription;
export type ClinicalLabResult = LabResult;
export type ClinicalAppointment = Appointment;
export type ClinicalDiagnosticReport = DiagnosticReport;

class ClinicalApiService {
  private baseUrl = '/api/clinical';

  // 1. Patients
  async getPatients(): Promise<Patient[]> {
    try {
      const res = await fetch(`${this.baseUrl}?type=patients`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  async createPatient(data: Partial<Patient>): Promise<Patient | null> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_patient', data }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.patient || null;
    } catch {
      return null;
    }
  }

  // 2. Patient-specific Bundle (All records for a patient)
  async getPatientBundle(params: { patientId?: string; mrn?: string }): Promise<{
    patient: Patient | null;
    prescriptions: Prescription[];
    labResults: LabResult[];
    appointments: Appointment[];
    diagnosticReports: DiagnosticReport[];
    messages: ClinicalMessage[];
  }> {
    try {
      const query = params.patientId ? `patientId=${params.patientId}` : `mrn=${params.mrn}`;
      const res = await fetch(`${this.baseUrl}?${query}`, { cache: 'no-store' });
      if (!res.ok) {
        return {
          patient: null,
          prescriptions: [],
          labResults: [],
          appointments: [],
          diagnosticReports: [],
          messages: [],
        };
      }
      const json = await res.json();
      return {
        patient: json.patient || null,
        prescriptions: json.prescriptions || [],
        labResults: json.labResults || [],
        appointments: json.appointments || [],
        diagnosticReports: json.diagnosticReports || [],
        messages: json.messages || [],
      };
    } catch {
      return {
        patient: null,
        prescriptions: [],
        labResults: [],
        appointments: [],
        diagnosticReports: [],
        messages: [],
      };
    }
  }

  // 3. Prescriptions
  async getPrescriptions(): Promise<Prescription[]> {
    try {
      const res = await fetch(`${this.baseUrl}?type=prescriptions`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  async createPrescription(data: Partial<Prescription>): Promise<Prescription | null> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_prescription', data }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.prescription || null;
    } catch {
      return null;
    }
  }

  // 4. Lab Results
  async getLabResults(): Promise<LabResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}?type=labs`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  async updatePatientVitals(patientId: string, vitals: { bloodPressure?: string; heartRate?: string; oxygen?: string; bmi?: string }): Promise<Patient | null> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_patient_vitals',
          data: { patientId, vitals },
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.patient || null;
    } catch {
      return null;
    }
  }

  async createLabResult(data: Partial<LabResult>): Promise<LabResult | null> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_lab_result', data }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.labResult || null;
    } catch {
      return null;
    }
  }

  // 5. Appointments
  async getAppointments(): Promise<Appointment[]> {
    try {
      const res = await fetch(`${this.baseUrl}?type=appointments`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  async createAppointment(data: Partial<Appointment>): Promise<Appointment | null> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_appointment', data }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.appointment || null;
    } catch {
      return null;
    }
  }

  // 6. Diagnostic Reports (from all 9 services)
  async getDiagnosticReports(): Promise<DiagnosticReport[]> {
    try {
      const res = await fetch(`${this.baseUrl}?type=reports`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  async saveDiagnosticReport(data: Partial<DiagnosticReport>): Promise<DiagnosticReport | null> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_diagnostic_report', data }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.report || null;
    } catch {
      return null;
    }
  }

  // 7. Clinical Communications
  async getMessages(): Promise<ClinicalMessage[]> {
    try {
      const res = await fetch(`${this.baseUrl}?type=messages`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  async sendMessage(data: Partial<ClinicalMessage>): Promise<ClinicalMessage | null> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_message', data }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.message || null;
    } catch {
      return null;
    }
  }

  // 7.5 Update Patient Allergies
  async updatePatientAllergies(patientId: string, allergies: string[]): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_patient_allergies', data: { patientId, allergies } }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // 8. Wipe all pre-seed data
  async clearAllRecords(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const clinicalApiService = new ClinicalApiService();
