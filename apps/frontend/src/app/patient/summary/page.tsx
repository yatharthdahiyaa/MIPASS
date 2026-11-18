import type { Metadata } from 'next';
import SummaryView from '@/components/patient/views/SummaryView';

export const metadata: Metadata = {
  title: 'Visit summary · MIPAAS',
  robots: { index: false },
};

export default function PatientSummaryPage() {
  return <SummaryView />;
}
