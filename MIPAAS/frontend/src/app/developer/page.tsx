import type { Metadata } from 'next';
import DeveloperPortal from '@/components/personas/DeveloperPortal';

export const metadata: Metadata = {
  title: 'MiPAAS Developer Hub · Sandbox, APIs, SDKs & Webhooks',
  description:
    'Developer portal: interactive synthetic sandbox, OpenAPI documentation, client SDK code snippets, and HMAC-verified webhooks.',
};

export default function DeveloperPage() {
  return <DeveloperPortal />;
}
