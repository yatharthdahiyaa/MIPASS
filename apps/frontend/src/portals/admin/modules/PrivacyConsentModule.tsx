'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import DataTable, { Column } from '../common/DataTable';
import SensitiveActionModal from '../common/SensitiveActionModal';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Lock,
  RotateCcw,
  Scale,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
} from 'lucide-react';

interface ConsentRecord {
  id: string;
  syntheticPatientId: string;
  purpose: string;
  consentState: 'granted' | 'withdrawn' | 'statutory_retained';
  timestamp: string;
  channel: 'OPD_Biometric' | 'SMS_OTP' | 'ABDM_Gateway';
  retentionUntil: string;
}

interface ErasureRequest {
  id: string;
  syntheticPatientId: string;
  requestedAt: string;
  status: 'completed_with_exemptions' | 'pending_verification' | 'rejected';
  erasedData: string;
  retainedData: string;
  legalExemptionBasis: string;
}

export default function PrivacyConsentModule() {
  const { activeOrg, hasPermission, addAuditLog } = useMultiLevelAdmin();

  const [activeTab, setActiveTab] = useState<'consent' | 'erasure' | 'breaches'>('consent');

  const [consentRecords] = useState<ConsentRecord[]>([
    {
      id: 'cns_901',
      syntheticPatientId: 'P-0001',
      purpose: 'Primary Clinical Diagnostic Interpretation (Mandatory)',
      consentState: 'granted',
      timestamp: '2026-10-13 11:20 IST',
      channel: 'ABDM_Gateway',
      retentionUntil: '2029-10-13 (NMC 3-Yr Rule)',
    },
    {
      id: 'cns_902',
      syntheticPatientId: 'P-0042',
      purpose: 'Secondary Research Benchmarking & Model Calibration',
      consentState: 'withdrawn',
      timestamp: '2026-10-12 16:04 IST',
      channel: 'SMS_OTP',
      retentionUntil: 'Erased immediately upon withdrawal',
    },
    {
      id: 'cns_903',
      syntheticPatientId: 'P-0108',
      purpose: 'Cross-Branch Tele-Radiology Second Opinion',
      consentState: 'granted',
      timestamp: '2026-10-11 09:30 IST',
      channel: 'OPD_Biometric',
      retentionUntil: '2029-10-11 (NMC 3-Yr Rule)',
    },
  ]);

  const [erasureRequests, setErasureRequests] = useState<ErasureRequest[]>([
    {
      id: 'ers_440',
      syntheticPatientId: 'P-0089',
      requestedAt: '2026-10-10 14:15 IST',
      status: 'completed_with_exemptions',
      erasedData: 'Direct patient phone, address, Aadhaar/ABHA ID token',
      retainedData: 'Raw DICOM CT study pixel matrix pseudonymized as P-0089',
      legalExemptionBasis: 'National Medical Commission (NMC) Regulations Sec 1.3.2 mandatory 3-year statutory imaging archive retention',
    },
  ]);

  const [selectedErasureTarget, setSelectedErasureTarget] = useState<string | null>(null);
  const [erasureModalOpen, setErasureModalOpen] = useState(false);

  const canExecuteErasure = hasPermission('privacy_consent', 'update', 'organisation');

  const handleErasureConfirm = (reason: string) => {
    if (!selectedErasureTarget) return;

    const newReq: ErasureRequest = {
      id: `ers_${Date.now()}`,
      syntheticPatientId: selectedErasureTarget,
      requestedAt: new Date().toLocaleString(),
      status: 'completed_with_exemptions',
      erasedData: 'Personal identifiers, contact coordinates, demographic tags',
      retainedData: 'Raw DICOM imaging study pseudonymized',
      legalExemptionBasis: 'NMC 3-year statutory medical records mandate',
    };

    setErasureRequests([newReq, ...erasureRequests]);
    addAuditLog({
      action: 'privacy_consent:execute_erasure',
      resource: 'privacy_consent',
      scope: 'organisation',
      reason: `Executed statutory DPDP Act 2023 right to erasure for ${selectedErasureTarget}. Reason: ${reason}`,
    });
  };

  const consentColumns: Column<ConsentRecord>[] = [
    {
      key: 'syntheticPatientId',
      header: 'Patient Token',
      render: (c) => <span className="font-mono font-bold text-white">{c.syntheticPatientId}</span>,
    },
    {
      key: 'purpose',
      header: 'Specified Processing Purpose',
      render: (c) => <span className="text-gray-200 font-medium">{c.purpose}</span>,
    },
    {
      key: 'consentState',
      header: 'Consent Status',
      render: (c) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            c.consentState === 'granted'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : c.consentState === 'withdrawn'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-white/5 text-gray-300'
          }`}
        >
          {c.consentState}
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'Consent Gateway Channel',
      render: (c) => (
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-teal-300 font-mono text-[11px]">
          {c.channel}
        </span>
      ),
    },
    {
      key: 'retentionUntil',
      header: 'Statutory Retention Expiry',
      render: (c) => <span className="text-gray-400 font-mono text-[11px]">{c.retentionUntil}</span>,
    },
  ];

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            India DPDP Act 2023 Compliance & Consent Ledger
          </h1>
          <p className="text-gray-400 mt-1">
            Data Protection Officer (DPO) governance: purpose limitation, withdrawal records, and NMC statutory erasure exemptions.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('consent')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'consent'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Consent Purposes ({consentRecords.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('erasure')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'erasure'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Right to Erasure ({erasureRequests.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('breaches')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'breaches'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Breach & Security Incidents (0)</span>
          </button>
        </div>
      </div>

      {activeTab === 'consent' ? (
        <DataTable
          columns={consentColumns}
          data={consentRecords}
          searchPlaceholder="Filter consent ledgers by patient token or purpose..."
          searchKey={(c) => `${c.syntheticPatientId} ${c.purpose} ${c.channel}`}
          exportFileName="mipaas-dpdp-consent-ledger.csv"
        />
      ) : activeTab === 'erasure' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              India DPDP Act 2023 Sec 12 specifies the Right to Correction & Erasure, balanced with the{' '}
              <strong className="text-white">National Medical Commission (NMC)</strong> 3-year statutory medical record requirement.
            </div>

            {canExecuteErasure && (
              <button
                onClick={() => {
                  setSelectedErasureTarget('P-0145');
                  setErasureModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Process Patient Erasure Request</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {erasureRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">Patient Token: {req.syntheticPatientId}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      PARTIALLY ERASED (STATUTORY HOLD)
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">{req.requestedAt}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 space-y-1">
                    <span className="text-red-400 font-bold uppercase text-[10px]">What Was Erased:</span>
                    <p className="text-gray-300">{req.erasedData}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                    <span className="text-emerald-400 font-bold uppercase text-[10px]">What Was Retained (And Why):</span>
                    <p className="text-gray-300">{req.retainedData}</p>
                    <p className="text-[10px] text-gray-400 italic pt-1">{req.legalExemptionBasis}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Breach Incident Log */
        <div className="p-8 rounded-2xl border border-white/10 bg-[#0E273A]/50 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="font-bold text-base text-white">Zero Data Security Incidents Recorded</h3>
          <p className="text-gray-400 max-w-md mx-auto text-xs">
            No unauthorized data disclosures, ransomware attacks, or pipeline leaks have occurred across{' '}
            {activeOrg.name}. Periodic simulated breach drill last performed: 2026-09-18.
          </p>
        </div>
      )}

      {/* Erasure Sensitive Action Modal */}
      <SensitiveActionModal
        isOpen={erasureModalOpen}
        onClose={() => setErasureModalOpen(false)}
        onConfirm={handleErasureConfirm}
        title={`Process DPDP Erasure: Patient ${selectedErasureTarget}`}
        actionLabel="Execute Pseudonymized Erasure"
        impactSummary="Identifiers will be wiped permanently from all MIPaaS web caches. Raw imaging DICOM data will be preserved under pseudonymized retention per NMC regulatory mandates."
        requiresConfirmationWord="ERASE_PATIENT"
      />
    </div>
  );
}
