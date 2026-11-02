import type { Metadata } from 'next';
import QERPage from '@/components/products/QERPage';

export const metadata: Metadata = {
  title: 'MiPAAS · qER Emergency Radiology & Acute Trauma AI',
  description:
    'Sub-15 second triage of non-contrast head CT scans for acute intracranial hemorrhage, midline shift, and cranial fractures with automated emergency push alerts.',
  keywords:
    'emergency radiology AI, head CT triage, intracranial hemorrhage, subdural hematoma, midline shift, trauma AI',
  openGraph: {
    title: 'MiPAAS · qER Emergency Radiology AI',
    description:
      'STAT acute bleed triage and midline shift quantification in <15 seconds.',
    type: 'website',
  },
};

import ServiceGuard from '@/components/common/ServiceGuard';

export default function Page() {
  return (
    <ServiceGuard serviceId="qer">
      <QERPage />
    </ServiceGuard>
  );
}
