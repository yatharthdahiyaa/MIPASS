import type { Metadata } from 'next';
import InternalPortal from '@/components/personas/InternalPortal';
import RoleGate from '@/components/auth/RoleGate';

export const metadata: Metadata = {
  title: 'MiPAAS Internal Platform & ML Operations Console',
  description:
    'Internal platform team: model catalog management, per-tenant feature enablement, override drift QA monitoring, and immutable compliance audit search.',
};

export default function InternalPage() {
  return (
    <RoleGate
      allowedRoles={['admin', 'auditor']}
      title="Internal MLOps Console"
      description="Model catalog, tenant enablement, and compliance audit data are restricted to internal administrators and auditors."
    >
      <InternalPortal />
    </RoleGate>
  );
}
