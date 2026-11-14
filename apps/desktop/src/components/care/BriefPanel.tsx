import { useState } from 'react';
import { api, runAgentToEnd, type AgentRun, type ConsultBrief } from '../../api';
import { Icon, Spinner } from '../ui';
import type { OnError } from './common';

/**
 * Pre-consultation brief for one care link (optionally one consultation). The doctor reads it and
 * marks it useful or not; nothing is sent to the patient.
 */
export default function BriefPanel({ linkId, consultId, onError }: { linkId: string; consultId?: string; onError: OnError }) {
  const [run, setRun] = useState<AgentRun<ConsultBrief> | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  async function prepare() {
    setBusy(true);
    setProblem(null);
    setReviewed(false);
    try {
      const done = await runAgentToEnd<ConsultBrief>('consult_brief', consultId ? { link_id: linkId, consult_id: consultId } : { link_id: linkId });
      if (done.status === 'succeeded') setRun(done);
      else setProblem(done.error || 'The brief could not be prepared.');
    } catch (err) {
      setProblem(onError(err) || null);
    } finally {
      setBusy(false);
    }
  }

  async function review(decision: 'accepted' | 'discarded') {
    if (!run) return;
    setReviewed(true);
    await api.reviewAgentRun(run.id, decision).catch(() => undefined);
  }

  if (!run) {
    return (
      <div className="ai-panel row wrap" style={{ justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <h3>
            Pre-consultation brief <span className="ai-tag">AI agent</span>
          </h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5 }}>
            What needs attention in the shared record, vitals trends, medicines and imaging, on one screen.
          </p>
          {problem && (
            <div className="alert alert-error" role="alert" style={{ marginTop: 8 }}>
              {problem}
            </div>
          )}
        </div>
        <button className="btn btn-light btn-sm" disabled={busy} onClick={() => void prepare()}>
          {busy ? <Spinner /> : <Icon name="refresh" />} {busy ? 'Preparing…' : 'Prepare brief'}
        </button>
      </div>
    );
  }

  const brief = run.output!;
  return (
    <section className="ai-panel stack" style={{ gap: 12 }} aria-labelledby="brief-h">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <h3 id="brief-h">
          Pre-consultation brief <span className="ai-tag">AI agent</span>
        </h3>
        <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => void prepare()}>
          {busy ? <Spinner /> : <Icon name="refresh" />} Refresh
        </button>
      </div>
      {brief.narrative && (
        <p className="selectable" style={{ margin: 0, lineHeight: 1.55 }}>
          {brief.narrative}
        </p>
      )}
      {brief.sections.map((s) => (
        <div key={s.title} className={s.title === 'Needs attention' && brief.attention.length ? 'ai-attention' : undefined}>
          <p className="label">{s.title}</p>
          <ul className="ai-list selectable">
            {s.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        {brief.notice}{' '}
        {run.llm_used
          ? run.guard
            ? 'The AI summary was withheld by the safety check; the lines above are computed by rules.'
            : 'The opening paragraph was written by an AI model from the lines below it.'
          : 'Computed by rules only: the patient has not allowed AI processing, or no model is configured.'}
      </p>
      <div className="row">
        {reviewed ? (
          <span className="muted" style={{ fontSize: 12.5 }}>
            Thanks, noted.
          </span>
        ) : (
          <>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Was this brief useful?
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => void review('accepted')}>
              Yes
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => void review('discarded')}>
              No
            </button>
          </>
        )}
      </div>
    </section>
  );
}
