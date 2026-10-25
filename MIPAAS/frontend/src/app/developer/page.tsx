import type { Metadata } from 'next';
import DeveloperPortal from '@/components/personas/DeveloperPortal';
import RoleGate from '@/components/auth/RoleGate';

export const metadata: Metadata = {
  title: 'MiPAAS Developer Hub · Sandbox, APIs, SDKs & Webhooks',
  description:
    'Developer portal: interactive synthetic sandbox, OpenAPI documentation, client SDK code snippets, and HMAC-verified webhooks.',
};

export default function DeveloperPage() {
  return (
    <RoleGate
      allowedRoles={['admin', 'researcher', 'technician']}
      title="Developer Hub"
      description="Sandbox tokens, SDKs, and webhook configuration are restricted to authorized integration roles."
    >
      <DeveloperPortal />
    </RoleGate>
  );
}
