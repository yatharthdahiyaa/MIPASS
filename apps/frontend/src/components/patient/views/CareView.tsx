'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheckIcon, CalendarArrowDownIcon, CalendarPlusIcon, CircleAlertIcon, MailIcon, MessageSquareIcon, SearchIcon, SendIcon, UserPlusIcon } from 'lucide-react';
import { authApi } from '@/lib/auth/api';
import { localISODate } from '@/lib/patient/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  CARE_SCOPES,
  CONSULT_MODES,
  careApi,
  type CareLink,
  type CareMessage,
  type CareScope,
  type CareThread,
  type Consult,
  type ConsultMode,
  type DoctorCard,
} from '@/lib/care/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button as UIButton } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button, ConfirmAction, ErrorBox, PageHeader, SelectInput, Skeleton, TextArea, TextInput, useErrorText, useFormat, useLoader, useToast } from '../ui';

const TABS = ['team', 'messages', 'consults'] as const;
type Tab = (typeof TABS)[number];

const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

/* ------------------------------------------------------------------ shared */

/** RFC 5545 text: escape separators and fold lines at 75 octets. */
function icsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsFold(line: string) {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = '';
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join('\r\n ');
}
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** A one-event calendar file for a scheduled consultation, in UTC so every calendar shows local time. */
function downloadConsultIcs(consult: Consult, title: string, description: string) {
  if (!consult.scheduled_at) return;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MIPAAS//Patient portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:consult-${consult.id}@mipaas`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(consult.scheduled_at)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(icsFold);
  const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `consultation-${consult.scheduled_at.slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function ScopePicker({ value, onChange, disabled }: { value: CareScope[]; onChange: (next: CareScope[]) => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <ToggleGroup
      multiple
      variant="outline"
      size="sm"
      className="flex-wrap"
      aria-label={t('care.scopesLabel')}
      disabled={disabled}
      value={value}
      onValueChange={(v) => onChange(CARE_SCOPES.filter((s) => (v as string[]).includes(s)))}
    >
      {CARE_SCOPES.map((s) => (
        <ToggleGroupItem key={s} value={s}>
          {t(`care.scope.${s}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function doctorName(t: (k: string, v?: Record<string, string | number>) => string, doctor: { name: string } | null | undefined) {
  return doctor ? t('care.drName', { name: doctor.name }) : t('care.formerDoctor');
}

function DoctorTitle({ doctor }: { doctor: DoctorCard | null | undefined }) {
  const { t } = useI18n();
  const meta = doctor ? [doctor.specialty, doctor.organization].filter(Boolean).join(' · ') : '';
  return (
    <>
      <CardTitle className="flex flex-wrap items-center gap-2">
        <h3>{doctorName(t, doctor)}</h3>
        {doctor?.verified && (
          <Badge variant="success">
            <BadgeCheckIcon data-icon="inline-start" aria-hidden="true" />
            {t('care.verified')}
          </Badge>
        )}
      </CardTitle>
      {meta && <CardDescription>{meta}</CardDescription>}
    </>
  );
}

function DoctorItem({ doctor, action }: { doctor: DoctorCard | null | undefined; action?: React.ReactNode }) {
  const { t } = useI18n();
  const meta = doctor ? [doctor.specialty, doctor.organization].filter(Boolean).join(' · ') : '';
  return (
    <Item role="listitem" size="sm" className="px-0">
      <ItemContent className="min-w-0">
        <ItemTitle className="flex-wrap">
          {doctorName(t, doctor)}
          {doctor?.verified && <Badge variant="success">{t('care.verified')}</Badge>}
        </ItemTitle>
        {meta && <ItemDescription className="truncate">{meta}</ItemDescription>}
      </ItemContent>
      {action && <ItemActions>{action}</ItemActions>}
    </Item>
  );
}

/* -------------------------------------------------------------------- team */

function InviteForm({ onDone, canInvite, locked }: { onDone: () => void; canInvite: boolean; locked?: React.ReactNode }) {
  const { t } = useI18n();
  const errText = useErrorText();
  const [who, setWho] = useState('');
  const [scopes, setScopes] = useState<CareScope[]>([...CARE_SCOPES]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DoctorCard[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = who.trim();
    if (!value) {
      setError(t('care.inviteWhoMissing'));
      return;
    }
    if (!scopes.length) {
      setError(t('care.scopesMissing'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await careApi.inviteDoctor({
        ...(value.includes('@') ? { doctor_email: value } : { doctor_code: value }),
        scopes,
        message: message.trim() || undefined,
      });
      setWho('');
      setMessage('');
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setPending(false);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      setResults((await careApi.doctors(query.trim())).doctors);
      setError(null);
    } catch (err) {
      setError(errText(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('care.inviteTitle')}</h2>
        </CardTitle>
        <CardDescription className="max-w-2xl">{t('care.inviteBody')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {locked}
        <ErrorAlert message={error} />
        <form onSubmit={submit}>
          <FieldGroup className="gap-5">
            <TextInput
              label={t('care.inviteWho')}
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder={t('care.inviteWhoHint')}
              autoCapitalize="none"
              spellCheck={false}
            />
            <FieldSet>
              <FieldLegend variant="label">{t('care.scopesLabel')}</FieldLegend>
              <ScopePicker value={scopes} onChange={setScopes} />
            </FieldSet>
            <TextArea label={t('care.inviteMessage')} hint={t('common.optional')} value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} />
            <Button type="submit" pending={pending} disabled={!canInvite} className="w-full sm:w-fit">
              <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
              {t('care.inviteSend')}
            </Button>
          </FieldGroup>
        </form>

        <Separator />

        <form onSubmit={search} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <TextInput className="min-w-[220px] flex-1" label={t('care.directoryLabel')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('care.directoryPlaceholder')} />
            <Button type="submit" tone="ghost" pending={searching}>
              {!searching && <SearchIcon data-icon="inline-start" aria-hidden="true" />}
              {t('care.directorySearch')}
            </Button>
          </div>
          {results && (
            <ItemGroup className="gap-0 has-data-[size=sm]:gap-0">
              {results.length === 0 && <p className="text-sm text-muted-foreground">{t('care.directoryEmpty')}</p>}
              {results.map((d, i) => (
                <React.Fragment key={d.id}>
                  {i > 0 && <ItemSeparator />}
                  <DoctorItem
                    doctor={d}
                    action={
                      d.share_code && (
                        <UIButton variant="outline" size="sm" onClick={() => setWho(d.share_code ?? '')}>
                          {t('care.directoryPick')}
                        </UIButton>
                      )
                    }
                  />
                </React.Fragment>
              ))}
            </ItemGroup>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function LinkCard({ link, onChanged, go }: { link: CareLink; onChanged: (msg: string) => void; go: (tab: Tab, linkId: string) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const [scopes, setScopes] = useState<CareScope[]>(link.scopes);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invitedByDoctor = link.status === 'pending' && link.requested_by === 'doctor';
  const dirty = scopes.length !== link.scopes.length || scopes.some((s) => !link.scopes.includes(s));

  async function run(name: string, action: () => Promise<unknown>, done: string) {
    setBusy(name);
    setError(null);
    try {
      await action();
      onChanged(done);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  }

  const needScope = () => {
    if (scopes.length) return true;
    setError(t('care.scopesMissing'));
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <DoctorTitle doctor={link.doctor} />
        <CardAction>
          <Badge variant={link.status === 'active' ? 'success' : 'warning'}>
            {link.status === 'active' ? t('care.statusActive') : invitedByDoctor ? t('care.statusInvited') : t('care.statusWaiting')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {link.message && <p className="text-foreground/90">“{link.message}”</p>}
        {link.status === 'active' && link.accepted_at && <p className="text-sm text-muted-foreground">{t('care.connectedSince', { date: f.date(link.accepted_at) })}</p>}
        <FieldSet>
          <FieldLegend variant="label">{link.status === 'pending' && !invitedByDoctor ? t('care.scopesOffered') : t('care.scopesShared')}</FieldLegend>
          <ScopePicker value={scopes} onChange={setScopes} disabled={link.status === 'pending' && !invitedByDoctor} />
        </FieldSet>
        <ErrorAlert message={error} />
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {invitedByDoctor && (
          <>
            <Button pending={busy === 'accept'} onClick={() => needScope() && run('accept', () => careApi.respondToDoctor(link.id, true, scopes), t('care.toastAccepted'))}>
              {t('care.accept')}
            </Button>
            <Button tone="ghost" pending={busy === 'decline'} onClick={() => run('decline', () => careApi.respondToDoctor(link.id, false), t('care.toastDeclined'))}>
              {t('care.decline')}
            </Button>
          </>
        )}
        {link.status === 'active' && (
          <>
            {dirty && (
              <Button pending={busy === 'scopes'} onClick={() => needScope() && run('scopes', () => careApi.updateScopes(link.id, scopes), t('care.toastScopes'))}>
                {t('care.saveSharing')}
              </Button>
            )}
            <UIButton variant="outline" onClick={() => go('messages', link.id)}>
              <MessageSquareIcon data-icon="inline-start" aria-hidden="true" />
              {t('care.message')}
            </UIButton>
            <UIButton variant="outline" onClick={() => go('consults', link.id)}>
              <CalendarPlusIcon data-icon="inline-start" aria-hidden="true" />
              {t('care.requestConsult')}
            </UIButton>
            <ConfirmAction
              variant="ghost"
              className="text-destructive"
              label={t('care.stopSharing')}
              title={t('care.endConfirm')}
              onConfirm={() => run('end', () => careApi.endLink(link.id), t('care.toastEnded'))}
            />
          </>
        )}
        {link.status === 'pending' && !invitedByDoctor && (
          <Button tone="danger" pending={busy === 'end'} onClick={() => run('end', () => careApi.endLink(link.id), t('care.toastCancelled'))}>
            {t('care.cancelInvite')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function TeamTab({ go, toast }: { go: (tab: Tab, linkId: string) => void; toast: (m: string) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const { data, error, loading, reload } = useLoader(() => careApi.careTeam(), []);
  const [resend, setResend] = useState<'idle' | 'pending' | 'sent'>('idle');

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-56 rounded-surface" />;

  const open = data.links.filter((l) => l.status === 'pending' || l.status === 'active');
  const past = data.links.filter((l) => l.status === 'declined' || l.status === 'revoked');
  const changed = (msg: string) => {
    toast(msg);
    void reload();
  };

  async function resendVerification() {
    setResend('pending');
    try {
      const res = await authApi.requestVerification();
      setResend('sent');
      if (res.already_verified) void reload();
    } catch (err) {
      toast(errText(err));
      setResend('idle');
    }
  }

  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      {open.length === 0 ? (
        <Card>
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserPlusIcon />
              </EmptyMedia>
              <EmptyDescription>{t('care.teamEmpty')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {open.map((l) => (
            <LinkCard key={`${l.id}:${l.status}:${l.scopes.join(',')}`} link={l} onChanged={changed} go={go} />
          ))}
        </div>
      )}

      <InviteForm
        canInvite={data.email_verified}
        onDone={() => changed(t('care.toastInvited'))}
        locked={
          !data.email_verified && (
            <Alert className="flex flex-wrap items-center gap-x-3 gap-y-2 border-warning/30 bg-warning/5 *:[svg]:translate-y-0">
              <MailIcon className="text-warning" />
              <AlertTitle className="min-w-0 flex-1 font-normal">{resend === 'sent' ? t('care.verifySent') : t('care.verifyFirst')}</AlertTitle>
              {resend !== 'sent' && (
                <Button tone="ghost" size="sm" pending={resend === 'pending'} onClick={resendVerification}>
                  {t('care.verifyResend')}
                </Button>
              )}
            </Alert>
          )
        }
      />

      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t('care.pastTitle')}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-0 has-data-[size=sm]:gap-0">
              {past.map((l, i) => (
                <React.Fragment key={l.id}>
                  {i > 0 && <ItemSeparator />}
                  <DoctorItem
                    doctor={l.doctor}
                    action={
                      <span className="text-sm text-muted-foreground">
                        {l.status === 'declined' ? t('care.statusDeclined') : t('care.statusEnded')}
                        {l.ended_at ? ` · ${f.date(l.ended_at)}` : ''}
                      </span>
                    }
                  />
                </React.Fragment>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- messages */

const POLL_MS = 10_000;

function mergeMessages(prev: CareMessage[], incoming: CareMessage[]): CareMessage[] {
  if (!incoming.length) return prev;
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function Conversation({ thread, onActivity }: { thread: CareThread; onActivity: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const linkId = thread.link.id;
  const [messages, setMessages] = useState<CareMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastSeen = useRef<string | undefined>(undefined);
  const alive = useRef(true);
  const activity = useRef(onActivity);
  useEffect(() => {
    activity.current = onActivity;
  });

  const pull = useCallback(async () => {
    const res = await careApi.messages(linkId, lastSeen.current);
    if (!alive.current) return;
    setMessages((prev) => mergeMessages(prev ?? [], res.messages));
    setError(null);
    const newest = res.messages[res.messages.length - 1];
    if (newest) lastSeen.current = newest.id;
    if (res.messages.some((m) => !m.mine && !m.read_at)) {
      await careApi.markThreadRead(linkId);
      activity.current();
    }
  }, [linkId]);

  useEffect(() => {
    alive.current = true;
    const tick = () => {
      if (document.hidden) return;
      pull().catch((err) => alive.current && setError(errText(err)));
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive.current = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pull]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { message } = await careApi.sendMessage(linkId, body);
      setMessages((prev) => mergeMessages(prev ?? [], [message]));
      setDraft('');
      setError(null);
      activity.current();
    } catch (err) {
      setError(errText(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[min(68svh,640px)] min-h-[380px] flex-col gap-4">
      <CardHeader className="border-b px-0 pb-4 [.border-b]:pb-4">
        <DoctorTitle doctor={thread.link.doctor} />
      </CardHeader>
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-live="polite">
            <MessageScrollerContent className="gap-3 py-2 pr-1">
              {messages === null && !error && <Skeleton className="h-20" />}
              {messages?.length === 0 && <p className="text-sm text-muted-foreground">{t('care.noMessages')}</p>}
              {messages?.map((m, i) => {
                const day = localISODate(new Date(m.created_at));
                const newDay = i === 0 || localISODate(new Date(messages[i - 1].created_at)) !== day;
                return (
                  <MessageScrollerItem key={m.id} messageId={m.id} scrollAnchor={m.mine}>
                    {newDay && (
                      <Marker variant="separator" className="mb-3 text-xs">
                        <MarkerContent>{f.relDay(day)}</MarkerContent>
                      </Marker>
                    )}
                    <Message align={m.mine ? 'end' : 'start'}>
                      <MessageContent>
                        <Bubble variant={m.mine ? 'default' : 'secondary'} align={m.mine ? 'end' : 'start'}>
                          <BubbleContent className="text-body whitespace-pre-wrap">{m.body}</BubbleContent>
                        </Bubble>
                        <MessageFooter>
                          {f.time(m.created_at)}
                          {m.mine && m.read_at ? ` · ${t('care.read')}` : ''}
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <ErrorAlert message={error} />
      <form onSubmit={send} className="flex flex-col gap-2">
        <InputGroup>
          <InputGroupTextarea
            aria-label={t('care.messagePlaceholder')}
            value={draft}
            maxLength={4000}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={t('care.messagePlaceholder')}
            className="text-base md:text-body"
          />
          <InputGroupAddon align="block-end" className="justify-end">
            <InputGroupButton type="submit" variant="default" size="sm" disabled={!draft.trim() || sending}>
              {sending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" aria-hidden="true" />}
              {t('care.send')}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-xs text-muted-foreground">{t('care.messageNote')}</p>
      </form>
    </div>
  );
}

function MessagesTab({ linkId, go }: { linkId: string | null; go: (tab: Tab, linkId?: string) => void }) {
  const { t } = useI18n();
  const { data, error, reload } = useLoader(() => careApi.threads(), []);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-72 rounded-surface" />;
  if (data.threads.length === 0) {
    return (
      <Empty className="rounded-surface py-10 ring-1 ring-foreground/[0.08]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareIcon />
          </EmptyMedia>
          <EmptyDescription>{t('care.threadsEmpty')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <UIButton onClick={() => go('team')}>{t('care.goToTeam')}</UIButton>
        </EmptyContent>
      </Empty>
    );
  }

  const current = data.threads.find((th) => th.link.id === linkId) ?? data.threads[0];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card size="sm">
        <CardContent>
          <ItemGroup className="gap-1">
            {data.threads.map((th) => {
              const selected = th.link.id === current.link.id;
              return (
                <Item
                  key={th.link.id}
                  size="sm"
                  className={selected ? 'bg-muted' : 'cursor-pointer hover:bg-muted/60'}
                  render={<button type="button" aria-current={selected ? 'true' : undefined} onClick={() => go('messages', th.link.id)} />}
                >
                  <ItemContent className="min-w-0 text-left">
                    <ItemTitle className="truncate">{doctorName(t, th.link.doctor)}</ItemTitle>
                    <ItemDescription className="truncate">{th.last_message ? th.last_message.body : t('care.noMessages')}</ItemDescription>
                  </ItemContent>
                  {th.unread > 0 && (
                    <ItemActions>
                      <Badge>
                        {th.unread}
                        <span className="sr-only"> {t('care.unread')}</span>
                      </Badge>
                    </ItemActions>
                  )}
                </Item>
              );
            })}
          </ItemGroup>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Conversation key={current.link.id} thread={current} onActivity={reload} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- consults */

function ConsultForm({ links, initialLink, onDone }: { links: CareLink[]; initialLink: string | null; onDone: () => void }) {
  const { t } = useI18n();
  const errText = useErrorText();
  const [linkId, setLinkId] = useState(links.some((l) => l.id === initialLink) ? (initialLink as string) : links[0].id);
  const [mode, setMode] = useState<ConsultMode>('video');
  const [reason, setReason] = useState('');
  const [preferred, setPreferred] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offered = links.find((l) => l.id === linkId)?.doctor?.consult_modes ?? [...CONSULT_MODES];
  const modes = CONSULT_MODES.filter((m) => offered.includes(m));
  const chosen = modes.includes(mode) ? mode : (modes[0] ?? 'video');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError(t('care.consultReasonMissing'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await careApi.requestConsult({
        link_id: linkId,
        reason: reason.trim(),
        mode: chosen,
        preferred_at: preferred ? new Date(preferred).toISOString() : undefined,
      });
      setReason('');
      setPreferred('');
      onDone();
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
          <h2>{t('care.consultNew')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup className="gap-5">
            <ErrorAlert message={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label={t('care.consultDoctor')} value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                {links.map((l) => (
                  <option key={l.id} value={l.id}>
                    {doctorName(t, l.doctor)}
                  </option>
                ))}
              </SelectInput>
              <TextInput label={t('care.consultPreferred')} hint={t('common.optional')} type="datetime-local" value={preferred} onChange={(e) => setPreferred(e.target.value)} />
            </div>
            <FieldSet>
              <FieldLegend variant="label">{t('care.consultMode')}</FieldLegend>
              <ToggleGroup variant="outline" size="sm" aria-label={t('care.consultMode')} value={[chosen]} onValueChange={(v) => v[0] && setMode(v[0] as ConsultMode)}>
                {modes.map((m) => (
                  <ToggleGroupItem key={m} value={m}>
                    {t(`care.mode.${m}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <TextArea label={t('care.consultReason')} value={reason} maxLength={4000} onChange={(e) => setReason(e.target.value)} />
            <Button type="submit" pending={pending} className="w-full sm:w-fit">
              {t('care.consultSend')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

const CONSULT_BADGE: Record<string, 'success' | 'warning' | 'secondary'> = { scheduled: 'success', completed: 'success', requested: 'warning' };

function ConsultItem({ consult, onChanged }: { consult: Consult; onChanged: (msg: string) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const isOpen = consult.status === 'requested' || consult.status === 'scheduled';

  async function cancel() {
    try {
      await careApi.cancelConsult(consult.id);
      onChanged(t('care.toastConsultCancelled'));
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <div role="listitem" className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-medium">
            {doctorName(t, consult.doctor)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{t(`care.mode.${consult.mode}`)}</span>
          </p>
          <p className="break-words whitespace-pre-wrap text-foreground/90">{consult.reason}</p>
        </div>
        <Badge variant={CONSULT_BADGE[consult.status] ?? 'secondary'}>{t(`care.consultStatus.${consult.status}`)}</Badge>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {consult.scheduled_at && (
          <div>
            <dt className="inline text-muted-foreground">{t('care.consultScheduledFor')} </dt>
            <dd className="inline font-medium">{f.date(consult.scheduled_at, DATE_TIME)}</dd>
          </div>
        )}
        {consult.preferred_at && !consult.scheduled_at && (
          <div>
            <dt className="inline text-muted-foreground">{t('care.consultPreferredAt')} </dt>
            <dd className="inline">{f.date(consult.preferred_at, DATE_TIME)}</dd>
          </div>
        )}
        <div>
          <dt className="inline text-muted-foreground">{t('care.consultRequestedOn')} </dt>
          <dd className="inline">{f.date(consult.created_at)}</dd>
        </div>
      </dl>
      {consult.doctor_note && (
        <div className="rounded-control bg-muted/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">{t('care.consultDoctorNote')}</p>
          <p className="text-foreground/90">{consult.doctor_note}</p>
        </div>
      )}
      <ErrorAlert message={error} />
      {(isOpen || (consult.status === 'scheduled' && consult.scheduled_at)) && (
        <div className="flex flex-wrap gap-2">
          {consult.status === 'scheduled' && consult.scheduled_at && new Date(consult.scheduled_at) > new Date() && (
            <UIButton
              variant="outline"
              size="sm"
              onClick={() =>
                downloadConsultIcs(
                  consult,
                  t('ux.consultWith', { name: doctorName(t, consult.doctor) }),
                  [t(`care.mode.${consult.mode}`), consult.reason, consult.doctor_note].filter(Boolean).join('\n'),
                )
              }
            >
              <CalendarArrowDownIcon data-icon="inline-start" aria-hidden="true" />
              {t('ux.calendar')}
            </UIButton>
          )}
          {isOpen && (
            <ConfirmAction variant="ghost" className="w-fit text-destructive" label={t('care.consultCancel')} title={t('care.consultCancelConfirm')} onConfirm={cancel} />
          )}
        </div>
      )}
    </div>
  );
}

/** Scheduled (soonest first), then waiting requests, then everything that is closed. */
function sortConsults(list: Consult[]) {
  const rank = (c: Consult) => (c.status === 'scheduled' ? 0 : c.status === 'requested' ? 1 : 2);
  return [...list].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.status === 'scheduled') return (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '');
    return b.created_at.localeCompare(a.created_at);
  });
}

function ConsultsTab({ linkId, go, toast }: { linkId: string | null; go: (tab: Tab) => void; toast: (m: string) => void }) {
  const { t } = useI18n();
  const { data, error, reload } = useLoader(async () => {
    const [consults, team] = await Promise.all([careApi.consults(), careApi.careTeam()]);
    return { consults: sortConsults(consults.consults), links: team.links.filter((l) => l.status === 'active') };
  }, []);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-72 rounded-surface" />;

  const changed = (msg: string) => {
    toast(msg);
    void reload();
  };

  return (
    <div className="flex flex-col gap-5">
      {data.links.length > 0 ? (
        <ConsultForm links={data.links} initialLink={linkId} onDone={() => changed(t('care.toastConsultSent'))} />
      ) : (
        <Empty className="rounded-surface py-10 ring-1 ring-foreground/[0.08]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarPlusIcon />
            </EmptyMedia>
            <EmptyDescription>{t('care.consultNeedsDoctor')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <UIButton onClick={() => go('team')}>{t('care.goToTeam')}</UIButton>
          </EmptyContent>
        </Empty>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t('care.consultListTitle')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.consults.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('care.consultsEmpty')}</p>
          ) : (
            <div role="list" className="-my-4 flex flex-col divide-y">
              {data.consults.map((c) => (
                <ConsultItem key={`${c.id}:${c.status}`} consult={c} onChanged={changed} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------- view */

export default function CareView() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const raw = params.get('tab');
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'team';
  const linkId = params.get('link');

  const go = useCallback(
    (next: Tab, link?: string) => {
      const q = new URLSearchParams({ tab: next });
      if (link) q.set('link', link);
      router.replace(`/patient/care?${q.toString()}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('care.title')} subtitle={t('care.subtitle')} />
      <Tabs value={tab} onValueChange={(v) => go(v as Tab)} className="gap-6">
        <TabsList aria-label={t('care.title')} className="max-w-full overflow-x-auto">
          {TABS.map((x) => (
            <TabsTrigger key={x} value={x}>
              {t(`care.tab.${x}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="team">{tab === 'team' && <TeamTab go={go} toast={toast.show} />}</TabsContent>
        <TabsContent value="messages">{tab === 'messages' && <MessagesTab linkId={linkId} go={go} />}</TabsContent>
        <TabsContent value="consults">{tab === 'consults' && <ConsultsTab linkId={linkId} go={go} toast={toast.show} />}</TabsContent>
      </Tabs>
    </div>
  );
}
