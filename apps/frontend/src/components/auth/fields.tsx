'use client';

import React, { useId, useState } from 'react';
import { cx } from '@/components/home/ui';
import { useI18n } from '@/lib/i18n/I18nProvider';

const inputClass =
  'h-field h-14 w-full rounded-xl border border-[var(--h-border)] bg-[var(--h-surface-2)] px-4 text-[17px] text-[var(--h-text)] ' +
  'placeholder:text-[#5d6068] outline-none transition-colors focus:border-white/40 focus:bg-[var(--h-surface-3)] ' +
  'aria-[invalid=true]:border-rose-400/70';

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  trailing?: React.ReactNode;
};

export function Field({ label, hint, error, trailing, className, ...props }: InputProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-medium text-[var(--h-text-2)]">
          {label}
        </label>
        {trailing}
      </div>
      <input id={id} aria-invalid={!!error} aria-describedby={describedBy} className={inputClass} {...props} />
      {hint && !error && (
        <div id={`${id}-hint`} className="mt-2 text-[13px] text-[var(--h-muted)]">
          {hint}
        </div>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-2 text-[13px] text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField(props: Omit<InputProps, 'type'>) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const id = useId();
  const describedBy = [props.hint ? `${id}-hint` : '', props.error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  const { label, hint, error, trailing, className, ...rest } = props;
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-medium text-[var(--h-text-2)]">
          {label}
        </label>
        {trailing}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cx(inputClass, 'pr-20')}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-lg px-3 font-mono text-[12px] uppercase tracking-[0.04em] text-[var(--h-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          {visible ? t('auth.hide') : t('auth.show')}
        </button>
      </div>
      {hint && !error && (
        <div id={`${id}-hint`} className="mt-2 text-[13px] text-[var(--h-muted)]">
          {hint}
        </div>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-2 text-[13px] text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

// Mirrors accounts.validate_password on the backend.
export const PASSWORD_RULES = [
  { key: 'auth.ruleLength', test: (p: string) => p.length >= 10 },
  { key: 'auth.ruleLetter', test: (p: string) => /[A-Za-z]/.test(p) },
  { key: 'auth.ruleNumber', test: (p: string) => /\d/.test(p) },
];

export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

/** Live checklist shown under a new-password field. */
export function PasswordRules({ password }: { password: string }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label={t('auth.rulesLabel')}>
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.key} className={cx('flex items-center gap-1.5 transition-colors', ok ? 'text-emerald-300' : '')}>
            <span aria-hidden="true">{ok ? '✓' : '○'}</span>
            {t(r.key)}
            <span className="sr-only">{ok ? t('auth.met') : t('auth.notMet')}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="h-rise mb-6 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-[15px] text-rose-200">
      {message}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="h-btn h-key h-12 w-full disabled:cursor-wait disabled:opacity-70">
      {pending && (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--h-ink)]/25 border-t-[var(--h-ink)]" />
      )}
      {children}
    </button>
  );
}
