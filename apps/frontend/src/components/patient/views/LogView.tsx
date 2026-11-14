'use client';

import React, { useMemo, useState } from 'react';
import { AngryIcon, CircleAlertIcon, FrownIcon, LaughIcon, MehIcon, SmileIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { localISODate, patientApi, type DailyLog, type LogMetric, type NewLog } from '@/lib/patient/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemSeparator } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import TrendChart, { SERIES_COLORS, type TrendSeries } from '../TrendChart';
import { ConfirmDelete, Empty, ErrorBox, PageHeader, SelectInput, Skeleton, TextArea, TextInput, useErrorText, useFormat, useLoader, useToast } from '../ui';
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
      <CardHeader>
        <CardTitle>
          <h2>{t('patient.overview.logCta')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label" className="text-muted-foreground">
                {t('patient.log.vitals')}
              </FieldLegend>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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

            <FieldSet>
              <FieldLegend variant="label" className="text-muted-foreground">
                {t('patient.log.lifestyle')}
              </FieldLegend>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {num({ k: 'sleep_hours', label: t('patient.metrics.sleep_hours'), suffix: u('h'), step: '0.5', min: 0, max: 24 })}
                {num({ k: 'steps', label: t('patient.metrics.steps'), suffix: '', min: 0, max: 150000 })}
                {num({ k: 'water_ml', label: t('patient.metrics.water_ml'), suffix: u('ml'), step: '50', min: 0, max: 15000 })}
              </div>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label" className="text-muted-foreground">
                {t('patient.log.feeling')}
              </FieldLegend>
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
              <FieldLegend variant="label" className="text-muted-foreground">
                {t('patient.log.symptoms')}
              </FieldLegend>
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

            <TextArea label={t('patient.log.notes')} placeholder={t('patient.log.notesPlaceholder')} maxLength={2000} value={form.notes} onChange={set('notes')} />

            {error && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending} className="w-full sm:w-fit">
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? t('common.saving') : t('patient.log.submit')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
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

function Trends({ logs, days, setDays }: { logs: DailyLog[]; days: number; setDays: (d: number) => void }) {
  const { t } = useI18n();
  const u = (k: string) => t(`patient.units.${k}`);
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
    { id: 'hr', title: t('patient.metrics.heart_rate'), unit: u('bpm'), series: [series(logs, 'heart_rate', t('patient.metrics.heart_rate'), SERIES_COLORS[0])] },
    { id: 'glu', title: t('patient.metrics.glucose'), unit: u('mgdl'), series: [series(logs, 'glucose', t('patient.metrics.glucose'), SERIES_COLORS[0])] },
    { id: 'spo2', title: t('patient.metrics.spo2'), unit: u('pct'), series: [series(logs, 'spo2', t('patient.metrics.spo2'), SERIES_COLORS[0])] },
    { id: 'wt', title: t('patient.metrics.weight_kg'), unit: u('kg'), digits: 1, series: [series(logs, 'weight_kg', t('patient.metrics.weight_kg'), SERIES_COLORS[0])] },
    { id: 'sleep', title: t('patient.metrics.sleep_hours'), unit: u('h'), digits: 1, series: [series(logs, 'sleep_hours', t('patient.metrics.sleep_hours'), SERIES_COLORS[0])] },
  ].filter((c) => c.series.some((s) => s.points.length > 0));

  return (
    <section aria-labelledby="trends-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="trends-h" className="font-heading text-xl font-semibold tracking-tight">
          {t('patient.log.trends')}
        </h2>
        <ToggleGroup
          variant="outline"
          size="sm"
          aria-label={t('patient.log.trends')}
          value={[String(days)]}
          onValueChange={(v) => v[0] && setDays(Number(v[0]))}
        >
          {RANGES.map((d) => (
            <ToggleGroupItem key={d} value={String(d)}>
              {t('patient.log.days', { n: d })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {charts.length === 0 ? (
        <Empty>{t('patient.log.noTrend')}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {charts.map((c) => (
            <Card key={c.id} size="sm">
              <CardHeader>
                <CardTitle>
                  <h3 className="text-base">{c.title}</h3>
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

function History({ logs, onDelete }: { logs: DailyLog[]; onDelete: (id: string) => Promise<void> }) {
  const { t } = useI18n();
  const f = useFormat();
  const u = (k: string) => t(`patient.units.${k}`);
  const byDay = useMemo(() => {
    const map = new Map<string, DailyLog[]>();
    logs.forEach((l) => map.set(l.log_date, [...(map.get(l.log_date) ?? []), l]));
    return Array.from(map.entries());
  }, [logs]);

  if (logs.length === 0) return <Empty>{t('patient.log.noHistory')}</Empty>;

  return (
    <div className="flex flex-col gap-6">
      {byDay.map(([day, entries]) => (
        <section key={day} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{f.relDay(day)}</h3>
          <Card size="sm" className="py-1">
            <ItemGroup className="gap-0">
              {entries.map((l, i) => {
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
                  <React.Fragment key={l.id}>
                    {i > 0 && <ItemSeparator />}
                    <Item role="listitem" size="sm" className="items-start">
                      <ItemMedia className="w-14 pt-0.5 text-sm text-muted-foreground tabular-nums">{f.time(l.recorded_at)}</ItemMedia>
                      <ItemContent className="min-w-0 gap-2">
                        {readings.length > 0 && <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{readings}</ul>}
                        {l.symptoms.length > 0 && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">{t('patient.log.symptoms')}: </span>
                            {l.symptoms.map((s) => t(`patient.symptoms.${s}`)).join(', ')}
                          </p>
                        )}
                        {l.notes && <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">{l.notes}</p>}
                      </ItemContent>
                      <ItemActions>
                        <ConfirmDelete label={t('common.delete')} title={t('patient.log.deleteConfirm')} onConfirm={() => onDelete(l.id)} />
                      </ItemActions>
                    </Item>
                  </React.Fragment>
                );
              })}
            </ItemGroup>
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
  const [days, setDays] = useState<number>(30);
  const today = useMemo(() => localISODate(), []);
  const { data, error, reload } = useLoader(() => patientApi.logs(days, today), [days, today]);

  async function onDelete(id: string) {
    try {
      await patientApi.deleteLog(id);
      await reload();
    } catch (err) {
      toast.show(errText(err));
    }
  }

  const logs = data?.logs ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('patient.log.title')} subtitle={t('patient.log.subtitle')} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <CheckInForm onSaved={reload} />
        {error && !data ? <ErrorBox error={error} onRetry={reload} /> : !data ? <Skeleton className="h-80 rounded-xl" /> : <Trends logs={logs} days={days} setDays={setDays} />}
      </div>
      <section aria-labelledby="history-h" className="flex flex-col gap-4">
        <h2 id="history-h" className="font-heading text-xl font-semibold tracking-tight">
          {t('patient.log.history')}
        </h2>
        {data ? <History logs={logs} onDelete={onDelete} /> : <Skeleton className="h-32 rounded-xl" />}
      </section>
    </div>
  );
}
