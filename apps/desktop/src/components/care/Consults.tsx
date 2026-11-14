import { useCallback, useEffect, useState } from 'react';
import { api, type Consult, type ConsultFilter } from '../../api';
import { fmtDate, fmtDateTime } from '../../format';
import { Icon, Spinner } from '../ui';
import BriefPanel from './BriefPanel';
import { CONSULT_STATUS, MODE_LABEL, initials, toLocalInput, type OnError } from './common';

const TABS: { key: ConsultFilter; label: string }[] = [
  { key: 'requested', label: 'Requests' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
];

function StatusPill({ status }: { status: Consult['status'] }) {
  const s = CONSULT_STATUS[status];
  return (
    <span className="pill" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function ConsultDetail({
  consult,
  onError,
  onDone,
  onOpenRecord,
  onMessage,
}: {
  consult: Consult;
  onError: OnError;
  onDone: (msg: string) => void;
  onOpenRecord: (linkId: string) => void;
  onMessage: (linkId: string) => void;
}) {
  const [when, setWhen] = useState(toLocalInput(consult.scheduled_at ?? consult.preferred_at));
  const [note, setNote] = useState(consult.doctor_note ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = consult.status === 'requested' || consult.status === 'scheduled';

  async function run(action: 'schedule' | 'decline' | 'complete', msg: string) {
    if (action === 'schedule' && !when) {
      setError('Pick a date and time.');
      return;
    }
    setBusy(action);
    setError(null);
    try {
      await api.respondConsult(consult.id, action, {
        // The input is local time; the server stores an absolute instant.
        scheduledAt: action === 'schedule' ? new Date(when).toISOString() : undefined,
        note,
      });
      onDone(msg);
    } catch (err) {
      setError(onError(err) || null);
      setBusy(null);
    }
  }

  return (
    <div className="main-inner stack" style={{ gap: 16, maxWidth: 820 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="label">Consultation · {MODE_LABEL[consult.mode]}</p>
          <h1 className="page-title selectable" style={{ marginTop: 8 }}>
            {consult.patient.name}
          </h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Requested {fmtDateTime(consult.created_at)}
          </p>
        </div>
        <div className="row">
          <StatusPill status={consult.status} />
          <button className="btn btn-ghost btn-sm" onClick={() => onMessage(consult.link_id)}>
            Message
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onOpenRecord(consult.link_id)}>
            Shared record
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Reason</h2>
        <p className="selectable" style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
          {consult.reason}
        </p>
        <dl className="kv" style={{ marginTop: 16 }}>
          <div>
            <dt>Patient prefers</dt>
            <dd>{consult.preferred_at ? fmtDateTime(consult.preferred_at) : 'No preference given'}</dd>
          </div>
          <div>
            <dt>Scheduled for</dt>
            <dd>{consult.scheduled_at ? fmtDateTime(consult.scheduled_at) : '—'}</dd>
          </div>
          {consult.completed_at && (
            <div>
              <dt>{consult.status === 'cancelled' ? 'Cancelled' : 'Completed'}</dt>
              <dd>{fmtDateTime(consult.completed_at)}</dd>
            </div>
          )}
        </dl>
      </div>

      {open && <BriefPanel linkId={consult.link_id} consultId={consult.id} onError={onError} />}

      {open ? (
        <div className="card stack" style={{ gap: 12 }}>
          <h2 style={{ margin: 0 }}>{consult.status === 'scheduled' ? 'Reschedule or close' : 'Respond'}</h2>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <div className="grid-2">
            <label className="field">
              <span>
                Date and time <em>your local time</em>
              </span>
              <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>
              Note to the patient <em>optional</em>
            </span>
            <textarea className="input" style={{ minHeight: 60 }} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="row wrap">
            <button className="btn btn-light" disabled={busy !== null} onClick={() => void run('schedule', consult.status === 'scheduled' ? 'Consultation rescheduled' : 'Consultation scheduled')}>
              {busy === 'schedule' && <Spinner />} {consult.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
            </button>
            {consult.status === 'scheduled' && (
              <button className="btn btn-ghost" disabled={busy !== null} onClick={() => void run('complete', 'Consultation marked complete')}>
                {busy === 'complete' ? <Spinner /> : <Icon name="check" />} Mark complete
              </button>
            )}
            <button className="btn btn-danger" disabled={busy !== null} onClick={() => void run('decline', 'Consultation declined')}>
              {busy === 'decline' && <Spinner />} Decline
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
            The patient is notified of every change, with your note.
          </p>
        </div>
      ) : (
        consult.doctor_note && (
          <div className="card">
            <h2>Your note</h2>
            <p className="selectable" style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
              {consult.doctor_note}
            </p>
          </div>
        )
      )}
    </div>
  );
}

export default function Consults({
  onError,
  toast,
  onChanged,
  onOpenRecord,
  onMessage,
}: {
  onError: OnError;
  toast: (m: string) => void;
  onChanged: () => void;
  onOpenRecord: (linkId: string) => void;
  onMessage: (linkId: string) => void;
}) {
  const [filter, setFilter] = useState<ConsultFilter>('requested');
  const [consults, setConsults] = useState<Consult[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setConsults((await api.listConsults(filter)).consults);
      setListError(null);
    } catch (err) {
      setListError(onError(err));
    }
  }, [filter, onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = consults?.find((c) => c.id === selected) ?? consults?.[0] ?? null;

  return (
    <>
      <nav className="rail" aria-label="Consultations">
        <div className="rail-head">
          <div className="tabs tabs-3" role="tablist" aria-label="Filter consultations">
            {TABS.map((t) => (
              <button
                key={t.key}
                className="tab"
                role="tab"
                aria-selected={filter === t.key}
                onClick={() => {
                  setFilter(t.key);
                  setConsults(null);
                  setSelected(null);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="worklist">
          {listError ? (
            <div className="empty">
              <div className="alert alert-error">{listError}</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => void refresh()}>
                <Icon name="refresh" /> Retry
              </button>
            </div>
          ) : consults == null ? (
            <p className="empty">Loading…</p>
          ) : consults.length === 0 ? (
            <p className="empty">
              {filter === 'requested' ? 'No consultation requests waiting.' : filter === 'upcoming' ? 'Nothing scheduled.' : 'No consultations yet.'}
            </p>
          ) : (
            consults.map((c) => (
              <button key={c.id} className="wl-item" aria-current={current?.id === c.id ? 'true' : undefined} onClick={() => setSelected(c.id)}>
                <span className="wl-thumb" style={{ background: 'var(--s2)', fontSize: 12, fontWeight: 700 }}>
                  {initials(c.patient.name)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="wl-title truncate" style={{ display: 'block' }}>
                    {c.patient.name}
                  </span>
                  <span className="wl-sub truncate" style={{ display: 'block' }}>
                    {MODE_LABEL[c.mode]} · {c.reason}
                  </span>
                </span>
                <span className="wl-side">
                  <span className="tnum">{c.scheduled_at ? fmtDateTime(c.scheduled_at) : fmtDate(c.created_at)}</span>
                  <StatusPill status={c.status} />
                </span>
              </button>
            ))
          )}
        </div>
      </nav>

      <main className="main">
        {current ? (
          <ConsultDetail
            key={`${current.id}:${current.status}:${current.scheduled_at ?? ''}`}
            consult={current}
            onError={onError}
            onOpenRecord={onOpenRecord}
            onMessage={onMessage}
            onDone={(msg) => {
              toast(msg);
              onChanged();
              void refresh();
            }}
          />
        ) : (
          consults != null && (
            <div className="main-inner">
              <p className="label">Consultations</p>
              <p className="muted" style={{ lineHeight: 1.5, maxWidth: 560 }}>
                Connected patients request consultations from the MIPAAS website. Requests appear here for you to schedule or decline.
              </p>
            </div>
          )
        )}
      </main>
    </>
  );
}
