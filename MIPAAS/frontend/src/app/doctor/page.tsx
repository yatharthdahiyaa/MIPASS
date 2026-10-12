import type { Metadata } from 'next';
import DoctorWorkstation from '@/components/doctor/DoctorWorkstation';

export const metadata: Metadata = {
  title: 'MiPAAS Doctor Workstation · AI Radiology Clinical Findings',
  description:
    'Physician Diagnostic Station: Visual inspection of uploaded DICOM scans, automated deep-learning triage using trained neural models, and Grad-CAM visual explainability.',
};

export default function DoctorPage() {
  return <DoctorWorkstation />;
}
