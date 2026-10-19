'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import InteractiveEarth from './InteractiveEarth';
import FeatureCards from './FeatureCards';
import CareviaDashboardPreview from './CareviaDashboardPreview';
import MultiRoleAuthModal from '@/components/auth/MultiRoleAuthModal';
import { useRBAC } from '@/context/RBACContext';

export default function MIPAASHero() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { isAuthenticated } = useRBAC();

  return (
    <>
      <section className="relative w-full bg-transparent overflow-hidden pt-6 sm:pt-10 pb-16">
        {/* Soft atmospheric daylight radial glow */}
        <div className="absolute top-1/4 right-[10%] w-[600px] h-[600px] bg-white/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-[-5%] w-[500px] h-[500px] bg-sky-200/20 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center min-h-[540px]">
            {/* Left Column: Hero Typography & Actions */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Eyebrow / Social Proof Pill: "6k+ happy users" with avatar cluster */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/25 backdrop-blur-md border border-white/35 shadow-xs text-white">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-300 to-rose-400 ring-2 ring-white/60 flex items-center justify-center text-[10px] font-bold text-slate-700">
                    S
                  </div>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-300 to-blue-500 ring-2 ring-white/60 flex items-center justify-center text-[10px] font-bold text-white">
                    M
                  </div>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-300 to-teal-500 ring-2 ring-white/60 flex items-center justify-center text-[10px] font-bold text-white">
                    E
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-semibold tracking-tight text-white drop-shadow-xs">
                  6k+ happy users
                </span>
              </div>

              {/* Main Headline */}
              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold text-white tracking-tight leading-[1.12] drop-shadow-sm">
                  Better way to support patients digitally and efficiently
                </h1>
              </div>

              {/* Supporting Text */}
              <p className="text-sm sm:text-base text-white/95 max-w-xl font-normal leading-relaxed drop-shadow-xs">
                MIPASS helps clinics deliver a calm, modern health experience with clear reports, appointments, and real-time updates all in one platform.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {/* Primary Button: Dark Pill */}
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-6 sm:px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white font-bold text-sm sm:text-base shadow-lg shadow-black/15 transition-all cursor-pointer flex items-center gap-2 group hover:scale-[1.02]"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Secondary Button: White Pill */}
                <a
                  href="#features"
                  className="px-6 sm:px-7 py-3 rounded-full bg-white hover:bg-slate-50 text-[#111827] font-bold text-sm sm:text-base shadow-md transition-all flex items-center gap-2 group hover:scale-[1.02]"
                >
                  <span>Explore Pathways</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-slate-400" />
                </a>
              </div>
            </div>

            {/* Right Column: Interactive 3D Earth Globe (Position preserved) */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <InteractiveEarth />
            </div>
          </div>
        </div>

        {/* Conditional Dashboard: Shown ONLY when someone is logged in */}
        {isAuthenticated && (
          <div id="dashboard-preview" className="mt-8 sm:mt-12 animate-in fade-in duration-300">
            <CareviaDashboardPreview />
          </div>
        )}

        {/* 3 Horizontal Feature Cards Beneath Hero (As before on common public homepage) */}
        <div className="mt-8 sm:mt-12">
          <FeatureCards />
        </div>
      </section>

      {/* Multi-Role Authentication Modal */}
      <MultiRoleAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialRole="patient"
      />
    </>
  );
}
