'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AngryIcon, CircleAlertIcon, FrownIcon, LaughIcon, MehIcon, SmileIcon, Trash2Icon } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { localISODate, patientApi, type DailyLog, type LogMetric, type NewLog } from '@/lib/patient/api';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import TrendChart, { SERIES_COLORS, type TrendSeries } from '../TrendChart';
import { ErrorBox, PageHeader, SectionTitle, SelectInput, Skeleton, TextArea, TextInput, useErrorText, useFormat, useLoader, useToast, useUndoableDelete } from '../ui';
import { StatusPill, bpStatus, glucoseStatus, heartRateStatus, spo2Status, temperatureStatus } from '../vitals';

const SYMPTOMS = [
  'headache', 'fever', 'cough', 'breathlessness', 'chest_pain', 'fatigue', 'dizziness',
  'nausea', 'body_ache', 'sore_throat', 'palpitations', 'swelling', 'anxiety', 'poor_appetite',
] as const;
const RANGES = [7, 30, 90] as const;
const MOOD_ICONS = [AngryIcon, FrownIcon, MehIcon, SmileIcon, LaughIcon];

type Form = Record<Exclude<LogMetric, 'mood'>, string> & { mood: number | null; glucose_context: string; notes: string; symptoms: string[] };

const EMPTY: Form = {
  systolic: '', diastolic: '', heart_rate: '', glucose: '', spo2: '', temperature_c: '', weight_kg: '',
  sleep_hours: '', steps: '', water_ml: '', mood: null, glucose_context: '', notes: '', symptoms: [],
};

/** Small, muted group label inside the form. */
function Legend({ children }: { children: React.ReactNode }) {
  return (
    <FieldLegend variant="label" className="mb-3 text-sm font-medium text-muted-foreground">
      {children}
    </FieldLegend>
  );
}

function CheckInForm({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n();
  const errText = useErrorText();
  const [form, setForm] = useState<Form>(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const u = (k: string) => t(`patient.units.${k}`);
  const num = (props: { k: keyof Form; label: string; suffix: string; step?: string; min?: number; max?: number }) => (
    <TextInput
      label={props.label}
      suffix={props.suffix || undefined}
      inputMode="decimal"
      type="number"
      step={props.step ?? '1'}
      min={props.min}
      max={props.max}
      value={form[props.k] as string}
      onChange={set(props.k)}
    />
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: NewLog = { log_date: localISODate(), recorded_at: new Date().toISOString() };
    (['systolic', 'diastolic', 'heart_rate', 'glucose', 'spo2', 'temperature_c', 'weight_kg', 'sleep_hours', 'steps', 'water_ml'] as const).forEach((k) => {
      const v = form[k].trim();
      if (v !== '') payload[k] = Number(v);
    });
    if (form.mood) payload.mood = form.mood;
    if (form.symptoms.length) payload.symptoms = form.symptoms;
    if (form.notes.trim()) payload.notes = form.notes.trim();
    if (payload.glucose !== undefined) payload.glucose_context = form.glucose_context || undefined;
    if (Object.keys(payload).length === 2) {
      setError(t('patient.log.emptyForm'));
      return;
    }
    setPending(true);
    try {
      await patientApi.addLog(payload);
      setForm(EMPTY);
      toast.show(t('patient.log.saved'));
      onSaved();
    } catch (err) {
      setError(errText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          <h2>{t('patient.overview.logCta')}</h2>
        </CardTitle>
        <CardDescription>{t('patient.log.subtitle')}</CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate className="contents">
        <CardContent className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
          <FieldSet>
            <Legend>{t('patient.log.vitals')}</Legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {num({ k: 'systolic', label: t('patient.metrics.systolic'), suffix: u('mmhg'), min: 50, max: 260 })}
              {num({ k: 'diastolic', label: t('patient.metrics.diastolic'), suffix: u('mmhg'), min: 30, max: 160 })}
              {num({ k: 'heart_rate', label: t('patient.metrics.heart_rate'), suffix: u('bpm'), min: 25, max: 250 })}
              {num({ k: 'glucose', label: t('patient.metrics.glucose'), suffix: u('mgdl'), min: 20, max: 700 })}
              <SelectInput label={t('patient.log.glucoseWhen')} value={form.glucose_context} onChange={set('glucose_context')}>
                <option value="">{t('common.select')}</option>
                {(['fasting', 'after_meal', 'random'] as const).map((c) => (
                  <option key={c} value={c}>
                    {t(`patient.glucoseContext.${c}`)}
                  </option>
                ))}
              </SelectInput>
              {num({ k: 'spo2', label: t('patient.metrics.spo2'), suffix: u('pct'), min: 50, max: 100 })}
              {num({ k: 'temperature_c', label: t('patient.metrics.temperature_c'), suffix: u('c'), step: '0.1', min: 30, max: 45 })}
              {num({ k: 'weight_kg', label: t('patient.metrics.weight_kg'), suffix: u('kg'), step: '0.1', min: 1, max: 400 })}
            </div>
          </FieldSet>

          <div className="flex flex-col gap-8">
            <FieldSet>
              <Legend>{t('patient.log.lifestyle')}</Legend>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {num({ k: 'sleep_hours', label: t('patient.metrics.sleep_hours'), suffix: u('h'), step: '0.5', min: 0, max: 24 })}
                {num({ k: 'steps', label: t('patient.metrics.steps'), suffix: '', min: 0, max: 150000 })}
                {num({ k: 'water_ml', label: t('patient.metrics.water_ml'), suffix: u('ml'), step: '50', min: 0, max: 15000 })}
              </div>
            </FieldSet>

            <FieldSet>
              <Legend>{t('patient.log.feeling')}</Legend>
              <ToggleGroup
                variant="outline"
                size="sm"
                aria-label={t('patient.metrics.mood')}
                className="flex-wrap"
                value={form.mood ? [String(form.mood)] : []}
                onValueChange={(v) => setForm((f) => ({ ...f, mood: v[0] ? Number(v[0]) : null }))}
              >
                {[1, 2, 3, 4, 5].map((m) => {
                  const MoodIcon = MOOD_ICONS[m - 1];
                  return (
                    <ToggleGroupItem key={m} value={String(m)}>
                      <MoodIcon data-icon="inline-start" aria-hidden="true" />
                      {t(`patient.moods.${m}`)}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </FieldSet>

            <FieldSet>
              <Legend>{t('patient.log.symptoms')}</Legend>
              <ToggleGroup
                multiple
                variant="outline"
                size="sm"
                aria-label={t('patient.log.symptoms')}
                className="flex-wrap"
                value={form.symptoms}
                onValueChange={(v) => setForm((f) => ({ ...f, symptoms: v as string[] }))}
              >
                {SYMPTOMS.map((s) => (
                  <ToggleGroupItem key={s} value={s}>
                    {t(`patient.symptoms.${s}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
          </div>

          <TextArea
            className="lg:col-span-2"
            label={t('patient.log.notes')}
            placeholder={t('patient.log.notesPlaceholder')}
            maxLength={2000}
            value={form.notes}
            onChange={set('notes')}
          />
        </CardContent>

        <CardFooter className="flex-wrap justify-end gap-3 border-t">
          {error && (
            <Alert variant="destructive" className="mr-auto w-auto flex-1 py-2">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? t('common.saving') : t('patient.log.submit')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/** A reading belongs to the day it is logged for; the entry time only orders readings within that day. */
function readingTime(l: DailyLog) {
  const at = new Date(l.recorded_at);
  const day = new Date(`${l.log_date}T00:00:00`);
  day.setHours(at.getHours(), at.getMinutes(), at.getSeconds());
  return day.getTime();
}

function series(logs: DailyLog[], key: LogMetric, label: string, color: string): TrendSeries {
  return {
    key,
    label,
    color,
    points: logs.filter((l) => l[key] != null).map((l) => ({ t: readingTime(l), v: l[key] as number })),
  };
}

/** The last chart widens to fill its row (2 columns from md, 3 from xl) so no chart sits alone beside a gap. */
function lastSpan(count: number) {
  const md = count % 2 === 1 ? 'md:col-span-2' : '';
  const xl = count % 3 === 1 ? 'xl:col-span-3' : count % 3 === 2 ? 'xl:col-span-2' : 'xl:col-span-1';
  return `${md} ${xl}`;
}

function Trends({ logs, days, setDays, focus }: { logs: DailyLog[]; days: number; setDays: (d: number) => void; focus: string | null }) {
  const { t } = useI18n();
  const u = (k: string) => t(`patient.units.${k}`);
  const one = (key: LogMetric) => [series(logs, key, t(`patient.metrics.${key}`), SERIES_COLORS[0])];
  const charts: { id: string; title: string; unit: string; digits?: number; series: TrendSeries[] }[] = [
    {
      id: 'bp',
      title: t('patient.metrics.bp'),
      unit: u('mmhg'),
      series: [
        series(logs, 'systolic', t('patient.metrics.systolic'), SERIES_COLORS[0]),
        series(logs, 'diastolic', t('patient.metrics.diastolic'), SERIES_COLORS[1]),
      ],
    },
    { id: 'hr', title: t('patient.metrics.heart_rate'), unit: u('bpm'), series: one('heart_rate') },
    { id: 'glu', title: t('patient.metrics.glucose'), unit: u('mgdl'), series: one('glucose') },
    { id: 'spo2', title: t('patient.metrics.spo2'), unit: u('pct'), series: one('spo2') },
    { id: 'temp', title: t('patient.metrics.temperature_c'), unit: u('c'), digits: 1, series: one('temperature_c') },
    { id: 'wt', title: t('patient.metrics.weight_kg'), unit: u('kg'), digits: 1, series: one('weight_kg') },
    { id: 'sleep', title: t('patient.metrics.sleep_hours'), unit: u('h'), digits: 1, series: one('sleep_hours') },
    { id: 'steps', title: t('patient.metrics.steps'), unit: '', series: one('steps') },
  ].filter((c) => c.series.some((s) => s.points.length > 0));

  // Arriving from a reading on the overview: bring that chart into view once it exists.
  const hasFocus = charts.some((c) => c.id === focus);
  useEffect(() => {
    if (!focus || !hasFocus) return;
    document.getElementById(`trend-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus, hasFocus]);

  return (
    <section aria-labelledby="trends-h" className="flex flex-col gap-4">
      <SectionTitle
        id="trends-h"
        action={
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            aria-label={t('patient.log.trends')}
            value={[String(days)]}
            onValueChange={(v) => v[0] && setDays(Number(v[0]))}
          >
            {RANGES.map((d) => (
              <ToggleGroupItem key={d} value={String(d)} className="tabular-nums aria-pressed:border-input aria-pressed:bg-muted aria-pressed:text-foreground">
                {t('patient.log.days', { n: d })}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        {t('patient.log.trends')}
      </SectionTitle>
      {charts.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-body text-muted-foreground">{t('patient.log.noTrend')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {charts.map((c, i) => (
            <Card
              key={c.id}
              id={`trend-${c.id}`}
              size="sm"
              className={cn(
                'scroll-mt-24 transition-shadow',
                focus === c.id && 'ring-2 ring-ring/60',
                i === charts.length - 1 && lastSpan(charts.length),
              )}
            >
              <CardHeader>
                <CardTitle>
                  <h3 className="text-body">{c.title}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart series={c.series} unit={c.unit} digits={c.digits} title={c.title} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function History({ logs, onDelete }: { logs: DailyLog[]; onDelete: (l: DailyLog) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const u = (k: string) => t(`patient.units.${k}`);
  const byDay = useMemo(() => {
    const map = new Map<string, DailyLog[]>();
    logs.forEach((l) => map.set(l.log_date, [...(map.get(l.log_date) ?? []), l]));
    return Array.from(map.entries());
  }, [logs]);

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-body text-muted-foreground">{t('patient.log.noHistory')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {byDay.map(([day, entries]) => (
        <section key={day} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{f.relDay(day)}</h3>
          <Card size="sm" className="gap-0 py-0">
            <ul className="divide-y">
              {entries.map((l) => {
                const readings: React.ReactNode[] = [];
                const add = (key: string, label: string, value: string, status?: React.ReactNode) =>
                  readings.push(
                    <li key={key} className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">{value}</span>
                      {status}
                    </li>,
                  );
                if (l.systolic != null && l.diastolic != null)
                  add('bp', t('patient.metrics.bp'), `${f.num(l.systolic)}/${f.num(l.diastolic)} ${u('mmhg')}`, <StatusPill status={bpStatus(l.systolic, l.diastolic)} />);
                if (l.heart_rate != null) add('hr', t('patient.metrics.heart_rate'), `${f.num(l.heart_rate)} ${u('bpm')}`, <StatusPill status={heartRateStatus(l.heart_rate)} />);
                if (l.glucose != null)
                  add(
                    'glu',
                    `${t('patient.metrics.glucose')}${l.glucose_context ? ` (${t(`patient.glucoseContext.${l.glucose_context}`)})` : ''}`,
                    `${f.num(l.glucose)} ${u('mgdl')}`,
                    <StatusPill status={glucoseStatus(l.glucose, l.glucose_context)} />,
                  );
                if (l.spo2 != null) add('spo2', t('patient.metrics.spo2'), `${f.num(l.spo2)}${u('pct')}`, <StatusPill status={spo2Status(l.spo2)} />);
                if (l.temperature_c != null)
                  add('temp', t('patient.metrics.temperature_c'), `${f.num(l.temperature_c, 1)} ${u('c')}`, <StatusPill status={temperatureStatus(l.temperature_c)} />);
                if (l.weight_kg != null) add('wt', t('patient.metrics.weight_kg'), `${f.num(l.weight_kg, 1)} ${u('kg')}`);
                if (l.sleep_hours != null) add('sl', t('patient.metrics.sleep_hours'), `${f.num(l.sleep_hours, 1)} ${u('h')}`);
                if (l.steps != null) add('st', t('patient.metrics.steps'), f.num(l.steps));
                if (l.water_ml != null) add('wa', t('patient.metrics.water_ml'), `${f.num(l.water_ml)} ${u('ml')}`);
                if (l.mood != null) add('mood', t('patient.metrics.mood'), t(`patient.moods.${l.mood}`));
                return (
                  <li key={l.id} className="flex items-start gap-4 px-4 py-3.5">
                    <span className="w-14 shrink-0 pt-0.5 text-sm text-muted-foreground tabular-nums">{f.time(l.recorded_at)}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {readings.length > 0 && <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{readings}</ul>}
                      {l.symptoms.length > 0 && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">{t('patient.log.symptoms')}: </span>
                          {l.symptoms.map((s) => t(`patient.symptoms.${s}`)).join(', ')}
                        </p>
                      )}
                      {l.notes && <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">{l.notes}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="-my-1 text-muted-foreground hover:text-destructive"
                      aria-label={`${t('common.delete')} · ${f.time(l.recorded_at)}`}
                      title={t('common.delete')}
                      onClick={() => onDelete(l)}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

export default function LogView() {
  const { t } = useI18n();
  const errText = useErrorText();
  const toast = useToast();
  const params = useSearchParams();
  const focus = params.get('metric');
  const [days, setDays] = useState<number>(30);
  const today = useMemo(() => localISODate(), []);
  const { data, error, reload } = useLoader(() => patientApi.logs(days, today), [days, today]);
  /** Entries hidden while their Undo toast is open. */
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const undoable = useUndoableDelete();

  function onDelete(l: DailyLog) {
    undoable({
      key: l.id,
      message: t('ux.entryDeleted'),
      hide: () => setHidden((h) => new Set(h).add(l.id)),
      restore: () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(l.id);
          return next;
        }),
      commit: async () => {
        await patientApi.deleteLog(l.id);
        await reload();
      },
      onError: (err) => toast.show(errText(err)),
    });
  }

  const logs = (data?.logs ?? []).filter((l) => !hidden.has(l.id));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('patient.log.title')} />
      <CheckInForm onSaved={reload} />
      {error && !data ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-72 rounded-surface" />
      ) : (
        <Trends logs={logs} days={days} setDays={setDays} focus={focus} />
      )}
      <section aria-labelledby="history-h" className="flex flex-col gap-4">
        <SectionTitle id="history-h">{t('patient.log.history')}</SectionTitle>
        {data ? <History logs={logs} onDelete={onDelete} /> : <Skeleton className="h-32 rounded-surface" />}
      </section>
    </div>
  );
}
