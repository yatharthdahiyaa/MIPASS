'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LOCALES, type Locale } from '@/lib/i18n/config';
import { AssistantError, assistantApi, mediaUrl, type AssistantAttachment, type AssistantUpload } from '@/lib/patient/assistant';
import { Button, Icon, IconButton, cx } from '../ui';

// Formats the UploadAgent accepts (apps/agents/UploadAgent/pipeline.py); size cap matches the X-rays page.
const ACCEPT = '.dcm,.dicom,.png,.jpg,.jpeg,.bmp,.tif,.tiff,image/png,image/jpeg,image/bmp,image/tiff,application/dicom';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_MESSAGE = 4000;

type Message =
  | { id: string; role: 'user'; text: string; upload?: { name: string; preview: string } }
  | {
      id: string;
      role: 'assistant';
      text: string;
      language: Locale;
      attachments: AssistantAttachment[];
      audio?: string;
      speaking?: boolean;
    }
  | { id: string; role: 'notice'; text: string; error?: boolean };

let seq = 0;
const nextId = () => `msg-${++seq}`;

const icons = {
  chat: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M4.5 5.5h15v10h-8L7 19v-3.5H4.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M10 16V4m0 0-5 5m5-5 5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clip: (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="m15.5 9.5-5.6 5.6a3.5 3.5 0 0 1-5-5l6.4-6.3a2.3 2.3 0 0 1 3.3 3.3l-6.3 6.3a1.2 1.2 0 0 1-1.7-1.7l5.6-5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  speaker: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M3.5 8v4h3l4 3.5v-11l-4 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.4 6.4 0 0 1 0 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

const bubble = 'whitespace-pre-wrap break-words rounded-[16px] px-3.5 py-2.5 text-[15px] leading-[22px] text-[var(--h-text)]';
const suggestion =
  'inline-flex min-h-9 items-center rounded-full border border-[var(--h-border)] px-3.5 py-1.5 text-left text-[14px] text-[var(--h-text-2)] transition-colors hover:border-white/30 hover:bg-white/[0.04]';

export default function AssistantDock() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<(AssistantUpload & { name: string }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const panelId = useId();
  const inputId = useId();

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      input.current?.focus();
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    if (wasOpen.current) fab.current?.focus();
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  function errorText(err: unknown, upload = false) {
    const status = err instanceof AssistantError ? err.status : -1;
    if (status === 0) return t('patient.assistant.errors.offline');
    if (status === 401) return t('patient.assistant.errors.signIn');
    if (status === 413) return t('patient.assistant.errors.tooLarge');
    if (status === 400 && upload) return t('patient.assistant.errors.badFile');
    if (status === 503) return t('patient.assistant.errors.unavailable');
    return t('patient.assistant.errors.generic');
  }

  const notice = (text: string, error = false) => setMessages((m) => [...m, { id: nextId(), role: 'notice', text, error }]);

  const pathology = (label = '') => {
    const key = `patient.xray.pathologies.${label}`;
    const name = t(key);
    return name === key ? label.replace(/_/g, ' ') : name;
  };

  const languageName = (code = '') => LOCALES.find((l) => l.code === code)?.native ?? code;

  function resizeInput() {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  async function pickFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      notice(t('patient.assistant.errors.tooLarge'), true);
      return;
    }
    setUploading(true);
    try {
      const up = await assistantApi.upload(file);
      setAttachment({ ...up, name: file.name });
      input.current?.focus();
    } catch (err) {
      notice(errorText(err, true), true);
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const typed = draft.trim();
    if ((!typed && !attachment) || sending || uploading) return;
    const upload = attachment;
    const text = typed || t('patient.assistant.xrayDefault');
    const userId = nextId();
    const language = locale;
    setMessages((m) => [...m, { id: userId, role: 'user', text, upload: upload ? { name: upload.name, preview: upload.preview } : undefined }]);
    setDraft('');
    setAttachment(null);
    if (input.current) input.current.style.height = '';
    setSending(true);
    try {
      const res = await assistantApi.chat({ conversation_id: conversationId, message: text, language, upload_id: upload?.upload_id });
      setConversationId(res.conversation_id);
      setMessages((m) => [
        ...m,
        ...(res.restarted ? [{ id: nextId(), role: 'notice' as const, text: t('patient.assistant.restarted') }] : []),
        { id: nextId(), role: 'assistant', text: res.reply || t('patient.assistant.emptyReply'), language, attachments: res.attachments },
      ]);
    } catch (err) {
      // Give the patient their message back so they can try again.
      setMessages((m) => [...m.filter((x) => x.id !== userId), { id: nextId(), role: 'notice', text: errorText(err), error: true }]);
      setDraft(typed);
      setAttachment(upload);
    } finally {
      setSending(false);
    }
  }

  async function listen(id: string, text: string, language: Locale) {
    const patch = (fields: { audio?: string; speaking: boolean }) =>
      setMessages((m) => m.map((x) => (x.id === id && x.role === 'assistant' ? { ...x, ...fields } : x)));
    patch({ speaking: true });
    try {
      const { audio } = await assistantApi.speak(text, language);
      patch({ audio, speaking: false });
    } catch (err) {
      patch({ speaking: false });
      notice(errorText(err), true);
    }
  }

  function reset() {
    setMessages([]);
    setConversationId(null);
    setDraft('');
    setAttachment(null);
  }

  const canSend = (draft.trim() !== '' || attachment !== null) && !sending && !uploading;

  return (
    <>
      <button
        ref={fab}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('patient.assistant.open')}
        title={t('patient.assistant.open')}
        data-assistant-fab=""
        className={cx(
          'fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[var(--h-text)] text-[var(--h-ink)] shadow-[0_12px_32px_-8px_rgb(0_0_0/0.7)] transition-transform hover:scale-105 lg:bottom-6 lg:right-6',
          open && 'hidden',
        )}
      >
        {icons.chat}
      </button>

      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-label={t('patient.assistant.title')}
          className="fixed inset-0 z-50 flex flex-col bg-[#121213] lg:inset-auto lg:bottom-6 lg:right-6 lg:h-[min(720px,calc(100svh-48px))] lg:w-[420px] lg:overflow-hidden lg:rounded-[18px] lg:border lg:border-[var(--h-hairline)] lg:shadow-[0_24px_80px_-12px_rgb(0_0_0/0.8)]"
        >
          <header className="flex items-start gap-1 border-b border-[var(--h-hairline)] px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] lg:pt-3">
            <div className="min-w-0 flex-1 pr-2">
              <h2 className="text-[16px] font-medium text-[var(--h-text)]">{t('patient.assistant.title')}</h2>
              <p className="mt-0.5 text-[12px] leading-[17px] text-[var(--h-muted)]">{t('patient.assistant.disclaimer')}</p>
            </div>
            <IconButton label={t('patient.assistant.newChat')} onClick={reset} disabled={sending || messages.length === 0} className="disabled:opacity-40">
              {Icon.plus}
            </IconButton>
            <IconButton label={t('patient.assistant.close')} onClick={() => setOpen(false)}>
              {icons.close}
            </IconButton>
          </header>

          <div ref={log} role="log" aria-label={t('patient.assistant.title')} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className={cx(bubble, 'rounded-bl-[6px] border border-[var(--h-hairline)] bg-white/[0.03] text-[var(--h-text-2)]')}>
                  {t('patient.assistant.welcome')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={suggestion} onClick={() => fileInput.current?.click()} disabled={uploading}>
                    {t('patient.assistant.suggestXray')}
                  </button>
                  <button
                    type="button"
                    className={suggestion}
                    onClick={() => {
                      setDraft(t('patient.assistant.termPrompt'));
                      input.current?.focus();
                    }}
                  >
                    {t('patient.assistant.suggestTerm')}
                  </button>
                </div>
              </div>
            )}

            {messages.map((m) => {
              if (m.role === 'notice') {
                return (
                  <p
                    key={m.id}
                    role={m.error ? 'alert' : undefined}
                    className={cx('mx-auto max-w-[90%] text-center text-[13px] leading-[19px]', m.error ? 'text-rose-300' : 'text-[var(--h-muted)]')}
                  >
                    {m.text}
                  </p>
                );
              }
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="ml-auto max-w-[85%] space-y-2">
                    <span className="sr-only">{t('patient.assistant.you')}:</span>
                    {m.upload && (
                      <figure className="overflow-hidden rounded-[12px] border border-[var(--h-hairline)] bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl(m.upload.preview)} alt={m.upload.name} className="max-h-48 w-full object-contain" />
                        <figcaption className="truncate px-3 py-1.5 text-[12px] text-[var(--h-muted)]">{m.upload.name}</figcaption>
                      </figure>
                    )}
                    <p className={cx(bubble, 'rounded-br-[6px] bg-white/[0.09]')}>{m.text}</p>
                  </div>
                );
              }
              const images = m.attachments.filter((a) => a.kind === 'image');
              const audios = m.attachments.filter((a) => a.kind === 'audio');
              return (
                <div key={m.id} className="max-w-[92%] space-y-2">
                  <span className="sr-only">{t('patient.assistant.assistant')}:</span>
                  <p className={cx(bubble, 'rounded-bl-[6px] border border-[var(--h-hairline)] bg-white/[0.03]')}>{m.text}</p>
                  {images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {images.map((a) => (
                        <figure key={a.url} className="overflow-hidden rounded-[12px] border border-[var(--h-hairline)] bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mediaUrl(a.url)}
                            alt={t('patient.assistant.imageAlt', { label: pathology(a.label) })}
                            className="aspect-square w-full object-contain"
                            loading="lazy"
                          />
                          <figcaption className="truncate px-2 py-1 text-[12px] text-[var(--h-muted)]">{pathology(a.label)}</figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                  {audios.map((a) => (
                    <div key={a.url} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 truncate text-[12px] text-[var(--h-muted)]">{languageName(a.language)}</span>
                      <audio controls preload="none" src={mediaUrl(a.url)} className="h-9 min-w-0 flex-1" />
                    </div>
                  ))}
                  {m.audio ? (
                    // Started by the patient's tap on Listen, so playing straight away is expected.
                    <audio controls autoPlay src={mediaUrl(m.audio)} className="h-9 w-full" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => listen(m.id, m.text, m.language)}
                      disabled={m.speaking}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-[var(--h-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--h-text)] disabled:opacity-60"
                    >
                      {icons.speaker}
                      {m.speaking ? t('patient.assistant.loadingAudio') : t('patient.assistant.listen')}
                    </button>
                  )}
                </div>
              );
            })}

            {sending && (
              <p role="status" className="flex items-center gap-2 text-[13px] text-[var(--h-muted)]">
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" style={{ animationDelay: `${i * 140}ms` }} />
                  ))}
                </span>
                {t('patient.assistant.thinking')}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="border-t border-[var(--h-hairline)] px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3"
          >
            {(attachment || uploading) && (
              <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-[var(--h-hairline)] bg-white/[0.04] py-1 pl-3 pr-1 text-[13px] text-[var(--h-text)]">
                {icons.clip}
                <span className="min-w-0 flex-1 truncate">
                  {attachment ? `${t('patient.assistant.attached')} · ${attachment.name}` : t('patient.assistant.uploading')}
                </span>
                {attachment && (
                  <IconButton label={t('patient.assistant.removeAttachment')} onClick={() => setAttachment(null)} className="h-8 w-8">
                    {icons.close}
                  </IconButton>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              <IconButton
                label={`${t('patient.assistant.attach')} (${t('patient.assistant.attachHint')})`}
                onClick={() => fileInput.current?.click()}
                disabled={uploading || sending}
                className="h-11 w-11 shrink-0 disabled:opacity-40"
              >
                {icons.clip}
              </IconButton>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
              <label htmlFor={inputId} className="sr-only">
                {t('patient.assistant.placeholder')}
              </label>
              <textarea
                id={inputId}
                ref={input}
                rows={1}
                value={draft}
                maxLength={MAX_MESSAGE}
                enterKeyHint="send"
                placeholder={t('patient.assistant.placeholder')}
                onChange={(e) => {
                  setDraft(e.target.value);
                  resizeInput();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-[12px] border border-[var(--h-border)] bg-[var(--h-surface-2)] px-3.5 py-2.5 text-[16px] leading-[22px] text-[var(--h-text)] outline-none transition-colors placeholder:text-[#5d6068] focus:border-white/40"
              />
              <Button type="submit" disabled={!canSend} aria-label={t('patient.assistant.send')} title={t('patient.assistant.send')} className="w-11 shrink-0 !px-0">
                {icons.send}
              </Button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
