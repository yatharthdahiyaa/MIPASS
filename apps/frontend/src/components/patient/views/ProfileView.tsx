'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CircleAlertIcon, FileTextIcon, LogOutIcon } from 'lucide-react';
import { useSession } from '@/lib/auth/SessionProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import LanguageSwitcher from '@/lib/i18n/LanguageSwitcher';
import { localISODate, patientApi, type PatientProfile } from '@/lib/patient/api';
import { AiConsent, ChangePassword, Devices, EmailPreferences, PhoneCard, TwoStep, YourData } from '@/components/auth/SecurityPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorBox, PageHeader, SelectInput, Skeleton, TextArea, TextInput, useErrorText, useFormat, useLoader, useToast } from '../ui';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SEXES = ['female', 'male', 'intersex', 'prefer_not'] as const;
const TABS = ['details', 'alerts', 'security', 'data'] as const;
type Tab = (typeof TABS)[number];

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

/** A settings card: title, optional one-line description, body. */
function Section({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return (
    <FieldLegend variant="label" className="mb-3 text-sm font-medium text-muted-foreground">
      {children}
    </FieldLegend>
  );
}

function HealthDetails() {
  const { t, locale } = useI18n();
  const f = useFormat();
  const errText = useErrorText();
  const toast = useToast();
  const { user } = useSession();
  const { data, error, reload, setData } = useLoader(() => patientApi.profile(), []);
  // Unsaved edits; null means "show what the server has".
  const [edits, setEdits] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-[520px] rounded-surface" />;

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
  const completenessLabel = t('patient.profile.completeness', { n: f.num(completeness) });

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          <h2>{user?.name ?? t('ux.profileTabs.details')}</h2>
        </CardTitle>
        {user && <CardDescription className="truncate">{user.email}</CardDescription>}
        <CardAction className="flex w-36 flex-col items-end gap-1.5 self-center sm:w-48">
          <span className="text-meta text-muted-foreground tabular-nums">{completenessLabel}</span>
          <Progress value={completeness} aria-label={completenessLabel} className="w-full" />
        </CardAction>
      </CardHeader>
      <form onSubmit={save} noValidate className="contents">
        <CardContent className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
          <FieldSet>
            <Legend>{t('ux.summary.details')}</Legend>
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
              <TextInput className="sm:col-span-2" label={t('patient.profile.phone')} type="tel" autoComplete="tel" value={draft.phone} maxLength={30} onChange={set('phone')} />
            </div>
          </FieldSet>

          <div className="flex flex-col gap-4">
            <TextArea label={t('patient.profile.allergies')} placeholder={t('patient.profile.allergiesPlaceholder')} maxLength={2000} value={draft.allergies} onChange={set('allergies')} />
            <TextArea label={t('patient.profile.conditions')} placeholder={t('patient.profile.conditionsPlaceholder')} maxLength={2000} value={draft.conditions} onChange={set('conditions')} />
          </div>

          <FieldSet className="lg:col-span-2">
            <Legend>{t('patient.profile.emergency')}</Legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:max-w-[calc(50%-1.25rem)]">
              <TextInput label={t('patient.profile.emergencyName')} value={draft.emergency_contact_name} maxLength={120} onChange={set('emergency_contact_name')} />
              <TextInput label={t('patient.profile.emergencyPhone')} type="tel" value={draft.emergency_contact_phone} maxLength={30} onChange={set('emergency_contact_phone')} />
            </div>
          </FieldSet>
        </CardContent>
        <CardFooter className="flex-wrap justify-end gap-3 border-t">
          {formError && (
            <Alert variant="destructive" className="mr-auto w-auto flex-1 py-2">
              <CircleAlertIcon />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          {edits && (
            <Button type="button" variant="ghost" onClick={() => setEdits(null)}>
              {t('common.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={pending || !edits}>
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? t('common.saving') : t('common.save')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ProfileView() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { signOut } = useSession();
  const raw = params.get('tab');
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'details';
  const [sessionsVersion, setSessionsVersion] = useState(0);

  const go = useCallback((next: string) => router.replace(next === 'details' ? pathname : `${pathname}?tab=${next}`, { scroll: false }), [router, pathname]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('patient.profile.title')} subtitle={t('patient.profile.subtitle')} />
      <Tabs value={tab} onValueChange={go} className="gap-6">
        <TabsList aria-label={t('patient.profile.title')} className="max-w-full overflow-x-auto">
          {TABS.map((x) => (
            <TabsTrigger key={x} value={x}>
              {t(`ux.profileTabs.${x}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details">{tab === 'details' && <HealthDetails />}</TabsContent>

        <TabsContent value="alerts" className="grid items-start gap-5 lg:grid-cols-12">
          {tab === 'alerts' && (
            <>
              <Section title={t('security.prefsTitle')} className="lg:col-span-8">
                <EmailPreferences />
              </Section>
              <Section title={t('common.language')} className="lg:col-span-4">
                <LanguageSwitcher className="w-full [&_select]:w-full" />
              </Section>
            </>
          )}
        </TabsContent>

        <TabsContent value="security" className="grid items-start gap-5 lg:grid-cols-2">
          {tab === 'security' && (
            <>
              <Section title={t('security.passwordTitle')}>
                <ChangePassword onChanged={() => setSessionsVersion((v) => v + 1)} />
              </Section>
              <Section title={t('security.mfaTitle')}>
                <TwoStep />
              </Section>
              <PhoneCard section={Section} />
              <Section title={t('security.devicesTitle')} className="lg:col-span-2">
                <Devices version={sessionsVersion} />
              </Section>
            </>
          )}
        </TabsContent>

        <TabsContent value="data" className="grid items-start gap-5 lg:grid-cols-2">
          {tab === 'data' && (
            <>
              <Section title={t('ux.summary.open')} description={t('ux.summary.body')}>
                <Button variant="outline" nativeButton={false} render={<Link href="/patient/summary" />}>
                  <FileTextIcon data-icon="inline-start" aria-hidden="true" />
                  {t('ux.summary.open')}
                </Button>
              </Section>
              <Section title={t('ai.title')}>
                <AiConsent />
              </Section>
              <Section title={t('security.dataTitle')} className="lg:col-span-2">
                <YourData />
              </Section>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* The desktop sidebar has its own sign-out; phones reach it here without opening the menu. */}
      <Button
        variant="ghost"
        className="w-fit text-muted-foreground md:hidden"
        onClick={async () => {
          await signOut();
          router.replace('/');
        }}
      >
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />
        {t('common.signOut')}
      </Button>
    </div>
  );
}
