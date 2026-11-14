import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/components/home/tokens.css';
import AuthShell from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/RecoveryForms';

export const metadata: Metadata = {
  title: 'Reset your password · MIPAAS',
  robots: { index: false },
};

export default function Page() {
  return (
    <AuthShell mode="login" title="authx.forgotTitle" subtitle="authx.forgotSubtitle">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
