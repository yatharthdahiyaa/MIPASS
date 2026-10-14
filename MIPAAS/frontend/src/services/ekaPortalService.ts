/**
 * Eka.care PHR Portal Service Client for MiPAAS
 *
 * Talks to the MiPAAS Flask backend (/api/v1/eka/*) with the authenticated
 * user's identity headers, following the same direct-first / proxy-fallback
 * pattern used by openemrService.
 */

const EKA_BASE = '/api/v1/eka';

export interface EkaSession {
  userId: string;
  userName: string;
  role: string;
  linkedMembers: number;
  primaryMemberId: string;
  entitlements: string[];
  consent: {
    abdmLinked: boolean;
    aiConsultEnabled: boolean;
    lockerEncryption: string;
  };
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  gender: string;
  abhaId: string;
  bloodGroup: string;
  avatarColor: string;
  primaryCondition?: string | null;
}

export interface Medication {
  id: string;
  memberId: string;
  name: string;
  dosage: string;
  frequency: string;
  timing: 'Morning' | 'Afternoon' | 'Night' | 'Morning & Night';
  instruction: 'Before Food' | 'After Food' | 'With Food';
  prescribedBy: string;
  refillDaysLeft: number;
  takenToday: boolean;
  timeSlot: string;
}

export interface VitalRecord {
  id: string;
  memberId: string;
  type: string;
  value: string;
  unit: string;
  status: 'Normal' | 'Elevated' | 'Attention' | 'Optimal';
  recordedAt: string;
  trend: 'up' | 'down' | 'stable';
  targetRange: string;
}

export interface HealthRecord {
  id: string;
  memberId: string;
  title: string;
  category: 'Prescriptions' | 'Lab Reports' | 'Scans & Imaging' | 'Discharge Summary' | 'Vaccinations';
  doctorOrLab: string;
  date: string;
  fileType: string;
  fileSize: string;
  aiKeySummary: string;
  extractedParameters?: Array<{ name: string; value: string; unit: string; flag: 'Normal' | 'High' | 'Low' }>;
  tags: string[];
}

export interface Appointment {
  id: string;
  memberId: string;
  doctorName: string;
  specialty: string;
  hospital: string;
  date: string;
  time: string;
  tokenNumber: number;
  type: 'In-Clinic' | 'Video Teleconsult';
  status: 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled';
  queueWaitMins: number;
}

export interface ConsultResult {
  reply: string;
  model: string;
  groundedOn: {
    vitalsCount: number;
    activeMedications: number;
    pendingMedications: number;
    upcomingAppointments: number;
  };
  disclaimer: string;
}

export interface TodaySummary {
  medicationAdherence: { taken: number; total: number; percentage: number };
  vitalsLoggedToday: number;
  abnormalVitals: VitalRecord[];
  recordsInLocker: number;
  upcomingAppointments: Appointment[];
}

export interface AbhaProfile {
  member: FamilyMember;
  abhaAddress: string;
  verificationStatus: string;
  consentArtifacts: Array<{ name: string; status: string; expiry: string }>;
  immunizationHistory: Array<{ record: string; date: string }>;
  linkedFacilities: string[];
}

export interface PortalIdentity {
  userId: string;
  role: string;
}

export class PortalAuthError extends Error {
  constructor(message = 'Your MiPAAS session is not authorized for the eka.care portal.') {
    super(message);
    this.name = 'PortalAuthError';
  }
}

async function ekaRequest<T>(
  identity: PortalIdentity,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-User-ID': identity.userId,
    'X-User-Role': identity.role,
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`http://localhost:8080${EKA_BASE}${path}`, {
    ...options,
    headers,
  }).catch(async () => {
    // Direct Flask call blocked (CORS/network) — use the Next.js proxy rewrite
    return fetch(`${EKA_BASE}${path}`, { ...options, headers });
  });

  const body: {
    success?: boolean;
    data?: unknown;
    error?: { message?: string };
  } = await res.json().catch(() => ({}));

  if (res.status === 401 || res.status === 403) {
    throw new PortalAuthError(body?.error?.message);
  }
  if (!res.ok) {
    throw new Error(body?.error?.message || `Request failed with status ${res.status}`);
  }
  if (body?.success === false) {
    throw new Error(body?.error?.message || 'Unexpected backend error');
  }
  return body.data as T;
}

export const ekaPortalService = {
  getSession: (id: PortalIdentity) =>
    ekaRequest<{ session: EkaSession }>(id, '/session'),

  getMeta: (id: PortalIdentity) =>
    ekaRequest<{
      vitalTypes: string[];
      recordCategories: string[];
      medicationTimings: string[];
      medicationInstructions: string[];
      appointmentTypes: string[];
    }>(id, '/meta'),

  listFamily: (id: PortalIdentity) =>
    ekaRequest<{ members: FamilyMember[]; count: number }>(id, '/family'),

  addFamilyMember: (id: PortalIdentity, payload: Partial<FamilyMember>) =>
    ekaRequest<{ member: FamilyMember }>(id, '/family', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSummary: (id: PortalIdentity, memberId: string) =>
    ekaRequest<{ summary: TodaySummary }>(id, `/members/${memberId}/summary`),

  getAbha: (id: PortalIdentity, memberId: string) =>
    ekaRequest<{ abha: AbhaProfile }>(id, `/members/${memberId}/abha`),

  listMedications: (id: PortalIdentity, memberId: string) =>
    ekaRequest<{ medications: Medication[] }>(id, `/members/${memberId}/medications`),

  addMedication: (id: PortalIdentity, memberId: string, payload: Partial<Medication>) =>
    ekaRequest<{ medication: Medication }>(id, `/members/${memberId}/medications`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  setMedicationTaken: (id: PortalIdentity, medId: string, taken: boolean) =>
    ekaRequest<{ medication: Medication }>(id, `/medications/${medId}/taken`, {
      method: 'POST',
      body: JSON.stringify({ taken }),
    }),

  deleteMedication: (id: PortalIdentity, medId: string) =>
    ekaRequest<{ deleted: string }>(id, `/medications/${medId}`, { method: 'DELETE' }),

  listVitals: (id: PortalIdentity, memberId: string) =>
    ekaRequest<{ vitals: VitalRecord[] }>(id, `/members/${memberId}/vitals`),

  logVital: (id: PortalIdentity, memberId: string, payload: { type: string; value: string; unit: string }) =>
    ekaRequest<{ vital: VitalRecord }>(id, `/members/${memberId}/vitals`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listRecords: (id: PortalIdentity, memberId: string, filters?: { category?: string; q?: string }) => {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'All') params.set('category', filters.category);
    if (filters?.q) params.set('q', filters.q);
    const qs = params.toString();
    return ekaRequest<{ records: HealthRecord[]; count: number }>(
      id,
      `/members/${memberId}/records${qs ? `?${qs}` : ''}`,
    );
  },

  uploadRecord: (id: PortalIdentity, memberId: string, payload: Partial<HealthRecord>) =>
    ekaRequest<{ record: HealthRecord }>(id, `/members/${memberId}/records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteRecord: (id: PortalIdentity, recordId: string) =>
    ekaRequest<{ deleted: string }>(id, `/records/${recordId}`, { method: 'DELETE' }),

  listAppointments: (id: PortalIdentity, memberId: string) =>
    ekaRequest<{ appointments: Appointment[] }>(id, `/members/${memberId}/appointments`),

  bookAppointment: (id: PortalIdentity, memberId: string, payload: {
    doctorName: string;
    specialty?: string;
    date: string;
    time?: string;
    type?: string;
    hospital?: string;
  }) =>
    ekaRequest<{ appointment: Appointment }>(id, `/members/${memberId}/appointments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelAppointment: (id: PortalIdentity, aptId: string) =>
    ekaRequest<{ cancelled: string }>(id, `/appointments/${aptId}/cancel`, { method: 'POST' }),

  consult: (id: PortalIdentity, memberId: string, message: string) =>
    ekaRequest<{ consult: ConsultResult }>(id, `/members/${memberId}/consult`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
