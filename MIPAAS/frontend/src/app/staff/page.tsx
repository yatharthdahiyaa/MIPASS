import type { Metadata } from 'next';
import StaffPortal from '@/components/personas/StaffPortal';

export const metadata: Metadata = {
  title: 'MiPAAS Lab & Hospital Staff Portal · Resumable Upload & Ingestion QA',
  description:
    'Hospital and laboratory staff workspace: multi-channel resumable DICOM uploads, pseudonymous case timeline, and instant blur quality gate.',
};

export default function StaffPage() {
  return <StaffPortal />;
}
