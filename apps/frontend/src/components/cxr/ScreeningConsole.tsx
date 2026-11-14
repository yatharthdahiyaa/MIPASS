'use client';

import React, { useEffect, useState } from 'react';
import { useReducedMotion } from '@/components/home/hooks';
import { MonoLabel, cx } from '@/components/home/ui';
import CxrFilm from './CxrFilm';
import {
  CRITICAL,
  PATHOLOGIES,
  PIPELINE,
  STUDIES,
  THRESHOLDS,
  label,
  positives,
  type Pathology,
  type Priority,
} from './data';

const STEP_MS = 700;
const MODEL_STEP = PIPELINE.findIndex((s) => s.key === 'model');
const TRIAGE_STEP = PIPELINE.findIndex((s) => s.key === 'triage');
const REPORT_STEP = PIPELINE.findIndex((s) => s.key === 'report');

const PRIORITY_STYLE: Record<Priority, string> = {
  STAT: 'bg-[#ff4d6d]/15 text-[#ff8197] ring-[#ff4d6d]/40',
  URGENT: 'bg-amber-400/15 text-amber-300 ring-amber-400/40',
  ROUTINE: 'bg-[#34C0AE]/15 text-[#6FD8C8] ring-[#34C0AE]/40',
};

/** Interactive walk-through of one chest X-ray study moving through the agents and the model. */
export default function ScreeningConsole() {
  const reduced = useReducedMotion();
  const [studyId, setStudyId] = useState(STUDIES[0].id);
  // Index of the running step; PIPELINE.length means the study is complete.
  const [stage, setStage] = useState(0);
  const [showMap, setShowMap] = useState(true);
  const [active, setActive] = useState<Pathology | null>(null);

  const study = STUDIES.find((s) => s.id === studyId)!;
  const done = stage >= PIPELINE.length;
  const modelDone = stage > MODEL_STEP;
  const triageDone = stage > TRIAGE_STEP;
  const reportDone = stage > REPORT_STEP;
  const found = positives(study);

  useEffect(() => {
    if (stage >= PIPELINE.length) return;
    const t = window.setTimeout(() => setStage(reduced ? PIPELINE.length : stage + 1), reduced ? 0 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [stage, reduced]);

  const run = (id = studyId) => {
    setStudyId(id);
    setActive(null);
    setStage(0);
  };

  return (
    <div className="rounded-[20px] border border-[var(--h-hairline)] bg-[var(--h-surface-1)] p-2 sm:p-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2">
        <div role="tablist" aria-label="Sample studies" className="flex flex-wrap gap-1.5">
          {STUDIES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === studyId}
              onClick={() => run(s.id)}
              className={cx(
                'rounded-[11px] px-3.5 py-2 text-left transition-colors',
                s.id === studyId ? 'bg-[var(--h-surface-3)] text-white' : 'text-[var(--h-muted)] hover:bg-white/[0.04] hover:text-[var(--h-text-2)]',
              )}
            >
              <span className="block text-[14px] font-medium">{s.title}</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.04em] opacity-80">{s.accession}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--h-muted)]" aria-live="polite">
            {done ? 'Complete · awaiting sign-off' : `Step ${stage + 1} of ${PIPELINE.length}`}
          </span>
          <button type="button" onClick={() => run()} className="h-btn h-btn-light h-[38px] rounded-[10px] px-4 text-[14px]">
            {done ? 'Replay' : 'Restart'}
          </button>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-12">
        {/* viewer */}
        <div className="relative flex items-center overflow-hidden rounded-[14px] bg-[#050506] lg:col-span-5">
          <div className="mx-auto aspect-[100/120] w-full max-w-[560px]">
            <CxrFilm study={study} showMap={showMap && modelDone} active={active} scanning={!modelDone && stage === MODEL_STEP} onHover={setActive} />
          </div>
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
            <span className="rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--h-muted)] backdrop-blur">
              {study.accession} · {study.age} · {study.view}
            </span>
            {triageDone && (
              <span className={cx('rounded-md px-2 py-1 font-mono text-[10px] font-semibold ring-1', PRIORITY_STYLE[study.priority])}>
                {study.priority}
              </span>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
            <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--h-muted)]">Sample study · drawn, not a patient</span>
            <label className={cx('flex items-center gap-2 text-[12px] text-[var(--h-text-2)]', !modelDone && 'opacity-40')}>
              <input
                type="checkbox"
                checked={showMap}
                disabled={!modelDone}
                onChange={(e) => setShowMap(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#34C0AE]"
              />
              Focus map
            </label>
          </div>
        </div>

        {/* agent timeline */}
        <ol className="rounded-[14px] bg-[var(--h-surface-2)] p-2 lg:col-span-7" aria-label="Agent pipeline">
          {PIPELINE.map((step, i) => {
            const state = i < stage ? 'done' : i === stage ? 'running' : 'queued';
            return (
              <li
                key={step.key}
                className={cx(
                  'grid grid-cols-[22px_1fr] gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-500',
                  state === 'running' && 'bg-white/[0.05]',
                )}
              >
                <span
                  className={cx(
                    'mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[10px] transition-colors duration-500',
                    state === 'done' && 'bg-[#34C0AE]/20 text-[#6FD8C8]',
                    state === 'running' && 'bg-amber-400/20 text-amber-300',
                    state === 'queued' && 'bg-white/5 text-[var(--h-muted)]',
                  )}
                >
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx('text-[15px] font-medium transition-colors', state === 'queued' ? 'text-[var(--h-muted)]' : 'text-[var(--h-text)]')}>
                      {step.name}
                    </span>
                    <span
                      className={cx(
                        'rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] uppercase',
                        step.kind === 'model' ? 'bg-[#3fb0ff]/15 text-[#8fd0ff]' : 'bg-white/[0.06] text-[var(--h-muted)]',
                      )}
                    >
                      {step.kind === 'model' ? 'Model' : `Agent · ${step.autonomy}`}
                    </span>
                    {state === 'running' && <span className="font-mono text-[10px] uppercase text-amber-300">Running…</span>}
                  </div>
                  {state === 'done' && (
                    <ul className="cxr-in mt-1 space-y-0.5">
                      {step.output(study).map((line) => (
                        <li key={line} className="text-[13px] leading-[19px] text-[var(--h-muted)]">
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* model output */}
        <section className="rounded-[14px] bg-[var(--h-surface-2)] p-5 lg:col-span-5" aria-labelledby="cxr-scores">
          <div className="flex items-baseline justify-between">
            <MonoLabel className="text-[var(--h-muted)]">
              <span id="cxr-scores">Model output</span>
            </MonoLabel>
            <span className="font-mono text-[10px] text-[var(--h-muted)]">score · │ threshold</span>
          </div>
          <ul className="mt-4 space-y-2">
            {PATHOLOGIES.map((p) => {
              const score = study.scores[p];
              const pos = score >= THRESHOLDS[p];
              return (
                <li
                  key={p}
                  onMouseEnter={() => setActive(pos ? p : null)}
                  onMouseLeave={() => setActive(null)}
                  className={cx('rounded-md px-1.5 py-0.5 transition-colors', active === p && 'bg-white/[0.05]')}
                >
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className={cx(pos && modelDone ? 'font-medium text-[var(--h-text)]' : 'text-[var(--h-muted)]')}>
                      {label(p)}
                      {pos && modelDone && CRITICAL.has(p) && <span className="ml-1.5 font-mono text-[9px] uppercase text-[#ff8197]">Critical</span>}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--h-muted)]">{modelDone ? score.toFixed(2) : '–'}</span>
                  </div>
                  <div className="relative mt-1 h-1.5 rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-[var(--h-ease-out)]"
                      style={{
                        width: modelDone ? `${score * 100}%` : '0%',
                        background: pos ? (CRITICAL.has(p) ? '#ff4d6d' : '#f5a623') : '#5b6474',
                      }}
                    />
                    <span className="absolute -top-0.5 h-2.5 w-px bg-[var(--h-text-2)]/70" style={{ left: `${THRESHOLDS[p] * 100}%` }} aria-hidden="true" />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* draft report */}
        <section className="flex flex-col rounded-[14px] bg-[var(--h-surface-2)] p-5 lg:col-span-7" aria-labelledby="cxr-report">
          <div className="flex items-baseline justify-between gap-3">
            <MonoLabel className="text-[var(--h-muted)]">
              <span id="cxr-report">Draft report</span>
            </MonoLabel>
            <span className="font-mono text-[10px] uppercase text-[var(--h-muted)]">Report drafting · L0</span>
          </div>
          {reportDone ? (
            <div className="cxr-in mt-4 flex flex-1 flex-col">
              <p className="text-[17px] leading-[27px] text-[var(--h-text-2)]">
                {study.report.map((s) => (
                  <span
                    key={s.text}
                    onMouseEnter={() => s.finding && setActive(s.finding)}
                    onMouseLeave={() => setActive(null)}
                    className={cx(
                      'rounded-sm transition-colors',
                      s.finding && 'cursor-default underline decoration-[#f5a623]/60 decoration-dotted underline-offset-4',
                      s.finding && active === s.finding && 'bg-[#f5a623]/15 text-white',
                    )}
                  >
                    {s.text}{' '}
                  </span>
                ))}
              </p>
              {found.length > 0 && (
                <p className="mt-3 text-[12px] text-[var(--h-muted)]">Hover an underlined sentence to see the region it is grounded in.</p>
              )}
              <div className="mt-auto pt-6">
                <p className="flex items-center gap-2 border-t border-[var(--h-hairline)] pt-4 text-[13px] text-[var(--h-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                  Not sent. A radiologist reviews, edits and e-signs every report.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid flex-1 place-items-center rounded-[10px] border border-dashed border-[var(--h-border)] py-12 text-[13px] text-[var(--h-muted)]">
              Waiting for the model and triage…
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
