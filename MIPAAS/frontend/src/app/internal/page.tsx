import type { Metadata } from 'next';
import InternalPortal from '@/components/personas/InternalPortal';

export const metadata: Metadata = {
  title: 'MiPAAS Internal Platform & ML Operations Console',
  description:
    'Internal platform team: model catalog management, per-tenant feature enablement, override drift QA monitoring, and immutable compliance audit search.',
};

export default function InternalPage() {
  return <InternalPortal />;
}
