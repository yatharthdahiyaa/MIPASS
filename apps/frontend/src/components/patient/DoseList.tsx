'use client';

import React, { useState } from 'react';
import { CheckIcon, Undo2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { patientApi, type DoseStatus, type MedicationDay } from '@/lib/patient/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { cx, useErrorText, useFormat } from './ui';

/** Today's dose checklist. Updates optimistically and rolls back on failure. */
export default function DoseList({
  items,
  date,
  onChanged,
  onError,
}: {
  items: MedicationDay[];
  date: string;
  onChanged?: () => void;
  onError?: (msg: string) => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const [local, setLocal] = useState<Record<string, DoseStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const rows = items
    .flatMap((it) => it.doses.map((d) => ({ med: it.medication, slot: d.slot, status: d.status })))
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.med.name.localeCompare(b.med.name));

  async function set(medId: string, slot: string, status: DoseStatus) {
    const key = `${medId}|${slot}`;
    const prev = key in local ? local[key] : rows.find((r) => r.med.id === medId && r.slot === slot)?.status ?? null;
    setLocal((l) => ({ ...l, [key]: status }));
    setBusy(key);
    try {
      await patientApi.recordDose(medId, date, slot, status);
      onChanged?.();
    } catch (err) {
      setLocal((l) => ({ ...l, [key]: prev }));
      onError?.(errText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ItemGroup className="gap-0">
      {rows.map(({ med, slot, status: serverStatus }, i) => {
        const key = `${med.id}|${slot}`;
        const status = key in local ? local[key] : serverStatus;
        return (
          <React.Fragment key={key}>
            {i > 0 && <ItemSeparator />}
            <Item role="listitem" size="sm" className="px-0">
              <ItemMedia className="w-16 text-sm text-muted-foreground tabular-nums">{f.slot(slot)}</ItemMedia>
              <ItemContent className="min-w-0 basis-[calc(100%-5rem)] sm:basis-0">
                <ItemTitle className={cx('text-[15px]', status && 'text-muted-foreground')}>{med.name}</ItemTitle>
                {(med.dosage || med.instructions) && <ItemDescription>{[med.dosage, med.instructions].filter(Boolean).join(' · ')}</ItemDescription>}
              </ItemContent>
              <ItemActions className="ml-auto w-full justify-end sm:w-auto">
                {status ? (
                  <>
                    <Badge variant={status === 'taken' ? 'success' : 'secondary'}>
                      {status === 'taken' && <CheckIcon data-icon="inline-start" aria-hidden="true" />}
                      {status === 'taken' ? t('patient.meds.taken') : t('patient.meds.skipped')}
                    </Badge>
                    <Button variant="ghost" size="sm" disabled={busy === key} onClick={() => set(med.id, slot, null)}>
                      <Undo2Icon data-icon="inline-start" aria-hidden="true" />
                      {t('patient.meds.undo')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" disabled={busy === key} onClick={() => set(med.id, slot, 'skipped')}>
                      {t('patient.meds.markSkipped')}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy === key}
                      onClick={() => set(med.id, slot, 'taken')}
                      aria-label={`${t('patient.meds.markTaken')}: ${med.name} ${f.slot(slot)}`}
                    >
                      <CheckIcon data-icon="inline-start" aria-hidden="true" />
                      {t('patient.meds.markTaken')}
                    </Button>
                  </>
                )}
              </ItemActions>
            </Item>
          </React.Fragment>
        );
      })}
    </ItemGroup>
  );
}
