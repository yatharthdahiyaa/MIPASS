import type { Metadata } from 'next';
import AdminPortalSwitcher from '@/components/admin/AdminPortalSwitcher';

export const metadata: Metadata = {
  title: 'MiPAAS Administration Console · Multi-Level Enterprise & Lab PACS Hub',
  description:
    'Comprehensive administration portal: Multi-level RBAC, enterprise organizations, break-glass approvals, PACS AE titles, and diagnostic telemetry.',
};

export default function AdminPage() {
  return <AdminPortalSwitcher />;
}
