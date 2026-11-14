'use client';

import React from 'react';
import Link from 'next/link';
import { cx } from '@/components/marketing/ui';
import { useInView } from './hooks';

export { cx };

function Nudge({ children }: { children: React.ReactNode }) {
  return (
    <span className="h-nudge" aria-hidden="true">
      <span className="inline-flex">{children}</span>
    </span>
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cx('h-3.5 w-3.5', className)} aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type PillProps = {
  tone?: 'light' | 'ink';
  arrow?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function PillLink({ href, tone = 'light', arrow, className, children }: PillProps & { href: string }) {
  return (
    <Link href={href} className={cx('h-btn', tone === 'light' ? 'h-btn-light' : 'h-btn-ink', className)}>
      {children}
      {arrow && (
        <Nudge>
          <Arrow />
        </Nudge>
      )}
    </Link>
  );
}

export function PillButton({
  tone = 'light',
  arrow,
  className,
  children,
  ...rest
}: PillProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cx('h-btn', tone === 'light' ? 'h-btn-light' : 'h-btn-ink', className)} {...rest}>
      {children}
      {arrow && (
        <Nudge>
          <Arrow />
        </Nudge>
      )}
    </button>
  );
}

export function MonoLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx('h-label', className)}>{children}</p>;
}

/** "Lead. muted remainder" caption used under showcase tiles and cards. */
export function Caption({
  lead,
  children,
  className,
  muted = 'text-[var(--h-muted)]',
}: {
  lead: string;
  children: React.ReactNode;
  className?: string;
  muted?: string;
}) {
  return (
    <p className={cx('h-caption text-balance', className)}>
      <span>{lead}.</span> <span className={muted}>{children}</span>
    </p>
  );
}

/** Fades and lifts its children in once they scroll into view. */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  children,
}: {
  as?: 'div' | 'section' | 'li' | 'article';
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cx('h-reveal', inView && 'is-in', className)}
      style={{ '--h-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

export function Grain({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cx('absolute inset-0 overflow-hidden', className)}>
      <span className="h-grain" />
    </span>
  );
}
