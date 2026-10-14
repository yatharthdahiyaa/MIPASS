'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import ApprovalCard from '../common/ApprovalCard';
import {
  CheckCircle2,
  Clock,
  Filter,
  History,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface ModelChangeRequest {
  id: string;
  title: string;
  requesterName: string;
  requesterRole: string;
  targetOrg: string;
  scope: 'organisation' | 'site' | 'platform' | 'own';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  timestamp: string;
  expiresInMinutes?: number;
  firstSigner?: string;
  requiresSecondSigner?: boolean;
  diffSummary?: { field: string; before: any; after: any }[];
}

export default function ApprovalsModule() {
  const { breakGlassRequests, approveBreakGlass, rejectBreakGlass, addAuditLog } = useMultiLevelAdmin();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Multi-person model threshold change requests
  const [modelChangeRequests, setModelChangeRequests] = useState<ModelChangeRequest[]>([
    {
      id: 'req_roc_201',
      title: 'ROC Threshold Calibration: Sybil Lung CT Sensitivity (94.2% → 96.0%)',
      requesterName: 'Dr. Sarah Lin',
      requesterRole: 'Clinical Governance Lead',
      targetOrg: 'Apollo Diagnostics India (All Sites)',
      scope: 'organisation' as const,
      reason: 'Validation trial across 2,400 low-dose CT scans in Delhi & Bengaluru demonstrated 1.8% sensitivity gain with negligible false positives.',
      status: 'pending' as const,
      timestamp: '18 mins ago',
      expiresInMinutes: 45,
      firstSigner: 'Dr. Sarah Lin (Governance Lead)',
      requiresSecondSigner: true,
      diffSummary: [
        { field: 'sensitivity_threshold', before: 0.942, after: 0.960 },
        { field: 'specificity_target', before: 0.915, after: 0.912 },
      ],
    },
    {
      id: 'req_agent_202',
      title: 'Autonomous Dispatch Agent (L2 Autonomy) Enablement: STAT ICH Alerting',
      requesterName: 'Dr. Marcus Vance',
      requesterRole: 'Clinical Lead / HOD',
      targetOrg: 'Indraprastha Apollo (Sarita Vihar)',
      scope: 'site' as const,
      reason: 'Enable instant auto-SMS dispatch to on-call neurosurgery roster when subarachnoid hemorrhage is detected with >98% confidence.',
      status: 'pending' as const,
      timestamp: '32 mins ago',
      expiresInMinutes: 28,
      requiresSecondSigner: true,
      diffSummary: [
        { field: 'agent_ich_autonomy', before: 'L1_semi_autonomous', after: 'L2_autonomous' },
        { field: 'escalation_sms_target', before: 'OPD_Nurse', after: 'OnCall_Neurosurgery' },
      ],
    },
  ]);

  const [approvalHistory] = useState([
    {
      id: 'req_hist_198',
      title: 'PACS GE Gateway DICOM TLS 1.3 Upgrade',
      requesterName: 'Aditya Sen',
      requesterRole: 'Integrations Admin',
      targetOrg: 'Dr Lal PathLabs',
      scope: 'organisation' as const,
      reason: 'Migrate DIMSE port 11112 to TLS 1.3 encrypted tunnel per NABH digital guidelines.',
      status: 'approved' as const,
      timestamp: 'Yesterday at 16:40',
      firstSigner: 'Aditya Sen',
      approver: 'Vikramaditya Sharma (Platform Owner)',
      diffSummary: [{ field: 'dicom_tls', before: 'TLS_1.2', after: 'TLS_1.3' }],
    },
    {
      id: 'req_hist_195',
      title: 'Break-Glass Emergency Request: Sector 14 Server Stall',
      requesterName: 'Kunal Verma',
      requesterRole: 'Ops / SRE',
      targetOrg: 'Dr Lal PathLabs (Sector 14)',
      scope: 'site' as const,
      reason: 'Emergency database lockup clearance.',
      status: 'approved' as const,
      timestamp: '2 days ago',
      approver: 'Platform Dual-Sign Protocol',
    },
  ]);

  const handleApproveModelReq = (id: string) => {
    setModelChangeRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r))
    );
    addAuditLog({
      action: 'approvals:sign_off',
      resource: 'thresholds',
      scope: 'organisation',
      reason: `Dual sign-off completed for request ${id}`,
    });
  };

  const handleRejectModelReq = (id: string) => {
    setModelChangeRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r))
    );
    addAuditLog({
      action: 'approvals:reject',
      resource: 'thresholds',
      scope: 'organisation',
      reason: `Rejected request ${id}`,
    });
  };

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Access Requests, Dual Sign-Offs & Break-Glass Governance
          </h1>
          <p className="text-gray-400 mt-1">
            Mandatory two-person authorization for diagnostic thresholds, agent autonomy promotions, and emergency root elevations.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Authorization ({modelChangeRequests.filter(r => r.status === 'pending').length + breakGlassRequests.filter(r => r.status === 'pending').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Approval History Log</span>
          </button>
        </div>
      </div>

      {activeTab === 'pending' ? (
        <div className="space-y-6">
          {/* Section 1: Break-Glass Emergency Elevation Requests */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-red-400">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Break-Glass Elevated Privilege Requests</span>
            </div>

            <div className="space-y-3">
              {breakGlassRequests.map((bg) => (
                <ApprovalCard
                  key={bg.id}
                  id={bg.id}
                  title={`Emergency Break-Glass Escalation (${bg.durationMinutes} Minutes)`}
                  requesterName={bg.requesterName}
                  requesterRole={bg.requestedRole}
                  targetOrg={bg.targetOrg}
                  scope={bg.targetScope}
                  reason={bg.reason}
                  status={bg.status}
                  expiresInMinutes={bg.durationMinutes}
                  requiresSecondSigner={true}
                  onApprove={() => approveBreakGlass(bg.id)}
                  onReject={() => rejectBreakGlass(bg.id)}
                />
              ))}
            </div>
          </div>

          {/* Section 2: Clinical Threshold & Model Change Approvals (Dual Signer) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-teal-400">
              <UserCheck className="w-4 h-4 text-teal-400" />
              <span>Diagnostic Threshold & Agent Autonomy Requests (Two-Person Approval)</span>
            </div>

            <div className="space-y-3">
              {modelChangeRequests.map((req) => (
                <ApprovalCard
                  key={req.id}
                  id={req.id}
                  title={req.title}
                  requesterName={req.requesterName}
                  requesterRole={req.requesterRole}
                  targetOrg={req.targetOrg}
                  scope={req.scope}
                  reason={req.reason}
                  status={req.status}
                  timestamp={req.timestamp}
                  expiresInMinutes={req.expiresInMinutes}
                  firstSigner={req.firstSigner}
                  requiresSecondSigner={req.requiresSecondSigner}
                  diffSummary={req.diffSummary}
                  onApprove={() => handleApproveModelReq(req.id)}
                  onReject={() => handleRejectModelReq(req.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* History Log View */
        <div className="space-y-3">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Completed & Audit-Archived Approvals</span>
          </div>

          <div className="space-y-3">
            {approvalHistory.map((hist) => (
              <ApprovalCard
                key={hist.id}
                id={hist.id}
                title={hist.title}
                requesterName={hist.requesterName}
                requesterRole={hist.requesterRole}
                targetOrg={hist.targetOrg}
                scope={hist.scope}
                reason={hist.reason}
                status={hist.status}
                timestamp={hist.timestamp}
                diffSummary={hist.diffSummary}
                firstSigner={hist.firstSigner}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
