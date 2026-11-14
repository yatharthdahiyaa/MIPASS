'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRightIcon, CircleAlertIcon, FileTextIcon, SparklesIcon, ThumbsDownIcon, ThumbsUpIcon, TriangleAlertIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { agentsApi, runAgent, type AgentRun, type ReportExplanation } from '@/lib/agents/api';
import { patientApi, type SharedReport } from '@/lib/patient/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { ErrorBox, Skeleton, useErrorText, useFormat, useLoader } from './ui';
import { SeverityDot } from './vitals';

/** The report explainer's result, with feedback that is recorded against the run. */
function Explanation({ run }: { run: AgentRun<ReportExplanation> }) {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState<'idle' | 'sent'>(run.review_decision ? 'sent' : 'idle');
  const out = run.output;
  if (!out) return null;

  async function send(helpful: boolean) {
    setFeedback('sent');
    try {
      await agentsApi.review(run.id, helpful ? 'accepted' : 'discarded');
    } catch {
      // feedback is best effort
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {out.attention && (
        <Alert role="status" className="border-warning/30 bg-warning/5">
          <TriangleAlertIcon className="text-warning" />
          <AlertDescription className="text-foreground">{out.attention}</AlertDescription>
        </Alert>
      )}
      <section className="flex flex-col gap-2">
        <h4 className="font-medium">{t('reports.summary')}</h4>
        {out.summary ? (
          <p className="text-base whitespace-pre-line text-foreground/90">{out.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{run.guard ? t('reports.summaryWithheld') : t('reports.summaryOff')}</p>
        )}
      </section>
      {out.terms.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="font-medium">{t('reports.terms')}</h4>
          <dl className="flex flex-col gap-2">
            {out.terms.map((term) => (
              <div key={term.term} className="rounded-xl bg-muted/60 px-4 py-3">
                <dt className="font-medium first-letter:uppercase">{term.term}</dt>
                <dd className="text-sm text-muted-foreground">{term.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h4 className="font-medium">{t('reports.questions')}</h4>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-foreground/90">
          {out.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-muted-foreground">{out.notice}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {feedback === 'sent' ? (
          <span role="status">{t('reports.thanks')}</span>
        ) : (
          <>
            <span>{t('reports.helpful')}</span>
            <Button variant="outline" size="sm" onClick={() => send(true)}>
              <ThumbsUpIcon data-icon="inline-start" aria-hidden="true" />
              {t('reports.yes')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => send(false)}>
              <ThumbsDownIcon data-icon="inline-start" aria-hidden="true" />
              {t('reports.no')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ReportDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const { data, error, reload } = useLoader(() => patientApi.report(id), [id]);
  const [run, setRun] = useState<AgentRun<ReportExplanation> | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function explain() {
    setBusy(true);
    setProblem(null);
    abort.current = new AbortController();
    try {
      const done = await runAgent<ReportExplanation>('report_explainer', { report_id: id, language: locale }, abort.current.signal);
      if (done.status === 'succeeded') setRun(done);
      else setProblem(done.error || t('reports.failed'));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setProblem(errText(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-40" />;
  const r = data.report;

  return (
    <div className="h-rise flex flex-col gap-5 py-2">
      <div className="flex flex-col gap-5 sm:flex-row">
        {r.has_preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={patientApi.reportImageUrl(r.id, 'preview')} alt="" className="size-40 shrink-0 rounded-xl bg-black object-cover" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h3 className="font-medium">{t('reports.impression')}</h3>
          <p className="text-base whitespace-pre-line text-foreground/90">{r.impression || t('reports.noImpression')}</p>
          {r.impression && !run && (
            <Button className="w-fit" disabled={busy} onClick={explain}>
              {busy ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" aria-hidden="true" />}
              {busy ? t('reports.explaining') : t('reports.explain')}
            </Button>
          )}
          {problem && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
      {run && <Explanation run={run} />}
      <Separator />
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{[r.signed_by ? t('reports.signedBy', { name: r.signed_by }) : null, r.signed_at ? f.date(r.signed_at) : null].filter(Boolean).join(' · ')}</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('reports.close')}
        </Button>
      </div>
    </div>
  );
}

/** Signed reports doctors shared with this patient, each with the plain-language explainer. */
export default function ReportsSection() {
  const { t } = useI18n();
  const f = useFormat();
  const linked = useSearchParams().get('report');
  const { data, error, reload } = useLoader(() => patientApi.reports(), []);
  const [open, setOpen] = useState<string | null>(linked);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('reports.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && !data ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : !data ? (
          <Skeleton className="h-24" />
        ) : data.reports.length === 0 ? (
          <Empty className="border p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyDescription>{t('reports.empty')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-0">
            {data.reports.map((r: SharedReport, i) => (
              <React.Fragment key={r.id}>
                {i > 0 && <ItemSeparator />}
                {open === r.id ? (
                  <ReportDetail id={r.id} onClose={() => setOpen(null)} />
                ) : (
                  <Item size="sm" className="cursor-pointer px-1 text-left hover:bg-muted" render={<button type="button" onClick={() => setOpen(r.id)} />}>
                    <ItemMedia>
                      <SeverityDot severity={r.severity} />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="truncate">{r.analyzer_name || r.modality || t('reports.title')}</ItemTitle>
                      <ItemDescription className="truncate">
                        {[r.doctor?.name ? t('care.drName', { name: r.doctor.name }) : null, r.study_date ? f.date(r.study_date) : r.signed_at ? f.date(r.signed_at) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="text-sm text-muted-foreground">
                      {t('reports.open')}
                      <ChevronRightIcon aria-hidden="true" className="size-4" />
                    </ItemActions>
                  </Item>
                )}
              </React.Fragment>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}
