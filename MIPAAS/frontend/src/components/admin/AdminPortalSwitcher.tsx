'use client';

import React, { useState } from 'react';
import MultiLevelAdminPortal from '@/components/admin/MultiLevelAdminPortal';
import AdminPortal from '@/components/personas/AdminPortal';
import { Layers, Server } from 'lucide-react';

export default function AdminPortalSwitcher() {
  const [view, setView] = useState<'enterprise' | 'lab'>('enterprise');

  return (
    <div className="relative min-h-screen bg-[#0A1823]">
      {/* Top Banner Switcher */}
      <div className="sticky top-0 z-50 bg-[#071118]/90 backdrop-blur-md border-b border-white/10 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">Portal View:</span>
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
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
              <span>Multi-Level Enterprise Admin</span>
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
              <span>Lab PACS / Integration Hub</span>
            </button>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 hidden sm:block">
          MiPAAS Unified Administration Console
        </div>
      </div>

      {view === 'enterprise' ? <MultiLevelAdminPortal /> : <AdminPortal />}
    </div>
  );
}
