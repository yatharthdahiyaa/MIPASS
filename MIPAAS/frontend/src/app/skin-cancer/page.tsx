import type { Metadata } from 'next';
import SkinCancerEnhanced from '@/components/skin-cancer/SkinCancerEnhanced';

export const metadata: Metadata = {
  title: 'MiPAAS · Skin Cancer & Dermoscopy AI (HAM10000)',
  description:
    '7-class dermatological lesion classification, automated melanoma risk triage, and Grad-CAM++ spatial explainability powered by EfficientNet-B0 on the HAM10000 benchmark.',
  keywords:
    'skin cancer AI, melanoma detection, HAM10000, dermoscopy AI, basal cell carcinoma, actinic keratosis, dermatology AI',
  openGraph: {
    title: 'MiPAAS · Skin Cancer & Dermoscopy AI',
    description:
      'Sub-second 7-class lesion triage with malignancy risk scoring and explainable AI.',
    type: 'website',
  },
};

export default function Page() {
  return <SkinCancerEnhanced />;
}
