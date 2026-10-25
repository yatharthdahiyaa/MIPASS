'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import MultiLevelAdminPortal from '@/components/admin/MultiLevelAdminPortal';
import AdminPortal from '@/components/personas/AdminPortal';
import { Layers, Server, ShieldAlert, Lock } from 'lucide-react';
import { useRBAC } from '@/context/RBACContext';
import { useIndicLanguage } from '@/context/IndicLanguageContext';
import IndicLanguageSelector from '@/components/common/IndicLanguageSelector';

export default function AdminPortalSwitcher() {
  const [view, setView] = useState<'enterprise' | 'lab'>('enterprise');
  const { currentUser, isAuthenticated, isSessionReady } = useRBAC();
  const { t } = useIndicLanguage();

  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-[#071118] text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
          <span>Verifying administrator session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser?.id) {
    return (
      <div className="min-h-screen bg-[#071118] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0B1724] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-[#00DCCE] mx-auto flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-teal-500/20 text-[#00DCCE] text-xs font-bold uppercase tracking-wider">
              Administration Console
            </span>
            <h2 className="text-2xl font-black text-white mt-3">
              Administrator Sign In Required
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Access to enterprise organizations, PACS AE routing, system telemetry, and audit logs requires administrator privileges.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/admin"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#00DCCE] to-[#008280] text-black font-bold text-sm shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In as Administrator</span>
            </Link>
            <Link
              href="/"
              className="block text-xs text-slate-400 hover:text-white transition-colors pt-2"
            >
              Return to MiPAAS Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#071118] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0B1724] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
              Access Restricted
            </span>
            <h2 className="text-2xl font-black text-white mt-3">
              Administrator Role Required
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              You are currently signed in as <strong className="text-white">{currentUser.name}</strong> ({currentUser.role}). This console is restricted to system administrators.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Link
              href="/"
              className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Return to MiPAAS Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0A1823]">
      {/* Top Banner Switcher */}
      <div className="sticky top-0 z-50 bg-[#071118]/90 backdrop-blur-md border-b border-white/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="hidden text-xs font-semibold text-gray-400 sm:inline">{t('Portal View:')}</span>
          <div className="flex max-w-full items-center overflow-x-auto bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setView('enterprise')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                view === 'enterprise'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('admin_enterprise_view', 'Multi-Level Enterprise Admin')}</span>
            </button>
            <button
              type="button"
              onClick={() => setView('lab')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                view === 'lab'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>{t('admin_lab_view', 'Lab PACS / Integration Hub')}</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <IndicLanguageSelector />
          </div>
          <div className="text-[11px] text-gray-400 hidden lg:block">
            {t('admin_portal_title', 'MiPAAS Unified Administration Console')}
          </div>
        </div>
      </div>

      {view === 'enterprise' ? <MultiLevelAdminPortal /> : <AdminPortal />}
    </div>
  );
}
