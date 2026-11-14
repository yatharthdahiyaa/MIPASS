'use client';

import React, { Suspense, useRef, useState } from 'react';
import { CircleAlertIcon, DownloadIcon, FileTextIcon, PlusIcon } from 'lucide-react';
import ReportsSection from '../ReportsSection';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { DOCUMENT_CATEGORIES, localISODate, patientApi, type DocumentCategory, type PatientDocument } from '@/lib/patient/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ConfirmDelete, ErrorBox, PageHeader, SelectInput, Skeleton, TextInput, useErrorText, useFormat, useLoader, useToast } from '../ui';

const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp,.dcm,.dicom';
const MAX_BYTES = 25 * 1024 * 1024;

function UploadDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('lab_report');
  const [date, setDate] = useState(localISODate());
  const [provider, setProvider] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || file.size > MAX_BYTES) {
      setError(t('patient.records.fileHint'));
      return;
    }
    setPending(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    if (title.trim()) form.append('title', title.trim());
    if (date) form.append('record_date', date);
    if (provider.trim()) form.append('provider', provider.trim());
    if (notes.trim()) form.append('notes', notes.trim());
    try {
      await patientApi.uploadDocument(form);
      setFile(null);
      setTitle('');
      setProvider('');
      setNotes('');
      if (fileRef.current) fileRef.current.value = '';
      onDone();
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
          <DialogTitle>{t('patient.records.upload')}</DialogTitle>
          <DialogDescription>{t('patient.records.subtitle')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="record-file">{t('patient.records.file')}</FieldLabel>
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileRef} id="record-file" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  {file ? t('patient.xray.change') : t('patient.xray.choose')}
                </Button>
                {file && (
                  <span className="min-w-0 text-sm break-all">
                    {file.name} <span className="text-muted-foreground">· {f.bytes(file.size)}</span>
                  </span>
                )}
              </div>
              <FieldDescription>{t('patient.records.fileHint')}</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label={t('patient.records.titleLabel')} placeholder={t('patient.records.titlePlaceholder')} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
              <SelectInput label={t('patient.records.category')} value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`patient.records.categories.${c}`)}
                  </option>
                ))}
              </SelectInput>
              <TextInput label={t('patient.records.date')} type="date" max={localISODate()} value={date} onChange={(e) => setDate(e.target.value)} />
              <TextInput label={t('patient.records.provider')} hint={t('common.optional')} value={provider} maxLength={150} onChange={(e) => setProvider(e.target.value)} />
              <TextInput className="sm:col-span-2" label={t('patient.records.notes')} hint={t('common.optional')} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
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
              {pending ? t('common.saving') : t('patient.records.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FileBadge({ doc }: { doc: PatientDocument }) {
  const ext = doc.content_type === 'application/pdf' ? 'PDF' : doc.content_type === 'application/dicom' ? 'DCM' : doc.content_type.split('/')[1]?.toUpperCase().slice(0, 4);
  return (
    <ItemMedia aria-hidden="true" className="size-11 rounded-xl bg-muted font-mono text-[11px] font-medium text-muted-foreground">
      {ext}
    </ItemMedia>
  );
}

export default function RecordsView() {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const toast = useToast();
  const { data, error, reload } = useLoader(() => patientApi.documents(), []);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<DocumentCategory | 'all'>('all');

  const docs = data?.documents ?? [];
  const present = DOCUMENT_CATEGORIES.filter((c) => docs.some((d) => d.category === c));
  const shown = filter === 'all' ? docs : docs.filter((d) => d.category === filter);

  async function remove(doc: PatientDocument) {
    try {
      await patientApi.deleteDocument(doc.id);
      await reload();
    } catch (err) {
      toast.show(errText(err));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('patient.records.title')}
        subtitle={t('patient.records.subtitle')}
        action={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            {t('patient.records.upload')}
          </Button>
        }
      />

      <UploadDialog
        open={adding}
        onOpenChange={setAdding}
        onDone={() => {
          setAdding(false);
          void reload();
        }}
      />

      <Suspense>
        <ReportsSection />
      </Suspense>

      <Card>
        {present.length > 1 && (
          <CardHeader>
            <ToggleGroup
              variant="outline"
              size="sm"
              className="flex-wrap"
              aria-label={t('patient.records.category')}
              value={[filter]}
              onValueChange={(v) => v[0] && setFilter(v[0] as DocumentCategory | 'all')}
            >
              <ToggleGroupItem value="all">{t('patient.records.all')}</ToggleGroupItem>
              {present.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {t(`patient.records.categories.${c}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardHeader>
        )}
        <CardContent>
          {error && !data ? (
            <ErrorBox error={error} onRetry={reload} />
          ) : !data ? (
            <Skeleton className="h-40" />
          ) : shown.length === 0 ? (
            <Empty className="border p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyDescription>{docs.length === 0 ? t('patient.records.empty') : t('patient.records.emptyFilter')}</EmptyDescription>
              </EmptyHeader>
              {docs.length === 0 && (
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                    <PlusIcon data-icon="inline-start" aria-hidden="true" />
                    {t('patient.records.upload')}
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <ItemGroup className="gap-0">
              {shown.map((d, i) => (
                <React.Fragment key={d.id}>
                  {i > 0 && <ItemSeparator />}
                  <Item role="listitem" className="px-0">
                    <FileBadge doc={d} />
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full">
                        <a href={patientApi.documentUrl(d.id)} target="_blank" rel="noopener noreferrer" className="truncate text-base underline-offset-4 hover:underline">
                          {d.title}
                        </a>
                      </ItemTitle>
                      <ItemDescription className="truncate">
                        {[t(`patient.records.categories.${d.category}`), d.record_date ? f.date(d.record_date) : null, d.provider, f.bytes(d.size_bytes)].filter(Boolean).join(' · ')}
                      </ItemDescription>
                      {d.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{d.notes}</p>}
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        aria-label={`${t('common.download')}: ${d.title}`}
                        title={t('common.download')}
                        render={<a href={patientApi.documentUrl(d.id, true)} />}
                      >
                        <DownloadIcon aria-hidden="true" />
                      </Button>
                      <ConfirmDelete label={`${t('common.delete')}: ${d.title}`} title={t('patient.records.deleteConfirm')} onConfirm={() => remove(d)} />
                    </ItemActions>
                  </Item>
                </React.Fragment>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
