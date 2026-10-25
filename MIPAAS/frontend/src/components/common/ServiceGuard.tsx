'use client';

import React from 'react';
import Link from 'next/link';
import { useServices } from '@/context/ServicesContext';
import { useRBAC } from '@/context/RBACContext';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Lock,
  PhoneCall,
  Activity,
  Layers,
} from 'lucide-react';

interface ServiceGuardProps {
  serviceId: string;
  children: React.ReactNode;
}

export default function ServiceGuard({ serviceId, children }: ServiceGuardProps) {
  const { getService, toggleServiceStatus, activeServices, isLoading } = useServices();
  const { hasRole, currentUser, isAuthenticated, setRBACModalOpen } = useRBAC();

  const service = getService(serviceId);
  const isAdmin = hasRole('admin');

  // 1. Mandatory Clinical Access Gate: Users MUST sign in to access diagnostic pathways
  if (!isLoading && (!isAuthenticated || !currentUser?.id)) {
    return (
      <div className="min-h-screen bg-[#060D14] text-slate-100 flex flex-col justify-between selection:bg-[#00DCCE] selection:text-black">
        {/* Top Bar */}
        <header className="border-b border-white/10 bg-[#081520]/80 backdrop-blur-md px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#00DCCE] to-[#008280] flex items-center justify-center font-bold text-white shadow-md group-hover:scale-105 transition-transform">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg leading-none">MiPAAS</span>
                <span className="text-[9px] uppercase tracking-wider text-gray-400">Healthcare AI</span>
              </div>
            </Link>

            <Link
              href={`/login?redirect=/${serviceId}`}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#00DCCE] to-[#008280] text-black font-bold text-xs shadow hover:brightness-110 transition-all flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          </div>
        </header>

        {/* Main Security Gate */}
        <main className="flex-1 max-w-2xl mx-auto px-6 py-16 flex flex-col items-center justify-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-teal-500/20 blur-xl animate-pulse" />
            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-[#00DCCE]/20 to-teal-900/30 border border-[#00DCCE]/30 flex items-center justify-center text-[#00DCCE] shadow-2xl">
              <Lock className="w-10 h-10" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-[#00DCCE] text-xs font-semibold uppercase tracking-wider mb-4">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Protected Clinical Pathway · Sign In Required</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
            {service?.name || 'Clinical Diagnostic Pathway'}
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-lg">
            Direct access to AI inference models, PACS DICOM upload pipelines, and diagnostic evaluations is restricted. Please sign in to your medical provider or patient account to access this pathway.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
            <Link
              href={`/login?redirect=/${serviceId}`}
              className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-[#00DCCE] to-[#008280] text-black font-bold text-sm shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In to Access Pathway</span>
            </Link>
            <Link
              href="/login"
              className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/15 font-semibold text-sm transition-all flex items-center justify-center"
            >
              <span>Create Account</span>
            </Link>
          </div>

          <Link
            href="/"
            className="mt-6 text-xs text-slate-400 hover:text-white transition-colors"
          >
            &larr; Return to MiPAAS Home
          </Link>
        </main>

        <footer className="border-t border-white/10 bg-[#081520]/80 py-4 text-center text-xs text-slate-500">
          MiPAAS HIPAA-Compliant Healthcare AI Platform
        </footer>
      </div>
    );
  }

  // If still loading or service not found or active, show children
  if (isLoading || !service || service.status === 'active') {
    return <>{children}</>;
  }

  // If the service is closed, but user is Admin: provide admin preview mode with action banner
  if (isAdmin) {
    return (
      <div className="relative">
        <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-950/95 via-[#1A1208]/95 to-amber-950/95 border-b border-amber-500/30 backdrop-blur-xl px-4 py-2.5 text-xs shadow-xl">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-amber-200">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="font-bold uppercase tracking-wider text-[11px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                Admin Bypass Active
              </span>
              <span className="text-amber-100">
                This service (<strong>{service.name}</strong>) is currently{' '}
                <span className="text-amber-400 font-semibold underline uppercase">Temporarily Closed</span> to public visitors.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleServiceStatus(service.id, 'active')}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Re-open Service Now</span>
              </button>
              <Link
                href="/admin"
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] flex items-center gap-1.5 border border-white/15 transition-all"
              >
                <Sliders className="w-3.5 h-3.5 text-[#00DCCE]" />
                <span>Admin Panel</span>
              </Link>
            </div>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // For maintenance / closed screen
  return (
    <div className="min-h-screen bg-[#060D14] text-slate-100 flex flex-col justify-between selection:bg-[#00DCCE] selection:text-black">
      {/* Top Bar */}
      <header className="border-b border-white/10 bg-[#081520]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#00DCCE] to-[#008280] flex items-center justify-center font-bold text-white shadow-md group-hover:scale-105 transition-transform">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg leading-none">MiPAAS</span>
              <span className="text-[9px] uppercase tracking-wider text-gray-400">Healthcare AI</span>
            </div>
          </Link>

          <div className="flex items-center gap-3 text-xs">
            {currentUser?.name && (
              <span className="text-gray-400 hidden sm:inline">Signed in: {currentUser.name} ({currentUser.role})</span>
            )}
            <button
              type="button"
              onClick={() => setRBACModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#00DCCE]" />
              <span>Admin Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Closed Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 md:py-20 w-full flex flex-col items-center text-center">
        {/* Radar Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-2xl">
            <ShieldAlert className="w-10 h-10" />
          </div>
        </div>

        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-4">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <span>Service Temporarily Closed for Maintenance</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4 max-w-2xl">
          {service.name}
        </h1>

        <p className="text-slate-300 text-base md:text-lg max-w-2xl leading-relaxed mb-8">
          This clinical AI diagnostic pathway is currently offline while laboratory administration conducts scheduled platform calibrations and model updates.
        </p>

        {/* Notice Card */}
        <div className="w-full bg-[#0A1823]/90 border border-amber-500/25 rounded-2xl p-6 sm:p-8 text-left shadow-2xl backdrop-blur-xl mb-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-5">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">
                Official Clinical Notice
              </span>
              <div className="text-white font-bold text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Routine Calibration &amp; Security Validation</span>
              </div>
            </div>

            {service.estimatedRestore && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
                <Clock className="w-3.5 h-3.5 text-[#00DCCE]" />
                <span>Estimated Reopening: <strong>{service.estimatedRestore}</strong></span>
              </div>
            )}
          </div>

          <p className="text-slate-200 text-sm leading-relaxed mb-4">
            {service.maintenanceNotice ||
              'Scheduled calibration of GPU cluster nodes and DICOM-SR inference pipelines. New uploads are paused to maintain data integrity.'}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5 text-xs text-gray-400">
            <div>
              <span>Modality: <strong className="text-slate-200">{service.modality}</strong></span>
              <span className="mx-2">•</span>
              <span>Last updated: {service.lastUpdated}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <PhoneCall className="w-3.5 h-3.5 text-[#00DCCE]" />
              <span>Urgent Triage Line: 1-800-MIPAAS-STAT</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
          <Link
            href="/"
            className="px-6 py-3 rounded-full bg-white text-slate-900 hover:bg-gray-100 font-bold text-sm flex items-center gap-2 transition-all shadow-lg hover:scale-105"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/15 flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#00DCCE]" />
            <span>Check Status Again</span>
          </button>
        </div>

        {/* Other Active Services */}
        {activeServices.length > 0 && (
          <div className="w-full text-left">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00DCCE]" />
                <span>Other Available AI Diagnostic Pathways</span>
              </h2>
              <span className="text-xs text-gray-400">
                {activeServices.length} modules currently operational
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeServices
                .filter((s) => s.id !== service.id)
                .slice(0, 3)
                .map((alt) => (
                  <Link
                    key={alt.id}
                    href={alt.href}
                    className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#00DCCE]/40 transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: alt.accent }}
                        />
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                          {alt.modality}
                        </span>
                      </div>
                      <h3 className="text-white font-bold text-sm group-hover:text-[#00DCCE] transition-colors truncate">
                        {alt.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {alt.tagline}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-[#00DCCE] font-semibold">
                      <span>Launch Suite</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-gray-500">
        <p>© {new Date().getFullYear()} MiPAAS Healthcare AI Platform • Laboratory Administration Governance</p>
      </footer>
    </div>
  );
}
