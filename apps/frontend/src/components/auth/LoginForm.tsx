'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth/SessionProvider';
import { AuthApiError, safeNext } from '@/lib/auth/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Field, FormError, PasswordField, SubmitButton } from './fields';

export default function LoginForm() {
  const { status, user, signIn, completeMfa } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get('next');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the password is accepted on an account with two-step verification. */
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // Already signed in: go straight to this account's home (or the requested page).
  useEffect(() => {
    if (status === 'authenticated' && user && !pending) router.replace(safeNext(nextParam, user.home));
  }, [status, user, nextParam, router, pending]);

  const errorText = (err: unknown) =>
    err instanceof AuthApiError ? (err.status === 0 ? t('common.offline') : err.message) : t('common.error');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await signIn(identifier.trim(), password, remember);
      if ('mfa_required' in res) {
        setMfaToken(res.mfa_token);
        setPassword('');
        setPending(false);
        return;
      }
      router.replace(safeNext(nextParam, res.home));
    } catch (err) {
      setError(errorText(err));
      setPassword('');
      setPending(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !mfaToken) return;
    setError(null);
    setPending(true);
    try {
      const u = await completeMfa(mfaToken, code.trim());
      router.replace(safeNext(nextParam, u.home));
    } catch (err) {
      setError(errorText(err));
      setCode('');
      setPending(false);
      // The challenge is single-use and short-lived; once it's gone, start over.
      if (err instanceof AuthApiError && err.type === 'challenge_expired') setMfaToken(null);
    }
  }

  if (mfaToken) {
    return (
      <form onSubmit={onSubmitCode} noValidate>
        <FormError message={error} />
        <p className="mb-6 text-[15px] leading-[22px] text-[var(--h-muted)]">{t('authx.mfaIntro')}</p>
        <Field
          label={t('authx.mfaCode')}
          name="one-time-code"
          type="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          hint={t('authx.mfaHint')}
        />
        <div className="mt-8">
          <SubmitButton pending={pending}>{pending ? t('authx.verifying') : t('authx.verify')}</SubmitButton>
        </div>
        <p className="mt-6 text-center text-[15px]">
          <button
            type="button"
            onClick={() => {
              setMfaToken(null);
              setCode('');
              setError(null);
            }}
            className="text-[var(--h-muted)] underline-offset-4 hover:text-[var(--h-text)] hover:underline"
          >
            {t('authx.mfaBack')}
          </button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError message={error} />
      <div className="space-y-5">
        <Field
          label={t('auth.identifier')}
          name="username"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={t('auth.emailPlaceholder')}
        />
        <PasswordField
          label={t('auth.password')}
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <Link href="/forgot-password" className="text-[13px] text-[var(--h-muted)] underline-offset-4 hover:text-[var(--h-text)] hover:underline">
              {t('authx.forgotLink')}
            </Link>
          }
        />
      </div>

      <label className="mt-5 flex cursor-pointer items-center gap-3 text-[15px] text-[var(--h-text-2)]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-[18px] w-[18px] cursor-pointer rounded accent-[var(--h-text)]"
        />
        {t('auth.remember')}
      </label>

      <div className="mt-8">
        <SubmitButton pending={pending}>{pending ? t('auth.signingIn') : t('auth.signIn')}</SubmitButton>
      </div>

      <p className="mt-6 text-center text-[15px] text-[var(--h-muted)]">
        {t('auth.newToMipaas')}{' '}
        <Link
          href={`/signup${nextParam ? `?next=${encodeURIComponent(safeNext(nextParam))}` : ''}`}
          className="text-[var(--h-text)] underline-offset-4 hover:underline"
        >
          {t('auth.createAccount')}
        </Link>
      </p>
    </form>
  );
}
