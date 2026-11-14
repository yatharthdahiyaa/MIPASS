import React, { useCallback, useEffect, useState } from 'react';
import { api, type DailyLog, type LatestReading, type LogMetric, type PatientXray, type SharedRecord, type XrayReview } from '../../api';
import { SEVERITY, bytes, capitalize, fmtDate, fmtDateTime, fmtSlot, pathologyName, pct } from '../../format';
import Viewer from '../Viewer';
import { Icon, Modal, SeverityIcon, SeverityPill, Spinner } from '../ui';
import BriefPanel from './BriefPanel';
import { SCOPE_LABEL, ScopePills, patientDemographics, patientName, type OnError } from './common';

const ALL_SCOPES = ['profile', 'vitals', 'medications', 'documents', 'xrays'] as const;

const WINDOWS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

/** Same limits the server uses to raise a vitals alert (care.vitals_alerts). */
function outOfRange(metric: LogMetric, value: number | null, log?: Pick<DailyLog, 'systolic' | 'diastolic'>) {
  if (value == null) return false;
  switch (metric) {
    case 'systolic':
    case 'diastolic':
      return (log?.systolic ?? 0) >= 180 || (log?.diastolic ?? 0) >= 120;
    case 'heart_rate':
      return value >= 130 || value < 40;
    case 'glucose':
      return value < 54 || value >= 300;
    case 'spo2':
      return value < 90;
    case 'temperature_c':
      return value >= 39.5 || value < 35;
    default:
      return false;
  }
}

const TILES: { metric: LogMetric; label: string; unit: string }[] = [
  { metric: 'systolic', label: 'Blood pressure', unit: 'mmHg' },
  { metric: 'heart_rate', label: 'Heart rate', unit: 'bpm' },
  { metric: 'glucose', label: 'Glucose', unit: 'mg/dL' },
  { metric: 'spo2', label: 'SpO₂', unit: '%' },
  { metric: 'temperature_c', label: 'Temperature', unit: '°C' },
  { metric: 'weight_kg', label: 'Weight', unit: 'kg' },
];

const GLUCOSE_CONTEXT: Record<string, string> = { fasting: 'fasting', after_meal: 'after meal', random: 'random' };

function num(v: number | null) {
  return v == null ? '—' : String(Number.isInteger(v) ? v : Math.round(v * 10) / 10);
}

function Cell({ metric, log }: { metric: LogMetric; log: DailyLog }) {
  const v = log[metric];
  return <td className={`tnum ${outOfRange(metric, v, log) ? 'out-of-range' : ''}`}>{num(v)}</td>;
}

function Tile({ label, unit, reading, metric }: { label: string; unit: string; reading: LatestReading | undefined; metric: LogMetric }) {
  if (!reading) {
    return (
      <div className="tile">
        <span className="muted">{label}</span>
        <div className="v muted">—</div>
      </div>
    );
  }
  const bp = metric === 'systolic';
  const bad = outOfRange(metric, reading.value, bp ? { systolic: reading.value, diastolic: reading.diastolic ?? null } : undefined);
  return (
    <div className="tile">
      <span className="muted">{label}</span>
      <div className={`v tnum ${bad ? 'out-of-range' : ''}`}>
        {bp ? `${num(reading.value)}/${num(reading.diastolic ?? null)}` : num(reading.value)}
        <small>{unit}</small>
      </div>
      <span className="muted" style={{ fontSize: 11.5 }}>
        {fmtDate(reading.log_date)}
        {reading.context ? ` · ${GLUCOSE_CONTEXT[reading.context] ?? reading.context}` : ''}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ x-ray */

const URGENCY: Record<XrayReview['urgency'], string> = { routine: 'Routine', soon: 'See a doctor soon', urgent: 'Urgent' };

function XrayDetail({
  linkId,
  xray,
  onError,
  onReviewed,
}: {
  linkId: string;
  xray: PatientXray;
  onError: OnError;
  onReviewed: (review: XrayReview) => void;
}) {
  const [images, setImages] = useState<{ preview: string | null; heatmap: string | null } | null>(null);
  const [impression, setImpression] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [urgency, setUrgency] = useState<XrayReview['urgency']>('routine');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      xray.has_preview ? api.patientXrayImage(linkId, xray.id, 'preview').catch(() => null) : null,
      xray.has_heatmap ? api.patientXrayImage(linkId, xray.id, 'heatmap').catch(() => null) : null,
    ]).then(([preview, heatmap]) => !cancelled && setImages({ preview, heatmap }));
    return () => {
      cancelled = true;
    };
  }, [linkId, xray.id, xray.has_preview, xray.has_heatmap]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (impression.trim().length < 3) {
      setError('Write your impression.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { review } = await api.reviewXray(linkId, xray.id, { impression, recommendation, urgency });
      setImpression('');
      setRecommendation('');
      onReviewed(review);
    } catch (err) {
      setError(onError(err) || null);
    } finally {
      setBusy(false);
    }
  }

  const flagged = xray.findings?.pathologies.filter((p) => p.positive) ?? [];
  const sev = xray.severity ? SEVERITY[xray.severity] : null;

  return (
    <div className="study" style={{ marginTop: 14 }}>
      <div className="stack" style={{ gap: 12 }}>
        {xray.status !== 'completed' ? (
          <div className="alert alert-info">{xray.status === 'failed' ? xray.error || 'The AI screening failed for this image.' : 'The AI screening is still running.'}</div>
        ) : images == null ? (
          <p className="muted row">
            <Spinner /> Loading image…
          </p>
        ) : (
          <Viewer preview={images.preview} heatmap={images.heatmap} />
        )}
      </div>
      <div className="stack" style={{ gap: 14 }}>
        {sev && (
          <div className="banner" style={{ borderColor: `${sev.color}66`, background: sev.bg }}>
            <h3 className="banner-title" style={{ color: sev.color }}>
              <SeverityIcon severity={xray.severity!} size={18} />
              {sev.label}
              {xray.primary_finding && <span style={{ color: 'var(--text)' }}> · {pathologyName(xray.primary_finding)}</span>}
            </h3>
            {xray.findings?.clinical_summary && <p className="selectable">{xray.findings.clinical_summary}</p>}
            <p className="muted" style={{ fontSize: 12 }}>
              AI screening the patient ran themselves{xray.model_name ? ` (${xray.model_name})` : ''}. Decision support only.
            </p>
          </div>
        )}
        {flagged.length > 0 && (
          <div>
            <p className="label">Flagged by the model</p>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6, color: 'var(--text-2)' }}>
              {flagged.map((p) => (
                <li key={p.name}>
                  {pathologyName(p.name)} <span className="muted tnum">{pct(p.probability)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {xray.my_review && (
          <div className="signed">
            <strong>Your review</strong> · {URGENCY[xray.my_review.urgency]} · {fmtDateTime(xray.my_review.created_at)}
            <p className="selectable" style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {xray.my_review.impression}
            </p>
            {xray.my_review.recommendation && (
              <p className="selectable muted" style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {xray.my_review.recommendation}
              </p>
            )}
          </div>
        )}

        <form onSubmit={submit} className="stack" style={{ gap: 10 }}>
          <p className="label">{xray.my_review ? 'Write a new review' : 'Review for the patient'}</p>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <label className="field">
            <span>Impression</span>
            <textarea className="input" value={impression} maxLength={8000} onChange={(e) => setImpression(e.target.value)} />
          </label>
          <label className="field">
            <span>
              Recommendation <em>optional</em>
            </span>
            <textarea className="input" style={{ minHeight: 60 }} value={recommendation} maxLength={4000} onChange={(e) => setRecommendation(e.target.value)} />
          </label>
          <div className="row wrap" style={{ justifyContent: 'space-between' }}>
            <div className="seg" role="group" aria-label="Urgency">
              {(Object.keys(URGENCY) as XrayReview['urgency'][]).map((u) => (
                <button key={u} type="button" aria-pressed={urgency === u} onClick={() => setUrgency(u)}>
                  {URGENCY[u]}
                </button>
              ))}
            </div>
            <button className="btn btn-light btn-sm" type="submit" disabled={busy}>
              {busy ? <Spinner /> : <Icon name="check" />} Send review to patient
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            The patient is notified and can read this review next to their X-ray.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- record */

export default function PatientRecord({
  linkId,
  initialXrayId,
  onError,
  toast,
  onMessage,
  onOpenStudy,
  onEnded,
}: {
  linkId: string;
  initialXrayId?: string;
  onError: OnError;
  toast: (m: string) => void;
  onMessage: (linkId: string) => void;
  onOpenStudy: (studyId: string) => void;
  onEnded: () => void;
}) {
  const [record, setRecord] = useState<SharedRecord | null>(null);
  const [days, setDays] = useState(30);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openXray, setOpenXray] = useState<string | null>(initialXrayId ?? null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRecord(await api.patientRecord(linkId, days));
      setLoadError(null);
    } catch (err) {
      setLoadError(onError(err));
    }
  }, [linkId, days, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="main-inner">
        <div className="alert alert-error">{loadError}</div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => void load()}>
          <Icon name="refresh" /> Retry
        </button>
      </div>
    );
  }
  if (!record) return <p className="empty">Loading the shared record…</p>;

  const { link } = record;
  const notShared = ALL_SCOPES.filter((s) => !record.scopes.includes(s));

  async function saveDocument(docId: string, fileName: string) {
    setBusy(docId);
    setError(null);
    try {
      const path = await api.savePatientDocument(linkId, docId, fileName);
      if (path) toast('Document saved');
    } catch (err) {
      setError(onError(err) || null);
    } finally {
      setBusy(null);
    }
  }

  async function endConnection() {
    setBusy('end');
    try {
      await api.endPatientLink(linkId);
      setConfirmEnd(false);
      onEnded();
    } catch (err) {
      setConfirmEnd(false);
      setError(onError(err) || null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="main-inner stack" style={{ gap: 16 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title selectable">{patientName(link)}</h1>
          <p className="muted selectable" style={{ margin: '6px 0 10px' }}>
            {[patientDemographics(link), link.patient?.email, link.accepted_at ? `connected ${fmtDate(link.accepted_at)}` : null].filter(Boolean).join(' · ')}
          </p>
          <ScopePills scopes={record.scopes} />
        </div>
        <div className="row">
          <button className="btn btn-light btn-sm" onClick={() => onMessage(linkId)}>
            Message
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmEnd(true)}>
            End connection
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {notShared.length > 0 && (
        <div className="alert alert-info">Not shared with you: {notShared.map((s) => SCOPE_LABEL[s]).join(', ')}. The patient chooses what you can see.</div>
      )}

      <BriefPanel linkId={linkId} onError={onError} />

      {record.profile !== undefined && (
        <section className="card" aria-labelledby="rec-profile">
          <h2 id="rec-profile">Profile</h2>
          {record.profile == null ? (
            <p className="muted" style={{ margin: 0 }}>
              The patient hasn’t filled in their profile.
            </p>
          ) : (
            <dl className="kv selectable">
              {(
                [
                  ['Date of birth', record.profile.date_of_birth ? `${fmtDate(record.profile.date_of_birth)}${record.profile.age != null ? ` (${record.profile.age}y)` : ''}` : null],
                  ['Sex', capitalize(record.profile.sex)],
                  ['Blood group', record.profile.blood_group],
                  ['Height', record.profile.height_cm != null ? `${record.profile.height_cm} cm` : null],
                  ['Phone', record.profile.phone],
                  ['Allergies', record.profile.allergies],
                  ['Conditions', record.profile.conditions],
                  ['Emergency contact', [record.profile.emergency_contact_name, record.profile.emergency_contact_phone].filter(Boolean).join(' · ') || null],
                ] as [string, string | null][]
              ).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      {record.vitals && (
        <section className="card" aria-labelledby="rec-vitals">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 id="rec-vitals" style={{ margin: 0 }}>
              Vitals <span className="muted" style={{ fontWeight: 400 }}>· self-logged by the patient</span>
            </h2>
            <div className="seg" role="group" aria-label="Period">
              {WINDOWS.map((w) => (
                <button key={w.days} aria-pressed={days === w.days} onClick={() => setDays(w.days)}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <p className="label" style={{ marginBottom: 8 }}>
            Latest readings
          </p>
          <div className="tiles">
            {TILES.map((t) => (
              <Tile key={t.metric} {...t} reading={record.vitals!.latest[t.metric]} />
            ))}
          </div>
          <p className="label" style={{ margin: '18px 0 8px' }}>
            Check-ins in the last {record.vitals.days} days ({record.vitals.logs.length})
            {record.vitals.streak_days > 0 ? ` · ${record.vitals.streak_days}-day logging streak` : ''}
          </p>
          {record.vitals.logs.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No check-ins in this period.
            </p>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 360 }}>
              <table className="table selectable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>BP</th>
                    <th>HR</th>
                    <th>Glucose</th>
                    <th>SpO₂</th>
                    <th>Temp</th>
                    <th>Weight</th>
                    <th>Symptoms and notes</th>
                  </tr>
                </thead>
                <tbody>
                  {record.vitals.logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(log.log_date)}</td>
                      <td className={`tnum ${outOfRange('systolic', log.systolic, log) ? 'out-of-range' : ''}`}>
                        {log.systolic != null || log.diastolic != null ? `${num(log.systolic)}/${num(log.diastolic)}` : '—'}
                      </td>
                      <Cell metric="heart_rate" log={log} />
                      <td className={`tnum ${outOfRange('glucose', log.glucose) ? 'out-of-range' : ''}`}>
                        {num(log.glucose)}
                        {log.glucose != null && log.glucose_context ? <span className="muted"> {GLUCOSE_CONTEXT[log.glucose_context] ?? log.glucose_context}</span> : null}
                      </td>
                      <Cell metric="spo2" log={log} />
                      <Cell metric="temperature_c" log={log} />
                      <Cell metric="weight_kg" log={log} />
                      <td style={{ minWidth: 200 }}>{[log.symptoms.join(', '), log.notes].filter(Boolean).join(' · ') || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {record.medications && (
        <section className="card" aria-labelledby="rec-meds">
          <h2 id="rec-meds">Medicines</h2>
          {(record.medications.adherence_7d || record.medications.adherence_30d) && (
            <p className="muted" style={{ margin: '-6px 0 12px' }}>
              Doses marked taken:{' '}
              {[record.medications.adherence_7d, record.medications.adherence_30d]
                .filter((a) => a != null)
                .map((a) => `${pct(a.rate)} over ${a.days} days (${a.taken}/${a.scheduled})`)
                .join(' · ')}
            </p>
          )}
          {record.medications.items.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No medicines listed.
            </p>
          ) : (
            <div className="selectable">
              {record.medications.items.map((m) => (
                <div key={m.id} className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>
                      {m.name} {m.dosage && <span className="muted">· {m.dosage}</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                      {[m.times.map(fmtSlot).join(', '), m.instructions, m.prescribed_by ? `prescribed by ${m.prescribed_by}` : null].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <span className="pill" style={m.is_active ? { color: '#0ca30c', background: 'rgba(12,163,12,0.12)' } : { color: 'var(--muted)', background: 'var(--s2)' }}>
                    {m.is_active ? 'Active' : 'Stopped'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {record.xrays && (
        <section className="card" aria-labelledby="rec-xrays">
          <h2 id="rec-xrays">X-rays uploaded by the patient</h2>
          {record.xrays.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No X-rays uploaded.
            </p>
          ) : (
            record.xrays.map((x) => {
              const open = openXray === x.id;
              return (
                <div key={x.id} style={{ borderBottom: '1px solid var(--hair)', padding: '6px 0' }}>
                  <button className="row-btn" aria-expanded={open} onClick={() => setOpenXray(open ? null : x.id)}>
                    <span className="row" style={{ justifyContent: 'space-between', padding: '8px 6px' }}>
                      <span style={{ minWidth: 0 }}>
                        <span className="truncate" style={{ display: 'block', fontWeight: 500 }}>
                          {x.title || x.original_filename}
                        </span>
                        <span className="muted" style={{ fontSize: 12.5 }}>
                          {[x.taken_on ? `taken ${fmtDate(x.taken_on)}` : `uploaded ${fmtDate(x.created_at)}`, x.primary_finding ? pathologyName(x.primary_finding) : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="row">
                        {x.my_review && (
                          <span className="pill" style={{ color: '#0ca30c', background: 'rgba(12,163,12,0.12)' }}>
                            Reviewed
                          </span>
                        )}
                        <SeverityPill severity={x.severity} />
                      </span>
                    </span>
                  </button>
                  {open && (
                    <XrayDetail
                      linkId={linkId}
                      xray={x}
                      onError={onError}
                      onReviewed={(review) => {
                        toast('Review sent to the patient');
                        setRecord((r) => (r ? { ...r, xrays: r.xrays?.map((y) => (y.id === x.id ? { ...y, my_review: review } : y)) } : r));
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {record.documents && (
        <section className="card" aria-labelledby="rec-docs">
          <h2 id="rec-docs">Records</h2>
          {record.documents.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No documents uploaded.
            </p>
          ) : (
            record.documents.map((d) => (
              <div key={d.id} className="list-row">
                <div className="selectable" style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 500 }}>
                    {d.title}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {[capitalize(d.category), d.record_date ? fmtDate(d.record_date) : null, d.provider, bytes(d.size_bytes)].filter(Boolean).join(' · ')}
                  </div>
                  {d.notes && (
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                      {d.notes}
                    </div>
                  )}
                </div>
                <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void saveDocument(d.id, d.original_filename)}>
                  {busy === d.id ? <Spinner /> : <Icon name="download" />} Save a copy
                </button>
              </div>
            ))
          )}
        </section>
      )}

      {record.reports.length > 0 && (
        <section className="card" aria-labelledby="rec-reports">
          <h2 id="rec-reports">Your studies for this patient</h2>
          {record.reports.map((r) => (
            <div key={r.id} className="list-row">
              <div>
                <div style={{ fontWeight: 500 }}>{[r.modality, r.primary_finding ? pathologyName(r.primary_finding) : null].filter(Boolean).join(' · ') || 'Study'}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                  {r.report_status === 'signed' ? `Signed ${fmtDateTime(r.signed_at)} · shared with the patient` : 'Draft · not shared yet'}
                </div>
              </div>
              <span className="row">
                <SeverityPill severity={r.severity} />
                <button className="btn btn-ghost btn-sm" onClick={() => onOpenStudy(r.id)}>
                  Open
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      {confirmEnd && (
        <Modal
          title="End this care connection?"
          onClose={() => setConfirmEnd(false)}
          actions={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmEnd(false)}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" disabled={busy === 'end'} onClick={() => void endConnection()}>
                {busy === 'end' && <Spinner />} End connection
              </button>
            </>
          }
        >
          You will lose access to {patientName(link)}’s shared record and messaging stops. The patient is told.
        </Modal>
      )}
    </div>
  );
}
