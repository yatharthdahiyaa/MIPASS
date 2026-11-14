'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { careApi, type AppNotification } from '@/lib/care/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { cx } from '@/components/home/ui';

const BADGE_POLL_MS = 30_000;

export interface Badge {
  notifications: number;
  messages: number;
}

/** Polls the cheap unread-count endpoint while the tab is visible. Call once per shell. */
export function useBadge(enabled: boolean) {
  const [badge, setBadge] = useState<Badge>({ notifications: 0, messages: 0 });

  const refresh = useCallback(async () => {
    try {
      setBadge(await careApi.badge());
    } catch {
      // keep the last known counts; the next poll retries
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    tick();
    const id = window.setInterval(tick, BADGE_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, refresh]);

  return { badge, refresh };
}

function relTime(iso: string, intl: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(intl, { dateStyle: 'medium' }).format(new Date(iso));
}

/**
 * Bell button with an unread count and a panel listing recent notifications.
 * `placement` says where the panel opens: beside the desktop sidebar or under the mobile top bar.
 */
export default function NotificationBell({
  count,
  onChanged,
  placement,
  className,
}: {
  count: number;
  onChanged: () => void;
  placement: 'sidebar' | 'topbar';
  className?: string;
}) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setItems((await careApi.notifications({ limit: 30 })).notifications);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load();
  }

  async function openItem(n: AppNotification) {
    if (!n.read_at) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? prev);
      try {
        await careApi.markRead(n.id);
      } catch {
        // non-fatal: it stays unread on the server and shows again next time
      }
      onChanged();
    }
    // Only follow same-site paths that exist in this portal.
    if (n.link && n.link.startsWith('/') && !n.link.startsWith('//')) {
      setOpen(false);
      router.push(n.link);
    }
  }

  async function markAll() {
    try {
      await careApi.markAllRead();
      await load();
      onChanged();
    } catch {
      setFailed(true);
    }
  }

  return (
    <div ref={root} className={cx('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? t('notify.openCount', { n: count }) : t('notify.open')}
        title={t('notify.title')}
        className="relative grid h-[42px] w-[42px] place-items-center rounded-[11px] border border-[var(--h-hairline)] text-[var(--h-text-2)] transition-colors hover:bg-white/[0.07] hover:text-white"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="M5 8.2a5 5 0 0 1 10 0c0 3.3 1.3 4.6 1.8 5.3H3.2C3.7 12.8 5 11.5 5 8.2ZM8.2 16a1.9 1.9 0 0 0 3.6 0"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {count > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('notify.title')}
          className={cx(
            'h-rise z-50 flex max-h-[min(70svh,560px)] flex-col overflow-hidden rounded-2xl border border-[var(--h-border)] bg-[var(--h-surface-1)] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]',
            placement === 'sidebar' ? 'fixed bottom-5 left-[276px] w-[380px]' : 'fixed inset-x-3 top-[70px]',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--h-hairline)] px-4 py-3">
            <p className="text-[16px] font-medium text-[var(--h-text)]">{t('notify.title')}</p>
            {items?.some((n) => !n.read_at) && (
              <button type="button" onClick={markAll} className="rounded-lg px-2 py-1 text-[13px] text-[var(--h-muted)] hover:bg-white/[0.06] hover:text-white">
                {t('notify.markAll')}
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            {failed && <p role="alert" className="px-4 py-4 text-[14px] text-rose-300">{t('common.error')}</p>}
            {!failed && items === null && <p className="px-4 py-4 text-[14px] text-[var(--h-muted)]">{t('common.loading')}</p>}
            {!failed && items?.length === 0 && <p className="px-4 py-6 text-[15px] text-[var(--h-muted)]">{t('notify.empty')}</p>}
            <ul>
              {items?.map((n) => (
                <li key={n.id} className="border-b border-[var(--h-hairline)] last:border-b-0">
                  <button type="button" onClick={() => openItem(n)} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
                    <span
                      aria-hidden="true"
                      className={cx(
                        'mt-[7px] h-2 w-2 shrink-0 rounded-full',
                        n.read_at ? 'bg-transparent' : n.severity === 'critical' ? 'bg-rose-400' : n.severity === 'warning' ? 'bg-amber-300' : 'bg-sky-300',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cx('block text-[15px] leading-[21px]', n.read_at ? 'text-[var(--h-text-2)]' : 'font-medium text-[var(--h-text)]')}>
                        {!n.read_at && <span className="sr-only">{t('notify.unread')} </span>}
                        {n.title}
                      </span>
                      {n.body && <span className="mt-0.5 line-clamp-3 block text-[13px] leading-[19px] text-[var(--h-muted)]">{n.body}</span>}
                      <span className="mt-1 block text-[12px] text-[var(--h-muted)]">{relTime(n.created_at, intl)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
