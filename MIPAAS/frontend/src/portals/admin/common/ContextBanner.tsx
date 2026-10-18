import React from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import {
  AlertOctagon,
  Building,
  CheckCircle,
  Clock,
  Globe,
  MapPin,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

export default function ContextBanner() {
  const {
    session,
    activeOrg,
    activeSite,
    activeRole,
    elevatedAccessMinutesRemaining,
    cancelElevatedAccess,
    language,
  } = useMultiLevelAdmin();

  const isElevated = session.elevatedAccess?.isActive && elevatedAccessMinutesRemaining > 0;

  return (
    <div className="w-full flex flex-col font-sans select-none border-b border-white/10">
      {/* 1. Red Elevated Break-Glass Countdown Banner (If active) */}
      {isElevated && (
        <div
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm font-semibold text-white animate-pulse"
          style={{
            background: 'linear-gradient(90deg, #991B1B 0%, #DC2626 50%, #991B1B 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.25)',
          }}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-1 rounded bg-black/30">
              <ShieldAlert className="w-4 h-4 text-white" />
            </span>
            <span className="uppercase tracking-wider font-bold text-yellow-300">
              {language === 'HI' ? 'आपातकालीन एलिवेटेड एक्सेस सक्रिय' : 'EMERGENCY BREAK-GLASS ACTIVE'}
            </span>
            <span className="hidden sm:inline text-white/70">|</span>
            <span className="truncate max-w-md font-normal text-white/95">
              {session.elevatedAccess?.reason} ({session.elevatedAccess?.ticketId})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full text-yellow-200 font-mono font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>{elevatedAccessMinutesRemaining}m remaining</span>
            </div>
            <button
              onClick={cancelElevatedAccess}
              className="px-2.5 py-1 rounded bg-white text-red-900 font-bold text-xs hover:bg-gray-100 transition-colors shadow flex items-center gap-1"
              title="Terminate elevated privileges and restore standard RBAC limits"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Relinquish</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Persistent Context Banner: Current Tenant & Hierarchy Scope */}
      <div
        className="w-full px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-[#A6B3BD] flex-wrap gap-2"
        style={{
          backgroundColor: '#0E273A',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/50 font-medium">Tenant Context:</span>

          {/* Level 0 indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-medium">
            <Globe className="w-3 h-3 text-[#00DCCE]" />
            <span>MIPaaS Healthcare Cloud</span>
          </div>

          <span className="text-white/30">/</span>

          {/* Organisation */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-semibold">
            <Building className="w-3 h-3 text-[#7C5CFC]" />
            <span className="text-[#EAF2F6]">{activeOrg.name}</span>
            <span className="text-[10px] text-[#A6B3BD] font-mono">({activeOrg.code})</span>
          </div>

          <span className="text-white/30">/</span>

          {/* Site */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-medium">
            <MapPin className="w-3 h-3 text-[#F5A623]" />
            <span className="text-gray-200">{activeSite.name}</span>
            <span className="text-[10px] text-teal-400 font-mono">[{activeSite.pacsAeTitle}]</span>
          </div>
        </div>

        {/* User Scope & Persona Summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <span className="text-white/40">Role:</span>
            <span className="font-semibold text-white">{activeRole.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#008280]/30 text-[#73C8BF] border border-[#008280]/50">
              {activeRole.levelLabel.split('·')[0]}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>MFA Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
