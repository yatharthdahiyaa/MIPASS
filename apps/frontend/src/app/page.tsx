import '@/components/home/tokens.css';
import SmoothScroll from '@/components/home/SmoothScroll';
import HomeNav from '@/components/home/HomeNav';
import HomeHero from '@/components/home/HomeHero';
import Positioning from '@/components/home/Positioning';
import CapabilitiesPanel from '@/components/home/CapabilitiesPanel';
import HowItWorks from '@/components/home/HowItWorks';
import EvidenceCarousel from '@/components/home/EvidenceCarousel';
import RevealFooter from '@/components/home/RevealFooter';

export default function Home() {
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
      {/* main sits above the fixed footer; its background hides the footer until the end */}
      <main id="main-content" tabIndex={-1} className="relative z-10 bg-[var(--h-page)] pb-[var(--h-section-y)]">
        <HomeHero />
        <Positioning />
        <CapabilitiesPanel />
        <HowItWorks />
        <EvidenceCarousel />
      </main>
      <RevealFooter />
    </div>
  );
}
