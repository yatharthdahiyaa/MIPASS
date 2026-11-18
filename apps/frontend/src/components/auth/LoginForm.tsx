'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth/SessionProvider';
import { AuthApiError, authApi, phoneChannelName, safeNext, type PhoneChannel } from '@/lib/auth/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Field, FormError, PasswordField, SubmitButton } from './fields';

/** Sign in with a one-time code sent (by SMS or WhatsApp) to the patient's confirmed number. */
function PhoneLogin({
  channel,
  next,
  onBack,
  onMfa,
}: {
  channel: PhoneChannel;
  next: string | null;
  onBack: () => void;
  onMfa: (token: string) => void;
}) {
  const { signInWithPhone } = useSession();
  const { t } = useI18n();
  const tp = (key: string) => t(`phoneotp.${key}`, { channel: phoneChannelName(channel) });
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorText = (err: unknown) =>
    err instanceof AuthApiError ? (err.status === 0 ? t('common.offline') : err.message) : t('common.error');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await authApi.phoneLoginRequest(phone.trim());
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await signInWithPhone(phone.trim(), code.trim(), remember);
      if ('mfa_required' in res) {
        onMfa(res.mfa_token);
        return;
      }
      router.replace(safeNext(next, res.home));
    } catch (err) {
      setError(errorText(err));
      setCode('');
      setPending(false);
    }
  }

  return (
    <form onSubmit={sent ? submitCode : sendCode} noValidate>
      <FormError message={error} />
      <p className="mb-6 text-[15px] leading-[22px] text-[var(--h-muted)]">{tp('signInIntro')}</p>
      <div className="space-y-5">
        <Field
          label={tp('phoneLabel')}
          name="tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          autoFocus={!sent}
          disabled={sent}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98765 43210"
          hint={tp('phoneHint')}
        />
        {sent && (
          <Field
            label={tp('signInCode')}
            name="one-time-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            hint={tp('signInSent')}
          />
        )}
      </div>

      {sent && (
        <label className="mt-5 flex cursor-pointer items-center gap-3 text-[15px] text-[var(--h-text-2)]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-[18px] w-[18px] cursor-pointer rounded accent-[var(--h-text)]"
          />
          {t('auth.remember')}
        </label>
      )}

      <div className="mt-8">
        <SubmitButton pending={pending}>{sent ? tp('signInSubmit') : tp('sendSignInCode')}</SubmitButton>
      </div>
      <p className="mt-4 text-center text-[13px] text-[var(--h-muted)]">{tp('patientsOnly')}</p>
      <p className="mt-4 flex items-center justify-center gap-5 text-[15px]">
        {sent && (
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode('');
              setError(null);
            }}
            className="text-[var(--h-muted)] underline-offset-4 hover:text-[var(--h-text)] hover:underline"
          >
            {tp('changeNumber')}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--h-muted)] underline-offset-4 hover:text-[var(--h-text)] hover:underline"
        >
          {tp('backToPassword')}
        </button>
      </p>
    </form>
  );
}

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
  /** Channel for one-time codes when the server can send them (reported on the signed-out session lookup). */
  const [phoneLogin, setPhoneLogin] = useState<PhoneChannel | null>(null);
  const [viaPhone, setViaPhone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi.session().then(
      (s) => !cancelled && setPhoneLogin(s.phone_login ? (s.phone_channel ?? 'sms') : null),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (viaPhone && phoneLogin) {
    return (
      <PhoneLogin
        channel={phoneLogin}
        next={nextParam}
        onBack={() => setViaPhone(false)}
        onMfa={(token) => {
          setViaPhone(false);
          setMfaToken(token);
        }}
      />
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

      {phoneLogin && (
        <p className="mt-5 text-center text-[15px]">
          <button
            type="button"
            onClick={() => setViaPhone(true)}
            className="text-[var(--h-text-2)] underline-offset-4 hover:text-[var(--h-text)] hover:underline"
          >
            {t('phoneotp.signInLink')}
          </button>
        </p>
      )}

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
