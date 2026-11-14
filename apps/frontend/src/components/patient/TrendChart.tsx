'use client';

import React, { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useFormat } from './ui';

export interface TrendPoint {
  t: number; // epoch ms
  v: number;
}
export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  points: TrendPoint[];
}

/** Theme chart slots; a second series is also dashed so the two never differ by colour alone. */
export const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)'] as const;
const DASH = [undefined, '6 4'];

/**
 * Time-series chart for one or two readings (shadcn Chart over Recharts). Two series get a legend.
 * "Show as table" carries the same numbers for screen readers, keyboard users and print.
 */
export default function TrendChart({
  series,
  unit,
  digits = 0,
  title,
}: {
  series: TrendSeries[];
  unit: string;
  digits?: number;
  title: string;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const [asTable, setAsTable] = useState(false);

  const rows = useMemo(() => {
    const byTime = new Map<number, Record<string, number>>();
    series.forEach((s) => s.points.forEach((p) => byTime.set(p.t, { ...(byTime.get(p.t) ?? { t: p.t }), [s.key]: p.v })));
    return Array.from(byTime.values()).sort((a, b) => a.t - b.t);
  }, [series]);

  const config = useMemo<ChartConfig>(() => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])), [series]);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('patient.log.noTrend')}</p>;
  }

  const twoSeries = series.length > 1;
  const day = (ms: number) => f.date(new Date(ms).toISOString(), { day: 'numeric', month: 'short' });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{unit}</span>
        <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)}>
          {asTable ? t('patient.log.showChart') : t('patient.log.showTable')}
        </Button>
      </div>

      {asTable ? (
        <div className="max-h-56 overflow-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('patient.log.date')}</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-medium">
                    {s.label} ({unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => (
                <tr key={row.t} className="border-t">
                  <td className="px-3 py-1.5">{f.date(new Date(row.t).toISOString(), { dateStyle: 'medium' })}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                      {row[s.key] != null ? f.num(row[s.key], digits) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-52 w-full" role="img" aria-label={title}>
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={day}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
            />
            <YAxis
              width={36}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              domain={['auto', 'auto']}
              allowDecimals={digits > 0}
              tickFormatter={(v: number) => f.num(v, digits)}
            />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(_, payload) => (payload?.[0] ? day(Number(payload[0].payload.t)) : '')} />}
            />
            {series.map((s, i) => (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                strokeDasharray={DASH[i]}
                dot={rows.length <= 14 ? { r: 3, fill: `var(--color-${s.key})` } : false}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {twoSeries && <ChartLegend content={<ChartLegendContent />} />}
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
