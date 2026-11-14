import type { Metadata } from 'next';
import '@/components/home/tokens.css';
import SmoothScroll from '@/components/home/SmoothScroll';
import HomeNav from '@/components/home/HomeNav';
import RevealFooter from '@/components/home/RevealFooter';
import { AgentsSection, ConsoleSection, CxrHero, ModelSection } from '@/components/cxr/Sections';

export const metadata: Metadata = {
  title: 'Chest X-ray screening · MIPAAS',
  description: 'How MIPAAS agents and the DenseNet-121 model screen a chest radiograph for 14 findings.',
};

export default function ChestXrayPage() {
  return (
    <div id="top" className="home-root min-h-screen">
      <SmoothScroll />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--h-text)] focus:px-4 focus:py-2 focus:text-[var(--h-ink)]"
      >
        Skip to content
      </a>
      <HomeNav />
      <main id="main-content" tabIndex={-1} className="relative z-10 bg-[var(--h-page)] pb-[var(--h-section-y)]">
        <CxrHero />
        <ConsoleSection />
        <ModelSection />
        <AgentsSection />
      </main>
      <RevealFooter />
    </div>
  );
}
