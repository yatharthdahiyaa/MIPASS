import type { Metadata } from 'next';
import EkaCareHub from '@/components/eka/EkaCareHub';

export const metadata: Metadata = {
  title: 'Eka.care Health Hub · Day-to-Day Medical & Personal Health Records',
  description:
    'Manage your day-to-day healthcare clearly with Eka.care: medicine schedule, daily vitals tracker, digital health locker, ABHA Ayushman Bharat card, and AI doctor consultation.',
};

export default function EkaCarePage() {
  return <EkaCareHub />;
}
