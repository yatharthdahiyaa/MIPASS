'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlertIcon, DownloadIcon, LogOutIcon } from 'lucide-react';
import { useSession } from '@/lib/auth/SessionProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import LanguageSwitcher from '@/lib/i18n/LanguageSwitcher';
import { localISODate, patientApi, type PatientProfile } from '@/lib/patient/api';
import { AiConsent } from '@/components/auth/SecurityPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { ErrorBox, PageHeader, SelectInput, Skeleton, TextArea, TextInput, useErrorText, useFormat, useLoader, useToast } from '../ui';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SEXES = ['female', 'male', 'intersex', 'prefer_not'] as const;

type Draft = Record<
  'date_of_birth' | 'sex' | 'blood_group' | 'height_cm' | 'phone' | 'allergies' | 'conditions' | 'emergency_contact_name' | 'emergency_contact_phone',
  string
>;

function toDraft(p: PatientProfile): Draft {
  return {
    date_of_birth: p.date_of_birth ?? '',
    sex: p.sex ?? '',
    blood_group: p.blood_group ?? '',
    height_cm: p.height_cm != null ? String(p.height_cm) : '',
    phone: p.phone ?? '',
    allergies: p.allergies ?? '',
    conditions: p.conditions ?? '',
    emergency_contact_name: p.emergency_contact_name ?? '',
    emergency_contact_phone: p.emergency_contact_phone ?? '',
  };
}

function SideCard({ title, description, children, footer }: { title: string; description?: string; children?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}

export default function ProfileView() {
  const { t, locale } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const { user, signOut } = useSession();
  const { data, error, reload, setData } = useLoader(() => patientApi.profile(), []);
  // Unsaved edits; null means "show what the server has".
  const [edits, setEdits] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-[520px] rounded-xl" />;

  const draft: Draft = edits ?? toDraft(data.profile);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEdits({ ...draft, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      const res = await patientApi.saveProfile({
        date_of_birth: draft.date_of_birth || null,
        sex: draft.sex || null,
        blood_group: draft.blood_group || null,
        height_cm: draft.height_cm ? Number(draft.height_cm) : null,
        phone: draft.phone.trim() || null,
        allergies: draft.allergies.trim() || null,
        conditions: draft.conditions.trim() || null,
        emergency_contact_name: draft.emergency_contact_name.trim() || null,
        emergency_contact_phone: draft.emergency_contact_phone.trim() || null,
        preferred_language: locale,
      });
      setData(res);
      setEdits(null);
      toast.show(t('patient.profile.saved'));
    } catch (err) {
      setFormError(errText(err));
    } finally {
      setPending(false);
    }
  }

  const p = data.profile;
  const completeness = Math.round(p.completeness * 100);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('patient.profile.title')} subtitle={t('patient.profile.subtitle')} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardContent>
            <form onSubmit={save} noValidate>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    label={t('patient.profile.dob')}
                    hint={p.age != null ? t('patient.profile.age', { n: f.num(p.age) }) : undefined}
                    type="date"
                    max={localISODate()}
                    value={draft.date_of_birth}
                    onChange={set('date_of_birth')}
                  />
                  <SelectInput label={t('patient.profile.sex')} value={draft.sex} onChange={set('sex')}>
                    <option value="">{t('common.select')}</option>
                    {SEXES.map((s) => (
                      <option key={s} value={s}>
                        {t(`patient.profile.sexes.${s}`)}
                      </option>
                    ))}
                  </SelectInput>
                  <SelectInput label={t('patient.profile.bloodGroup')} value={draft.blood_group} onChange={set('blood_group')}>
                    <option value="">{t('common.select')}</option>
                    {BLOOD_GROUPS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </SelectInput>
                  <TextInput label={t('patient.profile.height')} type="number" inputMode="decimal" min={30} max={260} value={draft.height_cm} onChange={set('height_cm')} />
                  <TextInput label={t('patient.profile.phone')} type="tel" autoComplete="tel" value={draft.phone} maxLength={30} onChange={set('phone')} />
                </div>
                <TextArea label={t('patient.profile.allergies')} placeholder={t('patient.profile.allergiesPlaceholder')} maxLength={2000} value={draft.allergies} onChange={set('allergies')} />
                <TextArea label={t('patient.profile.conditions')} placeholder={t('patient.profile.conditionsPlaceholder')} maxLength={2000} value={draft.conditions} onChange={set('conditions')} />
                <FieldSet>
                  <FieldLegend variant="label" className="text-muted-foreground">
                    {t('patient.profile.emergency')}
                  </FieldLegend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextInput label={t('patient.profile.emergencyName')} value={draft.emergency_contact_name} maxLength={120} onChange={set('emergency_contact_name')} />
                    <TextInput label={t('patient.profile.emergencyPhone')} type="tel" value={draft.emergency_contact_phone} maxLength={30} onChange={set('emergency_contact_phone')} />
                  </div>
                </FieldSet>
                {formError && (
                  <Alert variant="destructive">
                    <CircleAlertIcon />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" disabled={pending} className="w-full sm:w-fit">
                  {pending && <Spinner data-icon="inline-start" />}
                  {pending ? t('common.saving') : t('common.save')}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <Progress value={completeness} aria-label={t('patient.profile.completeness', { n: f.num(completeness) })}>
                <span className="text-sm text-muted-foreground">{t('patient.profile.completeness', { n: f.num(completeness) })}</span>
              </Progress>
              {user && (
                <dl className="flex justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{t('account.email')}</dt>
                  <dd className="truncate">{user.email}</dd>
                </dl>
              )}
            </CardContent>
          </Card>

          <SideCard title={t('ai.title')}>
            <AiConsent />
          </SideCard>

          <SideCard title={t('common.language')}>
            <LanguageSwitcher className="w-full [&_select]:h-11 [&_select]:w-full" />
          </SideCard>

          <SideCard
            title={t('patient.profile.export')}
            description={t('patient.profile.exportBody')}
            footer={
              <Button variant="outline" nativeButton={false} render={<a href={patientApi.exportUrl()} />}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                {t('patient.profile.export')}
              </Button>
            }
          />

          <Button
            variant="ghost"
            className="w-full"
            onClick={async () => {
              await signOut();
              router.replace('/');
            }}
          >
            <LogOutIcon data-icon="inline-start" aria-hidden="true" />
            {t('common.signOut')}
          </Button>
        </div>
      </div>
    </div>
  );
}
