import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/components/home/tokens.css';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in · MIPAAS',
  description: 'Sign in to your MIPAAS health record or clinical workspace.',
};

export default function LoginPage() {
  return (
    <AuthShell mode="login">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
