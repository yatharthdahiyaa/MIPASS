import React, { useCallback, useEffect, useState } from 'react';
import { api, type CareLink, type Doctor, type PatientFilter } from '../../api';
import { fmtDate } from '../../format';
import { Icon, Spinner } from '../ui';
import PatientRecord from './PatientRecord';
import { ScopePills, initials, patientDemographics, patientName, type OnError } from './common';

const TABS: { key: PatientFilter; label: string }[] = [
  { key: 'active', label: 'Connected' },
  { key: 'pending', label: 'Requests' },
  { key: 'ended', label: 'Ended' },
];

function subLine(link: CareLink) {
  if (link.status === 'pending') return link.requested_by === 'patient' ? 'Wants to connect' : 'Invitation sent';
  if (link.status === 'declined') return 'Declined';
  if (link.status === 'revoked') return link.ended_by === 'patient' ? 'Ended by the patient' : 'Ended by you';
  return patientDemographics(link) || link.patient?.email || '';
}

/** Share code and the invite-by-e-mail form. */
function ConnectPanel({ onError, onInvited }: { onError: OnError; onInvited: () => void }) {
  const [profile, setProfile] = useState<Doctor | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.doctorProfile().then(
      (r) => setProfile(r.user),
      (err) => void onError(err),
    );
  }, [onError]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.invitePatient(email, message);
      setEmail('');
      setMessage('');
      onInvited();
    } catch (err) {
      setError(onError(err) || null);
    } finally {
      setBusy(false);
    }
  }

  const code = profile?.clinician?.share_code ?? null;

  return (
    <div className="main-inner stack" style={{ gap: 16, maxWidth: 860 }}>
      <div>
        <h1 className="page-title">
          Connect with a patient
        </h1>
        <p className="muted" style={{ lineHeight: 1.5, maxWidth: 620 }}>
          A patient shares the parts of their MIPAAS record they choose. You see them only while the connection is active, and either of you can end it.
        </p>
      </div>

      <div className="card">
        <h2>Your share code</h2>
        {profile == null ? (
          <p className="muted" style={{ margin: 0 }}>
            Loading…
          </p>
        ) : code ? (
          <div className="row wrap" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="share-code mono">{code}</div>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Give this to a patient. They enter it under Care team on the MIPAAS website and choose what to share.
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(code).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            A share code is issued once your medical registration is verified.
          </p>
        )}
      </div>

      <form className="card stack" onSubmit={invite} style={{ gap: 12 }}>
        <h2 style={{ margin: 0 }}>Invite a patient by e-mail</h2>
        {profile && profile.email_verified === false && (
          <div className="alert alert-info">Confirm your own e-mail address on the MIPAAS website before sending invitations.</div>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <label className="field">
          <span>Patient’s e-mail</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="The address on their MIPAAS account" spellCheck={false} />
        </label>
        <label className="field">
          <span>
            Note <em>optional</em>
          </span>
          <textarea className="input" style={{ minHeight: 60 }} value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <div>
          <button className="btn btn-light" type="submit" disabled={busy || !email.trim()}>
            {busy && <Spinner />} Send invitation
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          The patient must already have a MIPAAS account. Nothing is shared until they accept.
        </p>
      </form>
    </div>
  );
}

/** A request that has not been answered yet (either direction). */
function PendingPanel({ link, onError, onChanged }: { link: CareLink; onError: OnError; onChanged: (msg: string, next: PatientFilter) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fromPatient = link.requested_by === 'patient';

  async function run(name: string, action: () => Promise<unknown>, msg: string, next: PatientFilter) {
    setBusy(name);
    setError(null);
    try {
      await action();
      onChanged(msg, next);
    } catch (err) {
      setError(onError(err) || null);
      setBusy(null);
    }
  }

  return (
    <div className="main-inner stack" style={{ gap: 16, maxWidth: 760 }}>
      <div>
        <p className="label">{fromPatient ? 'Connection request' : 'Invitation sent'}</p>
        <h1 className="page-title selectable" style={{ marginTop: 8 }}>
          {patientName(link)}
        </h1>
        <p className="muted selectable" style={{ margin: '6px 0 0' }}>
          {[patientDemographics(link), link.patient?.email, link.created_at ? fmtDate(link.created_at) : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="card stack" style={{ gap: 12 }}>
        {link.message && (
          <p className="selectable" style={{ margin: 0, lineHeight: 1.5 }}>
            “{link.message}”
          </p>
        )}
        {fromPatient ? (
          <>
            <div>
              <p className="label" style={{ marginBottom: 8 }}>
                Offers to share
              </p>
              <ScopePills scopes={link.scopes} />
            </div>
            <div className="row">
              <button className="btn btn-light" disabled={busy !== null} onClick={() => run('accept', () => api.respondPatient(link.id, true), 'Patient connected', 'active')}>
                {busy === 'accept' && <Spinner />} Accept
              </button>
              <button className="btn btn-ghost" disabled={busy !== null} onClick={() => run('decline', () => api.respondPatient(link.id, false), 'Request declined', 'pending')}>
                {busy === 'decline' && <Spinner />} Decline
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Waiting for the patient to accept and choose what to share.
            </p>
            <div>
              <button className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => run('cancel', () => api.endPatientLink(link.id), 'Invitation cancelled', 'pending')}>
                {busy === 'cancel' && <Spinner />} Cancel invitation
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Patients({
  initial,
  onError,
  toast,
  onMessage,
  onOpenStudy,
  onChanged,
}: {
  initial?: { linkId?: string; xrayId?: string; filter?: PatientFilter };
  onError: OnError;
  toast: (m: string) => void;
  onMessage: (linkId: string) => void;
  onOpenStudy: (studyId: string) => void;
  /** Called after anything that changes the counts shown elsewhere. */
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<PatientFilter>(initial?.filter ?? 'active');
  const [links, setLinks] = useState<CareLink[] | null>(null);
  const [selected, setSelected] = useState<string | null>(initial?.linkId ?? null);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLinks((await api.listPatients(filter)).patients);
      setListError(null);
    } catch (err) {
      setListError(onError(err));
    }
  }, [filter, onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = links?.find((l) => l.id === selected) ?? null;

  function changed(msg: string, next: PatientFilter) {
    toast(msg);
    onChanged();
    if (next === filter) void refresh();
    else setFilter(next);
  }

  return (
    <>
      <nav className="rail" aria-label="Patients">
        <div className="rail-head">
          <button className="btn btn-light" onClick={() => setSelected(null)}>
            <Icon name="plus" /> Connect a patient
          </button>
          <div className="tabs tabs-3" role="tablist" aria-label="Filter patients">
            {TABS.map((t) => (
              <button
                key={t.key}
                className="tab"
                role="tab"
                aria-selected={filter === t.key}
                onClick={() => {
                  setFilter(t.key);
                  setLinks(null);
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
          ) : links == null ? (
            <p className="empty">Loading…</p>
          ) : links.length === 0 ? (
            <p className="empty">
              {filter === 'active'
                ? 'No connected patients yet. Share your code or invite a patient by e-mail.'
                : filter === 'pending'
                  ? 'No open requests.'
                  : 'No ended connections.'}
            </p>
          ) : (
            links.map((l) => (
              <button key={l.id} className="wl-item" aria-current={selected === l.id ? 'true' : undefined} onClick={() => setSelected(l.id)}>
                <span className="wl-thumb" style={{ background: 'var(--s2)', fontSize: 12, fontWeight: 700 }}>
                  {initials(patientName(l))}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="wl-title truncate" style={{ display: 'block' }}>
                    {patientName(l)}
                  </span>
                  <span className="wl-sub truncate" style={{ display: 'block' }}>
                    {subLine(l)}
                  </span>
                </span>
                <span className="wl-side">
                  {l.unread_messages ? <span className="badge">{l.unread_messages}</span> : null}
                  {l.status === 'pending' && l.requested_by === 'patient' && <span className="badge badge-alert">New</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </nav>

      <main className="main">
        {current == null ? (
          <ConnectPanel
            onError={onError}
            onInvited={() => {
              changed('Invitation sent', 'pending');
            }}
          />
        ) : current.status === 'active' ? (
          <PatientRecord
            key={current.id}
            linkId={current.id}
            initialXrayId={current.id === initial?.linkId ? initial.xrayId : undefined}
            onError={onError}
            toast={toast}
            onMessage={onMessage}
            onOpenStudy={onOpenStudy}
            onEnded={() => {
              setSelected(null);
              changed('Connection ended', 'active');
            }}
          />
        ) : current.status === 'pending' ? (
          <PendingPanel
            key={current.id}
            link={current}
            onError={onError}
            onChanged={(msg, next) => {
              if (next !== 'active') setSelected(null);
              changed(msg, next);
            }}
          />
        ) : (
          <div className="main-inner">
            <h1 className="page-title selectable">{patientName(current)}</h1>
            <p className="muted" style={{ lineHeight: 1.5 }}>
              {subLine(current)}
              {current.ended_at ? ` on ${fmtDate(current.ended_at)}` : ''}. You no longer have access to this record. Send a new invitation to reconnect.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
