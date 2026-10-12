import type { Metadata } from 'next';
import LungCancerEnhanced from '@/components/lung-cancer/LungCancerEnhanced';

export const metadata: Metadata = {
  title: 'MiPAAS · Lung Cancer Screening AI',
  description:
    'AI-powered lung cancer risk prediction using 3D ResNet, Sybil ensemble models, and Grad-CAM++ explainability on low-dose CT scans.',
  keywords:
    'lung cancer AI, CT scan analysis, Sybil model, 3D ResNet, Grad-CAM++, LDCT screening, lung nodule detection',
  openGraph: {
    title: 'MiPAAS · Lung Cancer Screening AI',
    description:
      'AI-powered lung cancer risk prediction with explainable AI visualization and 1-6 year risk forecasting.',
    type: 'website',
  },
};

export default function LungCancerPage() {
  return <LungCancerEnhanced />;
}
