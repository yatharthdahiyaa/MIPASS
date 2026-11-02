'use client';

import React, { useState } from 'react';
import { useRBAC } from '@/context/RBACContext';
import {
  CLINICAL_PERSONAS,
  Permission,
  Role,
  ROLE_DEFINITIONS,
} from '@/types/rbac';
import {
  ShieldCheck,
  Stethoscope,
  Activity,
  Cpu,
  FileCheck2,
  X,
  Check,
  Minus,
  Lock,
  Unlock,
  Building,
  User,
  History,
  TableProperties,
  Sparkles,
} from 'lucide-react';

const ALL_PERMISSIONS: { key: Permission; label: string; category: string }[] = [
  // Jobs
  { key: 'jobs:create', label: 'Upload DICOM & Create Jobs', category: 'Pipeline & Jobs' },
  { key: 'jobs:read', label: 'View Own Job Results', category: 'Pipeline & Jobs' },
  { key: 'jobs:read_all', label: 'System-Wide Jobs Access', category: 'Pipeline & Jobs' },
  { key: 'jobs:delete', label: 'Cancel & Delete Jobs', category: 'Pipeline & Jobs' },

  // Clinical & XAI
  { key: 'results:read', label: 'Read AI Predictions & Probabilities', category: 'Clinical & XAI' },
  { key: 'xai:read', label: 'Grad-CAM++ & Feature Attributions', category: 'Clinical & XAI' },
  { key: 'reports:sign', label: 'Clinically Validate & Sign Reports', category: 'Clinical & XAI' },
  { key: 'reports:export', label: 'Export PDF & DICOM-SR Reports', category: 'Clinical & XAI' },

  // Models & Research
  { key: 'models:read', label: 'Inspect Model Registry & Versions', category: 'Models & Governance' },
  { key: 'models:manage', label: 'Manage Model Checkpoints & Config', category: 'Models & Governance' },
  { key: 'models:benchmark', label: 'Run Cohort Benchmarks & Sweeps', category: 'Models & Governance' },

  // Admin & Compliance
  { key: 'users:manage', label: 'User Role Administration', category: 'Security & Compliance' },
  { key: 'audit:read', label: 'HIPAA & Access Audit Logs', category: 'Security & Compliance' },
  { key: 'phi:read', label: 'Access Unmasked PHI (Patient ID/MRN)', category: 'Security & Compliance' },
];

export default function RBACModal() {
  const {
    currentUser,
    switchPersona,
    isRBACModalOpen,
    setRBACModalOpen,
    auditLogs,
  } = useRBAC();

  const [activeTab, setActiveTab] = useState<'overview' | 'matrix' | 'audit' | 'personas'>('overview');

  if (!isRBACModalOpen) return null;

  const currentMeta = ROLE_DEFINITIONS[currentUser.role];

  const getRoleIcon = (role: Role, size = 4) => {
    const className = `h-${size} w-${size}`;
    switch (role) {
      case 'admin':
        return <ShieldCheck className={className} style={{ color: '#F5A623' }} />;
      case 'radiologist':
        return <Stethoscope className={className} style={{ color: '#7C5CFC' }} />;
      case 'technician':
        return <Activity className={className} style={{ color: '#00DCCE' }} />;
      case 'researcher':
        return <Cpu className={className} style={{ color: '#FF7869' }} />;
      case 'auditor':
        return <FileCheck2 className={className} style={{ color: '#98AED9' }} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={() => setRBACModalOpen(false)}
      />

      {/* Modal Dialog */}
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl overflow-hidden text-[#EAF2F6] z-10"
        style={{
          backgroundColor: '#0A1823',
          borderColor: 'rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#060B11]/50">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl border flex items-center justify-center"
              style={{
                backgroundColor: currentMeta.badgeBg,
                borderColor: currentMeta.borderColor,
              }}
            >
              {getRoleIcon(currentUser.role, 5)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-bold tracking-tight font-sans">
                  Role-Based Access Control (RBAC)
                </h2>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#00DCCE]/10 text-[#00DCCE] border border-[#00DCCE]/20">
                  HIPAA Enforced
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Least-privilege permission matrix and audit trail for clinical medical imaging
              </p>
            </div>
          </div>

          <button
            onClick={() => setRBACModalOpen(false)}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Active Persona Strip */}
        <div className="px-6 py-3.5 bg-[#0E273A]/60 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-gray-400">
              <User className="h-3.5 w-3.5" />
              <span>Active Persona:</span>
            </div>
            <span className="font-semibold text-white">{currentUser.name}</span>
            <span
              className="font-medium px-2 py-0.5 rounded-full text-[11px]"
              style={{
                backgroundColor: currentMeta.badgeBg,
                color: currentMeta.badgeColor,
                border: `1px solid ${currentMeta.borderColor}`,
              }}
            >
              {currentMeta.title}
            </span>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
            <div className="flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" />
              <span>{currentUser.department}</span>
            </div>
            <button
              onClick={() => setActiveTab('personas')}
              className="text-[#00DCCE] hover:underline font-medium cursor-pointer"
            >
              Switch Role &rarr;
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 px-6 bg-[#060B11]/30">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-4 text-xs md:text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[#00DCCE] text-[#00DCCE]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Active Capabilities</span>
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 py-3 px-4 text-xs md:text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'matrix'
                ? 'border-[#00DCCE] text-[#00DCCE]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <TableProperties className="h-4 w-4" />
            <span>Full RBAC Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 py-3 px-4 text-xs md:text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-[#00DCCE] text-[#00DCCE]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('personas')}
            className={`flex items-center gap-2 py-3 px-4 text-xs md:text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'personas'
                ? 'border-[#00DCCE] text-[#00DCCE]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Switch Personas</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div
                className="p-5 rounded-2xl border text-left"
                style={{
                  backgroundColor: currentMeta.badgeBg,
                  borderColor: currentMeta.borderColor,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider" style={{ color: currentMeta.badgeColor }}>
                    Active Role Responsibilities
                  </span>
                  <span className="text-xs text-gray-400">
                    {currentUser.permissions.length} Granted Permissions
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {currentMeta.title}
                </h3>
                <p className="text-xs md:text-sm text-gray-300 mt-1 leading-relaxed">
                  {currentMeta.description}
                </p>
              </div>

              {/* Categorized Permissions Grid */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase font-semibold text-gray-400 tracking-wider">
                  Granted Capabilities by Domain
                </h4>

                {['Pipeline & Jobs', 'Clinical & XAI', 'Models & Governance', 'Security & Compliance'].map((cat) => {
                  const permsInCat = ALL_PERMISSIONS.filter((p) => p.category === cat);
                  return (
                    <div key={cat} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
                      <div className="text-xs font-semibold text-gray-300">{cat}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {permsInCat.map((p) => {
                          const isGranted =
                            currentUser.role === 'admin' ||
                            currentUser.permissions.includes(p.key) ||
                            (p.key === 'jobs:read' && currentUser.permissions.includes('jobs:read_all'));

                          return (
                            <div
                              key={p.key}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${
                                isGranted
                                  ? 'bg-[#00DCCE]/5 border-[#00DCCE]/25 text-white'
                                  : 'bg-white/[0.01] border-white/5 text-gray-500'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isGranted ? (
                                  <Unlock className="h-3.5 w-3.5 text-[#00DCCE]" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5 text-gray-600" />
                                )}
                                <span className={isGranted ? 'font-medium' : 'line-through opacity-70'}>
                                  {p.label}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono opacity-60">
                                {p.key}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: RBAC MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 flex items-center justify-between">
                <span>Clinical & Governance Roles vs Permissions Matrix</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[#00DCCE]">
                    <Check className="h-3.5 w-3.5" /> Granted
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <Minus className="h-3.5 w-3.5" /> Restricted
                  </span>
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#060B11]/50">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="p-3.5 font-semibold text-gray-300 min-w-[200px]">Permission</th>
                      <th className="p-3.5 text-center font-semibold text-[#7C5CFC]">Radiologist</th>
                      <th className="p-3.5 text-center font-semibold text-[#00DCCE]">Technician</th>
                      <th className="p-3.5 text-center font-semibold text-[#FF7869]">Researcher</th>
                      <th className="p-3.5 text-center font-semibold text-[#F5A623]">Admin</th>
                      <th className="p-3.5 text-center font-semibold text-[#98AED9]">Auditor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ALL_PERMISSIONS.map((perm) => (
                      <tr
                        key={perm.key}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="p-3 text-gray-200">
                          <div className="font-medium">{perm.label}</div>
                          <div className="text-[10px] font-mono text-gray-500">{perm.key}</div>
                        </td>

                        {(['radiologist', 'technician', 'researcher', 'admin', 'auditor'] as Role[]).map((r) => {
                          const rolePerms = ROLE_DEFINITIONS[r].permissions;
                          const granted =
                            r === 'admin' ||
                            rolePerms.includes(perm.key) ||
                            (perm.key === 'jobs:read' && rolePerms.includes('jobs:read_all'));
                          const isCurrentRole = currentUser.role === r;

                          return (
                            <td
                              key={r}
                              className={`p-3 text-center ${
                                isCurrentRole ? 'bg-white/[0.04]' : ''
                              }`}
                            >
                              {granted ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#00DCCE]/15 text-[#00DCCE] border border-[#00DCCE]/30">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/5 text-gray-600">
                                  <Minus className="h-3 w-3" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Recent System & Security Audit Events (HIPAA Log)</span>
                <span className="text-[11px] font-mono text-[#00DCCE]">
                  Real-Time Access Stream
                </span>
              </div>

              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-mono"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.decision === 'allow'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.decision}
                      </span>
                      <div>
                        <div className="text-white font-medium">
                          {log.action} &rarr; <span className="text-gray-400">{log.resource}</span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          User: <span className="text-gray-300">{log.userName}</span> ({log.role})
                        </div>
                      </div>
                    </div>

                    <div className="text-gray-500 text-[11px] sm:text-right flex-shrink-0">
                      {log.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SWITCH PERSONAS */}
          {activeTab === 'personas' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400">
                Select a clinical persona below to immediately preview and test the MiPAAS interface under their role.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {Object.values(CLINICAL_PERSONAS).map((persona) => {
                  const pMeta = ROLE_DEFINITIONS[persona.role];
                  const isSelected = currentUser.id === persona.id;

                  return (
                    <div
                      key={persona.id}
                      onClick={() => {
                        switchPersona(persona.id);
                        setActiveTab('overview');
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative overflow-hidden group hover:scale-[1.01] ${
                        isSelected
                          ? 'border-white/40 ring-1 ring-white/20'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                      style={{
                        backgroundColor: isSelected ? pMeta.badgeBg : '#060B11',
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          {getRoleIcon(persona.role, 5)}
                          <div>
                            <div className="font-bold text-white text-sm">
                              {persona.name}
                            </div>
                            <div
                              className="text-xs font-semibold"
                              style={{ color: pMeta.badgeColor }}
                            >
                              {pMeta.title}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#00DCCE] bg-[#00DCCE]/15 px-2 py-0.5 rounded-full border border-[#00DCCE]/30">
                            Active
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                        {pMeta.description}
                      </p>

                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                        <span>{persona.department}</span>
                        <span className="text-[#00DCCE] group-hover:translate-x-1 transition-transform">
                          {isSelected ? 'Currently Selected' : 'Switch &rarr;'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#060B11]/50 flex items-center justify-between text-xs text-gray-400">
          <span>MiPAAS Role-Based Access Control • Active Policy v2.4</span>
          <button
            onClick={() => setRBACModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
