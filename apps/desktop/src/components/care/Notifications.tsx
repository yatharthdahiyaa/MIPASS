import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type AppNotification } from '../../api';
import { fmtWhen } from '../../format';
import { targetForLink, type OnError, type Target } from './common';

const DOT: Record<AppNotification['severity'], string> = { info: '#7dd3fc', warning: '#fab219', critical: '#ff6b6b' };

/** Bell in the top bar with the doctor's recent notifications. */
export default function Notifications({
  count,
  onError,
  onChanged,
  onNavigate,
}: {
  count: number;
  onError: OnError;
  /** Called when the unread count may have changed. */
  onChanged: () => void;
  onNavigate: (target: Target) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api.notifications()).notifications);
      setError(null);
    } catch (err) {
      setError(onError(err) || null);
    }
  }, [onError]);

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

  async function openItem(n: AppNotification) {
    if (!n.read_at) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? prev);
      await api.markNotificationsRead(n.id).catch(() => undefined);
      onChanged();
    }
    let target = targetForLink(n.link);
    // A new connection request has no id in its link: open the Requests tab.
    if (target?.section === 'patients' && !target.linkId && n.kind === 'care.invite') target = { ...target, filter: 'pending' };
    if (target) {
      setOpen(false);
      onNavigate(target);
    }
  }

  async function markAll() {
    try {
      await api.markNotificationsRead();
      await load();
      onChanged();
    } catch (err) {
      setError(onError(err) || null);
    }
  }

  return (
    <div className="popover-anchor" ref={root}>
      <button
        className="btn btn-quiet btn-sm icon-btn"
        style={{ position: 'relative' }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        title="Notifications"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
      >
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 8.2a5 5 0 0 1 10 0c0 3.3 1.3 4.6 1.8 5.3H3.2C3.7 12.8 5 11.5 5 8.2ZM8.2 16a1.9 1.9 0 0 0 3.6 0" />
        </svg>
        {count > 0 && (
          <span className="badge badge-alert" style={{ position: 'absolute', top: -4, right: -6 }} aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <span>Notifications</span>
            {items?.some((n) => !n.read_at) && (
              <button className="btn btn-quiet btn-sm" onClick={() => void markAll()}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="popover-list">
            {error && (
              <div className="alert alert-error" style={{ margin: 12 }} role="alert">
                {error}
              </div>
            )}
            {!error && items == null && <p className="empty">Loading…</p>}
            {!error && items?.length === 0 && <p className="empty">Nothing new. Patient alerts, messages and requests appear here.</p>}
            {items?.map((n) => (
              <button key={n.id} className="note-item" onClick={() => void openItem(n)}>
                <span className="dot" style={{ background: n.read_at ? 'transparent' : DOT[n.severity] }} aria-hidden="true" />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: n.read_at ? 400 : 600, lineHeight: 1.4 }}>
                    {!n.read_at && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </span>
                  {n.body && <span className="note-body">{n.body}</span>}
                  <span className="muted" style={{ display: 'block', fontSize: 11.5, marginTop: 3 }}>
                    {fmtWhen(n.created_at)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
