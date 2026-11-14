import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, CommandError, type Badge, type Dashboard, type Doctor, type Filter, type Study, type Summary } from '../api';
import { SEVERITY, demographics, fmtWhen, pathologyName, patientLabel } from '../format';
import NewStudy from './NewStudy';
import StudyView from './StudyView';
import Consults from './care/Consults';
import Inbox from './care/Inbox';
import Notifications from './care/Notifications';
import Patients from './care/Patients';
import type { Target } from './care/common';
import { Icon, Logo, SeverityDot, SeverityIcon, useToast } from './ui';

type View = { kind: 'home' } | { kind: 'new' } | { kind: 'study'; id: string };

const SECTIONS: { key: Target['section']; label: string }[] = [
  { key: 'studies', label: 'Studies' },
  { key: 'patients', label: 'Patients' },
  { key: 'inbox', label: 'Messages' },
  { key: 'consults', label: 'Consultations' },
];

const BADGE_POLL_MS = 30_000;

const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'signed', label: 'Signed' },
  { key: 'pending', label: 'Waiting' },
];

/** Worklist sub-line for studies without an AI result. */
const STATUS_LABEL: Partial<Record<Study['status'], string>> = {
  processing: 'Analysing…',
  pending: 'Waiting for a model',
  failed: 'Analysis failed',
};

function initials(name: string) {
  return name
    .replace(/^dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export default function Workspace({ doctor, onSignedOut }: { doctor: Doctor; onSignedOut: (reason?: string) => void }) {
  const [view, setView] = useState<View>({ kind: 'home' });
  /** Which section is open, plus what to select in it. `nav.n` remounts the section on every jump. */
  const [nav, setNav] = useState<{ target: Target; n: number }>({ target: { section: 'studies' }, n: 0 });
  const [badge, setBadge] = useState<Badge>({ notifications: 0, messages: 0 });
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [studies, setStudies] = useState<Study[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [server, setServer] = useState<string>('');
  const toast = useToast();

  /** Session problems send the doctor back to sign-in; everything else is shown in place. */
  const handle = useCallback(
    (err: unknown): string => {
      if (err instanceof CommandError && (err.code === 'SESSION_EXPIRED' || err.code === 'NOT_SIGNED_IN')) {
        onSignedOut('Your session ended. Please sign in again.');
        return '';
      }
      return err instanceof CommandError ? err.message : 'Something went wrong.';
    },
    [onSignedOut],
  );

  const refresh = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([api.listStudies(filter, query), api.summary()]);
      setStudies(list.studies);
      setSummary(sum);
      setListError(null);
    } catch (err) {
      setListError(handle(err));
    }
  }, [filter, query, handle]);

  useEffect(() => {
    const t = window.setTimeout(() => void refresh(), query ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [refresh, query]);

  useEffect(() => {
    api.serverStatus().then((s) => setServer(s.server_url), () => undefined);
  }, []);

  const go = useCallback((target: Target) => {
    if (target.section === 'studies' && target.studyId) setView({ kind: 'study', id: target.studyId });
    setNav((prev) => ({ target, n: prev.n + 1 }));
  }, []);

  /** Unread counts for the top bar, and the "needs attention" numbers on the home screen. */
  const refreshCare = useCallback(async () => {
    try {
      const [b, d] = await Promise.all([api.notificationBadge(), api.dashboard()]);
      setBadge(b);
      setDash(d);
    } catch (err) {
      // A dropped connection just keeps the last counts; an ended session signs out.
      void handle(err);
    }
  }, [handle]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void refreshCare();
    };
    tick();
    const id = window.setInterval(tick, BADGE_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshCare]);

  // Automatic execution: once per sign-in, analyse studies that were saved while their
  // model was missing (or failed) as soon as the server reports the model is installed.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !summary || summary.pending + summary.failed === 0) return;
    autoRan.current = true;
    api.analyzeWaiting().then(
      (out) => {
        if (!out.attempted) return;
        const done = out.results.completed ?? 0;
        toast.show(done ? `Analysed ${done} waiting ${done === 1 ? 'study' : 'studies'}` : 'Waiting studies could not be analysed yet');
        void refresh();
      },
      (err) => void handle(err),
    );
  }, [summary, refresh, handle, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setView({ kind: 'new' });
        setNav((prev) => ({ target: { section: 'studies' }, n: prev.n + 1 }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function signOut() {
    await api.logout().catch(() => undefined);
    onSignedOut();
  }

  const counts = useMemo<Record<Filter, number | undefined>>(
    () => ({
      all: summary?.total,
      draft: summary?.drafts,
      urgent: summary ? (summary.by_severity.HIGH ?? 0) + (summary.by_severity.CRITICAL ?? 0) : undefined,
      signed: summary?.signed,
      pending: summary?.pending,
      failed: summary?.failed,
    }),
    [summary],
  );

  const section = nav.target.section;
  const sectionBadge: Record<Target['section'], number> = {
    studies: 0,
    patients: dash?.patients.pending_invites.length ?? 0,
    inbox: badge.messages,
    consults: dash?.consults.requested.length ?? 0,
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <Logo /> MIPAAS
        </span>
        <nav className="nav-seg" aria-label="Sections">
          {SECTIONS.map((s) => (
            <button key={s.key} aria-current={section === s.key ? 'page' : undefined} onClick={() => go({ section: s.key })}>
              {s.label}
              {sectionBadge[s.key] > 0 && <span className="badge">{sectionBadge[s.key]}</span>}
            </button>
          ))}
        </nav>
        <span className="spacer" />
        {server && (
          <span className="row muted" style={{ fontSize: 12 }}>
            <span className="dot" style={{ background: '#0ca30c' }} aria-hidden="true" />
            <span className="mono">{server}</span>
          </span>
        )}
        <Notifications count={badge.notifications} onError={handle} onChanged={() => void refreshCare()} onNavigate={go} />
        <span className="row" style={{ gap: 8 }}>
          <span className="avatar" aria-hidden="true">
            {initials(doctor.name)}
          </span>
          <span style={{ fontWeight: 500 }}>{doctor.name}</span>
        </span>
        <button className="btn btn-quiet btn-sm" onClick={signOut} title="Sign out">
          <Icon name="logout" /> Sign out
        </button>
      </header>

      <div className="body">
        {nav.target.section === 'patients' ? (
          <Patients
            key={nav.n}
            initial={nav.target}
            onError={handle}
            toast={toast.show}
            onMessage={(linkId) => go({ section: 'inbox', linkId })}
            onOpenStudy={(studyId) => go({ section: 'studies', studyId })}
            onChanged={() => void refreshCare()}
          />
        ) : nav.target.section === 'inbox' ? (
          <Inbox
            key={nav.n}
            initialLinkId={nav.target.linkId}
            onError={handle}
            onChanged={() => void refreshCare()}
            onOpenRecord={(linkId) => go({ section: 'patients', linkId })}
          />
        ) : nav.target.section === 'consults' ? (
          <Consults
            key={nav.n}
            onError={handle}
            toast={toast.show}
            onChanged={() => void refreshCare()}
            onOpenRecord={(linkId) => go({ section: 'patients', linkId })}
            onMessage={(linkId) => go({ section: 'inbox', linkId })}
          />
        ) : (
          <>
        <nav className="rail" aria-label="Worklist">
          <div className="rail-head">
            <button className="btn btn-light" onClick={() => setView({ kind: 'new' })} title="New study (Ctrl+N)">
              <Icon name="plus" /> New study
            </button>
            <div className="tabs tabs-5" role="tablist" aria-label="Filter studies">
              {TABS.map((t) => (
                <button key={t.key} className="tab" role="tab" aria-selected={filter === t.key} onClick={() => setFilter(t.key)}>
                  {t.label}
                  {counts[t.key] != null && <span className="count tnum">{counts[t.key]}</span>}
                </button>
              ))}
            </div>
            <label className="row" style={{ position: 'relative' }}>
              <span className="sr-only">Search patient, ID or file</span>
              <span style={{ position: 'absolute', left: 10, color: 'var(--muted)', display: 'flex' }}>
                <Icon name="search" />
              </span>
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Search patient, ID or file" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          <div className="worklist">
            {listError ? (
              <div className="empty">
                <div className="alert alert-error">{listError}</div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => void refresh()}>
                  <Icon name="refresh" /> Retry
                </button>
              </div>
            ) : studies == null ? (
              <p className="empty">Loading…</p>
            ) : studies.length === 0 ? (
              <p className="empty">{query || filter !== 'all' ? 'No studies match.' : 'No studies yet. Upload a study to start.'}</p>
            ) : (
              studies.map((s) => (
                <button
                  key={s.id}
                  className="wl-item"
                  aria-current={view.kind === 'study' && view.id === s.id ? 'true' : undefined}
                  onClick={() => setView({ kind: 'study', id: s.id })}
                >
                  <span className="wl-thumb" style={{ background: s.severity ? SEVERITY[s.severity].bg : 'var(--s2)' }}>
                    <SeverityDot severity={s.severity} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="wl-title truncate" style={{ display: 'block' }}>
                      {patientLabel(s)}
                    </span>
                    <span className="wl-sub truncate" style={{ display: 'block' }}>
                      {[demographics(s), STATUS_LABEL[s.status] ?? (s.primary_finding ? pathologyName(s.primary_finding) : null)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="wl-side">
                    <span className="tnum">{fmtWhen(s.created_at)}</span>
                    {s.report_status === 'signed' ? (
                      <span className="pill" style={{ color: '#0ca30c', background: 'rgba(12,163,12,0.12)', height: 18 }}>
                        Signed
                      </span>
                    ) : (
                      <span className="pill" style={{ color: 'var(--muted)', background: 'var(--s2)', height: 18 }}>
                        Draft
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </nav>

        <main className="main">
          {view.kind === 'new' ? (
            <NewStudy
              onCancel={() => setView({ kind: 'home' })}
              onCreated={(s) => {
                void refresh();
                setView({ kind: 'study', id: s.id });
              }}
              onError={handle}
            />
          ) : view.kind === 'study' ? (
            <StudyView
              key={view.id}
              id={view.id}
              doctor={doctor}
              onError={handle}
              onChanged={() => void refresh()}
              onDeleted={() => {
                void refresh();
                setView({ kind: 'home' });
                toast.show('Study deleted');
              }}
              toast={toast.show}
            />
          ) : (
            <Home
              summary={summary}
              dash={dash}
              unreadMessages={badge.messages}
              doctor={doctor}
              filter={filter}
              onNew={() => setView({ kind: 'new' })}
              onFilter={setFilter}
              onGo={go}
            />
          )}
        </main>
          </>
        )}
      </div>
      {toast.node}
    </div>
  );
}

function Home({
  summary,
  dash,
  unreadMessages,
  doctor,
  filter,
  onNew,
  onFilter,
  onGo,
}: {
  summary: Summary | null;
  dash: Dashboard | null;
  unreadMessages: number;
  doctor: Doctor;
  filter: Filter;
  onNew: () => void;
  onFilter: (f: Filter) => void;
  onGo: (target: Target) => void;
}) {
  const attention: { n: number; label: string; target: Target }[] = dash
    ? [
        { n: dash.patients.pending_invites.length, label: 'patient connection requests', target: { section: 'patients', filter: 'pending' } as Target },
        { n: dash.consults.requested.length, label: 'consultation requests', target: { section: 'consults' } as Target },
        { n: unreadMessages, label: 'unread messages', target: { section: 'inbox' } as Target },
      ].filter((a) => a.n > 0)
    : [];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="main-inner stack" style={{ gap: 20 }}>
      <div>
        <h1 className="page-title">
          {greet}, {doctor.name}
        </h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
      </div>
      <div className="stats" role="group" aria-label="Filter the worklist">
        {(
          [
            { key: 'all', label: 'Studies', n: summary?.total },
            { key: 'draft', label: 'To report', n: summary?.drafts },
            { key: 'urgent', label: 'Urgent, not yet signed', n: summary?.urgent_unsigned, alert: true },
            { key: 'signed', label: 'Signed', n: summary?.signed },
          ] as { key: Filter; label: string; n: number | undefined; alert?: boolean }[]
        ).map((s) => (
          <button key={s.key} className="stat" aria-pressed={filter === s.key} onClick={() => onFilter(s.key)}>
            <span className="muted">{s.label}</span>
            <span className="v tnum" style={{ display: 'block', color: s.alert && s.n ? SEVERITY.CRITICAL.color : undefined }}>
              {s.n ?? '—'}
            </span>
            <span className="go">{filter === s.key ? 'Shown in the worklist' : 'Show in the worklist'}</span>
          </button>
        ))}
      </div>

      {dash && (
        <div className="card">
          <h2>Your patients</h2>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onGo({ section: 'patients' })}>
              <span className="tnum" style={{ fontWeight: 600 }}>
                {dash.patients.active}
              </span>
              connected
            </button>
            {attention.map((a) => (
              <button key={a.label} className="btn btn-ghost btn-sm" onClick={() => onGo(a.target)}>
                <span className="badge badge-alert">{a.n}</span>
                {a.label}
              </button>
            ))}
            {dash.consults.upcoming.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => onGo({ section: 'consults' })}>
                <span className="tnum" style={{ fontWeight: 600 }}>
                  {dash.consults.upcoming.length}
                </span>
                upcoming consultations
              </button>
            )}
          </div>
        </div>
      )}

      {summary && summary.total > 0 && (
        <div className="card">
          <h2>AI triage of your studies</h2>
          <div className="stack" style={{ gap: 10 }}>
            {(Object.keys(SEVERITY) as (keyof typeof SEVERITY)[]).map((k) => {
              const n = summary.by_severity[k] ?? 0;
              const max = Math.max(1, ...Object.values(summary.by_severity).map((v) => v ?? 0));
              return (
                <div key={k} className="bar-row">
                  <div className="top">
                    <span className="row" style={{ gap: 6 }}>
                      <span style={{ color: SEVERITY[k].color, display: 'flex' }}>
                        <SeverityIcon severity={k} />
                      </span>
                      {SEVERITY[k].label}
                    </span>
                    <span className="tnum">{n}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(n / max) * 100}%`, minWidth: n ? 4 : 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card row wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0 }}>Review a new study</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            DICOM, PNG, JPG or WEBP. The matching model analyses it automatically; you write and sign the report.
          </p>
        </div>
        <button className="btn btn-light" onClick={onNew}>
          <Icon name="plus" /> New study
          <kbd className="kbd">Ctrl N</kbd>
        </button>
      </div>
    </div>
  );
}
