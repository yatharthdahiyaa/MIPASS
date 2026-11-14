import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/components/home/tokens.css';
import AdminView from '@/components/admin/AdminView';

export const metadata: Metadata = {
  title: 'Administration · MIPAAS',
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <Suspense>
      <AdminView />
    </Suspense>
  );
}
