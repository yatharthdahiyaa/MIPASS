import React from 'react';
import type { FocusRegion, Pathology, SampleStudy } from './data';

/**
 * A drawn PA chest radiograph (patient's right on the image left), with optional
 * focus-map overlays. ViewBox is 100 × 120, matching the region coordinates in data.ts.
 */
export default function CxrFilm({
  study,
  showMap,
  active,
  scanning,
  onHover,
}: {
  study: SampleStudy;
  showMap: boolean;
  active: Pathology | null;
  scanning: boolean;
  onHover?: (p: Pathology | null) => void;
}) {
  const id = `cxr-${study.id}`;
  return (
    <svg viewBox="0 0 100 120" className="block h-full w-full" role="img" aria-label={`Sample chest radiograph: ${study.title}`}>
      <defs>
        <radialGradient id={`${id}-body`} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#5d6066" />
          <stop offset="70%" stopColor="#2c2e32" />
          <stop offset="100%" stopColor="#0b0c0d" />
        </radialGradient>
        <linearGradient id={`${id}-lung`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0b0c" />
          <stop offset="75%" stopColor="#16181b" />
          <stop offset="100%" stopColor="#2a2c30" />
        </linearGradient>
        <radialGradient id={`${id}-heart`} cx="55%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#c9cbcf" />
          <stop offset="100%" stopColor="#7d8086" />
        </radialGradient>
        <radialGradient id={`${id}-heat`}>
          <stop offset="0%" stopColor="#ff3d5a" stopOpacity="0.85" />
          <stop offset="35%" stopColor="#ff9b3d" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#ffe14d" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffe14d" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`}>
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <filter id={`${id}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0" />
        </filter>
        <clipPath id={`${id}-rlung`}>
          <path d="M44 17 C34 16 22 24 17 40 C13 54 13 70 15 82 C24 79 36 79 46 82 C47 62 47 36 44 17Z" />
        </clipPath>
      </defs>

      <rect width="100" height="120" fill="#050506" />
      {/* soft tissue */}
      <path d="M8 120 C6 80 6 40 18 14 C30 8 70 8 82 14 C94 40 94 80 92 120Z" fill={`url(#${id}-body)`} />

      {/* lungs */}
      <g filter={`url(#${id}-soft)`}>
        <path d="M44 17 C34 16 22 24 17 40 C13 54 13 70 15 82 C24 79 36 79 46 82 C47 62 47 36 44 17Z" fill={`url(#${id}-lung)`} />
        <path d="M56 17 C66 16 78 24 83 40 C87 54 87 70 85 80 C78 77 70 76 64 78 C58 66 56 40 56 17Z" fill={`url(#${id}-lung)`} />
      </g>

      {/* lung markings (vessels), hidden at the right apex when there is a pneumothorax */}
      <g stroke="#6b6f76" strokeWidth="0.35" fill="none" opacity="0.55" strokeLinecap="round">
        {[
          'M44 40 C38 38 32 36 26 30',
          'M44 44 C36 44 28 46 20 48',
          'M44 48 C38 54 30 60 22 66',
          'M44 46 C40 50 36 56 32 64',
          'M45 42 C40 36 37 30 34 24',
        ].map((d, i) => (
          <path key={i} d={d} opacity={study.pneumothorax && i === 0 ? 0 : 1} />
        ))}
        {['M56 42 C62 38 68 34 74 28', 'M56 46 C64 46 72 48 80 50', 'M57 50 C62 56 68 62 76 68', 'M56 44 C60 38 63 32 66 24'].map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {study.pneumothorax && (
        <g clipPath={`url(#${id}-rlung)`}>
          {/* collapsed lung edge: dark, marking-free space lateral to the visceral pleural line */}
          <path d="M44 17 C34 16 22 24 17 40 L17 48 C24 46 28 38 30 30 C32 24 36 19 44 17Z" fill="#030304" />
          <path d="M17 48 C24 46 28 38 30 30 C32 24 36 19 42 17.5" stroke="#d8dadd" strokeWidth="0.4" fill="none" />
        </g>
      )}

      {/* ribs */}
      <g stroke="#9a9ea5" strokeWidth="1.1" fill="none" opacity="0.32" strokeLinecap="round">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const y = 22 + i * 7.4;
          return (
            <React.Fragment key={i}>
              <path d={`M47 ${y} C38 ${y - 4} 24 ${y - 1} ${15 + i * 0.3} ${y + 7}`} />
              <path d={`M53 ${y} C62 ${y - 4} 76 ${y - 1} ${85 - i * 0.3} ${y + 7}`} />
            </React.Fragment>
          );
        })}
      </g>

      {/* clavicles */}
      <g stroke="#c4c7cc" strokeWidth="1.6" fill="none" opacity="0.6" strokeLinecap="round">
        <path d="M47 19 C38 16 28 15 18 18" />
        <path d="M53 19 C62 16 72 15 82 18" />
      </g>

      {/* spine and mediastinum */}
      <rect x="47.5" y="14" width="5" height="100" rx="2" fill="#8d9096" opacity="0.28" />
      <path d="M47 18 C46 30 45 40 46 52 L54 52 C55 40 54 30 53 18Z" fill="#a3a6ab" opacity="0.3" />
      <path d="M46 50 C43 56 42 66 45 78 C52 82 62 82 70 78 C72 68 68 56 58 50Z" fill={`url(#${id}-heart)`} opacity="0.55" />

      {/* diaphragm */}
      <path d="M14 84 C24 76 38 77 47 84" stroke="#b9bcc1" strokeWidth="0.9" fill="none" opacity="0.7" />
      <path d="M53 82 C62 76 76 76 86 82" stroke="#b9bcc1" strokeWidth="0.9" fill="none" opacity="0.7" />

      {study.effusion && <path d="M15 82 C18 74 24 72 30 74 C36 76 42 78 46 82Z" fill="#b5b8bd" opacity="0.65" filter={`url(#${id}-soft)`} />}
      {study.nodule && <circle cx="66" cy="44" r="2.4" fill="#c9cbcf" opacity="0.8" filter={`url(#${id}-soft)`} />}

      {/* film grain + markers */}
      <rect width="100" height="120" filter={`url(#${id}-grain)`} />
      <text x="9" y="26" fill="#e8e9eb" fontSize="4.5" fontFamily="var(--font-geist-mono), monospace">
        R
      </text>

      {/* focus maps */}
      <g style={{ transition: 'opacity 400ms', opacity: showMap ? 1 : 0 }}>
        {study.regions.map((r) => (
          <Hotspot key={r.pathology} r={r} fill={`url(#${id}-heat)`} dim={active !== null && active !== r.pathology} onHover={onHover} />
        ))}
      </g>

      {/* region outlines for the hovered finding */}
      {study.regions
        .filter((r) => r.pathology === active)
        .map((r) => (
          <ellipse key={r.pathology} cx={r.cx} cy={r.cy} rx={r.rx + 1.5} ry={r.ry + 1.5} fill="none" stroke="#f4f5f8" strokeWidth="0.4" strokeDasharray="1.4 1" />
        ))}

      {scanning && (
        <rect x="0" width="100" height="10" fill="url(#cxr-scanline)">
          <animate attributeName="y" from="-10" to="120" dur="1.6s" repeatCount="indefinite" />
        </rect>
      )}
      <defs>
        <linearGradient id="cxr-scanline" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34C0AE" stopOpacity="0" />
          <stop offset="90%" stopColor="#34C0AE" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6FD8C8" stopOpacity="0.8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Hotspot({
  r,
  fill,
  dim,
  onHover,
}: {
  r: FocusRegion;
  fill: string;
  dim: boolean;
  onHover?: (p: Pathology | null) => void;
}) {
  return (
    <ellipse
      cx={r.cx}
      cy={r.cy}
      rx={r.rx}
      ry={r.ry}
      fill={fill}
      style={{ mixBlendMode: 'screen', transition: 'opacity 300ms', opacity: dim ? 0.25 : 1 }}
      onMouseEnter={() => onHover?.(r.pathology)}
      onMouseLeave={() => onHover?.(null)}
    />
  );
}
