'use client';

import React from 'react';
import Link from 'next/link';
import Orb from '@/components/home/Orb';
import { HomeLogoMark } from '@/components/home/HomeNav';
import { Grain } from '@/components/home/ui';
import { useI18n } from '@/lib/i18n/I18nProvider';
import LanguageSwitcher from '@/lib/i18n/LanguageSwitcher';

const PANEL_ORBS: Array<{ top: string; left: string; size: string; palette: [string, string, string]; blur?: boolean }> = [
  { top: '14%', left: '18%', size: '13%', palette: ['#ffd1f0', '#3fb4ff', '#6f7bff'] },
  { top: '9%', left: '58%', size: '9%', palette: ['#fffaf0', '#ffd78a', '#f2a65a'] },
  { top: '36%', left: '76%', size: '10%', palette: ['#ffb3a3', '#d44c3c', '#3a5b8c'], blur: true },
  { top: '62%', left: '12%', size: '9%', palette: ['#e8ff8a', '#38b6a0', '#2f3fbf'] },
  { top: '70%', left: '64%', size: '12%', palette: ['#c9ffd9', '#20b486', '#1b3f6b'] },
];

/**
 * Two-column auth layout in the homepage language: dark form column on the left,
 * an alloy panel with orbit orbs on the right (desktop only).
 */
export default function AuthShell({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: 'login' | 'signup';
  /** i18n keys overriding the default heading (used by verification and password-reset pages). */
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const login = mode === 'login';
  return (
    <div className="home-root min-h-[100svh]">
      <div className="grid min-h-[100svh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="MIPAAS home"
              className="flex h-[52px] items-center gap-2 rounded-2xl border border-white/[0.09] bg-[#161618]/[0.94] px-[17px] text-[var(--h-text)]"
            >
              <HomeLogoMark className="h-[18px] w-[18px]" />
              <span className="text-[19px] font-medium tracking-[-0.02em]">MIPAAS</span>
            </Link>
            <div className="flex items-center gap-3 text-[15px] text-[var(--h-muted)]">
              <LanguageSwitcher compact />
              <span className="hidden sm:inline">
                {login ? (
                  <>
                    {t('auth.newHere')}{' '}
                    <Link href="/signup" className="text-[var(--h-text)] underline-offset-4 hover:underline">
                      {t('auth.createAccount')}
                    </Link>
                  </>
                ) : (
                  <>
                    {t('auth.haveAccount')}{' '}
                    <Link href="/login" className="text-[var(--h-text)] underline-offset-4 hover:underline">
                      {t('auth.signIn')}
                    </Link>
                  </>
                )}
              </span>
            </div>
          </header>

          <main id="main-content" className="flex flex-1 items-center py-12">
            <div className="h-rise mx-auto w-full max-w-[440px]">
              <h1 className="h-display-l text-[clamp(34px,4vw,52px)] text-[var(--h-text)]">
                {title ? t(title) : login ? t('auth.loginTitle') : t('auth.signupTitle')}
              </h1>
              <p className="mt-4 text-[17px] leading-[25px] text-[var(--h-muted)]">
                {subtitle ? t(subtitle) : title ? null : login ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
              </p>
              <div className="mt-10">{children}</div>
            </div>
          </main>

          <footer className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--h-muted)]">
            <p>© {new Date().getFullYear()} MIPAAS</p>
            <p>{t('auth.footerNote')}</p>
          </footer>
        </div>

        <aside aria-hidden="true" className="relative hidden p-4 lg:block">
          <div className="h-alloy relative h-full overflow-hidden rounded-[20px]">
            <Grain />
            {PANEL_ORBS.map((o, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  top: o.top,
                  left: o.left,
                  width: o.size,
                  filter: o.blur ? 'blur(4px)' : undefined,
                  animation: `h-float ${13 + i * 2}s ease-in-out ${-i * 1.6}s infinite`,
                }}
              >
                <Orb palette={o.palette} />
              </div>
            ))}
            <div className="absolute inset-x-12 bottom-12">
              <p className="h-label text-[var(--h-ink-muted)]">{t('auth.shellLabel')}</p>
              <p className="h-display-l mt-3 max-w-[520px] text-[clamp(34px,3.2vw,52px)] text-[var(--h-ink)]">
                {t('auth.shellHeadline')}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
