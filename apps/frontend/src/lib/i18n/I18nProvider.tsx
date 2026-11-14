'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, intlLocale, type Locale } from './config';
import { MESSAGES, type Messages } from './messages';

type Vars = Record<string, string | number>;

interface I18nValue {
  locale: Locale;
  /** BCP-47 tag for Intl formatters, e.g. "hi-IN". */
  intl: string;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: Vars) => string;
  m: Messages;
}

const I18nContext = createContext<I18nValue | null>(null);

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/**
 * Locale comes from the `mipaas_lang` cookie (read by the root layout), so the
 * first server render is already in the right language.
 */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      setLocaleState(next);
      router.refresh(); // re-render server components (metadata, <html lang>)
    },
    [router],
  );

  const value = useMemo<I18nValue>(() => {
    const dict = MESSAGES[locale];
    return {
      locale,
      intl: intlLocale(locale),
      setLocale,
      m: dict,
      t: (key, vars) => interpolate(lookup(dict, key) ?? lookup(MESSAGES.en, key) ?? key, vars),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
