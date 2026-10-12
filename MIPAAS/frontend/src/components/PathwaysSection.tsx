'use client';
import { useState } from 'react';
import Link from 'next/link';

const pathways = [
  {
    id: 'lung-cancer',
    title: 'Accelerating Early Detection & Management of Lung Cancer',
    description:
      'The end-to-end Lung Cancer care continuum detects lung nodules early, measures for disease progression and manages cases with 6-year Sybil deep forecasting.',
    bg: 'bg-gradient-to-br from-[#008280] to-[#0E273A]',
    image: '/images/mipaas_lung_cancer.jpg',
    accentColor: '#00DCCE',
    label: 'Lung Cancer AI',
    href: '/lung-cancer',
  },
  {
    id: 'cardiac',
    title: 'Precision Structural & Functional Cardiac MRI Intelligence',
    description:
      'ACDC U-Net cine MRI segmentation for automated biventricular ejection fractions (LVEF/RVEF), myocardial mass volumetrics, and 17-segment AHA wall motion scoring.',
    bg: 'bg-gradient-to-br from-[#2D0A1E] to-[#FF5A78]/40',
    image: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=1200&q=80',
    accentColor: '#FF5A78',
    label: 'Cardiology AI',
    href: '/cardiac',
  },
  {
    id: 'brain-tumor',
    title: 'Comprehensive Neuro-Oncology & Glioma Volumetrics',
    description:
      'BraTS SegResNet multi-sequence MRI fusion (T1, T2, FLAIR, T1CE) with automated sub-compartment segmentation and 3D DenseNet WHO grade classification.',
    bg: 'bg-gradient-to-br from-[#1E0D36] to-[#A855F7]/40',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80',
    accentColor: '#A855F7',
    label: 'Neuro-Oncology',
    href: '/brain-tumor',
  },
  {
    id: 'stroke',
    title: 'Enabling Timely Intervention in Stroke Care',
    description:
      'An AI-powered care coordination suite to enable patient triage, Circle of Willis LVO detection, and automated 10-point ASPECTS matrix for timely thrombectomy.',
    bg: 'bg-gradient-to-br from-[#008280] to-[#0A1823]',
    image: '/images/mipaas_stroke_care.jpg',
    accentColor: '#F5A623',
    label: 'Stroke Care',
    href: '/stroke',
  },
  {
    id: 'global-health',
    title: 'Advancing Public Health Access for Tuberculosis & Beyond',
    description:
      'WHO-evaluated CAD4TB AI solutions supporting clinicians in making quick, accurate screening decisions with GeneXpert sputum cartridge optimization.',
    bg: 'bg-gradient-to-br from-[#0F2332] to-[#98AED9]/40',
    image: '/images/mipaas_global_health.jpg',
    accentColor: '#98AED9',
    label: 'Global Health TB',
    href: '/tb',
  },
  {
    id: 'skin-cancer',
    title: 'Precision Dermoscopic AI & 7-Class Lesion Triaging',
    description:
      'HAM10000 deep convolutional network with Grad-CAM++ morphological saliency and multi-class risk scoring across melanoma, basal cell, and benign keratosis.',
    bg: 'bg-gradient-to-br from-[#1E1B4B] to-[#EC4899]/40',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
    accentColor: '#F43F5E',
    label: 'Dermoscopy AI',
    href: '/skin-cancer',
  },
  {
    id: 'diabetic-foot',
    title: 'Plantar Thermography & Microvascular Ulcer Prevention',
    description:
      'Dual-foot infrared angiosome mapping with automated Bilateral Temperature Difference (ΔT) analysis to intercept neuropathic ulcers before tissue breakdown.',
    bg: 'bg-gradient-to-br from-[#1E293B] to-[#F97316]/40',
    image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80',
    accentColor: '#FB923C',
    label: 'Plantar Thermometry',
    href: '/diabetic-foot',
  },
];

export default function PathwaysSection() {
  const [activeCard, setActiveCard] = useState(0);

  return (
    <section id="products" className="bg-[#0F2332] py-16 md:py-24 scroll-mt-28">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#01DCBE] to-[#98AED9] bg-clip-text text-transparent pb-8 md:pb-14">
          Transforming Healthcare Pathways with AI
        </h2>

        {/* Mobile vertical stack */}
        <div className="flex flex-col gap-6 md:hidden">
          {pathways.map((card) => (
            <div
              key={card.id}
              className={`rounded-2xl overflow-hidden relative min-h-[460px] ${card.bg} border border-white/10 flex flex-col justify-end p-6 shadow-xl`}
            >
              {/* Background image */}
              <div className="absolute inset-0 z-0">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover opacity-60"
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1823] via-[#0A1823]/70 to-transparent" />
              </div>

              {/* Card content */}
              <div className="relative z-10 flex flex-col gap-3">
                <span
                  className="w-fit text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 backdrop-blur-md"
                  style={{ color: card.accentColor }}
                >
                  {card.label}
                </span>
                <h3 className="text-white text-xl font-bold leading-snug">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {card.description}
                </p>
                <Link
                  href={card.href}
                  className="mt-3 inline-block rounded-full border border-white/80 px-6 py-2.5 text-xs font-semibold text-white hover:bg-white hover:text-[#0F2332] transition-colors w-fit text-center"
                >
                  Explore AI Suite &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop interactive accordion */}
        <div className="hidden md:flex gap-4 w-full h-[520px] lg:h-[620px]">
          {pathways.map((card, i) => {
            const isActive = activeCard === i;
            return (
              <div
                key={card.id}
                onMouseEnter={() => setActiveCard(i)}
                style={{
                  flex: isActive ? 2.2 : 1,
                  transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                className={`relative rounded-2xl overflow-hidden cursor-pointer ${card.bg} border border-white/10 shadow-xl group`}
              >
                {/* Background image */}
                <div className="absolute inset-0 z-0">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{
                      opacity: isActive ? 0.75 : 0.45,
                    }}
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[#0A1823] via-[#0A1823]/50 to-transparent"
                    style={{ opacity: isActive ? 0.9 : 0.7 }}
                  />
                </div>

                {/* Card content */}
                <div className="relative z-10 h-full p-8 lg:p-10 flex flex-col justify-end">
                  <div className="flex flex-col gap-3">
                    <span
                      className="w-fit text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 backdrop-blur-md"
                      style={{ color: card.accentColor }}
                    >
                      {card.label}
                    </span>

                    <h3 className="text-white text-xl lg:text-2xl xl:text-3xl font-bold leading-tight">
                      {card.title}
                    </h3>

                    {/* Smooth disclosure for description */}
                    <div
                      className="overflow-hidden transition-all duration-500"
                      style={{
                        maxHeight: isActive ? '200px' : '0px',
                        opacity: isActive ? 1 : 0,
                      }}
                    >
                      <p className="text-sm lg:text-base text-gray-300 leading-relaxed pt-2">
                        {card.description}
                      </p>
                      <Link
                        href={card.href}
                        className="mt-5 inline-block rounded-full border border-white px-7 py-2.5 text-sm font-semibold text-white hover:bg-white hover:text-[#008280] transition-colors"
                      >
                        Explore AI Suite &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
