/**
 * Patient portal API client (apps/backend/app/routes/patient_portal.py).
 * Every call is scoped server-side to the signed-in patient.
 */
import { API_PREFIX } from '@/config/api';
import { apiCall } from '@/lib/auth/api';
import type { CareLink, Consult, DoctorCard } from '@/lib/care/api';

export type Severity = 'NORMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface PatientProfile {
  date_of_birth: string | null;
  age: number | null;
  sex: string | null;
  blood_group: string | null;
  height_cm: number | null;
  phone: string | null;
  allergies: string | null;
  conditions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_language: string | null;
  completeness: number;
  updated_at: string | null;
}

export const LOG_METRICS = [
  'systolic',
  'diastolic',
  'heart_rate',
  'glucose',
  'spo2',
  'temperature_c',
  'weight_kg',
  'sleep_hours',
  'steps',
  'water_ml',
  'mood',
] as const;
export type LogMetric = (typeof LOG_METRICS)[number];

export type DailyLog = { [K in LogMetric]: number | null } & {
  id: string;
  log_date: string;
  recorded_at: string;
  glucose_context: 'fasting' | 'after_meal' | 'random' | null;
  symptoms: string[];
  notes: string | null;
};

export type NewLog = Partial<{ [K in LogMetric]: number }> & {
  log_date: string;
  recorded_at: string;
  glucose_context?: string;
  symptoms?: string[];
  notes?: string;
};

export interface LatestReading {
  value: number;
  recorded_at: string;
  log_date: string;
  diastolic?: number | null;
  context?: string | null;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  times: string[];
  instructions: string | null;
  prescribed_by: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export type DoseStatus = 'taken' | 'skipped' | null;

export interface MedicationDay {
  medication: Medication;
  doses: { slot: string; status: DoseStatus; recorded_at: string | null }[];
}

export interface Adherence {
  taken: number;
  scheduled: number;
  rate: number;
  days: number;
}

export interface XrayFinding {
  name: string;
  probability: number;
  threshold: number;
  positive: boolean;
  description?: string;
}

export interface XrayStudy {
  id: string;
  title: string | null;
  taken_on: string | null;
  original_filename: string;
  size_bytes: number;
  status: 'processing' | 'completed' | 'failed';
  error: string | null;
  primary_finding: string | null;
  severity: Severity | null;
  model_name: string | null;
  has_preview: boolean;
  has_heatmap: boolean;
  analyzed_at: string | null;
  created_at: string;
  positive_findings?: string[];
  findings?: {
    pathologies: XrayFinding[];
    positive_findings: string[];
    clinical_summary?: string;
    recommended_actions?: string[];
    disclaimer?: string;
  };
}

export const DOCUMENT_CATEGORIES = ['lab_report', 'prescription', 'imaging', 'discharge', 'vaccination', 'insurance', 'other'] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface PatientDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  record_date: string | null;
  provider: string | null;
  notes: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface Overview {
  date: string;
  profile: PatientProfile;
  latest: Partial<Record<LogMetric, LatestReading>>;
  today: { check_ins: number; doses_scheduled: number; doses_taken: number };
  medications_today: MedicationDay[];
  adherence_7d: Adherence | null;
  streak_days: number;
  latest_xray: XrayStudy | null;
  counts: { logs: number; medications: number; documents: number; xrays: number };
  care: {
    /** Connected doctors (null for an account that no longer exists). */
    doctors: (DoctorCard | null)[];
    /** Doctors who asked to connect and are waiting for an answer. */
    pending_invites: CareLink[];
    unread_messages: number;
    unread_notifications: number;
    next_consult: Consult | null;
    reports: number;
  };
  email_verified: boolean;
}

/** A report a connected doctor signed and shared with this patient. */
export interface SharedReport {
  id: string;
  modality: string | null;
  analyzer_name: string | null;
  study_date: string | null;
  primary_finding: string | null;
  severity: Severity | null;
  signed_at: string | null;
  signed_by: string | null;
  doctor: { id: string | null; name: string | null; organization: string | null };
  has_preview: boolean;
  has_heatmap: boolean;
  // detail only
  impression?: string | null;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const patientApi = {
  overview: (date: string) => apiCall<Overview>(`/patient/overview?date=${date}`),

  profile: () => apiCall<{ profile: PatientProfile }>('/patient/profile'),
  saveProfile: (patch: Partial<PatientProfile>) => apiCall<{ profile: PatientProfile }>('/patient/profile', json('PUT', patch)),

  logs: (days: number, date: string) => apiCall<{ logs: DailyLog[] }>(`/patient/logs?days=${days}&date=${date}`),
  addLog: (log: NewLog) => apiCall<{ log: DailyLog }>('/patient/logs', json('POST', log)),
  deleteLog: (id: string) => apiCall<{ deleted: boolean }>(`/patient/logs/${id}`, json('DELETE')),

  medications: () => apiCall<{ medications: Medication[] }>('/patient/medications'),
  addMedication: (m: Partial<Medication>) => apiCall<{ medication: Medication }>('/patient/medications', json('POST', m)),
  updateMedication: (id: string, patch: Partial<Medication>) =>
    apiCall<{ medication: Medication }>(`/patient/medications/${id}`, json('PATCH', patch)),
  deleteMedication: (id: string) => apiCall<{ deleted: boolean }>(`/patient/medications/${id}`, json('DELETE')),
  medicationDay: (date: string) =>
    apiCall<{ date: string; items: MedicationDay[]; adherence_7d: Adherence | null; adherence_30d: Adherence | null }>(
      `/patient/medications/day?date=${date}`,
    ),
  recordDose: (id: string, date: string, slot: string, status: DoseStatus) =>
    apiCall<{ status: DoseStatus }>(`/patient/medications/${id}/doses`, json('POST', { date, slot, status })),

  documents: () => apiCall<{ documents: PatientDocument[] }>('/patient/documents'),
  uploadDocument: (form: FormData) => apiCall<{ document: PatientDocument }>('/patient/documents', { method: 'POST', body: form }),
  deleteDocument: (id: string) => apiCall<{ deleted: boolean }>(`/patient/documents/${id}`, json('DELETE')),
  documentUrl: (id: string, download = false) => `${API_PREFIX}/patient/documents/${id}/file${download ? '?download=1' : ''}`,

  xrays: () => apiCall<{ xrays: XrayStudy[] }>('/patient/xrays'),
  xray: (id: string) => apiCall<{ xray: XrayStudy }>(`/patient/xrays/${id}`),
  uploadXray: (form: FormData) => apiCall<{ xray: XrayStudy }>('/patient/xrays', { method: 'POST', body: form }),
  deleteXray: (id: string) => apiCall<{ deleted: boolean }>(`/patient/xrays/${id}`, json('DELETE')),
  xrayImageUrl: (id: string, kind: 'preview' | 'heatmap' | 'original') => `${API_PREFIX}/patient/xrays/${id}/image?kind=${kind}`,

  reports: () => apiCall<{ reports: SharedReport[] }>('/patient/reports'),
  report: (id: string) => apiCall<{ report: SharedReport }>(`/patient/reports/${id}`),
  reportImageUrl: (id: string, kind: 'preview' | 'heatmap') => `${API_PREFIX}/patient/reports/${id}/image?kind=${kind}`,

  exportUrl: () => `${API_PREFIX}/patient/export`,
};

/** Local calendar date as YYYY-MM-DD (the backend stores the patient's own day, not UTC). */
export function localISODate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
