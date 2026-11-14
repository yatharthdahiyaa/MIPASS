'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth/SessionProvider';
import HomeNav from '@/components/home/HomeNav';
import { MonoLabel, PillLink } from '@/components/home/ui';
import { useI18n } from '@/lib/i18n/I18nProvider';
import SecurityPanel from './SecurityPanel';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-[var(--h-hairline)] py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="text-[15px] text-[var(--h-muted)]">{label}</dt>
      <dd className="break-words text-[17px] text-[var(--h-text)]">{value}</dd>
    </div>
  );
}

/** Account summary. Deliberately shows no roles, permissions or system internals. */
export default function AccountView() {
  const { status, user, signOut } = useSession();
  const { t, intl } = useI18n();
  const router = useRouter();
  const welcome = useSearchParams().get('welcome') === '1';
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (status === 'anonymous' && !signingOut) router.replace('/login?next=/account');
  }, [status, router, signingOut]);

  if (status !== 'authenticated' || !user) {
    return <div className="home-root min-h-[100svh]" aria-busy="true" />;
  }

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';
  const typeLabel =
    user.account_type === 'patient' ? t('account.typePatient') : user.account_type === 'doctor' ? t('account.typeDoctor') : t('account.typeStaff');

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace('/');
  }

  return (
    <div className="home-root h-ambient min-h-[100svh]">
      <HomeNav />
      <main id="main-content" className="h-container pb-24 pt-36">
        <div className="mx-auto max-w-[880px]">
          {welcome && (
            <p role="status" className="h-rise mb-8 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-[15px] text-emerald-200">
              {t('account.welcome')}
            </p>
          )}
          <MonoLabel className="text-[var(--h-muted)]">{t('account.label')}</MonoLabel>
          <h1 className="h-display-l mt-3 break-words text-[var(--h-text)]">{user.name}</h1>

          {user.verification_pending && (
            <div className="mt-8 rounded-xl border border-sky-300/20 bg-sky-300/[0.07] px-5 py-4">
              <p className="text-[17px] font-medium text-[var(--h-text)]">{t('account.pendingTitle')}</p>
              <p className="mt-1 text-[15px] leading-[22px] text-[var(--h-muted)]">{t('account.pendingBody', { email: user.email })}</p>
            </div>
          )}

          <dl className="mt-10">
            <Row label={t('account.accountType')} value={typeLabel} />
            <Row label={t('account.email')} value={user.email} />
            <Row label={t('account.username')} value={<span className="font-mono text-[15px]">{user.username}</span>} />
            {user.organization && user.account_type !== 'patient' && <Row label={t('account.organisation')} value={user.organization} />}
            <Row
              label={t('security.emailStatus')}
              value={
                user.email_verified ? (
                  <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[14px] text-emerald-300">{t('security.emailConfirmed')}</span>
                ) : (
                  <span className="rounded-full bg-amber-300/10 px-2.5 py-0.5 text-[14px] text-amber-200">{t('security.emailUnconfirmed')}</span>
                )
              }
            />
            <Row label={t('account.lastSignIn')} value={fmt(user.last_login_at)} />
            <Row label={t('account.memberSince')} value={fmt(user.created_at)} />
          </dl>

          <div className="mt-10 flex flex-wrap gap-3">
            {user.home === '/patient' && (
              <PillLink href="/patient" arrow>
                {t('account.openRecord')}
              </PillLink>
            )}
            {user.home === '/doctor' && (
              <PillLink href="/doctor" arrow>
                {t('account.openWorkstation')}
              </PillLink>
            )}
            {(user.permissions.includes('users:manage') || user.permissions.includes('audit:read')) && (
              <PillLink href="/admin" arrow>
                {t('authx.openAdmin')}
              </PillLink>
            )}
            <Link href="/#platform" className="h-btn border border-[var(--h-border)] text-[var(--h-text)] hover:bg-white/[0.06]">
              {t('account.explore')}
            </Link>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="h-btn border border-[var(--h-border)] text-[var(--h-text)] hover:bg-white/[0.06] disabled:opacity-60"
            >
              {signingOut ? t('common.signingOut') : t('common.signOut')}
            </button>
          </div>

          <section aria-labelledby="account-security" className="mt-16">
            <h2 id="account-security" className="mb-6 text-[26px] font-medium tracking-[-0.02em] text-[var(--h-text)]">
              {t('security.heading')}
            </h2>
            <SecurityPanel />
          </section>
        </div>
      </main>
    </div>
  );
}
