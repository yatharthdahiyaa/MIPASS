import type { Metadata } from 'next';
import TBPage from '@/components/products/TBPage';

export const metadata: Metadata = {
  title: 'MiPAAS · qTrack Tuberculosis AI Screening & Monitoring',
  description:
    'WHO-compliant Computer-Aided Detection (CAD) for presumptive pulmonary tuberculosis on digital and ultra-portable X-rays with offline edge capability.',
  keywords:
    'tuberculosis AI, CAD4TB, TB screening, chest x-ray TB detection, WHO Class II CAD, global health AI',
  openGraph: {
    title: 'MiPAAS · qTrack WHO Tuberculosis AI',
    description:
      'Ultra-fast TB screening and cavitary lesion detection operating online and offline at the point of care.',
    type: 'website',
  },
};

export default function Page() {
  return <TBPage />;
}
