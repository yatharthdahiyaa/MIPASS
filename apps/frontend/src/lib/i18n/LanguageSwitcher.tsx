'use client';

import React, { useId } from 'react';
import { LOCALES, isLocale } from './config';
import { useI18n } from './I18nProvider';

/** Native <select> so it works with keyboards, screen readers and mobile pickers. */
export default function LanguageSwitcher({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const id = useId();
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t('common.language')}
      </label>
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--h-muted)]">
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.75 10h14.5M10 2.75c2 2.1 3 4.5 3 7.25s-1 5.15-3 7.25c-2-2.1-3-4.5-3-7.25s1-5.15 3-7.25Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <select
        id={id}
        value={locale}
        onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}
        className={`h-[42px] cursor-pointer appearance-none rounded-[11px] border border-white/[0.09] bg-white/[0.04] pl-9 pr-8 text-[14px] font-medium text-[var(--h-text-2)] outline-none transition-colors hover:bg-white/[0.08] focus-visible:border-white/40 ${compact ? 'w-[132px]' : ''}`}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} className="bg-[#1e1e20] text-white">
            {l.native}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 12 12" aria-hidden="true" className="pointer-events-none absolute right-3 h-2.5 w-2.5 text-[var(--h-muted)]">
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
