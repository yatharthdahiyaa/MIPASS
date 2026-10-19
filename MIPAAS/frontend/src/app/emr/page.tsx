import type { Metadata } from 'next';
import OpenEMRHub from '@/components/emr/OpenEMRHub';

export const metadata: Metadata = {
  title: 'CareNest Patient Health Portal · Appointments, Records & Care Plan',
  description:
    'Patient healthcare portal: View health vitals, upcoming doctor appointments, interactive care plan, active prescriptions, and doctor visit summaries.',
};

export default function OpenEMRPage() {
  return <OpenEMRHub />;
}
