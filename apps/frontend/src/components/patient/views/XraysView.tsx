'use client';

import React, { useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CircleAlertIcon, DownloadIcon, ScanLineIcon, UploadIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { localISODate, patientApi, type XrayStudy } from '@/lib/patient/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { FieldGroup } from '@/components/ui/field';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ConfirmDelete, ErrorBox, PageHeader, Skeleton, TextInput, cx, useErrorText, useFormat, useLoader } from '../ui';
import { SEVERITY_TONE, SeverityDot, StatusPill, severityColor } from '../vitals';

const ACCEPT = '.dcm,.dicom,image/png,image/jpeg,image/webp,application/dicom';
const MAX_BYTES = 25 * 1024 * 1024;

function Uploader({ onDone }: { onDone: (s: XrayStudy) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [takenOn, setTakenOn] = useState(localISODate());
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(fl: File | undefined | null) {
    setError(null);
    if (!fl) return;
    if (fl.size > MAX_BYTES) {
      setError(t('patient.xray.dropBody'));
      return;
    }
    setFile(fl);
  }

  async function submit() {
    if (!file || pending) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    if (takenOn) form.append('taken_on', takenOn);
    if (title.trim()) form.append('title', title.trim());
    try {
      const { xray } = await patientApi.uploadXray(form);
      setFile(null);
      setTitle('');
      if (input.current) input.current.value = '';
      onDone(xray);
    } catch (err) {
      setError(errText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <Empty
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cx('border p-6 transition-colors', drag && 'border-ring bg-ring/10')}
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UploadIcon />
            </EmptyMedia>
            {file ? (
              <EmptyTitle className="break-all">
                {file.name} <span className="font-normal text-muted-foreground">· {f.bytes(file.size)}</span>
              </EmptyTitle>
            ) : (
              <>
                <EmptyTitle>{t('patient.xray.dropTitle')}</EmptyTitle>
                <EmptyDescription>{t('patient.xray.dropBody')}</EmptyDescription>
              </>
            )}
          </EmptyHeader>
          <EmptyContent>
            <input ref={input} type="file" accept={ACCEPT} className="sr-only" id="xray-file" onChange={(e) => pick(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
              {file ? t('patient.xray.change') : t('patient.xray.choose')}
            </Button>
          </EmptyContent>
        </Empty>

        <FieldGroup className="gap-4">
          <TextInput label={t('patient.xray.takenOn')} type="date" max={localISODate()} value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
          <TextInput label={t('patient.xray.label')} hint={t('common.optional')} placeholder={t('patient.xray.labelPlaceholder')} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </FieldGroup>

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {pending && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('patient.xray.analyzing')}
          </p>
        )}
        <Button className="w-full" disabled={!file || pending} onClick={submit}>
          {pending ? <Spinner data-icon="inline-start" /> : <ScanLineIcon data-icon="inline-start" aria-hidden="true" />}
          {t('patient.xray.analyze')}
        </Button>
      </CardContent>
    </Card>
  );
}

function FindingsChart({ study }: { study: XrayStudy }) {
  const { t } = useI18n();
  const f = useFormat();
  const rows = [...(study.findings?.pathologies ?? [])].sort((a, b) => b.probability - a.probability);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('patient.xray.findingsHint')}</p>
      <ul className="flex flex-col gap-3">
        {rows.map((p) => (
          <li key={p.name} title={`${t(`patient.xray.pathologies.${p.name}`)}: ${f.pct(p.probability)} (${t('patient.xray.threshold')} ${f.pct(p.threshold)})`}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className={cx('min-w-0 truncate', p.positive ? 'font-medium' : 'text-muted-foreground')}>{t(`patient.xray.pathologies.${p.name}`)}</span>
              <span className="flex shrink-0 items-center gap-2">
                {p.positive && <StatusPill status="high" />}
                <span className="w-10 text-right tabular-nums">{f.pct(p.probability)}</span>
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-muted">
              <div className={cx('h-full rounded-full', p.positive ? 'bg-chart-4' : 'bg-chart-1')} style={{ width: `${Math.max(1.5, p.probability * 100)}%` }} />
              <span aria-hidden="true" className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-foreground/70" style={{ left: `${p.threshold * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-foreground/70" />
        {t('patient.xray.threshold')}
      </p>
    </div>
  );
}

function StudyDetail({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const { data, error, reload } = useLoader(() => patientApi.xray(id), [id]);
  const [view, setView] = useState<'preview' | 'heatmap'>('preview');
  const [delError, setDelError] = useState<string | null>(null);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-[520px] rounded-xl" />;
  const s = data.xray;
  const tone = severityColor(s.severity);

  async function remove() {
    try {
      await patientApi.deleteXray(s.id);
      onDeleted();
    } catch (err) {
      setDelError(errText(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {s.status === 'completed' && s.severity ? (
        <Alert style={{ borderColor: `color-mix(in oklch, ${tone.color} 35%, transparent)`, background: tone.bg }}>
          <AlertTitle className="flex flex-wrap items-center gap-2 text-base">
            <StatusPill status={SEVERITY_TONE[s.severity]} />
            <h2>{t(`patient.xray.severity.${s.severity}.title`)}</h2>
          </AlertTitle>
          <AlertDescription className="text-foreground/85">{t(`patient.xray.severity.${s.severity}.body`)}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>
            <h2>{t('patient.xray.failed')}</h2>
          </AlertTitle>
          {s.error && <AlertDescription>{s.error}</AlertDescription>}
        </Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card size="sm">
          <CardContent className="flex flex-col gap-3">
            {s.has_preview ? (
              <>
                <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={patientApi.xrayImageUrl(s.id, view === 'heatmap' && s.has_heatmap ? 'heatmap' : 'preview')}
                    alt={view === 'heatmap' ? t('patient.xray.viewHeatmap') : t('patient.xray.viewOriginal')}
                    className="size-full object-contain"
                  />
                </div>
                {s.has_heatmap && (
                  <ToggleGroup variant="outline" size="sm" value={[view]} onValueChange={(v) => v[0] && setView(v[0] as 'preview' | 'heatmap')}>
                    <ToggleGroupItem value="preview">{t('patient.xray.viewOriginal')}</ToggleGroupItem>
                    <ToggleGroupItem value="heatmap">{t('patient.xray.viewHeatmap')}</ToggleGroupItem>
                  </ToggleGroup>
                )}
                {view === 'heatmap' && <p className="text-xs text-muted-foreground">{t('patient.xray.heatmapHint')}</p>}
              </>
            ) : (
              <div className="grid aspect-square place-items-center rounded-xl bg-muted text-sm text-muted-foreground">{s.original_filename}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h3>{t('patient.xray.findings')}</h3>
            </CardTitle>
          </CardHeader>
          <CardContent>{s.findings ? <FindingsChart study={s} /> : <p className="text-sm text-muted-foreground">—</p>}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {s.primary_finding && (
              <div>
                <dt className="text-muted-foreground">{t('patient.xray.primary')}</dt>
                <dd>{t(`patient.xray.pathologies.${s.primary_finding}`)}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">{t('patient.xray.takenOn')}</dt>
              <dd>{f.date(s.taken_on || s.created_at)}</dd>
            </div>
            {s.analyzed_at && (
              <div>
                <dt className="text-muted-foreground">{t('patient.xray.analyzedAt')}</dt>
                <dd>{f.date(s.analyzed_at, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
              </div>
            )}
            {s.model_name && (
              <div>
                <dt className="text-muted-foreground">{t('patient.xray.model')}</dt>
                <dd>{s.model_name}</dd>
              </div>
            )}
          </dl>
          <Separator />
          <p className="text-sm text-muted-foreground">{t('patient.xray.disclaimer')}</p>
          {delError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{delError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<a href={patientApi.xrayImageUrl(s.id, 'original')} />}>
            <DownloadIcon data-icon="inline-start" aria-hidden="true" />
            {t('patient.xray.downloadOriginal')}
          </Button>
          <ConfirmDelete withText label={t('common.delete')} title={t('patient.xray.deleteConfirm')} onConfirm={remove} />
        </CardFooter>
      </Card>
    </div>
  );
}

export default function XraysView() {
  const { t } = useI18n();
  const f = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data, error, reload } = useLoader(() => patientApi.xrays(), []);
  const studies = data?.xrays ?? [];
  const selected = params.get('id') ?? studies[0]?.id ?? null;

  const select = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('patient.xray.title')} subtitle={t('patient.xray.subtitle')} />
      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Uploader
            onDone={(s) => {
              void reload();
              select(s.id);
            }}
          />
          {error && !data ? (
            <ErrorBox error={error} onRetry={reload} />
          ) : !data ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : (
            studies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>{t('patient.xray.history')}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ItemGroup className="gap-1">
                    {studies.map((s) => (
                      <Item
                        key={s.id}
                        size="sm"
                        className={cx('cursor-pointer text-left hover:bg-muted', selected === s.id && 'bg-muted')}
                        render={<button type="button" aria-current={selected === s.id ? 'true' : undefined} onClick={() => select(s.id)} />}
                      >
                        <ItemMedia className="size-12 overflow-hidden rounded-lg bg-black">
                          {s.has_preview && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={patientApi.xrayImageUrl(s.id, 'preview')} alt="" className="size-full object-cover" loading="lazy" />
                          )}
                        </ItemMedia>
                        <ItemContent className="min-w-0">
                          <ItemTitle className="w-full">
                            <SeverityDot severity={s.severity} />
                            <span className="truncate">{s.title || s.original_filename}</span>
                          </ItemTitle>
                          <ItemDescription className="truncate">
                            {f.date(s.taken_on || s.created_at)} ·{' '}
                            {s.status === 'completed' && s.severity ? t(`patient.xray.severity.${s.severity}.title`) : t('patient.xray.failed')}
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                </CardContent>
              </Card>
            )
          )}
        </div>

        <div>
          {selected ? (
            <StudyDetail
              key={selected}
              id={selected}
              onDeleted={async () => {
                await reload();
                select(null);
              }}
            />
          ) : data ? (
            <Empty className="border py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScanLineIcon />
                </EmptyMedia>
                <EmptyTitle>{t('patient.xray.empty')}</EmptyTitle>
                <EmptyDescription>{t('patient.xray.subtitle')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Skeleton className="h-[420px] rounded-xl" />
          )}
        </div>
      </div>
    </div>
  );
}
