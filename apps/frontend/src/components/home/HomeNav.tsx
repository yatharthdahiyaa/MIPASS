'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth/SessionProvider';
import { useScrolled } from './hooks';
import { Arrow, cx } from './ui';
import Orb from './Orb';
import { useI18n } from '@/lib/i18n/I18nProvider';
import LanguageSwitcher from '@/lib/i18n/LanguageSwitcher';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

const glass =
  'rounded-2xl border border-white/[0.09] bg-[#161618]/[0.94] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgb(0_0_0/0.6)]';

export function HomeLogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 12.5h3l1.8-4 3.4 8 1.8-4h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type MenuKey = 'services' | 'portals' | null;

function FeatureCard({ href, title, body, hue }: { href: string; title: string; body: string; hue: number }) {
  return (
    <Link
      href={href}
      className="group flex w-[220px] shrink-0 flex-col justify-between rounded-xl bg-[var(--h-surface-3)] p-4 transition-colors hover:bg-[#2a2a2c]"
    >
      <div className="relative h-24 overflow-hidden rounded-lg bg-[var(--h-surface-1)]">
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2">
          <Orb hue={hue} />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-[15px] font-medium text-[var(--h-text)]">{title}</p>
        <p className="mt-1 text-[13px] leading-[18px] text-[var(--h-muted)]">
          {body}
          <span className="ml-1 inline-flex translate-y-[1px] transition-transform group-hover:translate-x-0.5">
            <Arrow className="h-3 w-3" />
          </span>
        </p>
      </div>
    </Link>
  );
}

export default function HomeNav() {
  const { status, user } = useSession();
  const { t } = useI18n();
  // Signed-in users only see their own portal; visitors see both entry points.
  const portals =
    user?.home === '/patient'
      ? [{ label: t('nav.myHealth'), href: '/patient' }, { label: t('nav.account'), href: '/account' }]
      : user?.home === '/doctor'
        ? [{ label: t('nav.doctorWorkstation'), href: '/doctor' }, { label: t('nav.account'), href: '/account' }]
        : user
          ? [{ label: t('nav.account'), href: '/account' }]
          : [
              { label: t('nav.patientPortal'), href: '/patient' },
              { label: t('nav.doctorWorkstation'), href: '/doctor' },
            ];
  const services = [{ label: t('nav.chestXray'), href: '/chest-xray' }];
  const accountHref = user?.home ?? '/account';
  const scrolled = useScrolled(80);
  const [menu, setMenu] = useState<MenuKey>(null);
  const [sheet, setSheet] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
        setSheet(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = sheet ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [sheet]);

  const open = (key: MenuKey) => {
    window.clearTimeout(closeTimer.current);
    setMenu(key);
  };
  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setMenu(null), 140);
  };

  const trigger = (key: Exclude<MenuKey, null>, label: string) => (
    <button
      type="button"
      aria-expanded={menu === key}
      aria-haspopup="true"
      onClick={() => setMenu(menu === key ? null : key)}
      onMouseEnter={() => open(key)}
      onFocus={() => open(key)}
      className="flex h-[42px] items-center gap-1 rounded-[11px] px-[18px] text-[15px] font-medium text-[var(--h-text-2)] transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      {label}
      <svg viewBox="0 0 12 12" className={cx('h-2.5 w-2.5 transition-transform', menu === key && 'rotate-180')} aria-hidden="true">
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    </button>
  );

  const cta =
    status === 'authenticated' && user ? (
      <Link href={accountHref} className="h-btn h-btn-light h-[42px] gap-2.5 rounded-[11px] pl-[7px]">
        <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--h-ink)] text-[11px] font-semibold text-[var(--h-text)]">
          {initials(user.name)}
        </span>
        {user.home === '/patient' ? t('nav.myHealth') : t('nav.account')}
      </Link>
    ) : (
      <>
        <Link
          href="/login"
          className={cx(
            'hidden h-[42px] items-center rounded-[11px] px-4 text-[15px] font-medium text-[var(--h-text-2)] transition-colors hover:bg-white/[0.06] hover:text-white sm:flex',
            status === 'loading' && 'opacity-0',
          )}
        >
          {t('nav.signIn')}
        </Link>
        <Link href="/signup" className="h-btn h-btn-light h-[42px] rounded-[11px]">
          {t('nav.getStarted')}
        </Link>
      </>
    );

  return (
    <>
      <header className="fixed inset-x-0 top-5 z-50">
        <div className="h-container flex items-start justify-between gap-4">
          {/* logo block: wordmark collapses to the mark after scrolling */}
          <Link
            href="/"
            aria-label="MIPAAS home"
            className={cx(glass, 'flex h-[52px] items-center gap-2 px-[17px] text-[var(--h-text)] transition-all duration-500')}
          >
            <HomeLogoMark className="h-[18px] w-[18px] shrink-0" />
            <span
              className={cx(
                'overflow-hidden whitespace-nowrap text-[19px] font-medium tracking-[-0.02em] transition-all duration-500 ease-[var(--h-ease-out)]',
                scrolled ? 'max-w-0 opacity-0' : 'max-w-[120px] opacity-100',
              )}
            >
              MIPAAS
            </span>
          </Link>

          {/* centre link pill */}
          <nav
            ref={navRef}
            aria-label="Primary"
            onMouseLeave={scheduleClose}
            className={cx(
              'relative hidden transition-all duration-500 ease-[var(--h-ease-out)] lg:block',
              scrolled ? 'pointer-events-none -translate-y-2 opacity-0' : 'opacity-100',
            )}
          >
            <div className={cx(glass, 'flex h-[52px] items-center p-[5px]')}>
              {trigger('services', t('nav.services'))}
              <Link
                href="/#platform"
                onMouseEnter={() => setMenu(null)}
                className="flex h-[42px] items-center rounded-[11px] px-[18px] text-[15px] font-medium text-[var(--h-text-2)] transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {t('nav.platform')}
              </Link>
              <Link
                href="/#how-it-works"
                onMouseEnter={() => setMenu(null)}
                className="flex h-[42px] items-center rounded-[11px] px-[18px] text-[15px] font-medium text-[var(--h-text-2)] transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {t('nav.howItWorks')}
              </Link>
              {trigger('portals', t('nav.portals'))}
            </div>

            {menu && !scrolled && (
              <div
                onMouseEnter={() => open(menu)}
                className={cx(glass, 'h-rise absolute left-1/2 top-[60px] flex -translate-x-1/2 gap-2 p-2')}
              >
                {(
                  <>
                    <ul className="w-[240px] p-2">
                      {(menu === 'services' ? services : portals).map((p) => (
                        <li key={p.href}>
                          <Link
                            href={p.href}
                            onClick={() => setMenu(null)}
                            className="block rounded-lg px-3 py-2.5 text-[15px] text-[var(--h-text-2)] transition-colors hover:bg-white/[0.06] hover:text-white"
                          >
                            {p.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {menu === 'portals' && (
                      <FeatureCard href="/patient" title={t('nav.cardTitle')} body={t('nav.cardBody')} hue={150} />
                    )}
                  </>
                )}
              </div>
            )}
          </nav>

          {/* CTA block (+ burger on small screens) */}
          <div className={cx(glass, 'flex h-[52px] items-center gap-1 p-[5px]')}>
            <LanguageSwitcher compact className="hidden sm:inline-flex" />
            {cta}
            <button
              type="button"
              onClick={() => setSheet((v) => !v)}
              aria-label={sheet ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={sheet}
              className="grid h-[42px] w-[42px] place-items-center rounded-[11px] bg-white/[0.06] text-white lg:hidden"
            >
              <span className="relative block h-3 w-4">
                <i className={cx('absolute left-0 h-[1.5px] w-4 bg-current transition-all', sheet ? 'top-[5px] rotate-45' : 'top-0.5')} />
                <i className={cx('absolute left-0 h-[1.5px] w-4 bg-current transition-all', sheet ? 'top-[5px] -rotate-45' : 'top-[8.5px]')} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* mobile sheet */}
      {sheet && (
        <div className="h-rise fixed inset-0 z-40 overflow-y-auto bg-[var(--h-page)] pb-10 pt-28 lg:hidden" data-lenis-prevent>
          <div className="h-container">
            <nav className="flex flex-col" aria-label="Mobile">
              {[
                ...services,
                { label: t('nav.platform'), href: '/#platform' },
                { label: t('nav.howItWorks'), href: '/#how-it-works' },
                ...portals,
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setSheet(false)}
                  className="py-2 text-[32px] font-medium tracking-[-0.02em] text-[var(--h-text)]"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 grid gap-2 border-t border-[var(--h-hairline)] pt-6">
              <LanguageSwitcher className="mb-2 sm:hidden [&_select]:h-12 [&_select]:w-full" />
              {user ? (
                <Link href={accountHref} onClick={() => setSheet(false)} className="h-btn h-btn-light h-12">
                  {user.home === '/patient' ? t('nav.myHealth') : t('nav.account')}
                </Link>
              ) : (
                <>
                  <Link href="/signup" onClick={() => setSheet(false)} className="h-btn h-btn-light h-12">
                    {t('nav.getStarted')}
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setSheet(false)}
                    className="h-btn h-12 border border-[var(--h-border)] text-[var(--h-text)]"
                  >
                    {t('nav.signIn')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
