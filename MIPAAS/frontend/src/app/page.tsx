import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import PartnersSection from "@/components/PartnersSection";
import PathwaysSection from "@/components/PathwaysSection";
import ImpactSection from "@/components/ImpactSection";
import DevelopmentsSection from "@/components/DevelopmentsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="relative">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="sticky top-0 z-50 w-full">
        <Navbar />
      </div>

      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <PartnersSection />
        <PathwaysSection />
        <ImpactSection />
        <DevelopmentsSection />
        <TestimonialsSection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
