import React from 'react';
import Orb from '@/components/home/Orb';
import { Grain, MonoLabel, Reveal } from '@/components/home/ui';
import ScreeningConsole from './ScreeningConsole';
import { AGENTS, AUTONOMY, PATHOLOGIES, THRESHOLDS, label, type Autonomy } from './data';

export function CxrHero() {
  return (
    <section className="relative overflow-hidden pt-40 pb-16 lg:pt-48">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-20 w-[340px] opacity-80 blur-[2px] max-md:hidden">
        <Orb palette={['#d6fffb', '#00dcce', '#0b4a63']} />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 bottom-0 w-[140px] opacity-60 blur-[6px] max-md:hidden">
        <Orb palette={['#e8f6ff', '#3fb0ff', '#3a7fd8']} />
      </div>
      <div className="h-container relative">
        <MonoLabel className="text-[var(--h-muted)]">Chest X-ray screening</MonoLabel>
        <h1 className="h-display-xl mt-4 max-w-[900px] text-balance text-[var(--h-text)]">
          One radiograph, nine agents, fourteen findings.
        </h1>
        <p className="h-intro mt-6 max-w-[720px] text-[var(--h-muted)]">
          See how a chest X-ray moves through MIPAAS: checked, de-identified, scored by DenseNet-121, triaged, compared with
          priors and drafted into a report that a radiologist signs.
        </p>
        <dl className="mt-12 grid max-w-[880px] grid-cols-2 gap-px overflow-hidden rounded-[16px] bg-[var(--h-hairline)] sm:grid-cols-4">
          {[
            ['14', 'findings scored per film'],
            ['9', 'agents around the model'],
            ['3', 'autonomy levels, L0 to L2'],
            ['1', 'radiologist signs every report'],
          ].map(([v, l]) => (
            <div key={l} className="bg-[var(--h-page)] p-5">
              <dt className="sr-only">{l}</dt>
              <dd>
                <span className="block text-[40px] font-medium leading-none tracking-[-0.03em] text-[var(--h-text)]">{v}</span>
                <span className="mt-2 block text-[13px] text-[var(--h-muted)]">{l}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function ConsoleSection() {
  return (
    <section id="console" className="scroll-mt-24 pt-10">
      <div className="h-container">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <MonoLabel className="text-[var(--h-muted)]">Live walk-through</MonoLabel>
            <h2 className="h-display-l mt-3 text-[var(--h-text)]">Watch a study run.</h2>
          </div>
          <p className="max-w-[420px] text-[15px] leading-[22px] text-[var(--h-muted)]">
            Pick a sample study. Hover a finding or an underlined sentence to see where the model looked. The films and scores
            are illustrative, not real patient data.
          </p>
        </div>
        <ScreeningConsole />
      </div>
    </section>
  );
}

export function ModelSection() {
  const spec = [
    ['Architecture', 'DenseNet-121'],
    ['Fallback', 'ResNet-18, same 14 labels'],
    ['Input', 'Single-channel grayscale radiograph'],
    ['Output', '14 independent sigmoid scores'],
    ['Decision', 'Per-class thresholds, tuned per label'],
    ['Explainability', 'Focus map for every positive finding'],
  ];
  return (
    <section id="model" className="scroll-mt-24 pt-[var(--h-section-y)]">
      <div className="h-container">
        <Reveal>
          <div className="h-alloy relative overflow-hidden rounded-[20px] px-6 py-14 sm:px-10 lg:p-20">
            <Grain />
            <div className="relative grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <MonoLabel className="text-[var(--h-ink-muted)]">The model</MonoLabel>
                <h2 className="h-display-l mt-3 text-[var(--h-ink)]">Fourteen findings, each with its own bar.</h2>
                <p className="h-body mt-6 text-[var(--h-ink-muted)]">
                  The model scores each pathology independently, so one film can be positive for several. Each label has its own
                  threshold, set lower where a miss costs more.
                </p>
                <dl className="mt-10 divide-y divide-black/10 border-y border-black/10">
                  {spec.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-6 py-3 text-[15px]">
                      <dt className="text-[var(--h-ink-muted)]">{k}</dt>
                      <dd className="text-right font-medium text-[var(--h-ink)]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="lg:col-span-7">
                <p className="h-label text-[var(--h-ink-muted)]">Decision thresholds</p>
                <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {PATHOLOGIES.map((p) => (
                    <li key={p}>
                      <div className="flex items-baseline justify-between text-[14px]">
                        <span className="text-[var(--h-ink)]">{label(p)}</span>
                        <span className="font-mono text-[12px] text-[var(--h-ink-muted)]">{THRESHOLDS[p].toFixed(2)}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-[var(--h-ink)]" style={{ width: `${THRESHOLDS[p] * 250}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[13px] text-[var(--h-ink-muted)]">Bars scaled to 0.40. A score at or above the threshold counts as positive.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const AUTONOMY_TONE: Record<Autonomy, string> = {
  L0: 'bg-[#3fb0ff]/15 text-[#8fd0ff]',
  L1: 'bg-amber-400/15 text-amber-300',
  L2: 'bg-[#34C0AE]/15 text-[#6FD8C8]',
};

export function AgentsSection() {
  return (
    <section id="agents" className="scroll-mt-24 pt-[var(--h-section-y)]">
      <div className="h-container">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <MonoLabel className="text-[var(--h-muted)]">The agents</MonoLabel>
            <h2 className="h-display-l mt-3 max-w-[640px] text-[var(--h-text)]">Everything around the model, so the radiologist reads, not files.</h2>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Autonomy levels">
            {(Object.keys(AUTONOMY) as Autonomy[]).map((a) => (
              <li key={a} className="flex items-center gap-2 rounded-full border border-[var(--h-hairline)] px-3 py-1.5 text-[13px] text-[var(--h-text-2)]">
                <span className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] ${AUTONOMY_TONE[a]}`}>{a}</span>
                {AUTONOMY[a]}
              </li>
            ))}
          </ul>
        </div>
        <ul className="mt-14 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a, i) => (
            <Reveal as="li" key={a.name} delay={(i % 3) * 80} className="rounded-[16px] bg-[var(--h-surface-1)] p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[var(--h-muted)]">{String(i + 1).padStart(2, '0')}</span>
                <span className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] ${AUTONOMY_TONE[a.autonomy]}`}>{a.autonomy}</span>
              </div>
              <h3 className="h-title mt-8 text-[var(--h-text)]">{a.name}</h3>
              <p className="mt-2 text-[15px] leading-[22px] text-[var(--h-muted)]">{a.role}</p>
            </Reveal>
          ))}
        </ul>
        <p className="mt-6 text-[13px] text-[var(--h-muted)]">
          No agent signs, sends or pages on a clinical finding by itself. L1 actions wait for a clinician; L0 agents only suggest.
        </p>
      </div>
    </section>
  );
}
