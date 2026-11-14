import type { CareLink, CareScope, Consult, PatientFilter } from '../../api';

/** Turns a caught error into a message; returns '' when it already sent the doctor to sign-in. */
export type OnError = (err: unknown) => string;

/** A place in the app another screen (or a notification) can send the doctor to. */
export type Target =
  | { section: 'studies'; studyId?: string }
  | { section: 'patients'; linkId?: string; xrayId?: string; filter?: PatientFilter }
  | { section: 'inbox'; linkId?: string }
  | { section: 'consults' };

export const SCOPE_LABEL: Record<CareScope, string> = {
  profile: 'Profile',
  vitals: 'Vitals',
  medications: 'Medicines',
  documents: 'Records',
  xrays: 'X-rays',
};

export const MODE_LABEL: Record<Consult['mode'], string> = {
  video: 'Video call',
  in_person: 'In person',
  chat: 'Chat',
};

export const CONSULT_STATUS: Record<Consult['status'], { label: string; color: string; bg: string }> = {
  requested: { label: 'Requested', color: '#fab219', bg: 'rgba(250,178,25,0.13)' },
  scheduled: { label: 'Scheduled', color: '#0ca30c', bg: 'rgba(12,163,12,0.14)' },
  completed: { label: 'Completed', color: '#8a8e97', bg: 'rgba(255,255,255,0.06)' },
  declined: { label: 'Declined', color: '#8a8e97', bg: 'rgba(255,255,255,0.06)' },
  cancelled: { label: 'Cancelled by patient', color: '#8a8e97', bg: 'rgba(255,255,255,0.06)' },
};

export function patientName(link: Pick<CareLink, 'patient'>) {
  return link.patient?.name ?? 'Former member';
}

export function patientDemographics(link: Pick<CareLink, 'patient'>) {
  const p = link.patient;
  if (!p) return '';
  const sex = p.sex ? ({ female: 'F', male: 'M', other: 'O' }[p.sex] ?? p.sex) : null;
  return [p.age != null ? `${p.age}y` : null, sex].filter(Boolean).join(' · ');
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function ScopePills({ scopes }: { scopes: CareScope[] }) {
  return (
    <span className="row wrap" style={{ gap: 6 }}>
      {scopes.map((s) => (
        <span key={s} className="pill" style={{ color: 'var(--text-2)', background: 'var(--s2)' }}>
          {SCOPE_LABEL[s]}
        </span>
      ))}
    </span>
  );
}

/** Maps the web path the server attaches to a notification onto a screen of this app. */
export function targetForLink(link: string | null): Target | null {
  if (!link) return null;
  const [path, qs = ''] = link.split('?');
  const q = new URLSearchParams(qs);
  if (path === '/doctor/inbox') return { section: 'inbox', linkId: q.get('link') ?? undefined };
  if (path === '/doctor/consults') return { section: 'consults' };
  const m = /^\/doctor\/patients(?:\/([A-Za-z0-9-]+))?$/.exec(path ?? '');
  if (m) return { section: 'patients', linkId: m[1], xrayId: q.get('xray') ?? undefined };
  return null;
}

/** `datetime-local` value (local time) for an ISO timestamp. */
export function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
