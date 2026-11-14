'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth/SessionProvider';
import { AuthApiError, safeNext } from '@/lib/auth/api';
import { cx } from '@/components/home/ui';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Field, FormError, PasswordField, PasswordRules, SubmitButton, passwordOk } from './fields';

type AccountType = 'patient' | 'doctor';
type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'license' | 'specialty', string>>;

function TypeOption({
  active,
  title,
  hint,
  icon,
  onSelect,
}: {
  active: boolean;
  title: string;
  hint: string;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cx(
        'flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors',
        active
          ? 'border-white/60 bg-white/[0.07] text-[var(--h-text)]'
          : 'border-[var(--h-border)] bg-[var(--h-surface-2)] text-[var(--h-text-2)] hover:border-white/25',
      )}
    >
      <span className="flex w-full items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06]">{icon}</span>
        <span
          aria-hidden="true"
          className={cx('h-4 w-4 rounded-full border-2', active ? 'border-white bg-white shadow-[inset_0_0_0_3px_#1e1e20]' : 'border-white/30')}
        />
      </span>
      <span>
        <span className="block text-[16px] font-medium">{title}</span>
        <span className="mt-1 block text-[13px] leading-[18px] text-[var(--h-muted)]">{hint}</span>
      </span>
    </button>
  );
}

export default function SignupForm() {
  const { status, user, signUp } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get('next');

  const [type, setType] = useState<AccountType>(params.get('as') === 'doctor' ? 'doctor' : 'patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [license, setLicense] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (status === 'authenticated' && user && !pending) router.replace(safeNext(nextParam, user.home));
  }, [status, user, nextParam, router, pending]);

  function validate() {
    const errs: FieldErrors = {};
    if (name.trim().length < 2) errs.name = t('auth.errName');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = t('auth.errEmail');
    if (!passwordOk(password)) errs.password = t('auth.errPassword');
    if (type === 'doctor') {
      if (license.trim().length < 3) errs.license = t('auth.errLicense');
      if (specialty.trim().length < 2) errs.specialty = t('auth.errSpecialty');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !validate()) return;
    setError(null);
    setPending(true);
    try {
      const u = await signUp({
        account_type: type,
        name: name.trim(),
        email: email.trim(),
        password,
        organization: organization.trim() || undefined,
        license_number: type === 'doctor' ? license.trim() : undefined,
        specialty: type === 'doctor' ? specialty.trim() : undefined,
      });
      const home = u.home === '/account' ? '/account?welcome=1' : u.home;
      router.replace(safeNext(nextParam, home));
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 409) setFieldErrors({ email: err.message });
      else setError(err instanceof AuthApiError ? (err.status === 0 ? t('common.offline') : err.message) : t('common.error'));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError message={error} />

      <fieldset>
        <legend className="mb-2 text-[15px] font-medium text-[var(--h-text-2)]">{t('auth.iAm')}</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-3">
          <TypeOption
            active={type === 'patient'}
            onSelect={() => setType('patient')}
            title={t('auth.patient')}
            hint={t('auth.patientHint')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            }
          />
          <TypeOption
            active={type === 'doctor'}
            onSelect={() => setType('doctor')}
            title={t('auth.doctor')}
            hint={t('auth.doctorHint')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="20" cy="11" r="2" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            }
          />
        </div>
      </fieldset>

      <div className="mt-6 space-y-5">
        <Field
          label={t('auth.fullName')}
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          placeholder={type === 'doctor' ? t('auth.namePlaceholderDoctor') : t('auth.namePlaceholderPatient')}
        />
        <Field
          label={t('auth.email')}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder={t('auth.emailPlaceholder')}
        />

        {type === 'doctor' && (
          <div className="h-rise space-y-5">
            <Field
              label={t('auth.license')}
              name="license_number"
              autoComplete="off"
              required
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              error={fieldErrors.license}
              hint={t('auth.licenseHint')}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t('auth.specialty')}
                name="specialty"
                required
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                error={fieldErrors.specialty}
                placeholder={t('auth.specialtyPlaceholder')}
              />
              <Field
                label={t('auth.organisation')}
                trailing={<span className="text-[13px] text-[var(--h-muted)]">{t('common.optional')}</span>}
                name="organization"
                autoComplete="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </div>
          </div>
        )}

        <PasswordField
          label={t('auth.password')}
          name="new-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint={<PasswordRules password={password} />}
        />
      </div>

      <p className="mt-6 text-[13px] leading-[19px] text-[var(--h-muted)]">{t('auth.consent')}</p>

      <div className="mt-8">
        <SubmitButton pending={pending}>{pending ? t('auth.creating') : t('auth.create')}</SubmitButton>
      </div>

      <p className="mt-6 text-center text-[15px] text-[var(--h-muted)]">
        {t('auth.haveAccount')}{' '}
        <Link
          href={`/login${nextParam ? `?next=${encodeURIComponent(safeNext(nextParam))}` : ''}`}
          className="text-[var(--h-text)] underline-offset-4 hover:underline"
        >
          {t('auth.signIn')}
        </Link>
      </p>
    </form>
  );
}
