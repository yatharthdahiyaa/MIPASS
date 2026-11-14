'use client';

import React from 'react';
import { SessionProvider } from '@/lib/auth/SessionProvider';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/config';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function ClientProviders({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <I18nProvider initialLocale={locale}>
      <SessionProvider>
        <TooltipProvider>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
