import AnnouncementBar from "@/components/AnnouncementBar";
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
      {/* Sticky header */}
      <div className="sticky top-0 z-50 w-full">
        <AnnouncementBar />
        <Navbar />
      </div>

      {/* Main content */}
      <main>
        {/* 1. Hero */}
        <HeroSection />

        {/* 2. Partners / Logo ticker + Compliance */}
        <PartnersSection />

        {/* 4. Transforming Healthcare Pathways */}
        <PathwaysSection />

        {/* 5. Global Impact */}
        <ImpactSection />

        {/* 6. Latest Developments (Evidence + Blog) */}
        <DevelopmentsSection />

        {/* 7. Testimonials */}
        <TestimonialsSection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
