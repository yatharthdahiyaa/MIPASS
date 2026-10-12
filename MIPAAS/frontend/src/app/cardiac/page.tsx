import type { Metadata } from 'next';
import CardiacEnhanced from '@/components/cardiac/CardiacEnhanced';

export const metadata: Metadata = {
  title: 'MiPAAS · Cardiac AI Cine MRI & Ventricular Segmentation',
  description:
    'Automated short-axis cardiac cine MRI ventricular segmentation, LVEF/RVEF calculation, and 17-segment AHA myocardial wall strain analysis with deep U-Net.',
  keywords:
    'cardiac MRI AI, ACDC U-Net, left ventricle segmentation, ejection fraction, myocardial strain, cardiovascular AI',
  openGraph: {
    title: 'MiPAAS · Cardiac AI Cine MRI Suite',
    description:
      'Automated ventricular volumetrics and ejection fraction in <1.6 seconds.',
    type: 'website',
  },
};

export default function Page() {
  return <CardiacEnhanced />;
}
