/**
 * Typed wrappers around the Rust commands (src-tauri/src/commands.rs).
 * The webview has no network access of its own: every call goes through IPC to Rust,
 * which holds the session token and talks to the MIPAAS backend.
 */
import { invoke } from '@tauri-apps/api/core';

export type Severity = 'NORMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type Filter = 'all' | 'draft' | 'urgent' | 'signed' | 'pending' | 'failed';
export type StudyStatus = 'processing' | 'pending' | 'completed' | 'failed';

export interface Doctor {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: string | null;
  email_verified?: boolean;
  clinician?: {
    specialty: string | null;
    /** Code a patient types on the website to connect with this doctor. */
    share_code: string | null;
    verified: boolean;
    listed: boolean;
  } | null;
}

/* ---------- care connections (apps/backend/app/services/care.py) ---------- */

export type CareScope = 'profile' | 'vitals' | 'medications' | 'documents' | 'xrays';
export type LinkStatus = 'pending' | 'active' | 'declined' | 'revoked';
export type PatientFilter = 'active' | 'pending' | 'ended';

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
  patient: PatientCard | null;
  /** Only on active links in the patient list. */
  unread_messages?: number;
}

export interface CareMessage {
  id: string;
  link_id: string;
  mine: boolean;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface CareThread {
  link: CareLink;
  last_message: CareMessage | null;
  unread: number;
}

export type ConsultStatus = 'requested' | 'scheduled' | 'declined' | 'completed' | 'cancelled';
export type ConsultFilter = 'requested' | 'upcoming' | 'all';

export interface Consult {
  id: string;
  link_id: string;
  status: ConsultStatus;
  mode: 'video' | 'in_person' | 'chat';
  reason: string;
  preferred_at: string | null;
  scheduled_at: string | null;
  doctor_note: string | null;
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
  patient: { id: string | null; name: string };
}

export interface AppNotification {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string | null;
  /** Web path the server attached (e.g. /doctor/inbox?link=...); mapped to a screen here. */
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Badge {
  notifications: number;
  messages: number;
}

export interface Dashboard {
  patients: { active: number; pending_invites: CareLink[] };
  consults: { requested: Consult[]; upcoming: Consult[] };
  inbox: { unread_messages: number; unread_notifications: number };
}

export const LOG_METRICS = ['systolic', 'diastolic', 'heart_rate', 'glucose', 'spo2', 'temperature_c', 'weight_kg', 'sleep_hours', 'steps', 'water_ml', 'mood'] as const;
export type LogMetric = (typeof LOG_METRICS)[number];

export type DailyLog = { [K in LogMetric]: number | null } & {
  id: string;
  log_date: string;
  recorded_at: string;
  glucose_context: string | null;
  symptoms: string[];
  notes: string | null;
};

export interface LatestReading {
  value: number;
  recorded_at: string;
  log_date: string;
  diastolic?: number | null;
  context?: string | null;
}

export interface Adherence {
  taken: number;
  scheduled: number;
  rate: number;
  days: number;
}

export interface XrayReview {
  id: string;
  doctor_name: string;
  impression: string;
  recommendation: string | null;
  urgency: 'routine' | 'soon' | 'urgent';
  created_at: string;
}

export interface PatientDocument {
  id: string;
  title: string;
  category: string;
  record_date: string | null;
  provider: string | null;
  notes: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface SharedMedication {
  id: string;
  name: string;
  dosage: string | null;
  times: string[];
  instructions: string | null;
  prescribed_by: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export interface SharedProfile {
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
}

export interface LinkedReport {
  id: string;
  modality: string | null;
  primary_finding: string | null;
  severity: Severity | null;
  report_status: 'draft' | 'signed';
  signed_at: string | null;
  study_date: string | null;
}

export interface ServerInfo {
  server_url: string;
  reachable: boolean;
  version: string | null;
}

/** A study type the server can analyse (one registered model). */
export interface Analyzer {
  id: string;
  modality: string;
  display_name: string;
  description: string;
  extensions: string[];
  /** False until a trained model is installed; uploads are kept as `pending` meanwhile. */
  available: boolean;
}

export interface AnalyzeWaitingResult {
  attempted: number;
  waiting: number;
  results: Partial<Record<StudyStatus | 'skipped', number>>;
}

export interface Pathology {
  name: string;
  probability: number;
  threshold: number;
  positive: boolean;
  description?: string;
}

export interface Study {
  id: string;
  patient_ref: string | null;
  patient_name: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  study_date: string | null;
  modality: string | null;
  analyzer_id: string | null;
  analyzer_name: string | null;
  original_filename: string;
  size_bytes: number;
  status: StudyStatus;
  error: string | null;
  primary_finding: string | null;
  severity: Severity | null;
  model_name: string | null;
  analyzed_at: string | null;
  has_preview: boolean;
  has_heatmap: boolean;
  report_status: 'draft' | 'signed';
  signed_at: string | null;
  signed_by: string | null;
  /** Whether "Run analysis" is allowed and its model is installed right now. */
  can_analyze: boolean;
  created_at: string;
  updated_at: string;
  /** Patient account the signed report is shared with, if any. */
  patient_user_id?: string | null;
  // detail only
  patient_link?: CareLink | null;
  clinical_notes?: string | null;
  impression?: string | null;
  findings?: {
    pathologies: Pathology[];
    positive_findings: string[];
    clinical_summary?: string;
    recommended_actions?: string[];
    disclaimer?: string;
  } | null;
}

/** An X-ray the patient uploaded themselves and shared with this doctor. */
export interface PatientXray {
  id: string;
  title: string | null;
  taken_on: string | null;
  original_filename: string;
  status: 'processing' | 'completed' | 'failed';
  error: string | null;
  primary_finding: string | null;
  severity: Severity | null;
  model_name: string | null;
  has_preview: boolean;
  has_heatmap: boolean;
  analyzed_at: string | null;
  created_at: string;
  findings?: Study['findings'];
  my_review: XrayReview | null;
}

/** What the patient chose to share; a section is absent when its scope isn't shared. */
export interface SharedRecord {
  link: CareLink;
  scopes: CareScope[];
  patient: PatientCard | null;
  profile?: SharedProfile | null;
  vitals?: {
    latest: Partial<Record<LogMetric, LatestReading>>;
    logs: DailyLog[];
    days: number;
    streak_days: number;
  };
  medications?: {
    items: SharedMedication[];
    adherence_7d: Adherence | null;
    adherence_30d: Adherence | null;
  };
  documents?: PatientDocument[];
  xrays?: PatientXray[];
  /** This doctor's own studies linked to the patient. */
  reports: LinkedReport[];
}

export interface Summary {
  total: number;
  drafts: number;
  signed: number;
  urgent_unsigned: number;
  pending: number;
  failed: number;
  by_severity: Partial<Record<Severity, number>>;
  by_modality: Record<string, number>;
}

export interface PatientFields {
  patient_ref?: string;
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  study_date?: string;
  clinical_notes?: string;
}

export interface UploadFields extends PatientFields {
  /** Analyser id; omit to let the server choose from the file. */
  analyzer?: string;
}

export interface PickedFile {
  id: string;
  name: string;
  size: number;
}

/* ---------- AI agents (apps/backend/app/services/agents.py) ---------- */

export type AgentRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface AgentRun<T> {
  id: string;
  agent: string;
  status: AgentRunStatus;
  output: T | null;
  error: string | null;
  /** An outside AI model saw minimised data (only with the patient's consent). */
  llm_used: boolean;
  /** Why the model's wording was withheld by the safety check. */
  guard: string | null;
  review_decision: 'accepted' | 'edited' | 'discarded' | null;
  duration_ms: number | null;
}

export interface ConsultBrief {
  attention: string[];
  sections: { title: string; items: string[] }[];
  narrative: string | null;
  notice: string;
}

export interface ReportDraft {
  draft: string;
  flagged: { finding: string; wording: string; certainty: string; probability: number; threshold: number }[];
  borderline: { finding: string; wording: string; probability: number; threshold: number }[];
  recommendations: string[];
  notice: string;
}

export class CommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const isTauri =
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

let browserToken = typeof window !== 'undefined' ? localStorage.getItem('mipaas_desktop_token') : null;
let browserUser = typeof window !== 'undefined' && localStorage.getItem('mipaas_desktop_user')
  ? JSON.parse(localStorage.getItem('mipaas_desktop_user')!)
  : null;
let browserServerUrl = typeof window !== 'undefined'
  ? localStorage.getItem('mipaas_server_url') || 'http://127.0.0.1:8080'
  : 'http://127.0.0.1:8080';
const pickedFilesMap = new Map<string, File>();

async function browserCall<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const server = browserServerUrl.replace(/\/+$/, '');
  const authHeaders: Record<string, string> = browserToken
    ? { Authorization: `Bearer ${browserToken}` }
    : {};

  switch (cmd) {
    case 'server_status': {
      try {
        const res = await fetch(`${server}/api/v1/health`, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        return {
          server_url: server,
          reachable: res.ok,
          version: data?.version || null,
        } as T;
      } catch {
        return {
          server_url: server,
          reachable: false,
          version: null,
        } as T;
      }
    }

    case 'set_server_url': {
      const url = (args.url as string) || 'http://127.0.0.1:8080';
      browserServerUrl = url.trim().replace(/\/+$/, '');
      if (typeof window !== 'undefined') {
        localStorage.setItem('mipaas_server_url', browserServerUrl);
      }
      return browserServerUrl as T;
    }

    case 'login': {
      const res = await fetch(`${server}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: args.identifier,
          password: args.password,
          client: 'desktop',
          mfa_code: args.mfaCode || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new CommandError(json?.error?.code || 'INVALID', json?.error?.message || json?.error || 'Sign-in failed.');
      }
      if (json.data?.mfa_required) {
        throw new CommandError('MFA_REQUIRED', 'Two-step verification required.');
      }
      const token = json.data?.token;
      const user = json.data?.user;
      if (!token || !user) {
        throw new CommandError('SERVER', 'Server returned invalid session.');
      }
      browserToken = token;
      browserUser = user;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mipaas_desktop_token', token);
        localStorage.setItem('mipaas_desktop_user', JSON.stringify(user));
      }
      return user as T;
    }

    case 'logout': {
      try {
        if (browserToken) {
          await fetch(`${server}/api/v1/auth/logout`, {
            method: 'POST',
            headers: authHeaders,
          });
        }
      } finally {
        browserToken = null;
        browserUser = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('mipaas_desktop_token');
          localStorage.removeItem('mipaas_desktop_user');
        }
      }
      return undefined as T;
    }

    case 'current_user': {
      return browserUser as T;
    }

    case 'list_analyzers': {
      const res = await fetch(`${server}/api/v1/doctor/analyzers`, { headers: authHeaders });
      const json = await res.json();
      return { analyzers: json.data?.analyzers || json.data || [] } as T;
    }

    case 'analyze_study': {
      const res = await fetch(`${server}/api/v1/doctor/studies/${args.id}/analyze`, {
        method: 'POST',
        headers: authHeaders,
      });
      const json = await res.json();
      return { study: json.data?.study || json.data } as T;
    }

    case 'analyze_waiting': {
      const res = await fetch(`${server}/api/v1/doctor/studies/analyze`, {
        method: 'POST',
        headers: authHeaders,
      });
      const json = await res.json();
      return json.data as T;
    }

    case 'summary': {
      const res = await fetch(`${server}/api/v1/doctor/summary`, { headers: authHeaders });
      const json = await res.json();
      return json.data as T;
    }

    case 'list_studies': {
      const q = new URLSearchParams();
      if (args.filter) q.set('filter', String(args.filter));
      if (args.query) q.set('q', String(args.query));
      const res = await fetch(`${server}/api/v1/doctor/studies?${q}`, { headers: authHeaders });
      const json = await res.json();
      return { studies: json.data?.studies || json.data || [] } as T;
    }

    case 'get_study': {
      const res = await fetch(`${server}/api/v1/doctor/studies/${args.id}`, { headers: authHeaders });
      const json = await res.json();
      return { study: json.data?.study || json.data } as T;
    }

    case 'update_study': {
      const res = await fetch(`${server}/api/v1/doctor/studies/${args.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(args.patch),
      });
      const json = await res.json();
      return { study: json.data?.study || json.data } as T;
    }

    case 'sign_study': {
      const res = await fetch(`${server}/api/v1/doctor/studies/${args.id}/sign`, {
        method: 'POST',
        headers: authHeaders,
      });
      const json = await res.json();
      return { study: json.data?.study || json.data } as T;
    }

    case 'delete_study': {
      await fetch(`${server}/api/v1/doctor/studies/${args.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      return undefined as T;
    }

    case 'study_image': {
      const res = await fetch(`${server}/api/v1/doctor/studies/${args.id}/image?kind=${args.kind}`, {
        headers: authHeaders,
      });
      const blob = await res.blob();
      return new Promise<T>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as T);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    case 'pick_study_file': {
      return new Promise<T>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.dcm,.dicom,.png,.jpg,.jpeg,.webp';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(null as T);
            return;
          }
          const id = 'f-' + Math.random().toString(36).slice(2, 10);
          pickedFilesMap.set(id, file);
          resolve({ id, name: file.name, size: file.size } as T);
        };
        input.click();
      });
    }

    case 'upload_study': {
      const file = pickedFilesMap.get(args.fileId as string);
      if (!file) throw new CommandError('INVALID', 'No file selected.');
      const fd = new FormData();
      fd.append('file', file);
      const fields = (args.fields as Record<string, string>) || {};
      for (const [k, v] of Object.entries(fields)) {
        if (v != null) fd.append(k, v);
      }
      const res = await fetch(`${server}/api/v1/doctor/studies`, {
        method: 'POST',
        headers: authHeaders,
        body: fd,
      });
      const json = await res.json();
      return { study: json.data?.study || json.data } as T;
    }

    case 'save_report': {
      const blob = new Blob([args.html as string], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (args.fileName as string) || 'report.html';
      a.click();
      return a.download as T;
    }

    case 'dashboard': {
      const res = await fetch(`${server}/api/v1/doctor/dashboard`, { headers: authHeaders });
      const json = await res.json();
      return json.data as T;
    }

    case 'doctor_profile': {
      const res = await fetch(`${server}/api/v1/doctor/profile`, { headers: authHeaders });
      const json = await res.json();
      return { user: json.data?.user || json.data } as T;
    }

    case 'list_patients': {
      const res = await fetch(`${server}/api/v1/doctor/patients?status=${args.status}`, { headers: authHeaders });
      const json = await res.json();
      return { patients: json.data?.patients || json.data || [] } as T;
    }

    case 'invite_patient': {
      const res = await fetch(`${server}/api/v1/doctor/patients/invite`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: args.email, message: args.message }),
      });
      const json = await res.json();
      return { link: json.data?.link || json.data } as T;
    }

    case 'respond_patient': {
      const res = await fetch(`${server}/api/v1/doctor/patients/${args.linkId}/respond`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: args.accept }),
      });
      const json = await res.json();
      return { link: json.data?.link || json.data } as T;
    }

    case 'end_patient_link': {
      const res = await fetch(`${server}/api/v1/doctor/patients/${args.linkId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const json = await res.json();
      return { link: json.data?.link || json.data } as T;
    }

    case 'patient_record': {
      const res = await fetch(`${server}/api/v1/doctor/patients/${args.linkId}/record?days=${args.days ?? 30}`, {
        headers: authHeaders,
      });
      const json = await res.json();
      return json.data as T;
    }

    case 'patient_xray_image': {
      const res = await fetch(`${server}/api/v1/doctor/patients/${args.linkId}/xrays/${args.xrayId}/image?kind=${args.kind}`, {
        headers: authHeaders,
      });
      const blob = await res.blob();
      return new Promise<T>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as T);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    case 'review_xray': {
      const res = await fetch(`${server}/api/v1/doctor/patients/${args.linkId}/xrays/${args.xrayId}/review`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          impression: args.impression,
          recommendation: args.recommendation,
          urgency: args.urgency,
        }),
      });
      const json = await res.json();
      return { review: json.data?.review || json.data } as T;
    }

    case 'save_patient_document': {
      const res = await fetch(`${server}/api/v1/doctor/patients/${args.linkId}/documents/${args.docId}/file`, {
        headers: authHeaders,
      });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (args.fileName as string) || 'document';
      a.click();
      return a.download as T;
    }

    case 'list_consults': {
      const res = await fetch(`${server}/api/v1/doctor/consults?status=${args.status || ''}`, { headers: authHeaders });
      const json = await res.json();
      return { consults: json.data?.consults || json.data || [] } as T;
    }

    case 'respond_consult': {
      const res = await fetch(`${server}/api/v1/doctor/consults/${args.id}/respond`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: args.action,
          scheduled_at: args.scheduledAt,
          note: args.note,
        }),
      });
      const json = await res.json();
      return { consult: json.data?.consult || json.data } as T;
    }

    case 'care_threads': {
      const res = await fetch(`${server}/api/v1/care/messages/threads`, { headers: authHeaders });
      const json = await res.json();
      return { threads: json.data?.threads || json.data || [] } as T;
    }

    case 'care_messages': {
      const q = args.after ? `?after=${encodeURIComponent(String(args.after))}` : '';
      const res = await fetch(`${server}/api/v1/care/messages/${args.linkId}${q}`, { headers: authHeaders });
      const json = await res.json();
      return json.data as T;
    }

    case 'send_care_message': {
      const res = await fetch(`${server}/api/v1/care/messages/${args.linkId}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: args.body }),
      });
      const json = await res.json();
      return { message: json.data?.message || json.data } as T;
    }

    case 'mark_thread_read': {
      const res = await fetch(`${server}/api/v1/care/messages/${args.linkId}/read`, {
        method: 'POST',
        headers: authHeaders,
      });
      const json = await res.json();
      return json.data as T;
    }

    case 'run_agent': {
      const res = await fetch(`${server}/api/v1/agents/${args.key}/run`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(args.params || {}),
      });
      const json = await res.json();
      return { run: json.data?.run || json.data } as T;
    }

    case 'agent_run': {
      const res = await fetch(`${server}/api/v1/agents/runs/${args.id}`, { headers: authHeaders });
      const json = await res.json();
      return { run: json.data?.run || json.data } as T;
    }

    case 'review_agent_run': {
      const res = await fetch(`${server}/api/v1/agents/runs/${args.id}/review`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: args.decision, final_text: args.finalText }),
      });
      const json = await res.json();
      return { run: json.data?.run || json.data } as T;
    }

    case 'notifications': {
      const res = await fetch(`${server}/api/v1/notifications`, { headers: authHeaders });
      const json = await res.json();
      return { notifications: json.data?.notifications || json.data || [], unread: json.data?.unread || 0 } as T;
    }

    case 'notification_badge': {
      const res = await fetch(`${server}/api/v1/notifications/badge`, { headers: authHeaders });
      const json = await res.json();
      return json.data as T;
    }

    case 'mark_notifications_read': {
      const res = await fetch(`${server}/api/v1/notifications/read`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: args.id }),
      });
      const json = await res.json();
      return json.data as T;
    }

    default:
      throw new CommandError('NOT_IMPLEMENTED', `Browser fallback does not implement '${cmd}'.`);
  }
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    return await browserCall<T>(cmd, args);
  }
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    if (err && typeof err === 'object' && 'message' in err) {
      const e = err as { code?: string; message: string };
      throw new CommandError(e.code ?? 'INTERNAL', e.message);
    }
    throw new CommandError('INTERNAL', typeof err === 'string' ? err : 'Something went wrong.');
  }
}

export const api = {
  serverStatus: () => call<ServerInfo>('server_status'),
  setServerUrl: (url: string) => call<string>('set_server_url', { url }),

  /** Rejects with code MFA_REQUIRED when the account needs a two-step code; call again with `mfaCode`. */
  login: (identifier: string, password: string, mfaCode?: string) =>
    call<Doctor>('login', { identifier, password, mfaCode: mfaCode || null }),
  logout: () => call<void>('logout'),
  currentUser: () => call<Doctor | null>('current_user'),

  analyzers: () => call<{ analyzers: Analyzer[] }>('list_analyzers'),
  analyzeStudy: (id: string) => call<{ study: Study }>('analyze_study', { id }),
  analyzeWaiting: () => call<AnalyzeWaitingResult>('analyze_waiting'),

  summary: () => call<Summary>('summary'),
  listStudies: (filter: Filter, query?: string) => call<{ studies: Study[] }>('list_studies', { filter, query: query || null }),
  getStudy: (id: string) => call<{ study: Study }>('get_study', { id }),
  updateStudy: (id: string, patch: PatientFields & { impression?: string; patient_link_id?: string }) =>
    call<{ study: Study }>('update_study', { id, patch }),
  signStudy: (id: string) => call<{ study: Study }>('sign_study', { id }),
  deleteStudy: (id: string) => call<void>('delete_study', { id }),
  studyImage: (id: string, kind: 'preview' | 'heatmap') => call<string>('study_image', { id, kind }),

  pickStudyFile: () => call<PickedFile | null>('pick_study_file'),
  uploadStudy: (fileId: string, fields: UploadFields) => call<{ study: Study }>('upload_study', { fileId, fields }),
  saveReport: (fileName: string, html: string) => call<string | null>('save_report', { fileName, html }),

  dashboard: () => call<Dashboard>('dashboard'),
  doctorProfile: () => call<{ user: Doctor }>('doctor_profile'),

  listPatients: (status: PatientFilter) => call<{ patients: CareLink[] }>('list_patients', { status }),
  invitePatient: (email: string, message?: string) => call<{ link: CareLink }>('invite_patient', { email, message: message || null }),
  respondPatient: (linkId: string, accept: boolean) => call<{ link: CareLink }>('respond_patient', { linkId, accept }),
  endPatientLink: (linkId: string) => call<{ link: CareLink }>('end_patient_link', { linkId }),
  patientRecord: (linkId: string, days = 30) => call<SharedRecord>('patient_record', { linkId, days }),
  patientXrayImage: (linkId: string, xrayId: string, kind: 'preview' | 'heatmap') => call<string>('patient_xray_image', { linkId, xrayId, kind }),
  reviewXray: (linkId: string, xrayId: string, review: { impression: string; recommendation?: string; urgency: XrayReview['urgency'] }) =>
    call<{ review: XrayReview }>('review_xray', {
      linkId,
      xrayId,
      impression: review.impression,
      recommendation: review.recommendation || null,
      urgency: review.urgency,
    }),
  /** Opens a native save dialog; resolves to the saved path, or null if cancelled. */
  savePatientDocument: (linkId: string, docId: string, fileName: string) =>
    call<string | null>('save_patient_document', { linkId, docId, fileName }),

  listConsults: (status: ConsultFilter) => call<{ consults: Consult[] }>('list_consults', { status }),
  respondConsult: (id: string, action: 'schedule' | 'decline' | 'complete', opts: { scheduledAt?: string; note?: string } = {}) =>
    call<{ consult: Consult }>('respond_consult', { id, action, scheduledAt: opts.scheduledAt || null, note: opts.note || null }),

  careThreads: () => call<{ threads: CareThread[] }>('care_threads'),
  careMessages: (linkId: string, after?: string) =>
    call<{ link: CareLink; messages: CareMessage[] }>('care_messages', { linkId, after: after || null }),
  sendCareMessage: (linkId: string, body: string) => call<{ message: CareMessage }>('send_care_message', { linkId, body }),
  markThreadRead: (linkId: string) => call<{ read: number }>('mark_thread_read', { linkId }),

  runAgent: <T>(key: 'consult_brief' | 'report_draft', params: Record<string, string>) =>
    call<{ run: AgentRun<T> }>('run_agent', { key, params }),
  agentRun: <T>(id: string) => call<{ run: AgentRun<T> }>('agent_run', { id }),
  reviewAgentRun: (id: string, decision: 'accepted' | 'edited' | 'discarded', finalText?: string) =>
    call<{ run: AgentRun<unknown> }>('review_agent_run', { id, decision, finalText: finalText || null }),

  notifications: () => call<{ notifications: AppNotification[]; unread: number }>('notifications'),
  notificationBadge: () => call<Badge>('notification_badge'),
  markNotificationsRead: (id?: string) => call<{ read: number }>('mark_notifications_read', { id: id || null }),
};

/** Starts an agent run and polls until it has finished. */
export async function runAgentToEnd<T>(key: 'consult_brief' | 'report_draft', params: Record<string, string>): Promise<AgentRun<T>> {
  let { run } = await api.runAgent<T>(key, params);
  let wait = 700;
  while (run.status === 'queued' || run.status === 'running') {
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 1.4, 2500);
    ({ run } = await api.agentRun<T>(run.id));
  }
  return run;
}
