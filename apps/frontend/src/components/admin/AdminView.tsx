'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth/SessionProvider';
import { ROLE_DEFINITIONS, asRole, type Role } from '@/lib/auth/roles';
import { adminApi, type AdminUser, type AuditEvent, type OutboxEmail, type Paged, type PendingDoctor } from '@/lib/admin/api';
import { HomeLogoMark } from '@/components/home/HomeNav';
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  PageHeader,
  SelectInput,
  Skeleton,
  Tabs,
  TextArea,
  TextInput,
  cx,
  useErrorText,
  useLoader,
  useToast,
} from '@/components/patient/ui';

/**
 * Administration console (English only, like the other staff tools).
 * The backend enforces `users:manage` / `audit:read` on every call; this only decides what to show.
 */

const TABS = [
  { key: 'overview', label: 'Overview', permission: 'users:manage' },
  { key: 'doctors', label: 'Doctor verification', permission: 'users:manage' },
  { key: 'users', label: 'Users', permission: 'users:manage' },
  { key: 'audit', label: 'Audit log', permission: 'audit:read' },
  { key: 'agents', label: 'AI agents', permission: 'users:manage' },
  { key: 'outbox', label: 'E-mail', permission: 'users:manage' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const ROLES = (Object.keys(ROLE_DEFINITIONS) as Role[]).filter((r) => r !== 'guest');
const roleLabel = (role: string) => (role === 'doctor_pending' ? 'Doctor (unverified)' : ROLE_DEFINITIONS[asRole(role)].title);

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const fmt = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—');

function Tag({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'off'; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium',
        tone === 'ok' && 'bg-emerald-400/10 text-emerald-300',
        tone === 'warn' && 'bg-amber-300/10 text-amber-200',
        tone === 'bad' && 'bg-rose-500/10 text-rose-300',
        tone === 'off' && 'bg-white/[0.06] text-[var(--h-muted)]',
      )}
    >
      {children}
    </span>
  );
}

function Pager({ data, onPage }: { data: Paged; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[14px] text-[var(--h-muted)]">
      <span>
        {data.total === 0 ? 'No results' : `${(data.page - 1) * data.page_size + 1}–${Math.min(data.page * data.page_size, data.total)} of ${data.total}`}
      </span>
      <span className="flex items-center gap-2">
        <Button tone="ghost" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
          Previous
        </Button>
        <span className="tabular-nums">
          Page {data.page} of {pages}
        </span>
        <Button tone="ghost" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>
          Next
        </Button>
      </span>
    </div>
  );
}

const th = 'whitespace-nowrap border-b border-[var(--h-hairline)] px-3 py-2.5 text-left text-[13px] font-medium text-[var(--h-muted)]';
const td = 'border-b border-[var(--h-hairline)] px-3 py-3 align-top text-[14px] text-[var(--h-text-2)]';

/* ---------------------------------------------------------------- overview */

function Stat({ label, value, note, alert }: { label: string; value: number; note?: string; alert?: boolean }) {
  return (
    <div className="h-card rounded-2xl p-5">
      <p className="text-[14px] text-[var(--h-muted)]">{label}</p>
      <p className={cx('mt-1 text-[32px] font-medium tabular-nums tracking-[-0.02em]', alert && value > 0 ? 'text-amber-200' : 'text-[var(--h-text)]')}>
        {new Intl.NumberFormat('en-IN').format(value)}
      </p>
      {note && <p className="mt-1 text-[13px] text-[var(--h-muted)]">{note}</p>}
    </div>
  );
}

function OverviewTab({ go }: { go: (tab: Tab) => void }) {
  const { data, error, reload } = useLoader(() => adminApi.overview(), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-64" />;

  const roles = Object.entries(data.users.by_role).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-5">
      {data.doctors.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3">
          <p className="text-[15px] text-amber-100">
            {data.doctors.pending} {data.doctors.pending === 1 ? 'doctor is' : 'doctors are'} waiting for licence verification.
          </p>
          <Button tone="ghost" onClick={() => go('doctors')}>
            Review
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Accounts" value={data.users.total} note={`${data.users.new_7d} new in the last 7 days`} />
        <Stat label="Verified doctors" value={data.doctors.verified} note={`${data.doctors.pending} awaiting verification`} />
        <Stat label="Active care connections" value={data.care.links_active} note={`${data.care.links_pending} ${data.care.links_pending === 1 ? 'invitation' : 'invitations'} pending`} />
        <Stat label="Open consultations" value={data.care.consults_open} />
        <Stat label="Patient X-ray screenings" value={data.imaging.patient_xrays} note={`${data.imaging.patient_xrays_7d} in the last 7 days`} />
        <Stat label="Doctor studies" value={data.imaging.doctor_studies} note={`${data.imaging.signed_reports} signed reports`} />
        <Stat label="Audit events, last 24 h" value={data.audit.events_24h} note={`${data.audit.denied_24h} failed or denied`} />
        <Stat label="E-mails that failed to send" value={data.mail.failed} note={`${data.mail.queued} queued`} alert />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Accounts by role">
          <ul className="divide-y divide-[var(--h-hairline)]">
            {roles.map(([role, n]) => (
              <li key={role} className="flex items-center justify-between py-2.5 text-[15px]">
                <span className="text-[var(--h-text-2)]">{roleLabel(role)}</span>
                <span className="tabular-nums text-[var(--h-text)]">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Account security">
          <ul className="divide-y divide-[var(--h-hairline)]">
            <li className="flex items-center justify-between py-2.5 text-[15px]">
              <span className="text-[var(--h-text-2)]">Two-step verification on</span>
              <span className="tabular-nums text-[var(--h-text)]">
                {data.users.mfa_enabled} of {data.users.total}
              </span>
            </li>
            <li className="flex items-center justify-between py-2.5 text-[15px]">
              <span className="text-[var(--h-text-2)]">E-mail not confirmed</span>
              <span className="tabular-nums text-[var(--h-text)]">{data.users.unverified_email}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- doctors */

function DoctorCard({ doctor, onDone }: { doctor: PendingDoctor; onDone: (msg: string) => void }) {
  const errText = useErrorText();
  const [mode, setMode] = useState<'idle' | 'verify' | 'reject'>('idle');
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = doctor.clinician;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'reject' && text.trim().length < 3) {
      setError('Give the applicant a reason.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (mode === 'verify') await adminApi.verifyDoctor(doctor.id, text.trim() || undefined);
      else await adminApi.rejectDoctor(doctor.id, text.trim());
      onDone(mode === 'verify' ? `${doctor.name} verified` : `${doctor.name} was told why verification failed`);
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  return (
    <Card as="article">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[18px] font-medium text-[var(--h-text)]">{doctor.name}</p>
          <p className="mt-0.5 truncate text-[14px] text-[var(--h-muted)]">{doctor.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c?.rejected && <Tag tone="bad">Rejected before</Tag>}
          <Tag tone={doctor.email_verified ? 'ok' : 'warn'}>{doctor.email_verified ? 'E-mail confirmed' : 'E-mail not confirmed'}</Tag>
        </div>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-[var(--h-muted)]">Medical registration number</dt>
          <dd className="mt-0.5 break-all font-mono text-[var(--h-text)]">{c?.license_number || '—'}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-[var(--h-muted)]">Specialty</dt>
          <dd className="mt-0.5 text-[var(--h-text)]">{c?.specialty || '—'}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-[var(--h-muted)]">Hospital or clinic</dt>
          <dd className="mt-0.5 text-[var(--h-text)]">{doctor.organization || '—'}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-[var(--h-muted)]">Registered</dt>
          <dd className="mt-0.5 text-[var(--h-text)]">{fmt(doctor.created_at)}</dd>
        </div>
      </dl>
      {c?.rejected && c.rejection_reason && (
        <p className="mt-4 rounded-xl bg-white/[0.04] px-4 py-3 text-[14px] leading-[20px] text-[var(--h-text-2)]">
          <span className="block text-[12px] text-[var(--h-muted)]">Earlier rejection reason</span>
          {c.rejection_reason}
        </p>
      )}

      {mode === 'idle' ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setMode('verify')}>Verify</Button>
          <Button tone="danger" onClick={() => setMode('reject')}>
            Reject
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          {error && (
            <p role="alert" className="text-[14px] text-rose-300">
              {error}
            </p>
          )}
          <TextArea
            label={mode === 'verify' ? 'Note for the record' : 'Reason shown to the applicant'}
            hint={mode === 'verify' ? 'Optional, e.g. where you checked the registration' : 'Required'}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-[13px] leading-[19px] text-[var(--h-muted)]">
            {mode === 'verify'
              ? 'Verifying unlocks clinical tools for this account and issues their patient share code. Check the number against the medical council register first.'
              : 'The applicant is notified with this reason and can resubmit their details.'}
          </p>
          <div className="flex gap-2">
            <Button type="submit" pending={pending} tone={mode === 'verify' ? 'light' : 'danger'}>
              {mode === 'verify' ? 'Confirm verification' : 'Send rejection'}
            </Button>
            <Button
              tone="ghost"
              onClick={() => {
                setMode('idle');
                setText('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function DoctorsTab({ toast }: { toast: (m: string) => void }) {
  const { data, error, reload } = useLoader(() => adminApi.pendingDoctors(), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-56" />;
  if (data.doctors.length === 0) return <Empty>No doctors are waiting for verification.</Empty>;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {data.doctors.map((d) => (
        <DoctorCard
          key={d.id}
          doctor={d}
          onDone={(msg) => {
            toast(msg);
            void reload();
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- users */

function UserRow({ user, self, onChanged }: { user: AdminUser; self: boolean; onChanged: (msg: string) => void }) {
  const errText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(change: Parameters<typeof adminApi.updateUser>[1], question: string, done: string) {
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.updateUser(user.id, change);
      onChanged(done);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={cx(!user.is_active && 'opacity-60')}>
      <td className={cx(td, 'min-w-[230px]')}>
        <span className="block font-medium text-[var(--h-text)]">
          {user.name} {self && <span className="font-normal text-[var(--h-muted)]">(you)</span>}
        </span>
        <span className="block break-all text-[13px] text-[var(--h-muted)]">{user.email}</span>
        {error && (
          <span role="alert" className="mt-1 block text-[13px] text-rose-300">
            {error}
          </span>
        )}
      </td>
      <td className={td}>
        <label className="sr-only" htmlFor={`role-${user.id}`}>
          Role for {user.name}
        </label>
        <select
          id={`role-${user.id}`}
          value={user.role}
          disabled={busy || self}
          onChange={(e) =>
            patch(
              { role: e.target.value },
              `Change ${user.name} from ${roleLabel(user.role)} to ${roleLabel(e.target.value)}? They are signed out everywhere.`,
              'Role changed',
            )
          }
          className="h-9 max-w-[200px] cursor-pointer rounded-lg border border-[var(--h-border)] bg-[var(--h-surface-2)] px-2 text-[14px] text-[var(--h-text)] disabled:cursor-not-allowed"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </td>
      <td className={td}>
        <span className="flex flex-wrap gap-1.5">
          <Tag tone={user.is_active ? 'ok' : 'off'}>{user.is_active ? 'Active' : 'Deactivated'}</Tag>
          {!user.email_verified && <Tag tone="warn">E-mail not confirmed</Tag>}
          {user.mfa_enabled && <Tag tone="off">Two-step on</Tag>}
        </span>
      </td>
      <td className={cx(td, 'whitespace-nowrap')}>{fmt(user.last_login_at)}</td>
      <td className={cx(td, 'whitespace-nowrap text-right')}>
        {!user.email_verified && (
          <Button
            tone="ghost"
            className="!h-9 !px-3 !text-[13px]"
            disabled={busy}
            onClick={() => patch({ email_verified: true }, `Mark ${user.email} as confirmed without the e-mail link?`, 'E-mail marked as confirmed')}
          >
            Confirm e-mail
          </Button>
        )}
        {!self && (
          <Button
            tone={user.is_active ? 'danger' : 'ghost'}
            className="!h-9 !px-3 !text-[13px]"
            disabled={busy}
            onClick={() =>
              user.is_active
                ? patch({ is_active: false }, `Deactivate ${user.name}? They are signed out and can't sign in again until reactivated.`, 'Account deactivated')
                : patch({ is_active: true }, `Reactivate ${user.name}?`, 'Account reactivated')
            }
          >
            {user.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
        )}
      </td>
    </tr>
  );
}

function UsersTab({ toast, selfId }: { toast: (m: string) => void; selfId: string }) {
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLoader(() => adminApi.users({ q, role, page }), [q, role, page]);

  return (
    <div>
      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(draft.trim());
          setPage(1);
        }}
      >
        <TextInput className="min-w-[240px] flex-1" label="Search" placeholder="Name, e-mail, username or hospital" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <SelectInput
          className="w-[220px]"
          label="Role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </SelectInput>
        <Button type="submit" tone="ghost">
          Search
        </Button>
      </form>

      {error && !data ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div aria-busy={loading}>
          <div className="h-card overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Account</th>
                  <th className={th}>Role</th>
                  <th className={th}>Status</th>
                  <th className={th}>Last sign-in</th>
                  <th className={cx(th, 'text-right')}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <UserRow
                    key={`${u.id}:${u.role}:${u.is_active}:${u.email_verified}`}
                    user={u}
                    self={u.id === selfId}
                    onChanged={(msg) => {
                      toast(msg);
                      void reload();
                    }}
                  />
                ))}
              </tbody>
            </table>
            {data.users.length === 0 && <p className="px-4 py-6 text-[15px] text-[var(--h-muted)]">No accounts match.</p>}
          </div>
          <Pager data={data} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- audit */

function AuditRow({ e }: { e: AuditEvent }) {
  const ok = e.status === 'success';
  return (
    <tr>
      <td className={cx(td, 'whitespace-nowrap')}>{fmt(e.timestamp)}</td>
      <td className={cx(td, 'min-w-[180px]')}>
        <span className="break-all">{e.username || '—'}</span>
      </td>
      <td className={cx(td, 'font-mono text-[13px]')}>{e.action}</td>
      <td className={td}>
        <Tag tone={ok ? 'ok' : e.status === 'denied' ? 'warn' : 'bad'}>{e.status}</Tag>
      </td>
      <td className={cx(td, 'text-[13px]')}>
        {[e.resource_type, e.resource_id ? e.resource_id.slice(0, 8) : null].filter(Boolean).join(' ') || '—'}
        {e.details && <span className="mt-0.5 block break-all font-mono text-[12px] text-[var(--h-muted)]">{JSON.stringify(e.details)}</span>}
      </td>
      <td className={cx(td, 'whitespace-nowrap font-mono text-[13px]')}>{e.ip_address || '—'}</td>
    </tr>
  );
}

function AuditTab() {
  const [draft, setDraft] = useState({ action: '', user: '' });
  const [filters, setFilters] = useState({ action: '', user: '', status: '' });
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLoader(() => adminApi.audit({ ...filters, page }), [filters, page]);

  return (
    <div>
      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters((f) => ({ ...f, action: draft.action.trim(), user: draft.user.trim() }));
          setPage(1);
        }}
      >
        <TextInput
          className="min-w-[200px] flex-1"
          label="Action starts with"
          placeholder="auth.login, care., admin."
          value={draft.action}
          onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
        />
        <TextInput className="min-w-[200px] flex-1" label="User" placeholder="Username or e-mail" value={draft.user} onChange={(e) => setDraft((d) => ({ ...d, user: e.target.value }))} />
        <SelectInput
          className="w-[180px]"
          label="Outcome"
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Any</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="denied">Denied</option>
        </SelectInput>
        <Button type="submit" tone="ghost">
          Filter
        </Button>
      </form>

      {error && !data ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div aria-busy={loading}>
          <div className="h-card overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>User</th>
                  <th className={th}>Action</th>
                  <th className={th}>Outcome</th>
                  <th className={th}>Resource and details</th>
                  <th className={th}>IP address</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <AuditRow key={e.id} e={e} />
                ))}
              </tbody>
            </table>
            {data.events.length === 0 && <p className="px-4 py-6 text-[15px] text-[var(--h-muted)]">No events match.</p>}
          </div>
          <Pager data={data} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ agents */

const pctOf = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');

function AgentsTab() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useLoader(() => adminApi.agents(days), [days]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SelectInput className="w-[200px]" label="Period" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </SelectInput>
        {data && (
          <p className="max-w-[640px] text-[13px] leading-[19px] text-[var(--h-muted)]">
            {data.service_configured ? 'Agents service connected.' : 'AGENTS_URL is not set: only the health assistant can run.'}{' '}
            {data.consented_patients} {data.consented_patients === 1 ? 'patient has' : 'patients have'} allowed AI processing. “Reviewed” counts
            what people did with a result: kept it as it was, edited it, or threw it away.
          </p>
        )}
      </div>
      {error && !data ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-56" />
      ) : (
        <div aria-busy={loading} className="h-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Agent</th>
                <th className={cx(th, 'text-right')}>Runs</th>
                <th className={cx(th, 'text-right')}>Failed</th>
                <th className={cx(th, 'text-right')}>Used an AI model</th>
                <th className={cx(th, 'text-right')}>Text withheld</th>
                <th className={cx(th, 'text-right')}>Kept as is</th>
                <th className={cx(th, 'text-right')}>Edited</th>
                <th className={cx(th, 'text-right')}>Discarded</th>
                <th className={cx(th, 'text-right')}>Median time</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => {
                const reviewed = a.accepted + a.edited + a.discarded;
                return (
                  <tr key={a.key}>
                    <td className={cx(td, 'min-w-[220px]')}>
                      <span className="block font-medium text-[var(--h-text)]">{a.title}</span>
                      <span className="mt-0.5 flex flex-wrap gap-1.5 text-[13px] text-[var(--h-muted)]">
                        <span className="font-mono">{a.key}</span>· for {a.audience}s
                        {!a.enabled && <Tag tone="off">Switched off</Tag>}
                      </span>
                    </td>
                    <td className={cx(td, 'text-right tabular-nums')}>{a.runs}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{a.failed ? <Tag tone="bad">{a.failed}</Tag> : 0}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{pctOf(a.llm_used, a.runs)}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{a.withheld ? <Tag tone="warn">{a.withheld}</Tag> : 0}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{reviewed ? `${a.accepted} (${pctOf(a.accepted, reviewed)})` : '—'}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{reviewed ? a.edited : '—'}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{reviewed ? a.discarded : '—'}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{a.median_ms != null ? `${(a.median_ms / 1000).toFixed(1)} s` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ outbox */

const MAIL_TONE: Record<OutboxEmail['status'], 'ok' | 'warn' | 'bad' | 'off'> = { sent: 'ok', queued: 'warn', failed: 'bad', outbox: 'off' };
const MAIL_LABEL: Record<OutboxEmail['status'], string> = { sent: 'Sent', queued: 'Queued', failed: 'Failed', outbox: 'Stored, not sent' };

function OutboxTab() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoader(() => adminApi.outbox({ status, page }), [status, page]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SelectInput
          className="w-[220px]"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="outbox">Stored, not sent</option>
          <option value="sent">Sent</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
        </SelectInput>
        {data && (
          <p className="max-w-[560px] text-[13px] leading-[19px] text-[var(--h-muted)]">
            {data.bodies_visible
              ? 'This server stores e-mails instead of delivering them, so their text is readable here. It includes sign-in links: treat it as a development inbox.'
              : 'This server delivers e-mail by SMTP. Message text is hidden because it contains other people’s sign-in links.'}
          </p>
        )}
      </div>

      {error && !data ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-64" />
      ) : data.emails.length === 0 ? (
        <Empty>No e-mails match.</Empty>
      ) : (
        <div aria-busy={loading}>
          <ul className="h-card divide-y divide-[var(--h-hairline)] rounded-2xl">
            {data.emails.map((m) => {
              const expanded = open === m.id;
              return (
                <li key={m.id} className="px-4 py-3">
                  <button
                    type="button"
                    disabled={!m.text}
                    aria-expanded={m.text ? expanded : undefined}
                    onClick={() => setOpen(expanded ? null : m.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 text-left disabled:cursor-default"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-[var(--h-text)]">{m.subject}</span>
                      <span className="block truncate text-[13px] text-[var(--h-muted)]">
                        To {m.to} · {fmt(m.created_at)}
                        {m.kind ? ` · ${m.kind}` : ''}
                      </span>
                    </span>
                    <Tag tone={MAIL_TONE[m.status] ?? 'off'}>{MAIL_LABEL[m.status] ?? m.status}</Tag>
                  </button>
                  {m.error && <p className="mt-2 break-words text-[13px] text-rose-300">{m.error}</p>}
                  {expanded && m.text && (
                    <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--h-surface-2)] p-4 font-mono text-[13px] leading-[20px] text-[var(--h-text-2)]">
                      {m.text}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
          <Pager data={data} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- view */

export default function AdminView() {
  const { status, user, signOut } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);

  const allowed = TABS.filter((t) => user?.permissions.includes(t.permission));
  const canEnter = status === 'authenticated' && allowed.length > 0;

  useEffect(() => {
    if (leaving) return;
    if (status === 'anonymous') router.replace('/login?next=/admin');
    else if (status === 'authenticated' && user && !canEnter) router.replace(user.home === '/admin' ? '/account' : user.home);
  }, [status, user, canEnter, router, leaving]);

  if (!canEnter || !user) return <div className="home-root min-h-[100svh]" aria-busy="true" />;

  const raw = params.get('tab');
  const tab: Tab = allowed.find((t) => t.key === raw)?.key ?? allowed[0].key;
  const go = (next: Tab) => router.replace(`/admin?tab=${next}`, { scroll: false });

  return (
    <div className="home-root h-ambient min-h-[100svh]">
      <header className="sticky top-0 z-30 border-b border-[var(--h-hairline)] bg-[var(--h-page)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-[var(--h-text)]" aria-label="MIPAAS home">
            <HomeLogoMark className="h-[18px] w-[18px]" />
            <span className="text-[18px] font-medium tracking-[-0.02em]">MIPAAS</span>
            <span className="h-label ml-2 hidden text-[12px] text-[var(--h-muted)] sm:inline">Administration</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/account" className="hidden max-w-[240px] truncate rounded-lg px-3 py-2 text-[14px] text-[var(--h-muted)] hover:bg-white/[0.06] hover:text-white sm:block">
              {user.name}
            </Link>
            <Button
              tone="ghost"
              pending={leaving}
              onClick={async () => {
                setLeaving(true);
                await signOut();
                router.replace('/');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="h-stagger mx-auto w-full max-w-[1320px] space-y-6 px-4 pb-24 pt-8 sm:px-8">
        <PageHeader title="Administration" subtitle="Verify doctors, manage accounts and review what happened on the platform." />
        <Tabs label="Administration sections" value={tab} onChange={go} tabs={allowed.map((t) => ({ key: t.key, label: t.label }))} />
        <div role="tabpanel">
          {tab === 'overview' && <OverviewTab go={go} />}
          {tab === 'doctors' && <DoctorsTab toast={toast.show} />}
          {tab === 'users' && <UsersTab toast={toast.show} selfId={user.id} />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'agents' && <AgentsTab />}
          {tab === 'outbox' && <OutboxTab />}
        </div>
      </main>
      {toast.node}
    </div>
  );
}
