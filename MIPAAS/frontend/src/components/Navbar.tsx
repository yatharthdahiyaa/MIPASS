'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Menu,
  X,
  Globe,
  ArrowRight,
} from 'lucide-react';

export interface ProductItem {
  id: string;
  name: string;
  tagline: string;
  href: string;
  modality: string;
  badge?: string;
  accent: string;
}

export const productList: ProductItem[] = [
  {
    id: 'lung-cancer',
    name: 'qCT Lung – Lung Cancer AI',
    tagline: '3D Nodule Detection & 6-Year Risk Forecasting',
    href: '/lung-cancer',
    modality: 'LDCT',
    badge: 'Sybil AI',
    accent: '#7C5CFC',
  },
  {
    id: 'cardiac',
    name: 'qCardiac – Heart & Ventricle AI',
    tagline: 'ACDC U-Net Cine MRI & Ejection Fraction',
    href: '/cardiac',
    modality: 'Cine MRI',
    badge: '17-AHA Segments',
    accent: '#FF5A78',
  },
  {
    id: 'brain-tumor',
    name: 'qBrain – Brain Tumor AI',
    tagline: 'BraTS Multi-Sequence Glioma & WHO Grade',
    href: '/brain-tumor',
    modality: 'MRI 4-Seq',
    badge: 'BraTS SegResNet',
    accent: '#A855F7',
  },
  {
    id: 'qxr',
    name: 'qXR – Chest X-Ray AI',
    tagline: '14-Pathology Screening & Triage',
    href: '/qxr',
    modality: 'CXR',
    badge: 'CE · FDA',
    accent: '#00DCCE',
  },
  {
    id: 'stroke',
    name: 'qStroke – Stroke Care AI',
    tagline: 'LVO Detection & Automated ASPECTS Scoring',
    href: '/stroke',
    modality: 'CT/CTA',
    badge: 'Acute Code',
    accent: '#F5A623',
  },
  {
    id: 'tb',
    name: 'qTrack – TB Monitoring',
    tagline: 'WHO-Compliant Tuberculosis Program AI',
    href: '/tb',
    modality: 'CXR',
    badge: 'WHO Class II',
    accent: '#00DCCE',
  },
  {
    id: 'qer',
    name: 'qER – Emergency Radiology AI',
    tagline: 'Critical Hemorrhage & Trauma in <15s',
    href: '/qer',
    modality: 'Head CT',
    badge: 'STAT Care',
    accent: '#FF7869',
  },
  {
    id: 'skin-cancer',
    name: 'qDerm – Skin Lesion AI',
    tagline: '7-Class Dermoscopy & Melanoma Risk',
    href: '/skin-cancer',
    modality: 'Dermoscopy',
    badge: 'HAM10000',
    accent: '#EC4899',
  },
  {
    id: 'diabetic-foot',
    name: 'qThermo – Diabetic Foot AI',
    tagline: 'Plantar Thermogram Bilateral Asymmetry & DM',
    href: '/diabetic-foot',
    modality: 'Thermal IR',
    badge: 'Thermogram ML',
    accent: '#10B981',
  },
];

const navLinks = [
  { label: 'Products', hasDropdown: true, href: '/#products' },
  { label: 'Impact', hasDropdown: false, href: '/#impact' },
  { label: 'Evidence', hasDropdown: false, href: '/#evidence' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setProductOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setProductOpen(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <nav className="bg-[#0A1823] px-6 py-4 md:px-8 border-b border-white/5 relative z-50">
      <div className="mx-auto max-w-[81rem] xl:px-0">
        <div className="relative flex w-full items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex cursor-pointer items-center gap-2.5 flex-shrink-0 group"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#00DCCE] to-[#008280] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200">
              <span className="text-white font-bold text-sm tracking-wider">M</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-xl tracking-tight leading-none">MiPAAS</span>
              <span className="text-[9px] tracking-widest text-gray-400 uppercase font-medium">Healthcare AI</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-9 lg:flex">
            {/* Links */}
            <div className="flex items-center gap-8 font-medium">
              {navLinks.map((link) => (
                <div key={link.label} className="relative">
                  {link.hasDropdown ? (
                    <div
                      className="relative py-2"
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    >
                      <button
                        type="button"
                        onClick={() => setProductOpen((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 text-sm transition-colors focus:outline-none cursor-pointer ${
                          productOpen ? 'text-[#00DCCE]' : 'text-white hover:text-[#00DCCE]'
                        }`}
                      >
                        <span>{link.label}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            productOpen ? 'rotate-180 text-[#00DCCE]' : 'text-gray-400'
                          }`}
                        />
                      </button>

                      {/* Dropdown Menu with zero-gap hover bridge */}
                      {productOpen && (
                        <div
                          className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[390px] z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className="rounded-2xl bg-[#081520]/95 backdrop-blur-xl border border-white/12 p-3 shadow-2xl ring-1 ring-black/40">
                            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                Clinical AI Suites
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00DCCE]/10 text-[#00DCCE] font-medium border border-[#00DCCE]/20">
                                5 Active Modules
                              </span>
                            </div>

                            <div className="space-y-1">
                              {productList.map((item) => (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  onClick={() => setProductOpen(false)}
                                  className="group/item flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                                >
                                  <div className="flex flex-col min-w-0 pr-3">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="h-2 w-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: item.accent }}
                                      />
                                      <span className="text-sm font-semibold text-white group-hover/item:text-[#00DCCE] transition-colors truncate">
                                        {item.name}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-gray-400 mt-0.5 line-clamp-1 pl-4">
                                      {item.tagline}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/10 font-mono">
                                      {item.modality}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-gray-500 group-hover/item:text-[#00DCCE] group-hover/item:translate-x-0.5 transition-all" />
                                  </div>
                                </Link>
                              ))}
                            </div>

                            <div className="pt-2 mt-2 border-t border-white/5 px-2 flex items-center justify-between text-[11px] text-gray-400">
                              <span>Trained on 1B+ clinical datasets</span>
                              <Link
                                href="/#products"
                                onClick={() => setProductOpen(false)}
                                className="text-[#00DCCE] hover:underline"
                              >
                                View all pathways &rarr;
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-white hover:text-[#00DCCE] transition-colors py-1 cursor-pointer"
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                href="/#contact"
                className="rounded-full bg-gradient-to-r from-[#FF7869] to-[#ff6857] text-white font-bold px-5 py-2 text-xs shadow-md shadow-[#FF7869]/25 hover:scale-[1.02] transition-all whitespace-nowrap cursor-pointer"
              >
                Contact Us
              </Link>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="text-white lg:hidden p-2 rounded-lg hover:bg-white/5 cursor-pointer"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-[#07131D]/98 backdrop-blur-2xl p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-5 border-b border-white/10">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#00DCCE] to-[#008280] flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <span className="text-white font-bold text-xl">MiPAAS</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="text-white p-2 hover:bg-white/10 rounded-lg cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Nav list */}
            <div className="flex flex-col gap-2 mt-5">
              {/* Products Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileProductsOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between text-lg text-white font-medium py-3 border-b border-white/5 cursor-pointer"
                >
                  <span className="text-[#00DCCE]">Products & AI Suites</span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      mobileProductsOpen ? 'rotate-180 text-[#00DCCE]' : ''
                    }`}
                  />
                </button>

                {mobileProductsOpen && (
                  <div className="pl-2 py-2 space-y-2 border-b border-white/5">
                    {productList.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.accent }}
                          />
                          <span className="text-sm font-medium text-white">{item.name}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                          {item.modality}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Other links */}
              {navLinks
                .filter((l) => !l.hasDropdown)
                .map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-lg text-white hover:text-[#00DCCE] py-3 transition-colors border-b border-white/5"
                  >
                    {link.label}
                  </Link>
                ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-6 border-t border-white/10 mt-6">
            <Link
              href="/#contact"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center rounded-full border border-[#29333E] bg-gradient-to-r from-[#FF7869] to-[#98AED9] bg-clip-text py-3 text-sm font-medium text-transparent cursor-pointer"
            >
              Reach out to us
            </Link>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-[#091927] py-3 text-white text-sm">
              <Globe className="h-4 w-4 text-[#00DCCE]" />
              <span>Global Healthcare AI Platform</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
