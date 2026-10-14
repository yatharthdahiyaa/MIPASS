import type { Metadata } from 'next';
import AgentsConsole from '@/components/personas/AgentsConsole';

export const metadata: Metadata = {
  title: 'MiPAAS 9-Agent Command Center · Clinical Autonomy & Safety Framework',
  description:
    'Explore the 9 autonomous and assistive medical agents in MIPAAS: L0, L1, L2 autonomy tiers, strict clinical invariants, allowable tools, and live sandbox execution.',
};

export default function AgentsPage() {
  return <AgentsConsole />;
}
