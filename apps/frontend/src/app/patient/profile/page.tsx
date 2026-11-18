import { Suspense } from 'react';
import ProfileView from '@/components/patient/views/ProfileView';

export default function PatientProfilePage() {
  return (
    <Suspense>
      <ProfileView />
    </Suspense>
  );
}
