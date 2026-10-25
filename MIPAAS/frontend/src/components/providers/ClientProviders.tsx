'use client';

import React from 'react';
import { RBACProvider } from '@/context/RBACContext';
import { ServicesProvider } from '@/context/ServicesContext';
import { IndicLanguageProvider } from '@/context/IndicLanguageContext';
import RBACModal from '@/components/rbac/RBACModal';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <RBACProvider>
      <ServicesProvider>
        <IndicLanguageProvider>
          {children}
          <RBACModal />
        </IndicLanguageProvider>
      </ServicesProvider>
    </RBACProvider>
  );
}

