import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/components/home/tokens.css';
import AuthShell from '@/components/auth/AuthShell';
import SignupForm from '@/components/auth/SignupForm';

export const metadata: Metadata = {
  title: 'Create your account · MIPAAS',
  description: 'Create a MIPAAS account: patients keep their own health record, doctors join the clinical workspace.',
};

export default function SignupPage() {
  return (
    <AuthShell mode="signup">
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
