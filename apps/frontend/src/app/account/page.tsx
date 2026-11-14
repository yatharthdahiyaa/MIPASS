import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/components/home/tokens.css';
import AccountView from '@/components/auth/AccountView';

export const metadata: Metadata = {
  title: 'Your account · MIPAAS',
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
