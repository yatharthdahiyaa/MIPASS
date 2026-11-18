import { Suspense } from 'react';
import RecordsView from '@/components/patient/views/RecordsView';

export default function PatientRecordsPage() {
  return (
    <Suspense>
      <RecordsView />
    </Suspense>
  );
}
