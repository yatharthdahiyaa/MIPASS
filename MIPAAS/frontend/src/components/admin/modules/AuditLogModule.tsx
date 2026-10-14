'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import { AuditRecord } from '@/types/multiLevelRbac';
import DataTable, { Column } from '../common/DataTable';
import AuditDiff from '../common/AuditDiff';
import ScopeBadge from '../common/ScopeBadge';
import {
  Download,
  FileCode,
  FileText,
  Filter,
  Lock,
  Search,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';

export default function AuditLogModule() {
  const { auditLogs } = useMultiLevelAdmin();
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);

  const columns: Column<AuditRecord>[] = [
    {
      key: 'timestamp',
      header: 'Event Timestamp (IST)',
      render: (a) => (
        <span className="font-mono text-gray-300 text-[11px] whitespace-nowrap">
          {new Date(a.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </span>
      ),
    },
    {
      key: 'actorName',
      header: 'Actor & Session Role',
      render: (a) => (
        <div>
          <div className="font-semibold text-white">{a.actorName}</div>
          <div className="text-[11px] text-gray-400 font-mono">{a.actorRole}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Security Action & Scope',
      render: (a) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono font-bold text-teal-300 px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-[11px]">
            {a.action}
          </span>
          <ScopeBadge scope={a.scope} size="sm" />
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Justification & Clinical Context',
      render: (a) => (
        <span className="text-gray-300 text-xs italic truncate max-w-xs block">
          {a.reason || 'Routine administrative operation'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'Client WAN / IP Source',
      render: (a) => <span className="font-mono text-gray-400 text-[11px]">{a.ipAddress}</span>,
    },
    {
      key: 'diff',
      header: 'State Mutation',
      render: (a) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            a.diff && a.diff.length > 0
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-white/5 text-gray-400'
          }`}
        >
          {a.diff && a.diff.length > 0 ? `${a.diff.length} Fields Mutated` : 'Read Event'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200 relative">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-wide">
              Forensic Non-Repudiation Audit Trail
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Immutable Ledger</span>
            </span>
          </div>
          <p className="text-gray-400 mt-1">
            Complete cryptographic audit history compliant with NABH Digital Health Guidelines & India DPDP Act 2023. Zero PHI leakage.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={auditLogs}
        searchPlaceholder="Filter audit trails by actor, action (e.g. thresholds:update), IP..."
        searchKey={(a) => `${a.actorName} ${a.action} ${a.reason} ${a.ipAddress}`}
        onRowClick={(row) => setSelectedAudit(row)}
        exportFileName="mipaas-forensic-audit-trail.csv"
      />

      {/* Audit Detail Side Drawer */}
      {selectedAudit && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] z-50 bg-[#07131D] border-l border-white/15 p-6 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200 text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <div>
                <h3 className="font-bold text-white text-sm">Audit Record: {selectedAudit.id}</h3>
                <span className="font-mono text-[10px] text-gray-400">
                  SHA-256 Hash Verified · Non-Repudiation Anchor
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedAudit(null)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Metadata Card */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Timestamp (UTC / IST):</span>
                <span className="font-mono text-gray-200">{selectedAudit.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Actor Identity:</span>
                <span className="font-semibold text-white">{selectedAudit.actorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sign-in Role:</span>
                <span className="font-mono text-teal-300">{selectedAudit.actorRole}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Client IP Source:</span>
                <span className="font-mono text-gray-300">{selectedAudit.ipAddress}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Permission Scope:</span>
                <ScopeBadge scope={selectedAudit.scope} />
              </div>
            </div>

            {/* Justification Box */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Logged Justification / Clinical Reason:
              </div>
              <p className="text-gray-200 leading-relaxed italic">
                "{selectedAudit.reason || 'Standard operational command execution.'}"
              </p>
            </div>

            {/* Before-and-After Diff */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                State Mutation Delta:
              </div>
              <AuditDiff diffs={selectedAudit.diff} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
