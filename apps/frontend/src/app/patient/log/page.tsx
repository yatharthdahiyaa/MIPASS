import { Suspense } from 'react';
import LogView from '@/components/patient/views/LogView';

export default function PatientLogPage() {
  return (
    <Suspense>
      <LogView />
    </Suspense>
  );
}
