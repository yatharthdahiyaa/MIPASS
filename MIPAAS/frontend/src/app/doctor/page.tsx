import type { Metadata } from 'next';
import DoctorPortal from '@/components/doctor/DoctorPortal';

export const metadata: Metadata = {
  title: 'CareNest Hospital System · Doctor Clinical Dashboard',
  description:
    'Physician workstation: view clinical schedules, manage active patients, review pending lab results, and respond to critical patient alerts.',
};

export default function DoctorPage() {
  return <DoctorPortal />;
}
