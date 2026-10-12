import type { Metadata } from 'next';
import BrainTumorEnhanced from '@/components/brain-tumor/BrainTumorEnhanced';

export const metadata: Metadata = {
  title: 'MiPAAS · Brain Tumor AI & Multi-Parametric MRI Segmentation',
  description:
    'BraTS SegResNet multi-compartment glioma segmentation and 3D DenseNet WHO tumor grading.',
};

export default function Page() {
  return <BrainTumorEnhanced />;
}
