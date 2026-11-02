import MIPAASNavbar from "@/components/home/MIPAASNavbar";
import MIPAASHero from "@/components/home/MIPAASHero";
import PartnersSection from "@/components/PartnersSection";
import PathwaysSection from "@/components/PathwaysSection";
import ImpactSection from "@/components/ImpactSection";
import DevelopmentsSection from "@/components/DevelopmentsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
      <a href="#main-content" className="skip-link sr-only focus:not-sr-only">Skip to content</a>
      
      <main id="main-content" tabIndex={-1}>
        {/* Sky Background Wrapper spanning Navbar and Hero */}
        <div className="relative bg-[url('/images/sky_bg.jpg')] bg-cover bg-top bg-no-repeat overflow-hidden">
          {/* Carevia Daylight Sky Navigation */}
          <MIPAASNavbar />

          {/* Carevia Daylight Hero with 3D Earth Globe & Dashboard Preview */}
          <MIPAASHero />
        </div>

        <div id="solutions">
          <PartnersSection />
        </div>

        <div id="features">
          <PathwaysSection />
        </div>

        <div id="product">
          <ImpactSection />
        </div>

        <div id="pricing">
          <DevelopmentsSection />
        </div>

        <TestimonialsSection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
