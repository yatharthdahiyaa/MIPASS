/** Coded UI tiles used in the how-it-works cards. */
import React from 'react';
import { cx } from '@/components/marketing/ui';

/** A dark app window floating inside a tile. */
export function Screen({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        'overflow-hidden rounded-[10px] bg-[#0c0e12] text-left ring-1 ring-white/10 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]',
        className,
      )}
    >
      {title && (
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="ml-2 truncate font-mono text-[10px] text-slate-400">{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export const PIPELINE = [
  { name: 'Validation', detail: 'DICOM conformance, PHI checks', ms: 42 },
  { name: 'Clinical compatibility', detail: 'Modality, body part, protocol', ms: 18 },
  { name: 'Quality assessment', detail: 'SNR, sharpness, positioning', ms: 64 },
  { name: 'Preprocessing', detail: 'Windowing, resampling', ms: 120 },
  { name: 'AI inference', detail: 'Disease-specific models', ms: 910 },
  { name: 'Explainability', detail: 'Grad-CAM++, IG, occlusion', ms: 380 },
  { name: 'Report drafting', detail: 'Findings to narrative', ms: 260 },
];

export function PipelinePanel({ active = -1 }: { active?: number }) {
  return (
    <Screen title="agents · study CR-2041" className="w-full">
      <ol className="space-y-1 p-2.5">
        {PIPELINE.map((s, i) => {
          const done = active < 0 || i < active;
          const now = i === active;
          return (
            <li
              key={s.name}
              className={cx(
                'grid grid-cols-[18px_1fr_auto] items-center gap-3 rounded-md px-2.5 py-2 transition-colors duration-500',
                now && 'bg-white/[0.06]',
              )}
            >
              <span
                className={cx(
                  'grid h-[18px] w-[18px] place-items-center rounded-full font-mono text-[9px] transition-colors duration-500',
                  done ? 'bg-[#34C0AE]/20 text-[#6FD8C8]' : now ? 'bg-amber-400/20 text-amber-300' : 'bg-white/5 text-slate-500',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className={cx('block truncate text-[12px] transition-colors duration-500', done || now ? 'text-slate-100' : 'text-slate-500')}>
                  {s.name}
                </span>
                <span className="block truncate text-[10px] text-slate-500">{s.detail}</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">{s.ms} ms</span>
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}
