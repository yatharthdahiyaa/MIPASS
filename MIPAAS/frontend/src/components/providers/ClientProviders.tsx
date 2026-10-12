'use client';

import React from 'react';
import { RBACProvider } from '@/context/RBACContext';
import RBACModal from '@/components/rbac/RBACModal';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <RBACProvider>
      {children}
      <RBACModal />
    </RBACProvider>
  );
}
