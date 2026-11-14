'use client';

import React from 'react';
import Link from 'next/link';
import CxrFilm from '@/components/cxr/CxrFilm';
import { AUTONOMY, PIPELINE, STUDIES } from '@/components/cxr/data';
import { Arrow, MonoLabel } from './ui';

/**
 * The "glimpse" shown under each Clinical evidence claim: a small live look at the
 * service the claim is about, plus a route into it. Built from the same static
 * definitions the Chest X-ray service uses, so nothing here is invented.
 */

function GlimpseLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group mt-6 inline-flex items-center gap-2 text-[15px] font-medium text-[var(--h-text)] hover:text-white"
    >
      {children}
      <span className="transition-transform group-hover:translate-x-0.5">
        <Arrow className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-8 rounded-2xl border border-[var(--h-border)] bg-[var(--h-surface-1)] p-5 sm:grid-cols-[minmax(0,260px)_1fr] sm:p-6">
      {children}
    </div>
  );
}

function FocusMapGlimpse() {
  const study = STUDIES[0];
  return (
    <Frame>
      <div className="aspect-[100/120] overflow-hidden rounded-xl border border-[var(--h-hairline)]">
        <CxrFilm study={study} showMap active={null} scanning={false} />
      </div>
      <div className="flex flex-col justify-center">
        <MonoLabel>Service · Chest X-ray</MonoLabel>
        <p className="mt-3 text-[22px] font-medium leading-[28px] tracking-[-0.01em] text-[var(--h-text)]">
          See which region drove each finding.
        </p>
        <p className="mt-2 text-[15px] leading-[22px] text-[var(--h-muted)]">
          Upload a radiograph and every flagged pathology comes back with a focus map over the film.
        </p>
        <GlimpseLink href="/chest-xray#console">Open Chest X-ray screening</GlimpseLink>
        <p className="mt-4 text-[12px] text-[var(--h-muted)]">Illustrative sample film, not a real patient.</p>
      </div>
    </Frame>
  );
}

function AuditGlimpse() {
  const lanes = [
    { name: 'Patient portal', body: 'Own records and consent only.', href: '/patient' },
    { name: 'Doctor workstation', body: 'Clinical review, signing and reports.', href: '/doctor' },
  ];
  return (
    <Frame>
      <ul className="grid content-center gap-2 sm:col-span-2 sm:grid-cols-2">
        {lanes.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group block h-full rounded-xl bg-[var(--h-surface-3)] p-5 transition-colors hover:bg-[#2a2a2c]"
            >
              <p className="text-[17px] font-medium text-[var(--h-text)]">{l.name}</p>
              <p className="mt-1 text-[14px] leading-[20px] text-[var(--h-muted)]">{l.body}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-[14px] text-[var(--h-text-2)] transition-transform group-hover:translate-x-0.5">
                Open <Arrow className="h-3 w-3" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function PipelineGlimpse() {
  return (
    <Frame>
      <div className="sm:col-span-2">
        <MonoLabel>Service · Chest X-ray</MonoLabel>
        <ol className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {PIPELINE.map((s, n) => (
            <li key={s.key} className="flex items-baseline gap-3 border-b border-[var(--h-hairline)] py-2.5 text-[15px]">
              <span className="font-mono text-[12px] text-[var(--h-muted)]">{String(n + 1).padStart(2, '0')}</span>
              <span className="text-[var(--h-text)]">{s.name}</span>
              <span className="ml-auto text-[12px] text-[var(--h-muted)]">
                {s.autonomy ? AUTONOMY[s.autonomy] : 'Model'}
              </span>
            </li>
          ))}
        </ol>
        <GlimpseLink href="/chest-xray#agents">See the agents at work</GlimpseLink>
      </div>
    </Frame>
  );
}

export default function EvidenceGlimpse({ index }: { index: number }) {
  if (index === 0) return <FocusMapGlimpse />;
  if (index === 1) return <AuditGlimpse />;
  return <PipelineGlimpse />;
}
