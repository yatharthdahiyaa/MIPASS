import { Suspense } from 'react';
import type { Metadata } from 'next';
import OpenEMRUnifiedPortal from '@/portals/openemr/OpenEMRUnifiedPortal';

export const metadata: Metadata = {
  title: 'MiPAAS Patient Portal · Certified Reports & Privacy Consent',
  description:
    'Patient portal: access certified radiological reports, understand findings in plain language, configure consent controls, and submit data rights requests.',
};

export default function PatientPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070E14] text-slate-300 flex items-center justify-center font-sans">Loading patient portal...</div>}>
      <OpenEMRUnifiedPortal initialTab="reports" />
    </Suspense>
  );
}
