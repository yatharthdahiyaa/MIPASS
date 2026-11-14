import { Suspense } from 'react';
import CareView from '@/components/patient/views/CareView';

export default function PatientCarePage() {
  return (
    <Suspense>
      <CareView />
    </Suspense>
  );
}
