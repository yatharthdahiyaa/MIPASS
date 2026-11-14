import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { api, type CareMessage, type CareThread } from '../../api';
import { fmtDay, fmtTime, fmtWhen } from '../../format';
import { Icon, Spinner } from '../ui';
import { initials, patientDemographics, patientName, type OnError } from './common';

const POLL_MS = 10_000;

function merge(prev: CareMessage[], incoming: CareMessage[]) {
  if (!incoming.length) return prev;
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function Conversation({
  thread,
  onError,
  onActivity,
  onOpenRecord,
}: {
  thread: CareThread;
  onError: OnError;
  onActivity: () => void;
  onOpenRecord: (linkId: string) => void;
}) {
  const linkId = thread.link.id;
  const [messages, setMessages] = useState<CareMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastSeen = useRef<string | undefined>(undefined);
  const alive = useRef(true);
  const scroller = useRef<HTMLDivElement>(null);
  const activity = useRef(onActivity);
  useEffect(() => {
    activity.current = onActivity;
  });

  const pull = useCallback(async () => {
    const res = await api.careMessages(linkId, lastSeen.current);
    if (!alive.current) return;
    setMessages((prev) => merge(prev ?? [], res.messages));
    setError(null);
    const newest = res.messages[res.messages.length - 1];
    if (newest) lastSeen.current = newest.id;
    if (res.messages.some((m) => !m.mine && !m.read_at)) {
      await api.markThreadRead(linkId);
      activity.current();
    }
  }, [linkId]);

  useEffect(() => {
    alive.current = true;
    const tick = () => {
      if (document.hidden) return;
      pull().catch((err) => {
        if (alive.current) setError(onError(err) || null);
      });
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive.current = false;
      window.clearInterval(id);
    };
  }, [pull, onError]);

  const count = messages?.length ?? 0;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { message } = await api.sendCareMessage(linkId, body);
      setMessages((prev) => merge(prev ?? [], [message]));
      setDraft('');
      setError(null);
      activity.current();
    } catch (err) {
      setError(onError(err) || null);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="convo">
      <div className="convo-head">
        <div style={{ minWidth: 0 }}>
          <div className="truncate" style={{ fontWeight: 600, fontSize: 15 }}>
            {patientName(thread.link)}
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {[patientDemographics(thread.link), thread.link.patient?.email].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => onOpenRecord(linkId)}>
          Open shared record
        </button>
      </div>

      <div className="convo-scroll" ref={scroller} aria-live="polite">
        {messages === null && !error && <p className="muted">Loading…</p>}
        {messages?.length === 0 && <p className="muted">No messages yet.</p>}
        {messages?.map((m, i) => (
          <Fragment key={m.id}>
            {(i === 0 || fmtDay(messages[i - 1]!.created_at) !== fmtDay(m.created_at)) && <p className="day-sep">{fmtDay(m.created_at)}</p>}
            <div className={`bubble ${m.mine ? 'bubble-out' : 'bubble-in'}`}>
              {m.body}
              <time dateTime={m.created_at}>
                {fmtTime(m.created_at)}
                {m.mine && m.read_at ? ' · Read' : ''}
              </time>
            </div>
          </Fragment>
        ))}
      </div>

      <form className="composer" onSubmit={send}>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="composer-row">
          <label className="sr-only" htmlFor="care-draft">
            Message
          </label>
          <textarea
            id="care-draft"
            className="input"
            rows={2}
            maxLength={4000}
            placeholder="Write a message…  (Enter to send, Shift+Enter for a new line)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="btn btn-light" type="submit" disabled={sending || !draft.trim()} style={{ height: 44 }}>
            {sending && <Spinner />} Send
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Inbox({
  initialLinkId,
  onError,
  onChanged,
  onOpenRecord,
}: {
  initialLinkId?: string;
  onError: OnError;
  /** Called when unread counts may have changed. */
  onChanged: () => void;
  onOpenRecord: (linkId: string) => void;
}) {
  const [threads, setThreads] = useState<CareThread[] | null>(null);
  const [selected, setSelected] = useState<string | null>(initialLinkId ?? null);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setThreads((await api.careThreads()).threads);
      setListError(null);
    } catch (err) {
      setListError(onError(err));
    }
  }, [onError]);

  // The thread list is refreshed on the same cadence as the open conversation so new
  // conversations and unread counts appear without a manual reload.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    tick();
    const id = window.setInterval(tick, POLL_MS * 2);
    return () => window.clearInterval(id);
  }, [refresh]);

  const current = threads?.find((t) => t.link.id === selected) ?? threads?.[0] ?? null;

  return (
    <>
      <nav className="rail" aria-label="Conversations">
        <div className="rail-head">
          <p className="label" style={{ margin: '4px 2px' }}>
            Messages from connected patients
          </p>
        </div>
        <div className="worklist">
          {listError ? (
            <div className="empty">
              <div className="alert alert-error">{listError}</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => void refresh()}>
                <Icon name="refresh" /> Retry
              </button>
            </div>
          ) : threads == null ? (
            <p className="empty">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="empty">No conversations yet. Messaging opens once a patient is connected with you.</p>
          ) : (
            threads.map((t) => (
              <button key={t.link.id} className="wl-item" aria-current={current?.link.id === t.link.id ? 'true' : undefined} onClick={() => setSelected(t.link.id)}>
                <span className="wl-thumb" style={{ background: 'var(--s2)', fontSize: 12, fontWeight: 700 }}>
                  {initials(patientName(t.link))}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="wl-title truncate" style={{ display: 'block' }}>
                    {patientName(t.link)}
                  </span>
                  <span className="wl-sub truncate" style={{ display: 'block' }}>
                    {t.last_message ? `${t.last_message.mine ? 'You: ' : ''}${t.last_message.body}` : 'No messages yet'}
                  </span>
                </span>
                <span className="wl-side">
                  {t.last_message && <span className="tnum">{fmtWhen(t.last_message.created_at)}</span>}
                  {t.unread > 0 && <span className="badge">{t.unread}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </nav>

      <main className="main" style={{ overflow: 'hidden' }}>
        {current ? (
          <Conversation
            key={current.link.id}
            thread={current}
            onError={onError}
            onActivity={() => {
              void refresh();
              onChanged();
            }}
            onOpenRecord={onOpenRecord}
          />
        ) : (
          threads != null && <p className="empty">Select a conversation.</p>
        )}
      </main>
    </>
  );
}
