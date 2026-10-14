import type { Metadata } from 'next';
import QXRPage from '@/components/products/QXRPage';

export const metadata: Metadata = {
  title: 'MiPAAS · qXR Chest X-Ray AI Screening & Triage',
  description:
    'Comprehensive automated detection, triage, and Grad-CAM++ localization for 14 chest pathologies including pneumothorax, pneumonia, and pleural effusion.',
  keywords:
    'chest x-ray AI, CXR triage, CheXNet, pneumothorax detection, pneumonia screening, radiology AI',
  openGraph: {
    title: 'MiPAAS · qXR Chest Radiography AI',
    description:
      'Multi-pathology chest radiograph triage in < 3 seconds with explainable AI heatmaps and direct PACS push.',
    type: 'website',
  },
};

import ServiceGuard from '@/components/common/ServiceGuard';

export default function Page() {
  return (
    <ServiceGuard serviceId="qxr">
      <QXRPage />
    </ServiceGuard>
  );
}
