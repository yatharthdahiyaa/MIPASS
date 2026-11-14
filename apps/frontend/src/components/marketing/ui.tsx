import React from 'react';
import Link from 'next/link';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('mx-auto w-full max-w-6xl px-5 sm:px-8', className)}>{children}</div>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'light';

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-white shadow-[0_1px_0_0_rgb(255_255_255/0.12)_inset,0_8px_24px_-8px_rgb(11_18_32/0.5)] hover:bg-ink-soft',
  secondary: 'bg-white text-ink ring-1 ring-line shadow-sm hover:bg-slate-50',
  ghost: 'text-ink hover:bg-slate-100',
  light: 'bg-white text-ink hover:bg-brand-50',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: 'md' | 'lg' = 'md') {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 cursor-pointer',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
    size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-sm',
    buttonStyles[variant],
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)}>
      {children}
    </Link>
  );
}

export function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className={cx(
        'font-mono text-xs font-medium uppercase tracking-[0.16em]',
        dark ? 'text-brand-300' : 'text-brand-600',
      )}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  dark,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'center' | 'left';
  dark?: boolean;
}) {
  return (
    <div className={cx('max-w-2xl space-y-4', align === 'center' && 'mx-auto text-center')}>
      <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
      <h2
        className={cx(
          'font-display text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-[44px] sm:leading-[1.08]',
          dark ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </h2>
      {description && (
        <p className={cx('text-base leading-relaxed text-pretty sm:text-lg', dark ? 'text-slate-400' : 'text-muted')}>
          {description}
        </p>
      )}
    </div>
  );
}

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-brand-400 to-brand-700 shadow-[0_6px_16px_-6px_rgb(12_135_123/0.7)]">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-white" fill="none" aria-hidden="true">
          <path d="M3 12h4l2.5-6 5 12 2.5-6h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cx('font-display text-[19px] font-semibold tracking-[-0.03em]', dark ? 'text-white' : 'text-ink')}>
        MIPAAS
      </span>
    </span>
  );
}
