import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Severity } from '../api';
import { SEVERITY } from '../format';

export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 12.5h3l1.8-4 3.4 8 1.8-4h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** One drawn mark per severity, so the level never rests on colour alone. */
export function SeverityIcon({ severity, size = 14 }: { severity: Severity; size?: number }) {
  const path: Record<Severity, React.ReactNode> = {
    NORMAL: <path d="m6.5 10.2 2.4 2.4 4.6-5.2" />,
    MODERATE: <path d="M6.5 10h7" />,
    HIGH: <path d="M10 6.2v4.6M10 13.6v.2" />,
    CRITICAL: <path d="M7.6 6.2v4.6M7.6 13.6v.2M12.4 6.2v4.6M12.4 13.6v.2" />,
  };
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="10" cy="10" r="7.6" strokeWidth="1.6" />
      {path[severity]}
    </svg>
  );
}

export function SeverityPill({ severity }: { severity: Severity | null }) {
  if (!severity) return null;
  const s = SEVERITY[severity];
  return (
    <span className="pill" style={{ color: s.color, background: s.bg }}>
      <SeverityIcon severity={severity} size={13} />
      {s.label}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: Severity | null }) {
  return <span className="dot" aria-hidden="true" style={{ background: severity ? SEVERITY[severity].color : '#55585f' }} />;
}

export function Modal({
  title,
  children,
  onClose,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  actions: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button, textarea, input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <h3 id="modal-title">{title}</h3>
        <div style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{children}</div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          {actions}
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    window.clearTimeout(timer.current);
    setMsg(m);
    timer.current = window.setTimeout(() => setMsg(null), 3000);
  }, []);
  const node = (
    <div aria-live="polite">
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
  return { show, node };
}

export function Icon({ name }: { name: 'plus' | 'search' | 'download' | 'trash' | 'logout' | 'refresh' | 'zoomIn' | 'zoomOut' | 'reset' | 'check' }) {
  const p: Record<string, React.ReactNode> = {
    plus: <path d="M10 4v12M4 10h12" />,
    search: (
      <>
        <circle cx="9" cy="9" r="5.2" />
        <path d="m13 13 3.5 3.5" />
      </>
    ),
    download: <path d="M10 3.5v9m0 0 3.5-3.5M10 12.5 6.5 9M4 15.5h12" />,
    trash: <path d="M4 6h12M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />,
    logout: <path d="M8 4H5v12h3M12 6.5 15.5 10 12 13.5M15.5 10H8" />,
    refresh: <path d="M15.5 9A5.5 5.5 0 1 0 14 13.5M15.5 4.5V9H11" />,
    zoomIn: (
      <>
        <circle cx="9" cy="9" r="5.2" />
        <path d="m13 13 3.5 3.5M9 6.8v4.4M6.8 9h4.4" />
      </>
    ),
    zoomOut: (
      <>
        <circle cx="9" cy="9" r="5.2" />
        <path d="m13 13 3.5 3.5M6.8 9h4.4" />
      </>
    ),
    reset: <path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" />,
    check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  };
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name]}
    </svg>
  );
}
