'use client';

import React, { useMemo, useState } from 'react';
import { CircleAlertIcon, PauseIcon, PillIcon, PlayIcon, PlusIcon, XIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { localISODate, patientApi, type Adherence, type Medication } from '@/lib/patient/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import DoseList from '../DoseList';
import { ConfirmDelete, ErrorBox, PageHeader, Skeleton, TextInput, cx, useErrorText, useFormat, useLoader, useToast } from '../ui';

function Meter({ label, value }: { label: string; value: Adherence | null }) {
  const { t } = useI18n();
  const f = useFormat();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      {value ? (
        <>
          <p className="font-heading text-[1.625rem] leading-8 font-semibold tracking-[-0.02em] tabular-nums">{f.pct(value.rate)}</p>
          <Progress value={Math.round(value.rate * 100)} aria-label={label} className="mt-1" />
          <p className="text-meta text-muted-foreground">{t('patient.meds.dosesSummary', { taken: f.num(value.taken), scheduled: f.num(value.scheduled) })}</p>
        </>
      ) : (
        <p className="text-body text-muted-foreground">{t('patient.meds.noData')}</p>
      )}
    </div>
  );
}

function AdherenceCard({ week, month }: { week: Adherence | null; month: Adherence | null }) {
  const { t } = useI18n();
  return (
    <Card className="h-full lg:col-span-5">
      <CardHeader>
        <CardTitle>
          <h2>{t('ux.adherence')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5 sm:flex-row lg:flex-col">
        <Meter label={t('patient.meds.adherence7')} value={week} />
        <Separator className="sm:hidden lg:block" />
        <Meter label={t('patient.meds.adherence30')} value={month} />
      </CardContent>
    </Card>
  );
}

function AddMedication({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: () => void }) {
  const { t } = useI18n();
  const errText = useErrorText();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [instructions, setInstructions] = useState('');
  const [prescribedBy, setPrescribedBy] = useState('');
  const [start, setStart] = useState(localISODate());
  const [end, setEnd] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDosage('');
    setTimes(['08:00']);
    setInstructions('');
    setPrescribedBy('');
    setStart(localISODate());
    setEnd('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('patient.meds.name'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await patientApi.addMedication({
        name: name.trim(),
        dosage: dosage.trim() || null,
        times: times.filter(Boolean),
        instructions: instructions.trim() || null,
        prescribed_by: prescribedBy.trim() || null,
        start_date: start || null,
        end_date: end || null,
      });
      reset();
      onAdded();
    } catch (err) {
      setError(errText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('patient.meds.add')}</DialogTitle>
          <DialogDescription>{t('patient.meds.subtitle')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label={t('patient.meds.name')} placeholder={t('patient.meds.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={150} />
              <TextInput label={t('patient.meds.dosage')} placeholder={t('patient.meds.dosagePlaceholder')} value={dosage} onChange={(e) => setDosage(e.target.value)} maxLength={100} />
            </div>
            <FieldSet>
              <FieldLegend variant="label">{t('patient.meds.times')}</FieldLegend>
              <div className="flex flex-wrap items-center gap-2">
                {times.map((tm, i) => (
                  <InputGroup key={i} className="w-auto">
                    <InputGroupInput
                      type="time"
                      aria-label={`${t('patient.meds.times')} ${i + 1}`}
                      value={tm}
                      onChange={(e) => setTimes((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))}
                      className="w-28"
                    />
                    {times.length > 1 && (
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton size="icon-xs" aria-label={t('common.remove')} onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))}>
                          <XIcon aria-hidden="true" />
                        </InputGroupButton>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                ))}
                {times.length < 8 && (
                  <Button variant="outline" onClick={() => setTimes((ts) => [...ts, '20:00'])}>
                    <PlusIcon data-icon="inline-start" aria-hidden="true" />
                    {t('patient.meds.addTime')}
                  </Button>
                )}
              </div>
            </FieldSet>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label={t('patient.meds.instructions')} placeholder={t('patient.meds.instructionsPlaceholder')} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={255} />
              <TextInput label={t('patient.meds.prescribedBy')} hint={t('common.optional')} value={prescribedBy} onChange={(e) => setPrescribedBy(e.target.value)} maxLength={150} />
              <TextInput label={t('patient.meds.start')} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <TextInput label={t('patient.meds.end')} hint={t('common.optional')} type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </div>
            {error && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? t('common.saving') : t('patient.meds.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MedicationRow({ med, onChange, onError }: { med: Medication; onChange: () => void; onError: (m: string) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (err) {
      onError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const details = [med.times.map(f.slot).join(' · '), med.instructions, med.prescribed_by, med.end_date ? `→ ${f.date(med.end_date)}` : null].filter(Boolean).join(' · ');

  return (
    <Item role="listitem" className={cx('px-0', !med.is_active && 'opacity-70')}>
      <ItemContent className="min-w-0 basis-full sm:basis-0">
        <ItemTitle className="flex-wrap">
          {med.name}
          {med.dosage && <span className="text-sm font-normal text-muted-foreground">{med.dosage}</span>}
          {!med.is_active && <Badge variant="secondary">{t('patient.meds.paused')}</Badge>}
        </ItemTitle>
        <ItemDescription>{details}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => patientApi.updateMedication(med.id, { is_active: !med.is_active }))}>
          {med.is_active ? <PauseIcon data-icon="inline-start" aria-hidden="true" /> : <PlayIcon data-icon="inline-start" aria-hidden="true" />}
          {med.is_active ? t('patient.meds.pause') : t('patient.meds.resume')}
        </Button>
        <ConfirmDelete label={t('common.delete')} title={t('patient.meds.deleteConfirm')} onConfirm={() => run(() => patientApi.deleteMedication(med.id))} />
      </ItemActions>
    </Item>
  );
}

export default function MedicationsView() {
  const { t } = useI18n();
  const toast = useToast();
  const today = useMemo(() => localISODate(), []);
  const day = useLoader(() => patientApi.medicationDay(today), [today]);
  const list = useLoader(() => patientApi.medications(), []);
  const [adding, setAdding] = useState(false);

  const refresh = () => {
    void day.reload();
    void list.reload();
  };

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <PlusIcon data-icon="inline-start" aria-hidden="true" />
      {t('patient.meds.add')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('patient.meds.title')} subtitle={t('patient.meds.subtitle')} action={addButton} />

      <AddMedication
        open={adding}
        onOpenChange={setAdding}
        onAdded={() => {
          setAdding(false);
          refresh();
        }}
      />

      <div className="grid items-stretch gap-5 lg:grid-cols-12">
        <Card className="h-full lg:col-span-7">
          <CardHeader>
            <CardTitle>
              <h2>{t('patient.meds.today')}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {day.error && !day.data ? (
              <ErrorBox error={day.error} onRetry={day.reload} />
            ) : !day.data ? (
              <Skeleton className="h-36" />
            ) : day.data.items.length === 0 ? (
              <p className="flex flex-1 items-center justify-center py-8 text-center text-body text-muted-foreground">{t('patient.meds.noneToday')}</p>
            ) : (
              <DoseList items={day.data.items} date={today} onChanged={day.reload} onError={toast.show} />
            )}
          </CardContent>
        </Card>
        <AdherenceCard week={day.data?.adherence_7d ?? null} month={day.data?.adherence_30d ?? null} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t('patient.meds.list')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.error && !list.data ? (
            <ErrorBox error={list.error} onRetry={list.reload} />
          ) : !list.data ? (
            <Skeleton className="h-32" />
          ) : list.data.medications.length === 0 ? (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PillIcon />
                </EmptyMedia>
                <EmptyDescription>{t('patient.meds.empty')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-0 has-data-[size=sm]:gap-0">
              {list.data.medications.map((m, i) => (
                <React.Fragment key={m.id}>
                  {i > 0 && <ItemSeparator />}
                  <MedicationRow med={m} onChange={refresh} onError={toast.show} />
                </React.Fragment>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
