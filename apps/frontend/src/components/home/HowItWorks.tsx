'use client';

import React, { useEffect, useState } from 'react';
import Orb from './Orb';
import { PIPELINE, PipelinePanel } from './visuals/panels';
import { useReducedMotion, useVisible } from './hooks';
import { Caption, MonoLabel, PillLink, Reveal, cx } from './ui';

// Points on the ellipse (cx 300, cy 150, rx 252, ry 66, rotated -9°) at t = 110°, 235°, 330°.
const LOOP = [
  { key: 'detect', label: 'Detect', x: 225, y: 225, lx: 225, ly: 258, anchor: 'middle' as const },
  { key: 'explain', label: 'Explain', x: 149, y: 119, lx: 149, ly: 96, anchor: 'middle' as const },
  { key: 'sign', label: 'Sign', x: 510, y: 83, lx: 510, ly: 60, anchor: 'middle' as const },
];

/** Steps through `count` items every `ms` while visible (frozen under reduced motion). */
function useCycle(count: number, ms: number, run: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % count), ms);
    return () => window.clearInterval(t);
  }, [count, ms, run]);
  return i;
}

function ReadLoop({ active }: { active: number }) {
  return (
    <svg viewBox="0 0 600 300" className="h-full w-full" aria-hidden="true">
      <ellipse
        cx="300"
        cy="150"
        rx="252"
        ry="66"
        transform="rotate(-9 300 150)"
        fill="none"
        stroke="rgb(255 255 255 / 0.28)"
        strokeDasharray="2 5"
      />
      {LOOP.map((n, i) => {
        const on = i === active;
        return (
          <g key={n.key} data-seq-step className="transition-opacity">
            <circle cx={n.x} cy={n.y} r="7" fill="none" stroke={on ? '#f4f5f8' : '#8a8e97'} strokeWidth="1.4" />
            <circle cx={n.x} cy={n.y} r="2.4" fill={on ? '#f4f5f8' : '#8a8e97'} />
            {on && <circle cx={n.x - 16} cy={n.y} r="3" fill="#f4f5f8" />}
            <text
              x={n.lx}
              y={n.ly}
              textAnchor={n.anchor}
              fontFamily="var(--font-mono)"
              fontSize="15"
              fontWeight="500"
              letterSpacing="0.04em"
              fill={on ? '#f4f5f8' : '#8a8e97'}
              style={{ transition: 'fill 0.5s ease' }}
            >
              {n.label.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function HowItWorks() {
  const reduced = useReducedMotion();
  const [ref, visible] = useVisible<HTMLDivElement>();
  const loop = useCycle(LOOP.length, 2500, visible && !reduced);
  const step = useCycle(PIPELINE.length + 1, 900, visible && !reduced);

  return (
    <section id="how-it-works" className="scroll-mt-24 pt-[var(--h-section-y)]">
      <div className="h-container" ref={ref}>
        <Reveal>
          <MonoLabel className="text-[var(--h-muted)]">How it works</MonoLabel>
          <h2 className="h-display-l mt-3 text-[var(--h-text)]">Smarter diagnosis, faster.</h2>
        </Reveal>

        <div className="mt-12 grid gap-x-6 gap-y-16 lg:mt-14 lg:grid-cols-2">
          <Reveal>
            <div
              className="relative aspect-[5/3] overflow-hidden rounded-[20px]"
              style={{ background: 'linear-gradient(135deg, #f6dcc8 0%, #e9d9c8 30%, #9fd3cf 70%, #4cc7d6 100%)' }}
            >
              <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
                <span className="h-grain" style={{ opacity: 0.3 }} />
              </span>
              <div className="absolute left-[7%] top-[12%] w-[86%] sm:left-[14%] sm:w-[80%]">
                <PipelinePanel active={reduced ? -1 : step === PIPELINE.length ? -1 : step} />
              </div>
            </div>
            <Caption lead="Agent pipeline" className="mt-5 !text-[clamp(20px,1.7vw,24px)] !leading-[1.3]">
              Seven specialised agents validate, analyse, explain and draft every study, with timings you can audit.
            </Caption>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative aspect-[5/3] overflow-hidden rounded-[20px] bg-[var(--h-surface-3)]">
              <div className="absolute inset-0 px-[4%]">
                <ReadLoop active={loop} />
              </div>
              <div className="absolute left-1/2 top-1/2 w-[18%] -translate-x-1/2 -translate-y-1/2">
                <Orb palette={['#e8f6ff', '#3fb0ff', '#3a7fd8']} light={30} />
              </div>
            </div>
            <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row sm:justify-between sm:gap-8">
              <Caption lead="Read loop" className="!text-[clamp(20px,1.7vw,24px)] !leading-[1.3]">
                AI detects and explains, a clinician reviews and signs, and every step is recorded.
              </Caption>
              <PillLink href="/agents" arrow className={cx('shrink-0')}>
                Learn more
              </PillLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
