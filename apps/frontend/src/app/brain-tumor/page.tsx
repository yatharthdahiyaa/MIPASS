import type { Metadata } from 'next';
import BrainTumorEnhanced from '@/components/brain-tumor/BrainTumorEnhanced';

export const metadata: Metadata = {
  title: 'MiPAAS · Brain Tumor AI & Multi-Parametric MRI Segmentation',
  description:
    'BraTS SegResNet multi-compartment glioma segmentation (enhancing core, edema, necrotic cavity) and 3D DenseNet WHO tumor grading on multi-parametric MRI.',
  keywords:
    'brain tumor AI, BraTS SegResNet, glioma segmentation, glioblastoma grading, neuro-oncology AI, multi-parametric MRI',
  openGraph: {
    title: 'MiPAAS · Brain Tumor AI Suite',
    description:
      'Stereotactic tumor segmentation and WHO grade prediction in <2.4 seconds.',
    type: 'website',
  },
};

import ServiceGuard from '@/components/common/ServiceGuard';

export default function Page() {
  return (
    <ServiceGuard serviceId="brain-tumor">
      <BrainTumorEnhanced />
    </ServiceGuard>
  );
}
