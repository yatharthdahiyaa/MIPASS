import type { Severity, Study } from './api';

export const SEVERITY: Record<Severity, { label: string; color: string; bg: string }> = {
  NORMAL: { label: 'No acute findings', color: '#0ca30c', bg: 'rgba(12,163,12,0.14)' },
  MODERATE: { label: 'Indeterminate', color: '#fab219', bg: 'rgba(250,178,25,0.13)' },
  HIGH: { label: 'Abnormal', color: '#ec835a', bg: 'rgba(236,131,90,0.15)' },
  CRITICAL: { label: 'Critical', color: '#ff6b6b', bg: 'rgba(208,59,59,0.2)' },
};

export function pathologyName(raw: string) {
  return raw.replace(/_/g, ' ');
}

export function patientLabel(s: Pick<Study, 'patient_name' | 'patient_ref' | 'original_filename'>) {
  return s.patient_name || s.patient_ref || s.original_filename;
}

export function demographics(s: Pick<Study, 'patient_age' | 'patient_sex'>) {
  const sex = s.patient_sex ? { female: 'F', male: 'M', other: 'O', unknown: '?' }[s.patient_sex] ?? s.patient_sex : null;
  return [s.patient_age != null ? `${s.patient_age}y` : null, sex].filter(Boolean).join(' · ');
}

const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dtt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const tf = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return dtf.format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso));
}
export function fmtDateTime(iso: string | null | undefined) {
  return iso ? dtt.format(new Date(iso)) : '—';
}
export function fmtWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? tf.format(d) : dtf.format(d);
}
/** "Today", "Yesterday" or the date, for separators in a conversation. */
export function fmtDay(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : dtf.format(d);
}
export function fmtTime(iso: string) {
  return tf.format(new Date(iso));
}
/** A medicine slot such as "08:00" in the reader's clock format. */
export function fmtSlot(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return tf.format(d);
}
export function capitalize(s: string | null | undefined) {
  return s ? s[0]!.toUpperCase() + s.slice(1).replace(/_/g, ' ') : s ?? '';
}
export function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}
export function bytes(n: number) {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
