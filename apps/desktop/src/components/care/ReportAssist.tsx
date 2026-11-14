import { useEffect, useState } from 'react';
import { api, runAgentToEnd, type AgentRun, type CareLink, type ReportDraft } from '../../api';
import { pathologyName, pct } from '../../format';
import { Spinner } from '../ui';
import type { OnError } from './common';

/**
 * "Draft with AI" for an unsigned study: the report_draft agent turns the AI screen into an
 * impression the doctor can insert and then edit. What they finally sign is recorded against the
 * run, so the draft's usefulness can be measured.
 */
export function DraftAssist({
  studyId,
  onInsert,
  onError,
}: {
  studyId: string;
  onInsert: (text: string, runId: string) => void;
  onError: OnError;
}) {
  const [run, setRun] = useState<AgentRun<ReportDraft> | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  async function draft() {
    setBusy(true);
    setProblem(null);
    setClosed(false);
    try {
      const done = await runAgentToEnd<ReportDraft>('report_draft', { study_id: studyId });
      if (done.status === 'succeeded') setRun(done);
      else setProblem(done.error || 'The draft could not be prepared.');
    } catch (err) {
      setProblem(onError(err) || null);
    } finally {
      setBusy(false);
    }
  }

  if (!run || closed) {
    return (
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Start from a draft of the AI screen, with graded certainty, then edit it.
        </span>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void draft()}>
          {busy && <Spinner />} {busy ? 'Drafting…' : 'Draft with AI'}
        </button>
        {problem && (
          <div className="alert alert-error" role="alert" style={{ width: '100%' }}>
            {problem}
          </div>
        )}
      </div>
    );
  }

  const out = run.output!;
  return (
    <div className="ai-panel stack" style={{ gap: 10 }}>
      <h3>
        Draft impression <span className="ai-tag">AI agent</span>
      </h3>
      <div className="ai-draft">{out.draft}</div>
      {out.borderline.length > 0 && (
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Just under the threshold, check on the image:{' '}
          {out.borderline.map((b) => `${pathologyName(b.finding)} (${pct(b.probability)} / ${pct(b.threshold)})`).join(', ')}.
        </p>
      )}
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        {out.notice} Built by rules from the screen's scores; no patient data leaves MIPAAS for this draft.
      </p>
      <div className="row">
        <button
          className="btn btn-light btn-sm"
          onClick={() => {
            onInsert(out.draft, run.id);
            setClosed(true);
          }}
        >
          Insert into impression
        </button>
        <button
          className="btn btn-quiet btn-sm"
          onClick={() => {
            void api.reviewAgentRun(run.id, 'discarded').catch(() => undefined);
            setClosed(true);
            setRun(null);
          }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

/** Which connected patient sees this report once it is signed. */
export function SharePatient({
  studyId,
  current,
  disabled,
  onChanged,
  onError,
}: {
  studyId: string;
  current: CareLink | null | undefined;
  disabled: boolean;
  onChanged: () => void;
  onError: OnError;
}) {
  const [links, setLinks] = useState<CareLink[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listPatients('active').then(
      (r) => setLinks(r.patients),
      (err) => void onError(err),
    );
  }, [onError]);

  async function change(linkId: string) {
    setBusy(true);
    try {
      await api.updateStudy(studyId, { patient_link_id: linkId });
      onChanged();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="field">
      <span>
        Share with patient <em>they see the report once you sign it</em>
      </span>
      <select className="input" value={current?.id ?? ''} disabled={disabled || busy || links == null} onChange={(e) => void change(e.target.value)}>
        <option value="">Not shared</option>
        {(links ?? []).map((l) => (
          <option key={l.id} value={l.id}>
            {l.patient?.name ?? 'Former member'}
            {l.patient?.age != null ? ` · ${l.patient.age}y` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
