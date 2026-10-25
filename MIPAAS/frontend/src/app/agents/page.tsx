import type { Metadata } from 'next';
import AgentsConsole from '@/components/personas/AgentsConsole';
import RoleGate from '@/components/auth/RoleGate';

export const metadata: Metadata = {
  title: 'MiPAAS 9-Agent Command Center · Clinical Autonomy & Safety Framework',
  description:
    'Explore the 9 autonomous and assistive medical agents in MIPAAS: L0, L1, L2 autonomy tiers, strict clinical invariants, allowable tools, and live sandbox execution.',
};

export default function AgentsPage() {
  return (
    <RoleGate
      allowedRoles={['admin', 'researcher', 'doctor', 'radiologist']}
      title="Agent Command Center"
      description="The autonomy and safety console is restricted to authorized clinical and platform roles."
    >
      <AgentsConsole />
    </RoleGate>
  );
}
