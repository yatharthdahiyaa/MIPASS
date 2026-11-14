import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/components/home/tokens.css';
import AuthShell from '@/components/auth/AuthShell';
import { ResetPasswordForm } from '@/components/auth/RecoveryForms';

export const metadata: Metadata = {
  title: 'Choose a new password · MIPAAS',
  robots: { index: false },
};

export default function Page() {
  return (
    <AuthShell mode="login" title="authx.resetTitle" subtitle="authx.resetSubtitle">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
