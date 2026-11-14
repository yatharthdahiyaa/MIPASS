/**
 * Administration API client (apps/backend/app/routes/admin.py).
 * Every call needs the `users:manage` permission, except the audit log (`audit:read`).
 */
import { apiCall, type ClinicianInfo, type SessionUser } from '@/lib/auth/api';

export interface AdminOverview {
  users: { total: number; by_role: Record<string, number>; new_7d: number; unverified_email: number; mfa_enabled: number };
  doctors: { pending: number; verified: number };
  care: { links_active: number; links_pending: number; consults_open: number };
  imaging: { patient_xrays: number; patient_xrays_7d: number; doctor_studies: number; signed_reports: number };
  audit: { events_24h: number; denied_24h: number };
  mail: { failed: number; queued: number };
}

export type AdminUser = SessionUser & { is_active: boolean };
export type PendingDoctor = AdminUser & { clinician: ClinicianInfo | null };

export interface Paged {
  total: number;
  page: number;
  page_size: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string | null;
  user_id: string | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
}

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  kind: string | null;
  status: 'queued' | 'sent' | 'failed' | 'outbox';
  error: string | null;
  /** Null when the server delivers by SMTP: bodies hold other people's sign-in links. */
  text: string | null;
  created_at: string | null;
  sent_at: string | null;
}

export interface AgentStats {
  key: string;
  title: string;
  audience: 'patient' | 'doctor';
  enabled: boolean;
  runs: number;
  failed: number;
  llm_used: number;
  withheld: number;
  accepted: number;
  edited: number;
  discarded: number;
  median_ms: number | null;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const adminApi = {
  overview: () => apiCall<AdminOverview>('/admin/overview'),

  users: (params: { q?: string; role?: string; page?: number }) =>
    apiCall<{ users: AdminUser[] } & Paged>(`/admin/users${query({ ...params, page_size: 25 })}`),
  updateUser: (id: string, patch: { role?: string; is_active?: boolean; email_verified?: true }) =>
    apiCall<{ user: AdminUser }>(`/admin/users/${id}`, json('PATCH', patch)),

  pendingDoctors: () => apiCall<{ doctors: PendingDoctor[] }>('/admin/doctors/pending'),
  verifyDoctor: (id: string, note?: string) => apiCall<{ user: AdminUser }>(`/admin/doctors/${id}/verify`, json('POST', { note })),
  rejectDoctor: (id: string, reason: string) => apiCall<{ user: AdminUser }>(`/admin/doctors/${id}/reject`, json('POST', { reason })),

  audit: (params: { action?: string; user?: string; status?: string; page?: number }) =>
    apiCall<{ events: AuditEvent[] } & Paged>(`/admin/audit${query({ ...params, page_size: 50 })}`),

  agents: (days = 30) =>
    apiCall<{ days: number; agents: AgentStats[]; service_configured: boolean; consented_patients: number }>(`/admin/agents?days=${days}`),

  outbox: (params: { status?: string; page?: number }) =>
    apiCall<{ emails: OutboxEmail[]; bodies_visible: boolean } & Paged>(`/admin/outbox${query({ ...params, page_size: 25 })}`),
};
