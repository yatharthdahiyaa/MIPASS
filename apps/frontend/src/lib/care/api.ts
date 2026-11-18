/**
 * Care API client: doctor-patient links, secure messages, consultations and notifications
 * (apps/backend/app/routes/care.py and the care sections of patient_portal.py).
 * The backend scopes every call to the signed-in user.
 */
import { apiCall } from '@/lib/auth/api';

export const CARE_SCOPES = ['profile', 'vitals', 'medications', 'documents', 'xrays'] as const;
export type CareScope = (typeof CARE_SCOPES)[number];

export const CONSULT_MODES = ['video', 'in_person', 'chat'] as const;
export type ConsultMode = (typeof CONSULT_MODES)[number];

export type LinkStatus = 'pending' | 'active' | 'declined' | 'revoked';
export type ConsultStatus = 'requested' | 'scheduled' | 'declined' | 'completed' | 'cancelled';

export interface DoctorCard {
  id: string;
  name: string;
  organization: string | null;
  specialty: string | null;
  bio: string | null;
  years_experience: number | null;
  share_code: string | null;
  verified: boolean;
  consult_modes: ConsultMode[];
}

export interface PatientCard {
  id: string;
  name: string;
  email: string;
  age: number | null;
  sex: string | null;
}

export interface CareLink {
  id: string;
  status: LinkStatus;
  requested_by: 'patient' | 'doctor';
  scopes: CareScope[];
  message: string | null;
  created_at: string | null;
  accepted_at: string | null;
  ended_at: string | null;
  ended_by: 'patient' | 'doctor' | null;
  /** Embedded for the patient's view. */
  doctor?: DoctorCard | null;
  /** Embedded for the doctor's view. */
  patient?: PatientCard | null;
}

export interface CareMessage {
  id: string;
  link_id: string;
  sender_id: string;
  mine: boolean;
  body: string;
  ref_type: string | null;
  ref_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CareThread {
  link: CareLink;
  last_message: CareMessage | null;
  unread: number;
}

export interface Consult {
  id: string;
  link_id: string;
  status: ConsultStatus;
  mode: ConsultMode;
  reason: string;
  preferred_at: string | null;
  scheduled_at: string | null;
  doctor_note: string | null;
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
  doctor?: { id: string | null; name: string };
  patient?: { id: string | null; name: string };
}

export interface AppNotification {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export type NotificationPrefs = Record<string, { email: boolean; phone?: boolean }>;

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const careApi = {
  /* notifications (any signed-in account) */
  notifications: (opts: { unread?: boolean; limit?: number } = {}) =>
    apiCall<{ notifications: AppNotification[]; unread: number }>(
      `/notifications?limit=${opts.limit ?? 50}${opts.unread ? '&unread=1' : ''}`,
    ),
  badge: () => apiCall<{ notifications: number; messages: number }>('/notifications/badge'),
  markRead: (id: string) => apiCall<{ read: number }>(`/notifications/${id}/read`, json('POST')),
  markAllRead: () => apiCall<{ read: number }>('/notifications/read-all', json('POST')),
  preferences: () => apiCall<{ preferences: NotificationPrefs; kinds: string[] }>('/notifications/preferences'),
  savePreferences: (preferences: NotificationPrefs) =>
    apiCall<{ preferences: NotificationPrefs }>('/notifications/preferences', json('PUT', { preferences })),

  /* messaging (both sides of an active link) */
  threads: () => apiCall<{ threads: CareThread[] }>('/care/threads'),
  messages: (linkId: string, after?: string) =>
    apiCall<{ link: CareLink; messages: CareMessage[] }>(
      `/care/${linkId}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`,
    ),
  sendMessage: (linkId: string, body: string) => apiCall<{ message: CareMessage }>(`/care/${linkId}/messages`, json('POST', { body })),
  markThreadRead: (linkId: string) => apiCall<{ read: number }>(`/care/${linkId}/messages/read`, json('POST')),

  /* patient: care team */
  doctors: (q = '') => apiCall<{ doctors: DoctorCard[] }>(`/patient/doctors?q=${encodeURIComponent(q)}`),
  careTeam: () => apiCall<{ links: CareLink[]; email_verified: boolean }>('/patient/care-team'),
  inviteDoctor: (input: { doctor_code?: string; doctor_email?: string; scopes: CareScope[]; message?: string }) =>
    apiCall<{ link: CareLink }>('/patient/care-team/invite', json('POST', input)),
  respondToDoctor: (linkId: string, accept: boolean, scopes?: CareScope[]) =>
    apiCall<{ link: CareLink }>(`/patient/care-team/${linkId}/respond`, json('POST', { accept, scopes })),
  updateScopes: (linkId: string, scopes: CareScope[]) =>
    apiCall<{ link: CareLink }>(`/patient/care-team/${linkId}`, json('PATCH', { scopes })),
  endLink: (linkId: string) => apiCall<{ link: CareLink }>(`/patient/care-team/${linkId}`, json('DELETE')),

  /* patient: consultations */
  consults: () => apiCall<{ consults: Consult[] }>('/patient/consults'),
  requestConsult: (input: { link_id: string; reason: string; mode: ConsultMode; preferred_at?: string }) =>
    apiCall<{ consult: Consult }>('/patient/consults', json('POST', input)),
  cancelConsult: (id: string) => apiCall<{ consult: Consult }>(`/patient/consults/${id}/cancel`, json('POST')),
};
