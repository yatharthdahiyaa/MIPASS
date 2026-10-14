import type { Metadata } from 'next';
import AdminPortal from '@/components/personas/AdminPortal';

export const metadata: Metadata = {
  title: 'MiPAAS Lab Admin Hub · PACS, HL7, FHIR & Governance',
  description:
    'Laboratory administration portal: PACS AE title configuration, C-ECHO verification, multi-site RBAC, usage analytics, and API keys.',
};

export default function AdminPage() {
  return <AdminPortal />;
}
