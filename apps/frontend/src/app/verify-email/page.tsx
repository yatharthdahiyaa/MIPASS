import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/components/home/tokens.css';
import AuthShell from '@/components/auth/AuthShell';
import { VerifyEmailPanel } from '@/components/auth/RecoveryForms';

export const metadata: Metadata = {
  title: 'Confirm your e-mail · MIPAAS',
  robots: { index: false },
};

export default function Page() {
  return (
    <AuthShell mode="login" title="authx.verifyTitle" subtitle="authx.verifySubtitle">
      <Suspense>
        <VerifyEmailPanel />
      </Suspense>
    </AuthShell>
  );
}
