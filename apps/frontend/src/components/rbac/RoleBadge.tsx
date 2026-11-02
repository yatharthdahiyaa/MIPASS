'use client';

import React from 'react';
import { useRBAC } from '@/context/RBACContext';
import { ROLE_DEFINITIONS } from '@/types/rbac';
import {
  ShieldCheck,
  Stethoscope,
  Activity,
  Cpu,
  FileCheck2,
  ChevronDown,
  Cloud,
} from 'lucide-react';

interface RoleBadgeProps {
  compact?: boolean;
  showPersona?: boolean;
  className?: string;
}

export default function RoleBadge({
  compact = false,
  showPersona = true,
  className = '',
}: RoleBadgeProps) {
  const { currentUser, setRBACModalOpen, isIamAuthenticated, iamUser } = useRBAC();
  const meta = ROLE_DEFINITIONS[currentUser.role];

  const getIcon = () => {
    switch (currentUser.role) {
      case 'admin':
        return <ShieldCheck className="h-3.5 w-3.5" style={{ color: meta.badgeColor }} />;
      case 'radiologist':
        return <Stethoscope className="h-3.5 w-3.5" style={{ color: meta.badgeColor }} />;
      case 'technician':
        return <Activity className="h-3.5 w-3.5" style={{ color: meta.badgeColor }} />;
      case 'researcher':
        return <Cpu className="h-3.5 w-3.5" style={{ color: meta.badgeColor }} />;
      case 'auditor':
        return <FileCheck2 className="h-3.5 w-3.5" style={{ color: meta.badgeColor }} />;
      default:
        return <ShieldCheck className="h-3.5 w-3.5" style={{ color: meta.badgeColor }} />;
    }
  };

  return (
    <button
      onClick={() => setRBACModalOpen(true)}
      title="Click to view RBAC permissions & switch clinical persona"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-[1.02] cursor-pointer ${className}`}
      style={{
        backgroundColor: meta.badgeBg,
        borderColor: meta.borderColor,
        borderWidth: 1,
        color: '#EAF2F6',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span className="flex items-center justify-center">{getIcon()}</span>
      <span className="font-semibold tracking-wide" style={{ color: meta.badgeColor }}>
        {meta.title}
      </span>
      {isIamAuthenticated && (
        <span
          className="inline-flex items-center gap-1 rounded bg-[#FF9900]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#FF9900] border border-[#FF9900]/40"
          title={`Authenticated via AWS IAM: ${iamUser?.accountName || 'AWS Cloud'}`}
        >
          <Cloud className="w-2.5 h-2.5" />
          {iamUser?.isRoot ? 'ROOT' : iamUser?.accountAlias || iamUser?.accountId?.slice(-4) || 'IAM'}
        </span>
      )}
      {showPersona && !compact && (
        <>
          <span className="opacity-40">|</span>
          <span className="text-gray-300 font-normal truncate max-w-[140px]">
            {currentUser.name}
          </span>
        </>
      )}
      <ChevronDown className="h-3 w-3 text-gray-400 opacity-70 group-hover:opacity-100" />
    </button>
  );
}
