import React from 'react';
import { cx } from '@/components/marketing/ui';

type Palette = [highlight: string, mid: string, edge: string];

/**
 * A grainy gradient sphere. Pass a palette (highlight, mid, edge) or a hue.
 * Pure CSS, so it scales to any size and costs nothing to animate.
 */
export default function Orb({
  palette,
  hue = 180,
  light = 30,
  className,
  style,
}: {
  palette?: Palette;
  hue?: number;
  /** Highlight position in % from top-left. */
  light?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hi, mid, edge] = palette ?? [
    `hsl(${hue} 95% 88%)`,
    `hsl(${hue} 80% 58%)`,
    `hsl(${(hue + 40) % 360} 70% 32%)`,
  ];
  return (
    <span
      aria-hidden="true"
      className={cx('relative block aspect-square w-full overflow-hidden rounded-full', className)}
      style={{
        // Soft, matte blend of two colour fields rather than a glossy highlight.
        background: [
          `radial-gradient(circle at ${light}% ${light}%, ${hi} 0%, transparent 58%)`,
          `radial-gradient(circle at ${100 - light}% ${100 - light + 6}%, ${edge} 0%, transparent 72%)`,
          `linear-gradient(140deg, ${mid}, ${edge})`,
        ].join(', '),
        ...style,
      }}
    >
      <span className="h-grain" style={{ opacity: 0.95, mixBlendMode: 'overlay' }} />
    </span>
  );
}
