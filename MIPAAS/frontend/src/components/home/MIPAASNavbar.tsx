'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRBAC } from '@/context/RBACContext';
import { Search, Menu, X, ArrowRight, Activity, Heart, Stethoscope, ShieldCheck, LogOut } from 'lucide-react';
import MultiRoleAuthModal from '@/components/auth/MultiRoleAuthModal';
import { useIndicLanguage } from '@/context/IndicLanguageContext';
import IndicLanguageSelector from '@/components/common/IndicLanguageSelector';

export default function MIPAASNavbar() {
  const { currentUser, isAuthenticated, logout } = useRBAC();
  const { t } = useIndicLanguage();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Strictly gate portal visibility on authentication state:
  const isDoctor = isAuthenticated && (currentUser?.role === 'doctor' || currentUser?.role === 'radiologist');
  const isPatient = isAuthenticated && currentUser?.role === 'patient';
  const isAdmin = isAuthenticated && currentUser?.role === 'admin';

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-slate-950/45 backdrop-blur-md border-b border-white/20 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600/90 border border-white/40 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform backdrop-blur-xs">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-xs">
              MiPAAS
            </span>
          </Link>

          {/* Centered Frosted Capsule Pill Navigation */}
          <nav className="hidden lg:flex items-center gap-6 px-6 py-2 rounded-full bg-slate-950/30 backdrop-blur-md border border-white/25 shadow-sm text-sm font-semibold text-white">
            <Link href="#solutions" className="hover:text-blue-100 transition-colors">{t('nav_solutions')}</Link>
            <Link href="#features" className="hover:text-blue-100 transition-colors">{t('nav_features')}</Link>
            <Link href="#product" className="hover:text-blue-100 transition-colors">{t('nav_product')}</Link>
            <Link href="#pricing" className="hover:text-blue-100 transition-colors">{t('nav_updates')}</Link>
          </nav>

          {/* Right Area: Language Mode, Log In & CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Indian Language Selector */}
            <IndicLanguageSelector />

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {isDoctor ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/doctor"
                    className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>{t('nav_doctor_workstation')}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-2 text-white/80 hover:text-white rounded-full text-xs cursor-pointer"
                    title={t('nav_sign_out')}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : isPatient ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/patient"
                    className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Heart className="w-3.5 h-3.5 fill-white" />
                    <span>{t('nav_patient_portal')}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-2 text-white/80 hover:text-white rounded-full text-xs cursor-pointer"
                    title={t('nav_sign_out')}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : isAdmin ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/admin"
                    className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t('nav_admin_console')}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-2 text-white/80 hover:text-white rounded-full text-xs cursor-pointer"
                    title={t('nav_sign_out')}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="text-white hover:text-blue-100 font-bold text-sm px-3 py-2 cursor-pointer transition-colors"
                  >
                    {t('nav_login')}
                  </button>
                  <a
                    href="#contact"
                    className="px-5 py-2.5 rounded-full bg-[#111827] hover:bg-black text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{t('nav_request_demo')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-xl border border-white/20"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-sky-900/90 backdrop-blur-xl border-b border-white/20 p-5 space-y-4 animate-in fade-in text-white">
            <nav className="flex flex-col space-y-3 text-sm font-medium">
              <Link href="#solutions" onClick={() => setMobileMenuOpen(false)} className="hover:text-blue-200">{t('nav_solutions')}</Link>
              <Link href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-blue-200">{t('nav_features')}</Link>
              <Link href="#product" onClick={() => setMobileMenuOpen(false)} className="hover:text-blue-200">{t('nav_product')}</Link>
              <Link href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-blue-200">{t('nav_updates')}</Link>
            </nav>

            <div className="pt-3 border-t border-white/10 space-y-2">
              {isDoctor && (
                <Link
                  href="/doctor"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-[#0F9D9A] text-white font-bold text-sm text-center flex items-center justify-center gap-2"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>{t('nav_doctor_workstation')}</span>
                </Link>
              )}
              {isPatient && (
                <Link
                  href="/patient"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-[#0F9D9A] text-white font-bold text-sm text-center flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>{t('nav_patient_portal')}</span>
                </Link>
              )}
              {!isDoctor && !isPatient && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#16d9f5] to-[#26e6cf] text-[#020b14] font-bold text-sm text-center shadow-md cursor-pointer"
                >
                  {t('nav_login')}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Multi-Role Authentication Modal */}
      <MultiRoleAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialRole="patient"
      />
    </>
  );
}
