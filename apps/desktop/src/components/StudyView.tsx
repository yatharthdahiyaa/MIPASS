import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Doctor, type PatientFields, type Study } from '../api';
import { SEVERITY, bytes, demographics, fmtDate, fmtDateTime, pathologyName, patientLabel, pct } from '../format';
import { buildReportHtml } from '../report';
import Viewer from './Viewer';
import { DraftAssist, SharePatient } from './care/ReportAssist';
import { Icon, Modal, SeverityIcon, SeverityPill, Spinner } from './ui';

type Draft = Required<PatientFields> & { impression: string };
type Busy = 'save' | 'sign' | 'delete' | 'export' | 'analyze';

const STATUS_COPY: Record<'processing' | 'pending' | 'failed', { title: string; fallback: string }> = {
  processing: { title: 'Analysing…', fallback: 'The model is still working on this study.' },
  pending: { title: 'Waiting for a model', fallback: 'No trained model is installed for this study type yet.' },
  failed: { title: 'Analysis failed', fallback: 'The model could not analyse this file.' },
};

function toDraft(s: Study): Draft {
  return {
    patient_ref: s.patient_ref ?? '',
    patient_name: s.patient_name ?? '',
    patient_age: s.patient_age != null ? String(s.patient_age) : '',
    patient_sex: s.patient_sex ?? '',
    study_date: s.study_date ?? '',
    clinical_notes: s.clinical_notes ?? '',
    impression: s.impression ?? '',
  };
}

export default function StudyView({
  id,
  doctor,
  onError,
  onChanged,
  onDeleted,
  toast,
}: {
  id: string;
  doctor: Doctor;
  onError: (err: unknown) => string;
  onChanged: () => void;
  onDeleted: () => void;
  toast: (m: string) => void;
}) {
  const [study, setStudy] = useState<Study | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [images, setImages] = useState<{ preview: string | null; heatmap: string | null }>({ preview: null, heatmap: null });
  const [edits, setEdits] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<null | Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'sign' | 'delete'>(null);
  /** The AI draft the doctor inserted, so what they finally sign can be recorded against it. */
  const [aiDraft, setAiDraft] = useState<{ runId: string; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { study: s } = await api.getStudy(id);
      setStudy(s);
      setLoadError(null);
      const [preview, heatmap] = await Promise.all([
        s.has_preview ? api.studyImage(id, 'preview').catch(() => null) : null,
        s.has_heatmap ? api.studyImage(id, 'heatmap').catch(() => null) : null,
      ]);
      setImages({ preview, heatmap });
    } catch (err) {
      setLoadError(onError(err));
    }
  }, [id, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const draft = useMemo(() => (study ? edits ?? toDraft(study) : null), [study, edits]);
  const dirty = !!(study && edits && JSON.stringify(edits) !== JSON.stringify(toDraft(study)));
  const signed = study?.report_status === 'signed';

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
  if (!study || !draft) {
    return (
      <div className="main-inner row muted">
        <Spinner /> Loading study…
      </div>
    );
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEdits({ ...draft, [k]: e.target.value });

  async function save(): Promise<Study | null> {
    if (!dirty || !draft) return study;
    if (draft.patient_age && !/^\d{1,3}$/.test(draft.patient_age)) {
      setError('Age must be a whole number.');
      return null;
    }
    const { study: s } = await api.updateStudy(id, draft);
    setStudy(s);
    setEdits(null);
    onChanged();
    return s;
  }

  async function run(kind: Busy, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(onError(err));
    } finally {
      setBusy(null);
    }
  }

  const sev = study.severity ? SEVERITY[study.severity] : null;
  const findings = study.findings;
  const rows = [...(findings?.pathologies ?? [])].sort((a, b) => b.probability - a.probability);

  return (
    <div className="main-inner stack" style={{ gap: 16 }}>
      {/* header */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 0 }}>
          <p className="label">
            {[fmtDate(study.study_date || study.created_at), study.analyzer_name, study.original_filename, bytes(study.size_bytes)].filter(Boolean).join(' · ')}
          </p>
          <h1 className="page-title selectable" style={{ marginTop: 8 }}>
            {patientLabel(study)}
          </h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {[study.patient_ref && study.patient_name ? study.patient_ref : null, demographics(study)].filter(Boolean).join(' · ') || 'No patient details'}
          </p>
        </div>
        <div className="row">
          <SeverityPill severity={study.severity} />
          <span
            className="pill"
            style={signed ? { color: '#0ca30c', background: 'rgba(12,163,12,0.12)' } : { color: 'var(--muted)', background: 'var(--s2)' }}
          >
            {signed ? 'Signed' : 'Draft'}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy !== null}
            onClick={() =>
              run('export', async () => {
                const html = buildReportHtml(study, doctor, { preview: images.preview ?? undefined, heatmap: images.heatmap ?? undefined });
                const path = await api.saveReport(`${study.modality || 'Study'} ${study.patient_ref || study.patient_name || study.id.slice(0, 8)}`, html);
                if (path) toast('Report saved');
              })
            }
          >
            <Icon name="download" /> Export report
          </button>
          {!signed && (
            <button className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => setConfirm('delete')}>
              <Icon name="trash" /> Delete
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="study">
        {/* left: image */}
        <div className="stack" style={{ gap: 12 }}>
          {study.status === 'completed' ? (
            <Viewer preview={images.preview} heatmap={images.heatmap} />
          ) : (
            <div className="card">
              <h2>{STATUS_COPY[study.status].title}</h2>
              <p className="muted">{study.error || STATUS_COPY[study.status].fallback}</p>
              {study.can_analyze && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy !== null}
                  onClick={() =>
                    run('analyze', async () => {
                      const { study: s } = await api.analyzeStudy(id);
                      setStudy(s);
                      onChanged();
                      if (s.status === 'completed') {
                        toast('Analysis complete');
                        await load();
                      }
                    })
                  }
                >
                  {busy === 'analyze' ? <Spinner /> : <Icon name="refresh" />} Run analysis
                </button>
              )}
            </div>
          )}

          {sev && (
            <div className="banner" style={{ borderColor: `${sev.color}66`, background: sev.bg }}>
              <h3 className="banner-title" style={{ color: sev.color }}>
                <SeverityIcon severity={study.severity!} size={18} />
                {sev.label}
                {study.primary_finding && <span style={{ color: 'var(--text)' }}> · {pathologyName(study.primary_finding)}</span>}
              </h3>
              {findings?.clinical_summary && <p className="selectable">{findings.clinical_summary}</p>}
            </div>
          )}
        </div>

        {/* right: AI + report */}
        <div className="stack" style={{ gap: 14 }}>
          {findings && (
            <section className="card" aria-labelledby="ai-h">
              <h2 id="ai-h">AI findings</h2>
              <p className="muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
                Probability per class; tick = model threshold. Decision support only.
              </p>
              <div className="bars">
                {rows.map((p) => (
                  <div key={p.name} className="bar-row" title={p.description || undefined}>
                    <div className="top">
                      <span style={{ fontWeight: p.positive ? 600 : 400, color: p.positive ? 'var(--text)' : 'var(--text-2)' }}>
                        {pathologyName(p.name)}
                        {p.positive && (
                          <span className="pill" style={{ marginLeft: 8, height: 18, color: SEVERITY.HIGH.color, background: SEVERITY.HIGH.bg }}>
                            ! Flagged
                          </span>
                        )}
                      </span>
                      <span className="tnum">
                        {pct(p.probability)} <span className="muted">/ {pct(p.threshold)}</span>
                      </span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(1.5, p.probability * 100)}%` }} />
                      <span className="bar-tick" style={{ left: `${p.threshold * 100}%` }} aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
              {findings.recommended_actions && findings.recommended_actions.length > 0 && (
                <>
                  <p className="label" style={{ marginTop: 18 }}>
                    Suggested actions
                  </p>
                  <ul className="selectable" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.55, color: 'var(--text-2)' }}>
                    {findings.recommended_actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="muted" style={{ fontSize: 11.5, marginTop: 14, marginBottom: 0 }}>
                {study.model_name} · analysed {fmtDateTime(study.analyzed_at)}
              </p>
            </section>
          )}

          <section className="card" aria-labelledby="report-h">
            <h2 id="report-h">Report</h2>
            {signed ? (
              <div className="stack" style={{ gap: 12 }}>
                <div className="signed">
                  Signed by <b>{study.signed_by}</b> on {fmtDateTime(study.signed_at)}. Signed reports are locked.
                </div>
                {study.clinical_notes && (
                  <div>
                    <p className="label">Indication</p>
                    <p className="selectable" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                      {study.clinical_notes}
                    </p>
                  </div>
                )}
                <div>
                  <p className="label">Impression</p>
                  <div className="impression-view selectable" style={{ marginTop: 6 }}>
                    {study.impression}
                  </div>
                </div>
              </div>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                <div className="grid-2">
                  <label className="field">
                    <span>Patient ID / MRN</span>
                    <input className="input" value={draft.patient_ref} onChange={set('patient_ref')} maxLength={120} />
                  </label>
                  <label className="field">
                    <span>Name</span>
                    <input className="input" value={draft.patient_name} onChange={set('patient_name')} maxLength={150} />
                  </label>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <label className="field">
                      <span>Age</span>
                      <input className="input tnum" inputMode="numeric" value={draft.patient_age} onChange={set('patient_age')} maxLength={3} />
                    </label>
                    <label className="field">
                      <span>Sex</span>
                      <select className="input" value={draft.patient_sex} onChange={set('patient_sex')}>
                        <option value="">—</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Study date</span>
                    <input className="input" type="date" value={draft.study_date} onChange={set('study_date')} />
                  </label>
                </div>
                <label className="field">
                  <span>Indication / clinical history</span>
                  <textarea className="input" style={{ minHeight: 64 }} value={draft.clinical_notes} onChange={set('clinical_notes')} maxLength={4000} />
                </label>
                <SharePatient studyId={id} current={study.patient_link} disabled={busy !== null} onChanged={() => void load()} onError={onError} />
                {study.status === 'completed' && (
                  <DraftAssist
                    studyId={id}
                    onError={onError}
                    onInsert={(text, runId) => {
                      // Keep anything the doctor already wrote; the draft goes below it.
                      const mine = draft.impression.trim();
                      setEdits({ ...draft, impression: mine ? `${mine}\n\n${text}` : text });
                      setAiDraft({ runId, text });
                    }}
                  />
                )}
                <label className="field">
                  <span>
                    Impression <em>required to sign</em>
                  </span>
                  <textarea
                    className="input"
                    style={{ minHeight: 140 }}
                    value={draft.impression}
                    onChange={set('impression')}
                    maxLength={8000}
                    placeholder="Your findings and conclusion. The AI result is not included unless you write it here."
                  />
                </label>
                <div className="row wrap">
                  <button className="btn btn-ghost" disabled={!dirty || busy !== null} onClick={() =>
                      run('save', async () => {
                        if (await save()) toast('Draft saved');
                      })
                    }
                  >
                    {busy === 'save' && <Spinner />}
                    Save draft
                  </button>
                  <button
                    className="btn btn-light"
                    disabled={busy !== null || study.status !== 'completed' || !draft.impression.trim()}
                    onClick={() => setConfirm('sign')}
                    title={!draft.impression.trim() ? 'Write an impression first' : undefined}
                  >
                    {busy === 'sign' ? <Spinner /> : <Icon name="check" />}
                    Sign report
                  </button>
                  {dirty && <span className="muted" style={{ fontSize: 12.5 }}>Unsaved changes</span>}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {confirm === 'sign' && (
        <Modal
          title="Sign this report?"
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="btn btn-quiet" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-light"
                onClick={() => {
                  setConfirm(null);
                  void run('sign', async () => {
                    if (dirty && !(await save())) return;
                    const { study: s } = await api.signStudy(id);
                    setStudy(s);
                    setEdits(null);
                    onChanged();
                    toast('Report signed');
                    if (aiDraft) {
                      // What the doctor kept: the draft as it was, or their edited version.
                      const kept = (s.impression ?? '').trim();
                      const same = kept === aiDraft.text.trim();
                      void api.reviewAgentRun(aiDraft.runId, same ? 'accepted' : 'edited', same ? undefined : kept).catch(() => undefined);
                      setAiDraft(null);
                    }
                  });
                }}
              >
                Sign as {doctor.name}
              </button>
            </>
          }
        >
          Signing records your name and the time, and locks the report and patient details. This can’t be undone.
        </Modal>
      )}
      {confirm === 'delete' && (
        <Modal
          title="Delete this study?"
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="btn btn-quiet" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirm(null);
                  void run('delete', async () => {
                    await api.deleteStudy(id);
                    onDeleted();
                  });
                }}
              >
                Delete permanently
              </button>
            </>
          }
        >
          The image, AI result and your draft report will be removed from the server.
        </Modal>
      )}
    </div>
  );
}
