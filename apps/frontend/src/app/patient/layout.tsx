import type { Metadata } from 'next';
import '@/components/home/tokens.css';
import PatientShell from '@/components/patient/PatientShell';

export const metadata: Metadata = {
  title: 'My health · MIPAAS',
  robots: { index: false },
};

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <PatientShell>{children}</PatientShell>;
}
