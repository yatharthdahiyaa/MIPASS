'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActivityIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  MailIcon,
  MessageSquareIcon,
  PillIcon,
  PlusIcon,
  ScanLineIcon,
  UserPlusIcon,
  UserRoundPenIcon,
} from 'lucide-react';
import { authApi } from '@/lib/auth/api';
import { useSession } from '@/lib/auth/SessionProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { localISODate, patientApi, type LatestReading, type LogMetric, type Overview } from '@/lib/patient/api';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import DoseList from '../DoseList';
import { ErrorBox, useFormat, useLoader, useToast } from '../ui';
import { SeverityDot, StatusPill, bpStatus, glucoseStatus, heartRateStatus, spo2Status, temperatureStatus, type VitalStatus } from '../vitals';

const TILE_ORDER: LogMetric[] = ['systolic', 'heart_rate', 'glucose', 'spo2', 'temperature_c', 'weight_kg', 'sleep_hours', 'steps'];

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
function LinkButton({ href, children, variant = 'outline', size }: { href: string; children: React.ReactNode; variant?: 'default' | 'outline' | 'ghost'; size?: 'sm' | 'default' }) {
  return (
    <Button variant={variant} size={size} nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  );
}

function Greeting({ data }: { data: Overview }) {
  const { user } = useSession();
  const { t } = useI18n();
  const f = useFormat();
  const hour = new Date().getHours();
  const first = (user?.name || '').split(/\s+/)[0] || '';
  const key = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm text-muted-foreground">{f.date(data.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t(`patient.greeting.${key}`, { name: first })}</h1>
        <p className="text-base text-muted-foreground">
          {data.streak_days > 0 ? t('patient.overview.streak', { n: f.num(data.streak_days) }) : t('patient.overview.streakNone')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/patient/log" variant="default">
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {t('patient.overview.logCta')}
        </LinkButton>
        <LinkButton href="/patient/xrays">
          <ScanLineIcon data-icon="inline-start" aria-hidden="true" />
          {t('patient.overview.uploadXray')}
        </LinkButton>
      </div>
    </header>
  );
}

/** One cell of the "today" strip: a figure, its label and, where it means something, progress toward a target. */
function Stat({ label, value, sub, progress }: { label: string; value: string; sub?: string; progress?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-5 py-4">
      <p className="line-clamp-2 text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {progress != null && <Progress value={Math.round(Math.max(0, Math.min(1, progress)) * 100)} aria-label={label} className="mt-1 [&_[data-slot=progress-track]]:h-1.5" />}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** A callout with its action in the alert's own grid: under the text on phones, beside it from sm up. */
function Notice({
  icon: NoticeIcon,
  title,
  body,
  action,
  warning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <Alert className={cn('sm:has-[>svg]:grid-cols-[auto_1fr_auto]', warning && 'border-warning/30 bg-warning/5')}>
      <NoticeIcon className={cn(warning && 'text-warning')} />
      <AlertTitle>{title}</AlertTitle>
      {body && <AlertDescription>{body}</AlertDescription>}
      {action && <div className="col-start-2 mt-2 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:self-center">{action}</div>}
    </Alert>
  );
}

/** Things waiting for the patient: an unconfirmed e-mail, doctors asking to connect, unread messages, an incomplete profile. */
function Attention({ data, email }: { data: Overview; email: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const [resend, setResend] = useState<'idle' | 'pending' | 'sent'>('idle');
  const { care } = data;
  const profileIncomplete = data.profile.completeness < 1;
  if (data.email_verified && care.pending_invites.length === 0 && care.unread_messages === 0 && !profileIncomplete) return null;

  async function onResend() {
    setResend('pending');
    try {
      await authApi.requestVerification();
      setResend('sent');
    } catch {
      setResend('idle');
    }
  }

  return (
    <section aria-label={t('care.overview.title')} className="flex flex-col gap-3">
      {!data.email_verified && (
        <Notice
          warning
          icon={MailIcon}
          title={t('care.overview.verifyTitle')}
          body={resend === 'sent' ? t('care.overview.verifySent') : t('care.overview.verifyBody', { email })}
          action={
            resend !== 'sent' && (
              <Button variant="outline" size="sm" disabled={resend === 'pending'} onClick={onResend}>
                {resend === 'pending' && <Spinner data-icon="inline-start" />}
                {t('care.overview.verifyResend')}
              </Button>
            )
          }
        />
      )}
      {care.pending_invites.map((link) => (
        <Notice
          key={link.id}
          icon={UserPlusIcon}
          title={t('care.overview.wantsToConnect', { name: link.doctor ? t('care.drName', { name: link.doctor.name }) : t('care.formerDoctor') })}
          body={link.doctor?.specialty ?? undefined}
          action={
            <LinkButton href="/patient/care" size="sm">
              {t('care.overview.review')}
            </LinkButton>
          }
        />
      ))}
      {care.unread_messages > 0 && (
        <Notice
          icon={MessageSquareIcon}
          title={care.unread_messages === 1 ? t('care.overview.unreadOne') : t('care.overview.unreadMany', { n: f.num(care.unread_messages) })}
          action={
            <LinkButton href="/patient/care?tab=messages" size="sm">
              {t('care.overview.read')}
            </LinkButton>
          }
        />
      )}
      {profileIncomplete && (
        <Notice
          icon={UserRoundPenIcon}
          title={t('patient.overview.completeProfile')}
          body={t('patient.overview.completeProfileBody')}
          action={
            <LinkButton href="/patient/profile" size="sm">
              {t('patient.overview.completeProfileCta')}
            </LinkButton>
          }
        />
      )}
    </section>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={href} />}>
      {label}
      <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
    </Button>
  );
}

function EmptyBlock({ icon: EmptyIcon, text, action }: { icon: React.ComponentType; text: string; action: React.ReactNode }) {
  return (
    <Empty className="border p-5">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <EmptyIcon />
        </EmptyMedia>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{action}</EmptyContent>
    </Empty>
  );
}

/** Connected doctors and the next consultation. */
function CareCard({ care }: { care: Overview['care'] }) {
  const { t } = useI18n();
  const f = useFormat();
  const doctors = care.doctors.filter((d) => d != null);
  const next = care.next_consult;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('care.overview.title')}</h2>
        </CardTitle>
        <CardAction>
          <ViewAll href="/patient/care" label={t('care.overview.open')} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {doctors.length === 0 ? (
          <EmptyBlock
            icon={UserPlusIcon}
            text={t('care.overview.empty')}
            action={
              <LinkButton href="/patient/care" size="sm">
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                {t('care.overview.connect')}
              </LinkButton>
            }
          />
        ) : (
          <ItemGroup className="gap-1">
            {next?.scheduled_at && (
              <Item size="sm" render={<Link href="/patient/care?tab=consults" />}>
                <ItemContent>
                  <ItemDescription>{t('care.overview.nextConsult')}</ItemDescription>
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
              <Item key={d.id} size="sm" render={<Link href="/patient/care" />}>
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

/** Tiny trend line for a reading tile, drawn from the patient's own recent check-ins. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 3) return null;
  const w = 78;
  const h = 28;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [
    pad + (i * (w - pad * 2)) / (values.length - 1),
    max === min ? h / 2 : h - pad - ((v - min) / (max - min)) * (h - pad * 2),
  ]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" className="shrink-0 text-chart-1">
      <path d={d} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.3" fill="currentColor" />
    </svg>
  );
}

export default function OverviewView() {
  const { t } = useI18n();
  const { user } = useSession();
  const f = useFormat();
  const toast = useToast();
  const today = useMemo(() => localISODate(), []);
  const { data, error, loading, reload } = useLoader(() => patientApi.overview(today), [today]);
  // Two weeks of check-ins for the small trend lines; the tiles work without them.
  const recent = useLoader(() => patientApi.logs(14, today), [today]);
  const reading = useReading();
  const trend = useMemo(() => {
    const logs = [...(recent.data?.logs ?? [])].sort((a, b) => a.log_date.localeCompare(b.log_date) || a.recorded_at.localeCompare(b.recorded_at));
    return (m: LogMetric) => logs.map((l) => l[m]).filter((v): v is number => v != null);
  }, [recent.data]);

  if (!data) {
    return error ? (
      <ErrorBox error={error} onRetry={reload} />
    ) : (
      <div aria-busy="true" className="flex flex-col gap-5">
        <Skeleton className="h-28" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  const tiles = TILE_ORDER.filter((m) => data.latest[m]);
  const adherence = data.adherence_7d;
  const xray = data.latest_xray;

  return (
    <div className={cn('flex flex-col gap-6 transition-opacity', loading && 'opacity-90')}>
      <Greeting data={data} />

      <Card size="sm" className="py-0">
        <h2 className="sr-only">{t('common.today')}</h2>
        <div className="grid grid-cols-2 divide-border md:grid-cols-4 [&>*]:border-border max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r md:divide-x">
        <Stat label={t('patient.overview.checkIns')} value={f.num(data.today.check_ins)} />
        <Stat
          progress={data.today.doses_scheduled ? data.today.doses_taken / data.today.doses_scheduled : undefined}
          label={t('patient.overview.doses')}
          value={data.today.doses_scheduled ? `${f.num(data.today.doses_taken)}/${f.num(data.today.doses_scheduled)}` : '—'}
        />
        <Stat
          progress={adherence ? adherence.rate : undefined}
          label={t('patient.overview.adherence')}
          value={adherence ? f.pct(adherence.rate) : '—'}
          sub={adherence ? t('patient.meds.dosesSummary', { taken: f.num(adherence.taken), scheduled: f.num(adherence.scheduled) }) : undefined}
        />
        <Stat label={t('patient.nav.records')} value={f.num(data.counts.documents + data.counts.xrays)} />
        </div>
      </Card>

      <Attention data={data} email={user?.email ?? ''} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t('patient.overview.latestReadings')}</h2>
            </CardTitle>
            <CardAction>
              <ViewAll href="/patient/log" label={t('common.viewAll')} />
            </CardAction>
          </CardHeader>
          <CardContent>
            {tiles.length === 0 ? (
              <EmptyBlock
                icon={ActivityIcon}
                text={t('patient.overview.noReadings')}
                action={
                  <LinkButton href="/patient/log" variant="default" size="sm">
                    {t('patient.overview.logCta')}
                  </LinkButton>
                }
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {tiles.map((m) => {
                  const r = data.latest[m]!;
                  const view = reading(m, r);
                  return (
                    <li key={m} className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-muted-foreground">{view.label}</p>
                        {view.status && <StatusPill status={view.status} />}
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="flex items-baseline gap-1.5">
                            <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">{view.value}</span>
                            <span className="text-sm text-muted-foreground">{view.unit}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{f.relDay(r.log_date)}</p>
                        </div>
                        <Sparkline values={trend(m)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t('patient.overview.medsToday')}</h2>
              </CardTitle>
              <CardAction>
                <ViewAll href="/patient/medications" label={t('common.viewAll')} />
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.medications_today.length === 0 ? (
                <EmptyBlock
                  icon={PillIcon}
                  text={t('patient.overview.noMeds')}
                  action={
                    <LinkButton href="/patient/medications" size="sm">
                      <PlusIcon data-icon="inline-start" aria-hidden="true" />
                      {t('patient.overview.addMed')}
                    </LinkButton>
                  }
                />
              ) : (
                <DoseList items={data.medications_today} date={today} onChanged={reload} onError={toast.show} />
              )}
            </CardContent>
          </Card>

          <CareCard care={data.care} />

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t('patient.overview.latestXray')}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {xray ? (
                <Item variant="outline" render={<Link href={`/patient/xrays?id=${xray.id}`} />}>
                  <ItemMedia className="size-16 overflow-hidden rounded-xl bg-black">
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
                <EmptyBlock
                  icon={ScanLineIcon}
                  text={t('patient.overview.noXray')}
                  action={
                    <LinkButton href="/patient/xrays" size="sm">
                      {t('patient.overview.uploadXray')}
                    </LinkButton>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
