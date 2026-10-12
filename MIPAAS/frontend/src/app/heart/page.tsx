import type { Metadata } from 'next';
import CardiacEnhanced from '@/components/cardiac/CardiacEnhanced';

export const metadata: Metadata = {
  title: 'MiPAAS · Heart AI & Cardiac Ventricle Segmentation',
  description:
    'Automated cardiac MRI ventricle and myocardium segmentation with LVEF calculation.',
};

export default function Page() {
  return <CardiacEnhanced />;
}
