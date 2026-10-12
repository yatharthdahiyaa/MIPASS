import type { Metadata } from 'next';
import DiabeticFootEnhanced from '@/components/diabetic-foot/DiabeticFootEnhanced';

export const metadata: Metadata = {
  title: 'MiPAAS · Plantar Thermogram Diabetic Foot AI',
  description:
    'AI-powered bilateral plantar thermogram asymmetry mapping, GLCM spatial texture analysis, and diabetic peripheral neuropathy hot-spot screening.',
  keywords:
    'diabetic foot AI, plantar thermogram, thermal imaging, diabetic neuropathy, ulcer prevention, temperature asymmetry',
  openGraph: {
    title: 'MiPAAS · Plantar Thermogram Diabetic Foot AI',
    description:
      'Early diabetic foot ulcer risk screening using bilateral temperature discrepancy mapping and machine learning.',
    type: 'website',
  },
};

export default function Page() {
  return <DiabeticFootEnhanced />;
}
