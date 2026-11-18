'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react';
import { useSession } from '@/lib/auth/SessionProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { localISODate, patientApi, type LatestReading, type LogMetric } from '@/lib/patient/api';
import { HomeLogoMark } from '@/components/home/HomeNav';
import { Button } from '@/components/ui/button';
import { ErrorBox, Skeleton, useFormat, useLoader } from '../ui';
import { bpStatus, glucoseStatus, heartRateStatus, spo2Status, temperatureStatus, type VitalStatus } from '../vitals';

const READINGS: LogMetric[] = ['systolic', 'heart_rate', 'glucose', 'spo2', 'temperature_c', 'weight_kg', 'sleep_hours'];

/**
 * One page to hand to a clinician: identity, the profile's medical details, active medicines,
 * the latest self-measured readings and the latest X-ray screening. Everything shown comes from
 * what the patient saved; empty fields say so instead of being hidden.
 */
export default function SummaryView() {
  const { t } = useI18n();
  const f = useFormat();
  const { user } = useSession();
  const today = useMemo(() => localISODate(), []);
  const { data, error, reload } = useLoader(async () => {
    const [overview, meds] = await Promise.all([patientApi.overview(today), patientApi.medications()]);
    return { overview, medications: meds.medications.filter((m) => m.is_active) };
  }, [today]);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="mx-auto h-[900px] max-w-[820px] rounded-surface" />;

  const { overview, medications } = data;
  const p = overview.profile;
  const none = t('ux.summary.none');
  const u = (k: string) => t(`patient.units.${k}`);

  const reading = (m: LogMetric, r: LatestReading): { label: string; value: string; status?: VitalStatus } => {
    switch (m) {
      case 'systolic':
        return {
          label: t('patient.metrics.bp'),
          value: `${f.num(r.value)}/${r.diastolic != null ? f.num(r.diastolic) : '—'} ${u('mmhg')}`,
          status: r.diastolic != null ? bpStatus(r.value, r.diastolic) : undefined,
        };
      case 'heart_rate':
        return { label: t('patient.metrics.heart_rate'), value: `${f.num(r.value)} ${u('bpm')}`, status: heartRateStatus(r.value) };
      case 'glucose':
        return {
          label: `${t('patient.metrics.glucose')}${r.context ? ` (${t(`patient.glucoseContext.${r.context}`)})` : ''}`,
          value: `${f.num(r.value)} ${u('mgdl')}`,
          status: glucoseStatus(r.value, r.context),
        };
      case 'spo2':
        return { label: t('patient.metrics.spo2'), value: `${f.num(r.value)}${u('pct')}`, status: spo2Status(r.value) };
      case 'temperature_c':
        return { label: t('patient.metrics.temperature_c'), value: `${f.num(r.value, 1)} ${u('c')}`, status: temperatureStatus(r.value) };
      case 'weight_kg':
        return { label: t('patient.metrics.weight_kg'), value: `${f.num(r.value, 1)} ${u('kg')}` };
      default:
        return { label: t(`patient.metrics.${m}`), value: `${f.num(r.value, 1)} ${u('h')}` };
    }
  };

  const details: [string, string][] = [
    [t('patient.profile.dob'), p.date_of_birth ? `${f.date(p.date_of_birth)}${p.age != null ? ` · ${t('patient.profile.age', { n: f.num(p.age) })}` : ''}` : none],
    [t('patient.profile.sex'), p.sex ? t(`patient.profile.sexes.${p.sex}`) : none],
    [t('patient.profile.bloodGroup'), p.blood_group ?? none],
    [t('patient.profile.height'), p.height_cm != null ? `${f.num(p.height_cm)} cm` : none],
    [t('patient.profile.phone'), p.phone ?? none],
    [t('patient.profile.emergency'), [p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(' · ') || none],
  ];
  const rows = READINGS.filter((m) => overview.latest[m]);
  const xray = overview.latest_xray;

  return (
    <div className="flex flex-col gap-5">
      <div className="mx-auto flex w-full max-w-[820px] items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" className="-ml-3" nativeButton={false} render={<Link href="/patient/profile?tab=data" />}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          {t('ux.summary.back')}
        </Button>
        <Button onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" aria-hidden="true" />
          {t('ux.summary.print')}
        </Button>
      </div>

      {/* The sheet: card on screen, plain black-on-white page in print. */}
      <article
        className="mx-auto w-full max-w-[820px] rounded-surface bg-card p-6 text-body ring-1 ring-foreground/[0.08] sm:p-10 print:max-w-none print:rounded-none print:bg-white print:p-0 print:text-[11pt] print:ring-0 print:[--border:#d4d4d4] print:[--foreground:#000] print:[--muted-foreground:#4b4b4b]"
      >
        <header className="flex items-start justify-between gap-6 border-b pb-6">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-meta font-medium text-muted-foreground">{t('ux.summary.open')}</p>
            <h1 className="font-heading text-2xl font-semibold tracking-[-0.022em] text-foreground">{user?.name}</h1>
            <p className="text-meta text-muted-foreground">{t('ux.summary.generated', { date: f.date(new Date().toISOString(), { dateStyle: 'long' }) })}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-foreground">
            <HomeLogoMark className="size-4" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">MIPAAS</span>
          </span>
        </header>

        <SummarySection title={t('ux.summary.details')}>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-meta text-muted-foreground">{k}</dt>
                <dd className="text-foreground">{v}</dd>
              </div>
            ))}
            <div className="flex flex-col sm:col-span-2 print:col-span-2">
              <dt className="text-meta text-muted-foreground">{t('patient.profile.allergies')}</dt>
              <dd className="whitespace-pre-line text-foreground">{p.allergies || none}</dd>
            </div>
            <div className="flex flex-col sm:col-span-2 print:col-span-2">
              <dt className="text-meta text-muted-foreground">{t('patient.profile.conditions')}</dt>
              <dd className="whitespace-pre-line text-foreground">{p.conditions || none}</dd>
            </div>
          </dl>
        </SummarySection>

        <SummarySection title={t('ux.summary.medicines')}>
          {medications.length === 0 ? (
            <p className="text-muted-foreground">{none}</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b text-meta text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t('patient.meds.name')}</th>
                  <th className="py-2 pr-4 font-medium">{t('patient.meds.dosage')}</th>
                  <th className="py-2 pr-4 font-medium">{t('patient.meds.times')}</th>
                  <th className="py-2 font-medium">{t('patient.meds.instructions')}</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((m) => (
                  <tr key={m.id} className="border-b align-top last:border-b-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">
                      {m.name}
                      {m.prescribed_by && <span className="block text-meta font-normal text-muted-foreground">{m.prescribed_by}</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-foreground">{m.dosage || '—'}</td>
                    <td className="py-2.5 pr-4 text-foreground tabular-nums">{m.times.map(f.slot).join(', ') || '—'}</td>
                    <td className="py-2.5 text-foreground">{m.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SummarySection>

        <SummarySection title={t('ux.summary.readings')}>
          {rows.length === 0 ? (
            <p className="text-muted-foreground">{none}</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <tbody>
                {rows.map((m) => {
                  const r = overview.latest[m]!;
                  const view = reading(m, r);
                  return (
                    <tr key={m} className="border-b last:border-b-0">
                      <td className="py-2.5 pr-4 text-muted-foreground">{view.label}</td>
                      <td className="py-2.5 pr-4 font-medium text-foreground tabular-nums">{view.value}</td>
                      <td className="py-2.5 pr-4 text-foreground">{view.status ? t(`patient.status.${view.status}`) : ''}</td>
                      <td className="py-2.5 text-right text-meta text-muted-foreground tabular-nums">{f.date(r.log_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SummarySection>

        <SummarySection title={t('ux.summary.xray')}>
          {xray ? (
            <p className="text-foreground">
              <span className="font-medium">
                {xray.status === 'completed' && xray.severity ? t(`patient.xray.severity.${xray.severity}.title`) : t('patient.xray.failed')}
              </span>
              {xray.primary_finding && <span> · {t(`patient.xray.pathologies.${xray.primary_finding}`)}</span>}
              <span className="text-muted-foreground"> · {f.date(xray.taken_on || xray.created_at)}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">{none}</p>
          )}
        </SummarySection>

        <footer className="mt-8 border-t pt-4 text-meta text-pretty text-muted-foreground">{t('ux.summary.footer')}</footer>
      </article>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 break-inside-avoid">
      <h2 className="mb-3 font-heading text-title font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
