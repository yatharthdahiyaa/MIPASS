'use client';

import React from 'react';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, TriangleAlertIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n/I18nProvider';

/**
 * Reference ranges for self-monitoring (adult, at rest). These only label a reading;
 * they are not a diagnosis and the UI always says so alongside.
 *   Blood pressure: ACC/AHA 2017 categories. Glucose: ADA fasting / post-meal targets.
 *   SpO2 and temperature: common home-monitoring thresholds.
 */
export type VitalStatus = 'normal' | 'elevated' | 'high' | 'low' | 'urgent';

export function bpStatus(sys: number, dia: number): VitalStatus {
  if (sys >= 180 || dia >= 120) return 'urgent';
  if (sys < 90 || dia < 60) return 'low';
  if (sys >= 130 || dia >= 80) return 'high';
  if (sys >= 120) return 'elevated';
  return 'normal';
}

export function heartRateStatus(bpm: number): VitalStatus {
  if (bpm >= 130 || bpm < 40) return 'urgent';
  if (bpm > 100) return 'high';
  if (bpm < 50) return 'low';
  return 'normal';
}

export function glucoseStatus(mg: number, context: string | null | undefined): VitalStatus {
  if (mg < 54 || mg >= 300) return 'urgent';
  if (mg < 70) return 'low';
  if (context === 'fasting') return mg >= 126 ? 'high' : mg >= 100 ? 'elevated' : 'normal';
  return mg >= 200 ? 'high' : mg >= 140 ? 'elevated' : 'normal';
}

export function spo2Status(pct: number): VitalStatus {
  if (pct < 90) return 'urgent';
  if (pct < 95) return 'low';
  return 'normal';
}

export function temperatureStatus(c: number): VitalStatus {
  if (c >= 39.5 || c < 35) return c < 35 ? 'low' : 'urgent';
  if (c >= 38) return 'high';
  if (c >= 37.5) return 'elevated';
  return 'normal';
}

/** Status colours are theme tokens (--success, --warning, --destructive) and never reused for data series. */
const BADGE: Record<VitalStatus, { variant: 'success' | 'warning' | 'danger' | 'urgent'; icon: React.ComponentType }> = {
  normal: { variant: 'success', icon: CheckIcon },
  elevated: { variant: 'warning', icon: ArrowUpIcon },
  low: { variant: 'warning', icon: ArrowDownIcon },
  high: { variant: 'danger', icon: ArrowUpIcon },
  urgent: { variant: 'urgent', icon: TriangleAlertIcon },
};

/** Icon + word + colour, so the meaning never relies on colour alone. */
export function StatusPill({ status, className }: { status: VitalStatus; className?: string }) {
  const { t } = useI18n();
  const { variant, icon: StatusIcon } = BADGE[status];
  return (
    <Badge variant={variant} className={className}>
      <StatusIcon data-icon="inline-start" aria-hidden="true" />
      {t(`patient.status.${status}`)}
    </Badge>
  );
}

export const SEVERITY_TONE: Record<string, VitalStatus> = {
  NORMAL: 'normal',
  MODERATE: 'elevated',
  HIGH: 'high',
  CRITICAL: 'urgent',
};

const DOT: Record<VitalStatus, string> = {
  normal: 'var(--success)',
  elevated: 'var(--warning)',
  low: 'var(--warning)',
  high: 'var(--destructive)',
  urgent: 'var(--destructive)',
};

export function SeverityDot({ severity }: { severity: string | null }) {
  return (
    <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full" style={{ background: DOT[SEVERITY_TONE[severity ?? ''] ?? 'normal'] }} />
  );
}

export function severityColor(severity: string | null) {
  const color = DOT[SEVERITY_TONE[severity ?? ''] ?? 'normal'];
  return { color, bg: `color-mix(in oklch, ${color} 15%, transparent)` };
}
