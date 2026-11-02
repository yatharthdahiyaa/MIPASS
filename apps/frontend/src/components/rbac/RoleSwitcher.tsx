'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRBAC } from '@/context/RBACContext';
import { CLINICAL_PERSONAS, ROLE_DEFINITIONS, Role } from '@/types/rbac';
import {
  ShieldCheck,
  Stethoscope,
  Activity,
  Cpu,
  FileCheck2,
  ChevronDown,
  Check,
  Sliders,
} from 'lucide-react';

export default function RoleSwitcher() {
  const { currentUser, switchPersona, setRBACModalOpen } = useRBAC();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const meta = ROLE_DEFINITIONS[currentUser.role];

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck className="h-4 w-4 text-[#F5A623]" />;
      case 'radiologist':
        return <Stethoscope className="h-4 w-4 text-[#7C5CFC]" />;
      case 'technician':
        return <Activity className="h-4 w-4 text-[#00DCCE]" />;
      case 'researcher':
        return <Cpu className="h-4 w-4 text-[#FF7869]" />;
      case 'auditor':
        return <FileCheck2 className="h-4 w-4 text-[#98AED9]" />;
      default:
        return <ShieldCheck className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs md:text-sm font-medium transition-all duration-200 border hover:border-white/20 cursor-pointer shadow-sm"
        style={{
          backgroundColor: '#091927',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          color: '#EAF2F6',
        }}
        aria-label="Active Role & Persona Selector"
      >
        <span className="flex items-center justify-center">{getRoleIcon(currentUser.role)}</span>
        <div className="flex flex-col text-left">
          <span className="font-semibold text-xs leading-tight" style={{ color: meta.badgeColor }}>
            {meta.title}
          </span>
          <span className="text-[11px] text-gray-400 font-normal leading-tight hidden sm:inline">
            {currentUser.name.split(',')[0]}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-2xl border p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{
            backgroundColor: '#0A1823',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Active Persona & Role
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
              RBAC v2.4
            </span>
          </div>

          <div className="py-1.5 space-y-1">
            {Object.values(CLINICAL_PERSONAS).map((persona) => {
              const pMeta = ROLE_DEFINITIONS[persona.role];
              const isSelected = currentUser.id === persona.id;

              return (
                <button
                  key={persona.id}
                  onClick={() => {
                    switchPersona(persona.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-white/10 ring-1 ring-white/15'
                      : 'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{getRoleIcon(persona.role)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-white truncate">
                        {persona.name}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-[#00DCCE] flex-shrink-0" />}
                    </div>
                    <div
                      className="text-[11px] font-medium truncate"
                      style={{ color: pMeta.badgeColor }}
                    >
                      {pMeta.title}
                    </div>
                    <div className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                      {pMeta.shortDesc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 mt-1 border-t border-white/5 px-1">
            <button
              onClick={() => {
                setIsOpen(false);
                setRBACModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-[#00DCCE] hover:bg-[#00DCCE]/10 transition-colors cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Open RBAC Matrix & Audit Console</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
