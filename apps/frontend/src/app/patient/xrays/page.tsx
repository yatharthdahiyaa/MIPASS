import { Suspense } from 'react';
import XraysView from '@/components/patient/views/XraysView';

export default function PatientXraysPage() {
  return (
    <Suspense>
      <XraysView />
    </Suspense>
  );
}
