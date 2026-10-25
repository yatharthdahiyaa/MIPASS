'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import InteractiveEarth from './InteractiveEarth';
import FeatureCards from './FeatureCards';
import CareviaDashboardPreview from './CareviaDashboardPreview';
import MultiRoleAuthModal from '@/components/auth/MultiRoleAuthModal';
import { useRBAC } from '@/context/RBACContext';
import { useIndicLanguage } from '@/context/IndicLanguageContext';

export default function MIPAASHero() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { isAuthenticated } = useRBAC();
  const { t } = useIndicLanguage();

  return (
    <>
      <section className="relative w-full bg-transparent overflow-hidden pt-6 sm:pt-10 pb-16">
        {/* Readability scrims: the sky imagery behind the hero is very bright */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-slate-950/50 [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)] lg:hidden"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-[700px] bg-gradient-to-r from-slate-950/70 via-slate-950/45 to-slate-950/10 [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)] lg:block"
        />

        {/* Soft atmospheric daylight radial glow */}
        <div className="absolute top-1/4 right-[10%] w-[600px] h-[600px] bg-white/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-[-5%] w-[500px] h-[500px] bg-sky-200/20 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center min-h-[540px]">
            {/* Left Column: Hero Typography & Actions */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Eyebrow / Social Proof Pill: "6k+ happy users" with avatar cluster */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-950/35 backdrop-blur-md border border-white/30 shadow-xs text-white">
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
                  {t('hero_eyebrow')}
                </span>
              </div>

              {/* Main Headline */}
              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold text-white tracking-tight leading-[1.12] drop-shadow-sm">
                  {t('hero_headline')}
                </h1>
              </div>

              {/* Supporting Text */}
              <p className="text-sm sm:text-base text-white max-w-xl font-normal leading-relaxed drop-shadow-md">
                {t('hero_subtext')}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {/* Primary Button: Dark Pill */}
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-6 sm:px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white font-bold text-sm sm:text-base shadow-lg shadow-black/15 transition-all cursor-pointer flex items-center gap-2 group hover:scale-[1.02]"
                >
                  <span>{t('hero_get_started')}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Secondary Button: White Pill */}
                <a
                  href="#features"
                  className="px-6 sm:px-7 py-3 rounded-full bg-white hover:bg-slate-50 text-[#111827] font-bold text-sm sm:text-base shadow-md transition-all flex items-center gap-2 group hover:scale-[1.02]"
                >
                  <span>{t('hero_explore_pathways')}</span>
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
