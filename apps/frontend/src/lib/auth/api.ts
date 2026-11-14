/**
 * Client for the central-database account API (apps/backend/app/routes/accounts.py).
 * Calls go through the Next.js /api/v1 rewrite so the HttpOnly session cookie is
 * first-party and never readable from JavaScript.
 */
import { API_PREFIX } from '@/config/api';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  role_title: string;
  organization: string | null;
  department: string | null;
  phone: string | null;
  locale: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  /** Present for doctor accounts only. */
  clinician?: ClinicianInfo | null;
  permissions: string[];
  last_login_at: string | null;
  created_at: string | null;
  account_type: 'patient' | 'doctor' | 'staff';
  verification_pending: boolean;
  /** Where this account lands after sign-in (decided by the backend). */
  home: string;
}

export interface ClinicianInfo {
  specialty: string | null;
  license_number: string | null;
  verified: boolean;
  verified_at: string | null;
  rejected: boolean;
  rejection_reason: string | null;
  /** Code a patient types to connect with this doctor (set once verified). */
  share_code: string | null;
  listed: boolean;
  bio: string | null;
  years_experience: number | null;
  consult_modes: string[];
}

export interface SignedIn {
  user: SessionUser;
  expires_at: string;
}

/** Password accepted, but the account has two-step verification on. */
export interface MfaChallenge {
  mfa_required: true;
  mfa_token: string;
  expires_in: number;
}

export interface MfaStatus {
  enabled: boolean;
  enabled_at: string | null;
  recovery_codes_left: number;
}

export interface DeviceSession {
  id: string;
  client: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  expires_at: string;
  current: boolean;
}

export interface ProfilePatch {
  name?: string;
  phone?: string;
  organization?: string;
  locale?: string;
}

export interface RegisterInput {
  account_type: 'patient' | 'doctor';
  name: string;
  email: string;
  password: string;
  organization?: string;
  license_number?: string;
  specialty?: string;
}

export interface SessionState {
  authenticated: boolean;
  user: SessionUser | null;
  expires_at?: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly type?: string,
  ) {
    super(message);
  }
}

type Envelope<T> = { success: true; data: T } | { success: false; error?: { message?: string; type?: string } };

/** Calls the MIPAAS API (`/api/v1` + path) and unwraps the `{success, data}` envelope. */
export async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new AuthApiError('Can’t reach the MIPAAS server. Check your connection and try again.', 0);
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // non-JSON (e.g. proxy error page)
  }
  if (!body) throw new AuthApiError('The service is unavailable right now. Please try again shortly.', res.status);
  if (!res.ok || !body.success) {
    const err = body.success ? undefined : body.error;
    throw new AuthApiError(err?.message ?? 'Something went wrong. Please try again.', res.status, err?.type);
  }
  return body.data;
}

const post = (body?: unknown): RequestInit => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const authApi = {
  session: () => apiCall<SessionState>('/auth/session'),
  login: (identifier: string, password: string, remember: boolean) =>
    apiCall<SignedIn | MfaChallenge>('/auth/login', post({ identifier, password, remember })),
  /** Second step of sign-in: a 6-digit authenticator code or a recovery code. */
  mfaVerify: (mfa_token: string, code: string) => apiCall<SignedIn>('/auth/mfa/verify', post({ mfa_token, code })),
  register: (input: RegisterInput) => apiCall<SignedIn>('/auth/register', post(input)),
  logout: () => apiCall<{ signed_out: boolean }>('/auth/logout', { method: 'POST' }),
  updateProfile: (patch: ProfilePatch) =>
    apiCall<{ user: SessionUser }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(patch) }),

  /** Patients only: permanently erases the account and everything stored under it. */
  deleteAccount: (password: string, code?: string) =>
    apiCall<{ deleted: boolean }>('/auth/account', { method: 'DELETE', body: JSON.stringify({ password, code }) }),

  requestVerification: () => apiCall<{ sent: boolean; already_verified?: boolean }>('/auth/verify-email/request', post()),
  confirmEmail: (token: string) => apiCall<{ verified: boolean; user: SessionUser }>('/auth/verify-email/confirm', post({ token })),

  forgotPassword: (email: string) => apiCall<{ sent: boolean }>('/auth/password/forgot', post({ email })),
  /** Sets the new password and signs in on this device (all other sessions end). */
  resetPassword: (token: string, password: string) => apiCall<SignedIn>('/auth/password/reset', post({ token, password })),
  changePassword: (current_password: string, new_password: string) =>
    apiCall<{ changed: boolean }>('/auth/password/change', post({ current_password, new_password })),

  mfaStatus: () => apiCall<MfaStatus>('/auth/mfa'),
  mfaSetup: () => apiCall<{ secret: string; otpauth_uri: string }>('/auth/mfa/setup', post()),
  mfaEnable: (code: string) => apiCall<{ enabled: boolean; recovery_codes: string[] }>('/auth/mfa/enable', post({ code })),
  mfaDisable: (password: string, code: string) => apiCall<{ enabled: boolean }>('/auth/mfa/disable', post({ password, code })),
  mfaRecoveryCodes: (code: string) => apiCall<{ recovery_codes: string[] }>('/auth/mfa/recovery-codes', post({ code })),

  sessions: () => apiCall<{ sessions: DeviceSession[] }>('/auth/sessions'),
  revokeSession: (id: string) => apiCall<{ revoked: boolean }>(`/auth/sessions/${id}`, { method: 'DELETE' }),
  revokeOtherSessions: () => apiCall<{ revoked: number }>('/auth/sessions/revoke-others', post()),

  audit: (event: { action: string; resource: string; decision: 'allow' | 'deny'; details?: Record<string, unknown> }) =>
    apiCall<{ recorded: boolean }>('/audit/events', { method: 'POST', body: JSON.stringify(event) }),
};

/** Only allow same-site relative redirects (blocks //evil.com and absolute URLs). */
export function safeNext(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
