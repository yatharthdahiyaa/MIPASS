'use client';

import React, { useMemo, useState } from 'react';
import { useSession } from '@/lib/auth/SessionProvider';
import { AuthApiError, authApi, phoneChannelName, type DeviceSession, type PhoneChannel } from '@/lib/auth/api';
import { agentsApi } from '@/lib/agents/api';
import { careApi, type NotificationPrefs } from '@/lib/care/api';
import { patientApi } from '@/lib/patient/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Button, Card, ErrorBox, Skeleton, TextInput, useLoader } from '@/components/patient/ui';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button as UIButton } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { qrMatrix, qrPath } from '@/lib/qr';
import { PasswordRules, passwordOk } from './fields';

function useErrorText() {
  const { t } = useI18n();
  return (err: unknown) => (err instanceof AuthApiError ? (err.status === 0 ? t('common.offline') : err.message) : t('common.error'));
}

function Problem({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" className="mb-4">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function Done({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert role="status" className="mb-4 border-success/30 bg-success/5">
      <CircleCheckIcon className="text-success" />
      <AlertDescription className="text-foreground">{message}</AlertDescription>
    </Alert>
  );
}

/* ------------------------------------------------------------ verification */

function EmailVerification() {
  const { t } = useI18n();
  const { user, refresh } = useSession();
  const errorText = useErrorText();
  const [state, setState] = useState<'idle' | 'pending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (!user || user.email_verified) return null;

  async function resend() {
    setState('pending');
    setError(null);
    try {
      const res = await authApi.requestVerification();
      if (res.already_verified) await refresh();
      setState('sent');
    } catch (err) {
      setError(errorText(err));
      setState('idle');
    }
  }

  return (
    <div className="rounded-control border border-amber-300/20 bg-amber-300/[0.07] px-5 py-4">
      <p className="text-[17px] font-medium text-[var(--h-text)]">{t('security.verifyTitle')}</p>
      <p className="mt-1 text-body text-[var(--h-muted)]">
        {state === 'sent' ? t('security.verifySent', { email: user.email }) : t('security.verifyBody', { email: user.email })}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-rose-300">
          {error}
        </p>
      )}
      {state !== 'sent' && (
        <Button tone="ghost" className="mt-3" pending={state === 'pending'} onClick={resend}>
          {t('security.verifyResend')}
        </Button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- MFA */

/** The setup link as a scannable code. Drawn locally: the secret never leaves the page. */
function SetupQr({ uri, label }: { uri: string; label: string }) {
  const code = useMemo(() => {
    const matrix = qrMatrix(uri);
    return matrix ? qrPath(matrix) : null;
  }, [uri]);
  if (!code) return null;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${code.size} ${code.size}`}
      shapeRendering="crispEdges"
      className="h-[184px] w-[184px] shrink-0 rounded-control bg-white"
    >
      <path d={code.d} fill="#000" />
    </svg>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-control border border-[var(--h-border)] bg-[var(--h-surface-2)] p-4">
      <p className="text-body font-medium text-[var(--h-text)]">{t('security.recoveryTitle')}</p>
      <p className="mt-1 text-[14px] leading-[20px] text-[var(--h-muted)]">{t('security.recoveryBody')}</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[15px] text-[var(--h-text)]">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <Button
        tone="ghost"
        className="mt-4"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(codes.join('\n'));
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? t('security.copied') : t('security.copy')}
      </Button>
    </div>
  );
}

export function TwoStep() {
  const { t, intl } = useI18n();
  const { refresh } = useSession();
  const errorText = useErrorText();
  const { data, error, reload } = useLoader(() => authApi.mfaStatus(), []);
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [mode, setMode] = useState<'idle' | 'disable' | 'codes'>('idle');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-24" />;

  async function run(action: () => Promise<void>) {
    setPending(true);
    setProblem(null);
    try {
      await action();
      setCode('');
      setPassword('');
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setPending(false);
    }
  }

  const begin = () => run(async () => setSetup(await authApi.mfaSetup()));
  const enable = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await authApi.mfaEnable(code.trim());
      setCodes(res.recovery_codes);
      setSetup(null);
      await Promise.all([reload(), refresh()]);
    });
  };
  const disable = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await authApi.mfaDisable(password, code.trim());
      setMode('idle');
      setCodes(null);
      await Promise.all([reload(), refresh()]);
    });
  };
  const regenerate = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await authApi.mfaRecoveryCodes(code.trim());
      setCodes(res.recovery_codes);
      setMode('idle');
      await reload();
    });
  };

  const codeInput = (
    <TextInput
      label={t('security.mfaCode')}
      value={code}
      onChange={(e) => setCode(e.target.value)}
      autoComplete="one-time-code"
      spellCheck={false}
      placeholder="123456"
      required
    />
  );

  return (
    <div>
      <Problem message={problem} />
      {codes && (
        <div className="mb-5">
          <RecoveryCodes codes={codes} />
        </div>
      )}

      {data.enabled ? (
        <>
          <p className="text-body text-[var(--h-text-2)]">
            <span className="mr-2 rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[13px] text-emerald-300">{t('security.mfaOn')}</span>
            {data.enabled_at && t('security.mfaSince', { date: new Intl.DateTimeFormat(intl, { dateStyle: 'medium' }).format(new Date(data.enabled_at)) })}
          </p>
          <p className="mt-2 text-[14px] text-[var(--h-muted)]">{t('security.recoveryLeft', { n: data.recovery_codes_left })}</p>

          {mode === 'idle' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button tone="ghost" onClick={() => setMode('codes')}>
                {t('security.recoveryNew')}
              </Button>
              <Button tone="danger" onClick={() => setMode('disable')}>
                {t('security.mfaTurnOff')}
              </Button>
            </div>
          )}
          {mode === 'codes' && (
            <form onSubmit={regenerate} className="mt-4 max-w-[360px] space-y-4">
              <p className="text-[14px] leading-[20px] text-[var(--h-muted)]">{t('security.recoveryNewBody')}</p>
              {codeInput}
              <div className="flex gap-2">
                <Button type="submit" pending={pending}>
                  {t('security.recoveryNew')}
                </Button>
                <Button tone="ghost" onClick={() => setMode('idle')}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          )}
          {mode === 'disable' && (
            <form onSubmit={disable} className="mt-4 max-w-[360px] space-y-4">
              <p className="text-[14px] leading-[20px] text-[var(--h-muted)]">{t('security.mfaTurnOffBody')}</p>
              <TextInput
                label={t('security.currentPassword')}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {codeInput}
              <div className="flex gap-2">
                <Button type="submit" pending={pending}>
                  {t('security.mfaTurnOff')}
                </Button>
                <Button tone="ghost" onClick={() => setMode('idle')}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          )}
        </>
      ) : setup ? (
        <form onSubmit={enable} className="space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <SetupQr uri={setup.otpauth_uri} label={t('security.mfaQrLabel')} />
            <ol className="min-w-0 max-w-[460px] list-decimal space-y-3 pl-5 text-body text-[var(--h-text-2)]">
              <li>
                {t('security.mfaStep1')}
                <span className="mt-3 block text-[13px] text-[var(--h-muted)]">{t('security.mfaManual')}</span>
                <span className="mt-1 block select-all break-all rounded-lg bg-[var(--h-surface-2)] px-3 py-2 font-mono text-[14px] tracking-[0.06em] text-[var(--h-text)]">
                  {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
                </span>
                <a href={setup.otpauth_uri} className="mt-2 inline-block text-[14px] text-[var(--h-text)] underline underline-offset-4">
                  {t('security.mfaOpenApp')}
                </a>
              </li>
              <li>{t('security.mfaStep2')}</li>
            </ol>
          </div>
          <div className="max-w-[320px]">{codeInput}</div>
          <div className="flex gap-2">
            <Button type="submit" pending={pending}>
              {t('security.mfaTurnOn')}
            </Button>
            <Button tone="ghost" onClick={() => setSetup(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="max-w-[560px] text-body text-[var(--h-muted)]">{t('security.mfaBody')}</p>
          <Button className="mt-4" pending={pending} onClick={begin}>
            {t('security.mfaSetUp')}
          </Button>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- password */

export function ChangePassword({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(null);
    if (!passwordOk(next)) {
      setProblem(t('auth.errPassword'));
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      await authApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setDone(t('security.passwordChanged'));
      onChanged();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-[420px] space-y-4">
      <Problem message={problem} />
      <Done message={done} />
      <TextInput
        label={t('security.currentPassword')}
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <div>
        <TextInput
          label={t('authx.newPassword')}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <div className="mt-2 text-meta text-muted-foreground">
          <PasswordRules password={next} />
        </div>
      </div>
      <Button type="submit" pending={pending}>
        {t('security.changePassword')}
      </Button>
    </form>
  );
}

/* ----------------------------------------------------------------- devices */

/** Short, honest label from a User-Agent string; falls back to the raw value. */
function deviceLabel(s: DeviceSession, desktopApp: string, unknown: string) {
  if (s.client === 'desktop') return desktopApp;
  const ua = s.user_agent ?? '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 60) || unknown;
}

export function Devices({ version }: { version: number }) {
  const { t, intl } = useI18n();
  const errorText = useErrorText();
  const { data, error, reload } = useLoader(() => authApi.sessions(), [version]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-24" />;

  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—');

  async function run(name: string, action: () => Promise<unknown>) {
    setBusy(name);
    setProblem(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <Problem message={problem} />
      <ul className="divide-y">
        {data.sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-body font-medium">
                {deviceLabel(s, t('security.desktopApp'), t('security.unknownDevice'))}
                {s.current && <Badge variant="success">{t('security.thisDevice')}</Badge>}
              </p>
              <p className="mt-0.5 text-meta text-muted-foreground">
                {t('security.lastActive', { when: fmt(s.last_seen_at ?? s.created_at) })}
                {s.ip_address ? ` · ${s.ip_address}` : ''}
              </p>
            </div>
            {!s.current && (
              <Button tone="danger" pending={busy === s.id} onClick={() => run(s.id, () => authApi.revokeSession(s.id))}>
                {t('common.signOut')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {data.sessions.some((s) => !s.current) && (
        <Button tone="ghost" className="mt-4" pending={busy === 'others'} onClick={() => run('others', () => authApi.revokeOtherSessions())}>
          {t('security.signOutOthers')}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ e-mail prefs */

export function EmailPreferences() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const { data, error, reload, setData } = useLoader(() => careApi.preferences(), []);
  const [problem, setProblem] = useState<string | null>(null);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-24" />;

  async function toggle(kind: string, email: boolean) {
    if (!data) return;
    const previous = data.preferences;
    const next: NotificationPrefs = { ...previous, [kind]: { email } };
    setData({ ...data, preferences: next });
    setProblem(null);
    try {
      const saved = await careApi.savePreferences({ [kind]: { email } });
      setData({ ...data, preferences: saved.preferences });
    } catch (err) {
      setData({ ...data, preferences: previous });
      setProblem(errorText(err));
    }
  }

  return (
    <div>
      <Problem message={problem} />
      <p className="mb-2 max-w-[62ch] text-body text-pretty text-muted-foreground">{t('security.prefsBody')}</p>
      <ul className="grid gap-x-10 sm:grid-cols-2">
        {data.kinds.map((kind) => (
          <li key={kind} className="border-b last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-2 text-body">
              <span>{t(`notify.kind.${kind.replace('.', '_')}`)}</span>
              <Switch checked={data.preferences[kind]?.email ?? false} onCheckedChange={(checked) => toggle(kind, checked)} />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ phone number */

/** Translates the phone-number strings with the delivery channel (SMS or WhatsApp) filled in. */
function usePhoneText(channel: PhoneChannel | undefined) {
  const { t } = useI18n();
  const name = phoneChannelName(channel);
  return (key: string, params: Record<string, string | number> = {}) => t(`phoneotp.${key}`, { channel: name, ...params });
}

/** Confirm the account's phone number with a one-time code, then choose which updates arrive there. */
export function PhoneVerification() {
  const { setUser } = useSession();
  const errorText = useErrorText();
  const status = useLoader(() => authApi.phoneStatus(), []);
  const tp = usePhoneText(status.data?.channel);
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState<'save' | 'send' | 'confirm' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (status.error && !status.data) return <ErrorBox error={status.error} onRetry={status.reload} />;
  if (!status.data) return <Skeleton className="h-24" />;
  const data = status.data;
  const saved = data.phone ?? '';
  const value = phone ?? saved;
  const verified = data.verified && value === saved;

  async function run(kind: 'save' | 'send' | 'confirm', fn: () => Promise<void>) {
    setPending(kind);
    setProblem(null);
    try {
      await fn();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setPending(null);
    }
  }

  const save = () =>
    run('save', async () => {
      const res = await authApi.updateProfile({ phone: value.trim() });
      setUser(res.user);
      setPhone(null);
      setSentTo(null);
      status.reload();
    });
  const send = () =>
    run('send', async () => {
      const res = await authApi.phoneVerifyRequest();
      setSentTo(res.phone);
      setCode('');
    });
  const confirm = () =>
    run('confirm', async () => {
      const res = await authApi.phoneVerifyConfirm(code.trim());
      setUser(res.user);
      setSentTo(null);
      setCode('');
      status.reload();
    });

  if (!data.available && !data.verified) {
    // The server has no phone-message provider configured: nothing to offer.
    return null;
  }

  return (
    <div className="space-y-4">
      <Problem message={problem} />
      <p className="max-w-[62ch] text-body text-pretty text-muted-foreground">{tp('body')}</p>

      {verified && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success">{tp('verified')}</Badge>
          <span className="text-body">{tp('verifiedBody', { phone: saved })}</span>
        </div>
      )}

      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <TextInput
          label={tp('phoneLabel')}
          hint={tp('phoneHint')}
          type="tel"
          autoComplete="tel"
          maxLength={30}
          placeholder="+91 98765 43210"
          value={value}
          onChange={(e) => setPhone(e.target.value)}
        />
        {value.trim() !== saved ? (
          <Button pending={pending === 'save'} disabled={!value.trim()} onClick={save}>
            {tp('savePhone')}
          </Button>
        ) : (
          !verified && (
            <Button pending={pending === 'send'} disabled={!saved} onClick={send}>
              {sentTo ? tp('resendCode') : tp('sendCode')}
            </Button>
          )
        )}
      </div>

      {sentTo && !verified && (
        <form
          className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <TextInput
            label={tp('codeLabel')}
            hint={tp('codeSent', { phone: sentTo })}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" pending={pending === 'confirm'} disabled={code.trim().length < 4}>
            {pending === 'confirm' ? tp('confirming') : tp('confirm')}
          </Button>
        </form>
      )}
    </div>
  );
}

/** Which updates also go to the phone (only once a number is confirmed). */
export function PhoneUpdatePreferences({ channel }: { channel: PhoneChannel }) {
  const { t } = useI18n();
  const tp = usePhoneText(channel);
  const errorText = useErrorText();
  const { data, error, reload, setData } = useLoader(() => careApi.preferences(), []);
  const [problem, setProblem] = useState<string | null>(null);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-24" />;

  async function toggle(kind: string, phone: boolean) {
    if (!data) return;
    const previous = data.preferences;
    setData({ ...data, preferences: { ...previous, [kind]: { ...previous[kind], phone } } });
    setProblem(null);
    try {
      const saved = await careApi.savePreferences({ [kind]: { email: previous[kind]?.email ?? false, phone } });
      setData({ ...data, preferences: saved.preferences });
    } catch (err) {
      setData({ ...data, preferences: previous });
      setProblem(errorText(err));
    }
  }

  return (
    <div>
      <Problem message={problem} />
      <p className="mb-2 max-w-[62ch] text-body text-pretty text-muted-foreground">{tp('updatesBody')}</p>
      <ul className="grid gap-x-10 sm:grid-cols-2">
        {data.kinds.map((kind) => (
          <li key={kind} className="border-b last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-2 text-body">
              <span>{t(`notify.kind.${kind.replace('.', '_')}`)}</span>
              <Switch checked={data.preferences[kind]?.phone ?? false} onCheckedChange={(checked) => toggle(kind, checked)} />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ AI assistance */

/** The patient's decision on whether an outside AI model may see the parts of their record a task needs. */
export function AiConsent() {
  const { t, intl } = useI18n();
  const errorText = useErrorText();
  const { data, error, reload, setData } = useLoader(() => agentsApi.consent(), []);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-24" />;

  async function set(allow: boolean) {
    setPending(true);
    setProblem(null);
    setDone(null);
    try {
      setData(await agentsApi.setConsent(allow));
      setDone(allow ? t('ai.toastOn') : t('ai.toastOff'));
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-3 text-body">
      <Problem message={problem} />
      <Done message={done} />
      <p className="text-foreground/90">{t('ai.body')}</p>
      <p className="text-muted-foreground">{t('ai.who', { provider: data.provider_notice })}</p>
      <p className="text-muted-foreground">{t('ai.off')}</p>
      {data.consented ? (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{t('security.mfaOn')}</Badge>
            {data.consented_at && t('ai.on', { date: new Intl.DateTimeFormat(intl, { dateStyle: 'medium' }).format(new Date(data.consented_at)) })}
          </p>
          <Button tone="ghost" pending={pending} onClick={() => set(false)}>
            {t('ai.turnOff')}
          </Button>
        </>
      ) : (
        <Button pending={pending} onClick={() => set(true)}>
          {t('ai.turnOn')}
        </Button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- your data */

/** Download and erasure, for patient accounts. */
export function YourData() {
  const { t } = useI18n();
  const { user } = useSession();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!user) return null;
  const confirmed = typed.trim().toLowerCase() === user.email.toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    setPending(true);
    setProblem(null);
    try {
      await authApi.deleteAccount(password, user?.mfa_enabled ? code.trim() : undefined);
      // A full navigation drops every piece of client state along with the session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/?account=deleted');
    } catch (err) {
      setProblem(errorText(err));
      setPending(false);
    }
  }

  return (
    <div>
      <p className="max-w-[62ch] text-body text-pretty text-muted-foreground">{t('security.dataBody')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <UIButton variant="outline" nativeButton={false} render={<a href={patientApi.exportUrl()} />}>
          {t('security.dataDownload')}
        </UIButton>
        {!open && (
          <Button tone="danger" onClick={() => setOpen(true)}>
            {t('security.deleteStart')}
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-6 max-w-[460px] space-y-4 rounded-control border border-destructive/30 bg-destructive/[0.06] p-5">
          <div>
            <p className="text-title font-semibold">{t('security.deleteTitle')}</p>
            <p className="mt-1 text-sm text-foreground/80">{t('security.deleteBody')}</p>
          </div>
          <Problem message={problem} />
          <TextInput
            label={t('security.currentPassword')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {user.mfa_enabled && (
            <TextInput label={t('security.mfaCode')} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          )}
          <TextInput
            label={t('security.deleteConfirmLabel', { email: user.email })}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              pending={pending}
              disabled={!confirmed || !password}
              className="!bg-rose-500 !text-white hover:!bg-rose-400"
            >
              {t('security.deleteConfirm')}
            </Button>
            <Button
              tone="ghost"
              onClick={() => {
                setOpen(false);
                setPassword('');
                setCode('');
                setTyped('');
                setProblem(null);
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- panel */

/** Security and notification settings shown on the account page. */
/** The phone card appears only when the server can send codes (or a number is already confirmed). */
export function PhoneCard({ section: Wrap = Card }: { section?: React.ComponentType<{ title: string; children: React.ReactNode }> }) {
  const { user } = useSession();
  const status = useLoader(() => authApi.phoneStatus(), []);
  const tp = usePhoneText(status.data?.channel);
  if (!status.data || (!status.data.available && !status.data.verified)) return null;
  return (
    <>
      <Wrap title={tp('title')}>
        <PhoneVerification />
      </Wrap>
      {user?.phone_verified && status.data.updates && (
        <Wrap title={tp('updatesTitle')}>
          <PhoneUpdatePreferences channel={status.data.channel} />
        </Wrap>
      )}
    </>
  );
}

export default function SecurityPanel() {
  const { t } = useI18n();
  const { user } = useSession();
  // Bumped after a password change, which signs other devices out server-side.
  const [sessionsVersion, setSessionsVersion] = useState(0);
  return (
    <div className="space-y-5">
      <EmailVerification />
      <Card title={t('security.mfaTitle')}>
        <TwoStep />
      </Card>
      <Card title={t('security.passwordTitle')}>
        <ChangePassword onChanged={() => setSessionsVersion((v) => v + 1)} />
      </Card>
      <Card title={t('security.devicesTitle')}>
        <Devices version={sessionsVersion} />
      </Card>
      <Card title={t('security.prefsTitle')}>
        <EmailPreferences />
      </Card>
      <PhoneCard />
      {user?.account_type === 'patient' && (
        <Card title={t('ai.title')}>
          <AiConsent />
        </Card>
      )}
      {user?.account_type === 'patient' && (
        <Card title={t('security.dataTitle')}>
          <YourData />
        </Card>
      )}
    </div>
  );
}
