import type { Metadata } from 'next';
import OpenEMRUnifiedPortal from '@/portals/openemr/OpenEMRUnifiedPortal';

export const metadata: Metadata = {
  title: 'OpenEMR Unified Health Portal · Eka.care PHR & Master Patient Index',
  description:
    'Comprehensive OpenEMR user portal integrating Eka.care personal health records, Master Patient Index (MPI), daily vitals, ABHA digital locker, certified radiology reports, and FHIR R4 interoperability.',
};

export default function OpenEMRPage() {
  return <OpenEMRUnifiedPortal />;
}
