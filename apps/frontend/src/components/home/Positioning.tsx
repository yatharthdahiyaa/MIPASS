import React from 'react';
import { Reveal } from './ui';

// Standards and systems MIPAAS integrates with, set as wordmarks (not customer logos).
const WORDMARKS: Array<{ name: string; style?: React.CSSProperties }> = [
  { name: 'OpenEMR', style: { fontWeight: 600, letterSpacing: '-0.02em' } },
  { name: 'DICOMweb', style: { fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' } },
  { name: 'HL7 FHIR R4', style: { fontWeight: 700, letterSpacing: '-0.01em' } },
  { name: 'ABDM · ABHA', style: { fontWeight: 500, letterSpacing: '0.06em' } },
  { name: 'Orthanc', style: { fontStyle: 'italic', fontWeight: 600 } },
  { name: 'Google Cloud', style: { fontWeight: 500, letterSpacing: '-0.02em' } },
  { name: 'PostgreSQL', style: { fontWeight: 600, letterSpacing: '-0.03em' } },
  { name: 'Pub/Sub', style: { fontFamily: 'var(--font-mono)', fontWeight: 600 } },
];

export default function Positioning() {
  return (
    <section id="positioning" className="pb-[var(--h-section-y)] pt-[96px]">
      <Reveal className="h-container">
        <p className="h-intro mx-auto max-w-[680px] text-center text-[var(--h-text)] text-balance">
          We turn every scan into an explainable, signed report.
        </p>
      </Reveal>

      <Reveal delay={150} className="mt-[72px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)]">
        <ul className="h-marquee flex w-max items-center">
          {[...WORDMARKS, ...WORDMARKS].map((w, i) => (
            <li
              key={`${w.name}-${i}`}
              aria-hidden={i >= WORDMARKS.length}
              className="flex h-14 w-[280px] shrink-0 items-center justify-center whitespace-nowrap text-[28px] text-[var(--h-text-2)] opacity-90"
              style={w.style}
            >
              {w.name}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
