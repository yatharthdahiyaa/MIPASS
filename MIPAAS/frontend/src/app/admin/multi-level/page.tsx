import type { Metadata } from 'next';
import MultiLevelAdminPortal from '@/components/admin/MultiLevelAdminPortal';

export const metadata: Metadata = {
  title: 'MiPAAS Enterprise Multi-Level Admin Portal · Governance & RBAC',
  description:
    'Multi-tier enterprise governance, RBAC hierarchy, organizations, break-glass approvals, AI agents, and platform telemetry.',
};

export default function MultiLevelAdminPage() {
  return <MultiLevelAdminPortal />;
}
