import type { Metadata } from 'next';
import OpenEMRUnifiedPortal from '@/portals/openemr/OpenEMRUnifiedPortal';

export const metadata: Metadata = {
  title: 'MiPAAS OpenEMR Management System · Master Patient Index & FHIR R4',
  description:
    'Comprehensive OpenEMR clinical management hub: Master Patient Index (MPI), DICOM tag reconciliation, radiology procedure orders worklist, clinical encounters, and HL7 FHIR R4 interoperability.',
};

export default function OpenEMRPage() {
  return <OpenEMRUnifiedPortal initialTab="clinical" />;
}
