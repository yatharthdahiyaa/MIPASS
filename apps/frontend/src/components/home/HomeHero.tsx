'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Orb from './Orb';
import { useParallaxVars, useReducedMotion } from './hooks';
import { Arrow } from './ui';

// Orbit layout: percentage positions/sizes within the orbit box, plus depth
// (parallax strength; negative = far, which also blurs) and float amplitude.
const ORBS: Array<{
  top: number;
  left: number;
  size: number;
  depth: number;
  float: number;
  dur: number;
  palette: [string, string, string];
}> = [
  { top: 30.6, left: 26.7, size: 7.8, depth: 26, float: -16, dur: 14, palette: ['#ffd1f0', '#3fb4ff', '#6f7bff'] },
  { top: 13.5, left: 34.3, size: 5.7, depth: 18, float: -12, dur: 16, palette: ['#fffaf0', '#ffd78a', '#f2a65a'] },
  { top: 13.7, left: 47.4, size: 5.6, depth: 22, float: -14, dur: 13, palette: ['#d9f3ff', '#3aa0e0', '#1e5aa8'] },
  { top: 32.3, left: 59.2, size: 5.7, depth: -12, float: -10, dur: 18, palette: ['#ffb3a3', '#d44c3c', '#3a5b8c'] },
  { top: 58.8, left: 63.2, size: 5.7, depth: -18, float: -12, dur: 17, palette: ['#7fe0c4', '#1f6f7a', '#2a2f4a'] },
  { top: 76.8, left: 56.8, size: 5.4, depth: 14, float: -14, dur: 15, palette: ['#c9ffd9', '#20b486', '#1b3f6b'] },
  { top: 77.8, left: 43.8, size: 5.2, depth: 20, float: -12, dur: 12, palette: ['#ffd0e0', '#46c6e8', '#2a7fb8'] },
  { top: 59.4, left: 31.9, size: 5.1, depth: 24, float: -16, dur: 16, palette: ['#e8ff8a', '#38b6a0', '#2f3fbf'] },
];

const LINE_1 = ['Medical', 'imaging', 'AI'];
const LINE_2 = ['built', 'for', 'every', 'scan.'];

export default function HomeHero() {
  const reduced = useReducedMotion();
  const orbitRef = useParallaxVars<HTMLDivElement>(!reduced);
  const [newsOpen, setNewsOpen] = useState(true);

  let w = 0;
  const word = (t: string) => (
    <span key={`${t}-${w}`} className="h-word mr-[0.24em] last:mr-0" style={{ '--h-delay': `${120 + w++ * 80}ms` } as React.CSSProperties}>
      {t}
    </span>
  );

  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden" aria-labelledby="hero-title">
      {/* orbit */}
      <div
        ref={orbitRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto h-[min(100svh,60.117vw)] w-[min(100vw,166.342svh)] max-md:h-full max-md:w-[180%] max-md:-translate-x-[22%]"
      >
        {ORBS.map((o, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: `${o.top}%`,
              left: `${o.left}%`,
              width: `${o.size}%`,
              transform: `translate3d(calc(var(--px, 0) * ${o.depth}px), calc(var(--py, 0) * ${o.depth}px + var(--sy, 0) * ${o.depth * -6}px), 0)`,
              filter: o.depth < 0 ? 'blur(5px)' : undefined,
              opacity: o.depth < 0 ? 0.72 : 1,
            }}
          >
            <div
              style={{
                animation: `h-float ${o.dur}s ease-in-out ${-i * 1.7}s infinite`,
                '--h-float': `${o.float}px`,
              } as React.CSSProperties}
            >
              <Orb palette={o.palette} light={28 + (i % 3) * 6} />
            </div>
          </div>
        ))}
      </div>

      <div className="h-container relative">
        <h1
          id="hero-title"
          className="h-hero mx-auto max-w-[1180px] text-[var(--h-text)] max-md:max-w-[340px] max-md:text-center max-md:text-balance"
        >
          <span className="md:block md:whitespace-nowrap md:pl-[4%]">{LINE_1.map(word)} </span>
          <span className="md:block md:whitespace-nowrap md:pl-[38%]">{LINE_2.map(word)}</span>
        </h1>
      </div>

      {newsOpen && (
        <div className="h-reveal is-in absolute bottom-6 left-[var(--h-pad-x)] z-10 hidden md:block" style={{ '--h-delay': '900ms' } as React.CSSProperties}>
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-[#161618]/[0.94] p-[5px] pr-2 backdrop-blur-xl">
            <Link href="/chest-xray" className="group flex items-center gap-3">
              <span className="relative grid h-[56px] w-[72px] place-items-center overflow-hidden rounded-[11px] bg-[var(--h-surface-3)]">
                <span className="w-8">
                  <Orb palette={['#ffd0c4', '#ff6a5c', '#5a1f3a']} />
                </span>
              </span>
              <span className="max-w-[200px]">
                <span className="block font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--h-muted)]">News</span>
                <span className="block text-[14px] leading-[18px] text-[var(--h-text-2)] group-hover:text-white">
                  Watch a chest X-ray run through every agent
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setNewsOpen(false)}
              aria-label="Dismiss news"
              className="grid h-7 w-7 place-items-center self-start rounded-full text-[var(--h-muted)] hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <a
        href="#positioning"
        className="absolute bottom-8 right-[var(--h-pad-x)] hidden items-center gap-2 font-mono text-[13px] uppercase tracking-[0.04em] text-[var(--h-muted)] hover:text-white md:flex"
      >
        Scroll
        <Arrow className="h-3 w-3 rotate-90" />
      </a>
    </section>
  );
}
