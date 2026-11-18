'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActivityIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  GaugeIcon,
  HeartPulseIcon,
  MailIcon,
  MessageSquareIcon,
  PillIcon,
  PlusIcon,
  ScanLineIcon,
  StethoscopeIcon,
  UserPlusIcon,
} from 'lucide-react';
import { authApi } from '@/lib/auth/api';
import { useSession } from '@/lib/auth/SessionProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { localISODate, patientApi, type LatestReading, type LogMetric, type Overview } from '@/lib/patient/api';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import DoseList from '../DoseList';
import { ErrorBox, PageHeader, useFormat, useLoader, useToast } from '../ui';
import { SeverityDot, StatusPill, bpStatus, glucoseStatus, heartRateStatus, spo2Status, temperatureStatus, type VitalStatus } from '../vitals';

/** Any lucide icon component. */
type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const READING_ORDER: LogMetric[] = ['systolic', 'heart_rate', 'glucose', 'spo2', 'temperature_c', 'weight_kg', 'sleep_hours', 'steps'];

/** Which trend on the Daily log a reading opens (see LogView's chart ids). */
const TREND_ID: Partial<Record<LogMetric, string>> = {
  systolic: 'bp',
  heart_rate: 'hr',
  glucose: 'glu',
  spo2: 'spo2',
  temperature_c: 'temp',
  weight_kg: 'wt',
  sleep_hours: 'sleep',
  steps: 'steps',
};

function useReading() {
  const { t } = useI18n();
  const f = useFormat();
  return (metric: LogMetric, r: LatestReading): { label: string; value: string; unit: string; status?: VitalStatus } => {
    const u = (k: string) => t(`patient.units.${k}`);
    switch (metric) {
      case 'systolic':
        return {
          label: t('patient.metrics.bp'),
          value: `${f.num(r.value)}/${r.diastolic != null ? f.num(r.diastolic) : '—'}`,
          unit: u('mmhg'),
          status: r.diastolic != null ? bpStatus(r.value, r.diastolic) : undefined,
        };
      case 'heart_rate':
        return { label: t('patient.metrics.heart_rate'), value: f.num(r.value), unit: u('bpm'), status: heartRateStatus(r.value) };
      case 'glucose':
        return { label: t('patient.metrics.glucose'), value: f.num(r.value), unit: u('mgdl'), status: glucoseStatus(r.value, r.context) };
      case 'spo2':
        return { label: t('patient.metrics.spo2'), value: f.num(r.value), unit: u('pct'), status: spo2Status(r.value) };
      case 'temperature_c':
        return { label: t('patient.metrics.temperature_c'), value: f.num(r.value, 1), unit: u('c'), status: temperatureStatus(r.value) };
      case 'weight_kg':
        return { label: t('patient.metrics.weight_kg'), value: f.num(r.value, 1), unit: u('kg') };
      case 'sleep_hours':
        return { label: t('patient.metrics.sleep_hours'), value: f.num(r.value, 1), unit: u('h') };
      case 'steps':
        return { label: t('patient.metrics.steps'), value: f.num(r.value), unit: u('steps') };
      default:
        return { label: metric, value: f.num(r.value), unit: '' };
    }
  };
}

/** A link styled as a shadcn Button (Base UI: render + nativeButton={false}). */
function LinkButton({
  href,
  children,
  variant = 'outline',
  size,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default';
  className?: string;
}) {
  return (
    <Button variant={variant} size={size} className={className} nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground hover:text-foreground" nativeButton={false} render={<Link href={href} />}>
      {label}
      <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
    </Button>
  );
}

/** Empty state inside a card: an icon, a sentence and one action, centred in the space the card has. */
function CardEmpty({ text, action, icon: Icon }: { text: string; action?: React.ReactNode; icon?: IconType }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
      {Icon && (
        <span aria-hidden="true" className="h-icon-tile size-11 rounded-[12px]">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
      )}
      <p className="max-w-[34ch] text-body text-pretty text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------------- header */

function Greeting({ data }: { data: Overview }) {
  const { user } = useSession();
  const { t } = useI18n();
  const f = useFormat();
  const hour = new Date().getHours();
  const first = (user?.name || '').split(/\s+/)[0] || '';
  const key = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <PageHeader
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          <CalendarDaysIcon aria-hidden="true" className="size-3.5" />
          {f.date(data.date, { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      }
      title={t(`patient.greeting.${key}`, { name: first })}
      subtitle={data.streak_days > 0 ? t('patient.overview.streak', { n: f.num(data.streak_days) }) : t('patient.overview.streakNone')}
      action={
        <>
          <LinkButton href="/patient/xrays">
            <ScanLineIcon data-icon="inline-start" aria-hidden="true" />
            {t('patient.overview.uploadXray')}
          </LinkButton>
          <LinkButton href="/patient/log" variant="default" className="h-key">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            {t('patient.overview.logCta')}
          </LinkButton>
        </>
      }
    />
  );
}

/** One cell of the "today" strip: a figure, its label and, where it means something, progress toward a target. */
function Stat({ label, value, sub, progress, icon: Icon }: { label: string; value: string; sub?: string; progress?: number; icon: IconType }) {
  return (
    <Card size="sm" className="h-stat gap-0">
      <div className="flex min-w-0 flex-1 flex-col px-(--card-spacing)">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 text-sm leading-snug font-medium text-muted-foreground">{label}</p>
          <span aria-hidden="true" className="h-icon-tile size-7 rounded-[8px] sm:size-8 sm:rounded-[9px]">
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
        </div>
        <p className="mt-3 font-heading text-[1.875rem] leading-9 font-semibold tracking-[-0.03em] tabular-nums">{value}</p>
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          {progress != null && <Progress value={Math.round(Math.max(0, Math.min(1, progress)) * 100)} aria-label={label} />}
          {sub && <p className="text-meta text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function TodayStrip({ data }: { data: Overview }) {
  const { t } = useI18n();
  const f = useFormat();
  const adherence = data.adherence_7d;
  return (
    <section aria-labelledby="overview-today">
      <h2 id="overview-today" className="sr-only">{t('common.today')}</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={ActivityIcon} label={t('patient.overview.checkIns')} value={f.num(data.today.check_ins)} />
        <Stat
          icon={PillIcon}
          label={t('patient.overview.doses')}
          progress={data.today.doses_scheduled ? data.today.doses_taken / data.today.doses_scheduled : undefined}
          value={data.today.doses_scheduled ? `${f.num(data.today.doses_taken)}/${f.num(data.today.doses_scheduled)}` : '—'}
        />
        <Stat
          icon={GaugeIcon}
          label={t('patient.overview.adherence')}
          progress={adherence ? adherence.rate : undefined}
          value={adherence ? f.pct(adherence.rate) : '—'}
          sub={adherence ? t('patient.meds.dosesSummary', { taken: f.num(adherence.taken), scheduled: f.num(adherence.scheduled) }) : undefined}
        />
        <Stat icon={FolderOpenIcon} label={t('patient.nav.records')} value={f.num(data.counts.documents + data.counts.xrays)} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- getting set up */

/**
 * Replaces the stacked "verify e-mail" and "complete profile" banners with one checklist.
 * Every step reads a real field from the overview; the card disappears once all are done.
 */
function SetupChecklist({ data, email }: { data: Overview; email: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const [resend, setResend] = useState<'idle' | 'pending' | 'sent'>('idle');

  async function onResend() {
    setResend('pending');
    try {
      await authApi.requestVerification();
      setResend('sent');
    } catch {
      setResend('idle');
    }
  }

  const steps: { key: string; label: string; done: boolean; hint?: string; progress?: number; action?: React.ReactNode }[] = [
    {
      key: 'email',
      label: t('care.overview.verifyTitle'),
      done: data.email_verified,
      hint: resend === 'sent' ? t('care.overview.verifySent') : email,
      action:
        resend === 'sent' ? null : (
          <Button
            variant="outline"
            size="sm"
            className="border-warning/35 text-warning hover:border-warning/50 hover:bg-warning/10 hover:text-warning"
            disabled={resend === 'pending'}
            onClick={onResend}
          >
            {resend === 'pending' && <Spinner data-icon="inline-start" />}
            {t('care.overview.verifyResend')}
          </Button>
        ),
    },
    {
      key: 'profile',
      label: t('patient.overview.completeProfile'),
      done: data.profile.completeness >= 1,
      hint: data.profile.completeness < 1 ? t('patient.profile.completeness', { n: f.num(Math.round(data.profile.completeness * 100)) }) : undefined,
      progress: data.profile.completeness,
      action: <LinkButton href="/patient/profile" size="sm">{t('patient.overview.completeProfileCta')}</LinkButton>,
    },
    {
      key: 'checkin',
      label: t('ux.setup.checkin'),
      done: data.counts.logs > 0,
      action: <LinkButton href="/patient/log" size="sm">{t('patient.overview.logCta')}</LinkButton>,
    },
    {
      key: 'medicine',
      label: t('ux.setup.medicine'),
      done: data.counts.medications > 0,
      action: <LinkButton href="/patient/medications" size="sm">{t('patient.overview.addMed')}</LinkButton>,
    },
    {
      key: 'doctor',
      label: t('ux.setup.doctor'),
      done: data.care.doctors.some((d) => d != null),
      action: <LinkButton href="/patient/care" size="sm">{t('care.overview.connect')}</LinkButton>,
    },
  ];

  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{t('ux.setup.title')}</h2>
        </CardTitle>
        <CardDescription className="tabular-nums">{t('ux.setup.progress', { done: f.num(done), total: f.num(steps.length) })}</CardDescription>
        <CardAction className="w-28 self-center sm:w-40">
          <Progress value={(done / steps.length) * 100} aria-label={t('ux.setup.progress', { done: f.num(done), total: f.num(steps.length) })} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-x-8 xl:grid-cols-2">
          {steps.map((s, i) => {
            // An unverified e-mail blocks account recovery, so that step keeps its amber highlight.
            const attention = s.key === 'email' && !s.done;
            return (
              <li
                key={s.key}
                className={cn(
                  'grid min-h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-t py-2.5 first:border-t-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] xl:[&:nth-child(2)]:border-t-0',
                  attention && '-mx-3 my-1 rounded-control border-t-0 bg-warning/[0.07] px-3 ring-1 ring-warning/25 ring-inset',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border text-meta font-medium tabular-nums',
                    s.done
                      ? 'border-success/40 bg-success/15 text-success'
                      : attention
                        ? 'border-warning/40 bg-warning/15 text-warning'
                        : 'border-white/10 bg-white/[0.03] text-muted-foreground',
                  )}
                >
                  {s.done ? <CheckIcon className="size-3.5" strokeWidth={2.5} /> : attention ? <MailIcon className="size-3.5" /> : f.num(i + 1)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={cn('text-body', s.done ? 'text-muted-foreground' : 'font-medium')}>
                    {s.label}
                    {s.done && <span className="sr-only"> · {t('ux.setup.done')}</span>}
                  </span>
                  {!s.done && s.hint && <span className={cn('truncate text-meta', attention ? 'text-warning/85' : 'text-muted-foreground')}>{s.hint}</span>}
                  {!s.done && s.progress != null && (
                    <Progress value={Math.round(Math.max(0, Math.min(1, s.progress)) * 100)} aria-label={s.label} className="mt-1.5 max-w-44" />
                  )}
                </div>
                {!s.done && s.action && <div className="col-start-2 sm:col-start-auto">{s.action}</div>}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

/** Things another person is waiting on: doctors asking to connect and unread messages. */
function Waiting({ data }: { data: Overview }) {
  const { t } = useI18n();
  const f = useFormat();
  const { care } = data;
  if (care.pending_invites.length === 0 && care.unread_messages === 0) return null;

  return (
    <section aria-label={t('care.overview.title')} className="flex flex-col gap-2">
      {care.pending_invites.map((link) => (
        <Alert key={link.id} className="flex items-center gap-3 border-[var(--glass-border)] py-2.5 backdrop-blur-md *:[svg]:translate-y-0">
          <UserPlusIcon className="text-ring" />
          <AlertTitle className="min-w-0 flex-1 truncate">
            {t('care.overview.wantsToConnect', { name: link.doctor ? t('care.drName', { name: link.doctor.name }) : t('care.formerDoctor') })}
            {link.doctor?.specialty && <span className="font-normal text-muted-foreground"> · {link.doctor.specialty}</span>}
          </AlertTitle>
          <LinkButton href="/patient/care" size="sm">
            {t('care.overview.review')}
          </LinkButton>
        </Alert>
      ))}
      {care.unread_messages > 0 && (
        <Alert className="flex items-center gap-3 border-[var(--glass-border)] py-2.5 backdrop-blur-md *:[svg]:translate-y-0">
          <MessageSquareIcon className="text-ring" />
          <AlertTitle className="min-w-0 flex-1 truncate">
            {care.unread_messages === 1 ? t('care.overview.unreadOne') : t('care.overview.unreadMany', { n: f.num(care.unread_messages) })}
          </AlertTitle>
          <LinkButton href="/patient/care?tab=messages" size="sm">
            {t('care.overview.read')}
          </LinkButton>
        </Alert>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- readings */

/** Tiny trend line drawn from the patient's own recent check-ins. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 3) return <span aria-hidden="true" className="hidden w-[72px] sm:block" />;
  const w = 72;
  const h = 24;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), max === min ? h / 2 : h - pad - ((v - min) / (max - min)) * (h - pad * 2)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" className="hidden shrink-0 text-chart-1 sm:block">
      <path d={d} fill="none" stroke="currentColor" strokeOpacity={0.5} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.25" fill="currentColor" />
    </svg>
  );
}

function ReadingsCard({ data, trend }: { data: Overview; trend: (m: LogMetric) => number[] }) {
  const { t } = useI18n();
  const f = useFormat();
  const reading = useReading();
  const rows = READING_ORDER.filter((m) => data.latest[m]);

  return (
    <Card className="h-full lg:col-span-7">
      <CardHeader>
        <CardTitle>
          <h2>{t('patient.overview.latestReadings')}</h2>
        </CardTitle>
        <CardAction>
          <ViewAll href="/patient/log" label={t('common.viewAll')} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {rows.length === 0 ? (
          <CardEmpty
            icon={HeartPulseIcon}
            text={t('patient.overview.noReadings')}
            action={
              <LinkButton href="/patient/log" size="sm" variant="default" className="h-key">
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                {t('patient.overview.logCta')}
              </LinkButton>
            }
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {rows.map((m, i) => {
              const r = data.latest[m]!;
              const view = reading(m, r);
              const id = TREND_ID[m];
              return (
                <li key={m} className={cn(i > 0 && 'border-t')}>
                  <Link
                    href={id ? `/patient/log?metric=${id}` : '/patient/log'}
                    aria-label={`${view.label}: ${view.value} ${view.unit}. ${t('ux.seeTrend', { metric: view.label })}`}
                    className="group flex items-center gap-4 rounded-control px-2 py-3 transition-colors hover:bg-white/[0.04] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body">{view.label}</span>
                      <span className="text-meta text-muted-foreground">{f.relDay(r.log_date)}</span>
                    </div>
                    <Sparkline values={trend(m)} />
                    <div className="flex w-[7.5rem] shrink-0 flex-col items-end gap-1 sm:w-36">
                      <p className="flex items-baseline gap-1">
                        <span className="font-heading text-title font-semibold tabular-nums">{view.value}</span>
                        <span className="text-meta text-muted-foreground">{view.unit}</span>
                      </p>
                      {view.status && <StatusPill status={view.status} />}
                    </div>
                    <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------- side cards */

function MedicinesCard({ data, today, onChanged, onError }: { data: Overview; today: string; onChanged: () => void; onError: (m: string) => void }) {
  const { t } = useI18n();
  return (
    <Card className="h-full lg:col-span-5">
      <CardHeader>
        <CardTitle>
          <h2>{t('patient.overview.medsToday')}</h2>
        </CardTitle>
        <CardAction>
          <ViewAll href="/patient/medications" label={t('common.viewAll')} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {data.medications_today.length === 0 ? (
          <CardEmpty
            icon={PillIcon}
            text={t('patient.overview.noMeds')}
            // With no medicines at all, the setup checklist already offers this.
            action={
              data.counts.medications > 0 && (
                <LinkButton href="/patient/medications" size="sm">
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  {t('patient.overview.addMed')}
                </LinkButton>
              )
            }
          />
        ) : (
          <DoseList items={data.medications_today} date={today} onChanged={onChanged} onError={onError} />
        )}
      </CardContent>
    </Card>
  );
}

function CareCard({ care }: { care: Overview['care'] }) {
  const { t } = useI18n();
  const f = useFormat();
  const doctors = care.doctors.filter((d) => d != null);
  const next = care.next_consult;

  return (
    <Card className="h-full lg:col-span-7">
      <CardHeader>
        <CardTitle>
          <h2>{t('care.overview.title')}</h2>
        </CardTitle>
        <CardAction>
          <ViewAll href="/patient/care" label={t('care.overview.open')} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {doctors.length === 0 ? (
          <CardEmpty icon={StethoscopeIcon} text={t('care.overview.empty')} />
        ) : (
          <ItemGroup className="-mx-2 gap-0.5">
            {next?.scheduled_at && (
              <Item size="sm" className="px-2" render={<Link href="/patient/care?tab=consults" />}>
                <ItemContent>
                  <ItemDescription className="text-meta">{t('care.overview.nextConsult')}</ItemDescription>
                  <ItemTitle>{f.date(next.scheduled_at, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</ItemTitle>
                  <ItemDescription>
                    {[next.doctor?.name ? t('care.drName', { name: next.doctor.name }) : null, t(`care.mode.${next.mode}`)].filter(Boolean).join(' · ')}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                </ItemActions>
              </Item>
            )}
            {doctors.map((d) => (
              <Item key={d.id} size="sm" className="px-2" render={<Link href="/patient/care" />}>
                <ItemContent className="min-w-0">
                  <ItemTitle className="truncate">{t('care.drName', { name: d.name })}</ItemTitle>
                  <ItemDescription className="truncate">{[d.specialty, d.organization].filter(Boolean).join(' · ')}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="success">{t('care.statusActive')}</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}

function XrayCard({ xray }: { xray: Overview['latest_xray'] }) {
  const { t } = useI18n();
  const f = useFormat();
  return (
    <Card className="h-full lg:col-span-5">
      <CardHeader>
        <CardTitle>
          <h2>{t('patient.overview.latestXray')}</h2>
        </CardTitle>
        {xray && (
          <CardAction>
            <ViewAll href="/patient/xrays" label={t('common.viewAll')} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {xray ? (
          <Item variant="outline" className="px-3" render={<Link href={`/patient/xrays?id=${xray.id}`} />}>
            <ItemMedia className="size-16 overflow-hidden rounded-[8px] bg-black">
              {xray.has_preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={patientApi.xrayImageUrl(xray.id, 'preview')} alt="" className="size-full object-cover" />
              )}
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="flex items-center gap-2">
                <SeverityDot severity={xray.severity} />
                <span className="truncate">
                  {xray.status === 'completed' && xray.severity ? t(`patient.xray.severity.${xray.severity}.title`) : t('patient.xray.failed')}
                </span>
              </ItemTitle>
              <ItemDescription className="truncate">
                {xray.title || xray.original_filename} · {f.relDay(xray.taken_on || xray.created_at)}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        ) : (
          <CardEmpty icon={ScanLineIcon} text={t('patient.overview.noXray')} />
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------- view */

export default function OverviewView() {
  const { user } = useSession();
  const toast = useToast();
  const today = useMemo(() => localISODate(), []);
  const { data, error, loading, reload } = useLoader(() => patientApi.overview(today), [today]);
  // Two weeks of check-ins for the small trend lines; the rows work without them.
  const recent = useLoader(() => patientApi.logs(14, today), [today]);
  const trend = useMemo(() => {
    const logs = [...(recent.data?.logs ?? [])].sort((a, b) => a.log_date.localeCompare(b.log_date) || a.recorded_at.localeCompare(b.recorded_at));
    return (m: LogMetric) => logs.map((l) => l[m]).filter((v): v is number => v != null);
  }, [recent.data]);

  if (!data) {
    return error ? (
      <ErrorBox error={error} onRetry={reload} />
    ) : (
      <div aria-busy="true" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[124px] rounded-surface" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-12">
          <Skeleton className="h-72 rounded-surface lg:col-span-7" />
          <Skeleton className="h-72 rounded-surface lg:col-span-5" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-stagger flex flex-col gap-6 transition-opacity', loading && 'opacity-90')}>
      <Greeting data={data} />
      <TodayStrip data={data} />
      <Waiting data={data} />
      <SetupChecklist data={data} email={user?.email ?? ''} />

      {/* Cards that share a row share a height, so neither column leaves a hole. */}
      <div className="grid items-stretch gap-5 lg:grid-cols-12">
        <ReadingsCard data={data} trend={trend} />
        <MedicinesCard data={data} today={today} onChanged={reload} onError={toast.show} />
      </div>
      <div className="grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-12">
        <CareCard care={data.care} />
        <XrayCard xray={data.latest_xray} />
      </div>
    </div>
  );
}
