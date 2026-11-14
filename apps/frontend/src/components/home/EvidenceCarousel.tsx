'use client';

import React, { useState } from 'react';
import Orb from './Orb';
import EvidenceGlimpse from './EvidenceGlimpse';
import { useReducedMotion, useVisible } from './hooks';
import { Arrow, MonoLabel, cx } from './ui';

// Claims restate platform facts; attributed to the platform, not a person.
const SLIDES = [
  {
    product: 'Explainability',
    name: 'Focus maps',
    modality: 'All modalities',
    palette: ['#d6fffb', '#00dcce', '#0b4a63'] as [string, string, string],
    claim: 'Every finding ships with a focus map, so the radiologist can see what the system looked at before signing.',
  },
  {
    product: 'Governance',
    name: 'Audit trail',
    modality: 'Platform',
    palette: ['#e6deff', '#7c5cfc', '#2a1a6b'] as [string, string, string],
    claim: 'Role-based access and an audit entry for every sign-in and clinical action, stored in the central database.',
  },
  {
    product: 'MIPAAS',
    name: 'Agent pipeline',
    modality: 'All modalities',
    palette: ['#e8f6ff', '#3fb0ff', '#3a7fd8'] as [string, string, string],
    claim: 'Every study passes seven agents, from DICOM validation to a draft report, before a radiologist signs it.',
  },
];

const DURATION = 7000;
const RING = 2 * Math.PI * 23;

export default function EvidenceCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const [ref, visible] = useVisible<HTMLElement>();
  const slide = SLIDES[i];
  const go = (d: number) => setI((v) => (v + d + SLIDES.length) % SLIDES.length);
  const running = visible && !paused && !reduced;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section
      ref={ref}
      aria-roledescription="carousel"
      aria-label="Clinical evidence"
      className="pt-[var(--h-section-y)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      <div className="h-container">
        <div className="flex items-center justify-between border-t border-[var(--h-hairline)] pt-4">
          <MonoLabel className="text-[var(--h-text)]">Clinical evidence</MonoLabel>
          <div className="flex items-center gap-6">
            <p className="font-mono text-[15px] tracking-[0.02em]">
              <span className="text-[var(--h-text)]">{pad(i + 1)}</span>
              <span className="mx-2 text-[var(--h-muted)]">/</span>
              <span className="text-[var(--h-muted)]">{pad(SLIDES.length)}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous slide"
                className="grid h-12 w-12 place-items-center rounded-full border border-[var(--h-border)] text-[var(--h-text)] transition-colors hover:bg-white/[0.06]"
              >
                <Arrow className="h-4 w-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next slide"
                className="relative grid h-12 w-12 place-items-center rounded-full border border-[var(--h-border)] text-[var(--h-text)] transition-colors hover:bg-white/[0.06]"
              >
                <Arrow className="h-4 w-4" />
                <svg viewBox="0 0 48 48" className="pointer-events-none absolute inset-[-1px] -rotate-90" aria-hidden="true">
                  <circle
                    key={i}
                    cx="24"
                    cy="24"
                    r="23"
                    fill="none"
                    stroke="var(--h-text)"
                    strokeWidth="1.5"
                    strokeDasharray={RING}
                    strokeDashoffset={RING}
                    onAnimationEnd={() => go(1)}
                    style={{
                      animation: reduced ? 'none' : `h-ring ${DURATION}ms linear forwards`,
                      animationPlayState: running ? 'running' : 'paused',
                    }}
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div key={`a-${i}`} className="h-rise lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="w-8">
                <Orb palette={slide.palette} />
              </span>
              <span className="text-[19px] font-medium tracking-[-0.01em] text-[var(--h-text)]">{slide.product}</span>
            </div>
            <p className="mt-5 text-[17px] font-medium leading-[25px] text-[var(--h-text)]">{slide.name}</p>
            <p className="text-[17px] leading-[25px] text-[var(--h-muted)]">{slide.modality}</p>
          </div>
          <div aria-live="polite" className="lg:col-span-8">
            <p key={`q-${i}`} className={cx('h-quote h-rise text-[var(--h-text)] text-pretty')}>
              {slide.claim}
            </p>
            <div key={`g-${i}`} className="h-rise mt-10">
              <EvidenceGlimpse index={i} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
