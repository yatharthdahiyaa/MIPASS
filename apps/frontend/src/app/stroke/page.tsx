import type { Metadata } from 'next';
import StrokePage from '@/components/products/StrokePage';

export const metadata: Metadata = {
  title: 'MiPAAS · qStroke Care Coordination & LVO Detection AI',
  description:
    'Automated ASPECTS scoring, Large Vessel Occlusion (LVO) detection on CTA, and ischemic core vs. penumbra mismatch quantification for acute stroke care.',
  keywords:
    'stroke AI, ASPECTS automated scoring, LVO detection, CT perfusion mismatch, thrombectomy triage, tele-stroke',
  openGraph: {
    title: 'MiPAAS · qStroke Stroke AI Suite',
    description:
      'LVO detection and automated ASPECTS scoring in < 30 seconds for acute endovascular thrombectomy candidacy.',
    type: 'website',
  },
};

import ServiceGuard from '@/components/common/ServiceGuard';

export default function Page() {
  return (
    <ServiceGuard serviceId="stroke">
      <StrokePage />
    </ServiceGuard>
  );
}
