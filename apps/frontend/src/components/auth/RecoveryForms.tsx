'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth/SessionProvider';
import { AuthApiError, authApi } from '@/lib/auth/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Field, FormError, PasswordField, PasswordRules, SubmitButton, passwordOk } from './fields';

const linkClass = 'text-[var(--h-text)] underline-offset-4 hover:underline';

function Notice({ tone, children }: { tone: 'ok' | 'bad'; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'ok' ? 'status' : 'alert'}
      className={
        tone === 'ok'
          ? 'h-rise rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-[15px] leading-[22px] text-emerald-200'
          : 'h-rise rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-[15px] leading-[22px] text-rose-200'
      }
    >
      {children}
    </div>
  );
}

function useErrorText() {
  const { t } = useI18n();
  return (err: unknown) => (err instanceof AuthApiError ? (err.status === 0 ? t('common.offline') : err.message) : t('common.error'));
}

/** Step 1 of password recovery: ask for the e-mail and send a reset link. */
export function ForgotPasswordForm() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const address = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      setError(t('auth.errEmail'));
      return;
    }
    setError(null);
    setPending(true);
    try {
      await authApi.forgotPassword(address);
      setSentTo(address);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div>
        {/* The server answers the same way whether or not the address has an account. */}
        <Notice tone="ok">{t('authx.forgotSent', { email: sentTo })}</Notice>
        <p className="mt-6 text-[15px] text-[var(--h-muted)]">
          <Link href="/login" className={linkClass}>
            {t('authx.backToSignIn')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError message={error} />
      <Field
        label={t('auth.email')}
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('auth.emailPlaceholder')}
      />
      <div className="mt-8">
        <SubmitButton pending={pending}>{pending ? t('authx.sending') : t('authx.sendResetLink')}</SubmitButton>
      </div>
      <p className="mt-6 text-center text-[15px] text-[var(--h-muted)]">
        <Link href="/login" className={linkClass}>
          {t('authx.backToSignIn')}
        </Link>
      </p>
    </form>
  );
}

/** Step 2: the link from the e-mail lands here with ?token=... */
export function ResetPasswordForm() {
  const { t } = useI18n();
  const { setUser } = useSession();
  const errorText = useErrorText();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!passwordOk(password)) {
      setFieldError(t('auth.errPassword'));
      return;
    }
    setFieldError(undefined);
    setError(null);
    setPending(true);
    try {
      const { user } = await authApi.resetPassword(token, password);
      setUser(user); // the reset signs this device in
      router.replace(user.home);
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div>
        <Notice tone="bad">{t('authx.resetMissingToken')}</Notice>
        <p className="mt-6 text-[15px]">
          <Link href="/forgot-password" className={linkClass}>
            {t('authx.requestNewLink')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError message={error} />
      <PasswordField
        label={t('authx.newPassword')}
        name="new-password"
        autoComplete="new-password"
        required
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldError}
        hint={<PasswordRules password={password} />}
      />
      <p className="mt-5 text-[13px] leading-[19px] text-[var(--h-muted)]">{t('authx.resetNote')}</p>
      <div className="mt-8">
        <SubmitButton pending={pending}>{pending ? t('common.saving') : t('authx.setPassword')}</SubmitButton>
      </div>
      {error && (
        <p className="mt-6 text-center text-[15px]">
          <Link href="/forgot-password" className={linkClass}>
            {t('authx.requestNewLink')}
          </Link>
        </p>
      )}
    </form>
  );
}

/** Confirms the e-mail address from the link (?token=...). Works signed in or out. */
export function VerifyEmailPanel() {
  const { t } = useI18n();
  const { status, user, refresh } = useSession();
  const errorText = useErrorText();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  const [message, setMessage] = useState<string | null>(null);
  const [resend, setResend] = useState<'idle' | 'pending' | 'sent'>('idle');
  // The token is single-use: never confirm it twice (React re-runs effects in development).
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!token || attempted.current === token) return;
    attempted.current = token;
    authApi.confirmEmail(token).then(
      () => {
        setState('done');
        void refresh();
      },
      (err) => {
        setMessage(errorText(err));
        setState('failed');
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onResend() {
    setResend('pending');
    try {
      const res = await authApi.requestVerification();
      if (res.already_verified) {
        setState('done');
        void refresh();
      } else {
        setResend('sent');
      }
    } catch (err) {
      setMessage(errorText(err));
      setResend('idle');
    }
  }

  if (state === 'working') {
    return (
      <p role="status" aria-busy="true" className="flex items-center gap-3 text-[17px] text-[var(--h-muted)]">
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        {t('authx.verifyWorking')}
      </p>
    );
  }

  if (state === 'done') {
    return (
      <div>
        <Notice tone="ok">{t('authx.verifyDone')}</Notice>
        <p className="mt-6 text-[15px]">
          <Link href={status === 'authenticated' && user ? user.home : '/login'} className={linkClass}>
            {status === 'authenticated' ? t('authx.continue') : t('auth.signIn')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <Notice tone="bad">{message ?? t('authx.verifyMissingToken')}</Notice>
      <div className="mt-6 text-[15px] text-[var(--h-muted)]">
        {resend === 'sent' ? (
          <p role="status">{t('authx.verifyResent')}</p>
        ) : status === 'authenticated' && user && !user.email_verified ? (
          <button type="button" onClick={onResend} disabled={resend === 'pending'} className={`${linkClass} disabled:opacity-60`}>
            {resend === 'pending' ? t('authx.sending') : t('authx.verifyResend')}
          </button>
        ) : status === 'anonymous' ? (
          <p>
            {t('authx.verifySignInFirst')}{' '}
            <Link href="/login?next=/account" className={linkClass}>
              {t('auth.signIn')}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
