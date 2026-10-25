'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import DataTable, { Column } from '../common/DataTable';
import AdminNotice from '../common/AdminNotice';
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock,
  FileText,
  Flame,
  Hospital,
  Sliders,
  Stethoscope,
  UserCheck,
} from 'lucide-react';

interface WorklistStudy {
  id: string;
  syntheticPatientId: string;
  modality: 'CT' | 'MRI' | 'XR';
  bodyPart: string;
  findingSummary: string;
  urgency: 'STAT' | 'URGENT' | 'ROUTINE';
  elapsedMinutes: number;
  slaLimitMinutes: number;
  assignee: string;
  status: 'awaiting_review' | 'in_progress' | 'signed_off';
}

export default function ClinicalOpsModule() {
  const { activeOrg, activeSite, hasPermission, addAuditLog } = useMultiLevelAdmin();

  const [activeTab, setActiveTab] = useState<'worklist' | 'sla' | 'referrals'>('worklist');
  const [notice, setNotice] = useState<string | null>(null);

  const [worklist, setWorklist] = useState<WorklistStudy[]>([
    {
      id: 'STD-9901',
      syntheticPatientId: 'P-0001',
      modality: 'CT',
      bodyPart: 'Head Non-Contrast',
      findingSummary: 'Acute Intracranial Hemorrhage (18ml subarachnoid hematoma)',
      urgency: 'STAT',
      elapsedMinutes: 8,
      slaLimitMinutes: 15,
      assignee: 'Dr. Sarah Lin (Lead)',
      status: 'awaiting_review',
    },
    {
      id: 'STD-9904',
      syntheticPatientId: 'P-0042',
      modality: 'XR',
      bodyPart: 'Chest PA Standing',
      findingSummary: 'Tension Pneumothorax (Right lung >45% collapse)',
      urgency: 'STAT',
      elapsedMinutes: 11,
      slaLimitMinutes: 15,
      assignee: 'Dr. Marcus Vance',
      status: 'awaiting_review',
    },
    {
      id: 'STD-9908',
      syntheticPatientId: 'P-0108',
      modality: 'CT',
      bodyPart: 'Chest Angiography',
      findingSummary: 'Segmental Pulmonary Embolism with right ventricular strain',
      urgency: 'URGENT',
      elapsedMinutes: 24,
      slaLimitMinutes: 30,
      assignee: 'Unassigned',
      status: 'awaiting_review',
    },
    {
      id: 'STD-9912',
      syntheticPatientId: 'P-0220',
      modality: 'CT',
      bodyPart: 'Low-Dose Chest CT',
      findingSummary: 'Sybil Lung Cancer Risk Score: 1.8% (Normal screening interval)',
      urgency: 'ROUTINE',
      elapsedMinutes: 45,
      slaLimitMinutes: 120,
      assignee: 'Dr. Marcus Vance',
      status: 'in_progress',
    },
    {
      id: 'STD-9915',
      syntheticPatientId: 'P-0314',
      modality: 'MRI',
      bodyPart: 'Brain Contrast Protocol',
      findingSummary: 'Post-op resection cavity stable, no recurrent contrast enhancement',
      urgency: 'ROUTINE',
      elapsedMinutes: 52,
      slaLimitMinutes: 120,
      assignee: 'Dr. Sarah Lin (Lead)',
      status: 'signed_off',
    },
  ]);

  // SLA Configuration Settings
  const [slaSettings, setSlaSettings] = useState({
    statSlaMinutes: 15,
    urgentSlaMinutes: 30,
    routineSlaMinutes: 120,
    escalationContactPhone: '+91 98110 00000',
    statAutoNotifyOnCall: true,
  });

  const columns: Column<WorklistStudy>[] = [
    {
      key: 'syntheticPatientId',
      header: 'Synthetic Token',
      render: (w) => <span className="font-mono font-bold text-white">{w.syntheticPatientId}</span>,
    },
    {
      key: 'modality',
      header: 'Study Modality',
      render: (w) => (
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-teal-300 font-mono font-semibold">
          {w.modality} · {w.bodyPart}
        </span>
      ),
    },
    {
      key: 'findingSummary',
      header: 'AI Finding & Triage Summary',
      render: (w) => <span className="text-gray-200 font-medium">{w.findingSummary}</span>,
    },
    {
      key: 'urgency',
      header: 'Triage Priority',
      render: (w) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            w.urgency === 'STAT'
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
              : w.urgency === 'URGENT'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-white/5 text-gray-300 border border-white/10'
          }`}
        >
          {w.urgency}
        </span>
      ),
    },
    {
      key: 'elapsedMinutes',
      header: 'Elapsed / SLA Window',
      render: (w) => {
        const isNearBreach = w.elapsedMinutes / w.slaLimitMinutes > 0.7;
        return (
          <span
            className={`font-mono text-xs ${
              isNearBreach ? 'text-red-400 font-bold' : 'text-gray-300'
            }`}
          >
            {w.elapsedMinutes}m / {w.slaLimitMinutes}m
          </span>
        );
      },
    },
    {
      key: 'assignee',
      header: 'Assigned Physician',
      render: (w) => <span className="text-gray-300 text-xs">{w.assignee}</span>,
    },
    {
      key: 'status',
      header: 'Review State',
      render: (w) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            w.status === 'signed_off'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : w.status === 'in_progress'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          {w.status.replace('_', ' ')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Clinical Operations, STAT Triage & Worklists
          </h1>
          <p className="text-gray-400 mt-1">
            Emergency turnaround monitoring, radiologist assignment, and referral distribution for{' '}
            <strong className="text-white">{activeSite.name}</strong>.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('worklist')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'worklist'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Active Worklist ({worklist.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'sla'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>SLA & Notification Rules</span>
          </button>
        </div>
      </div>

      {activeTab === 'worklist' ? (
        <DataTable
          columns={columns}
          data={worklist}
          searchPlaceholder="Filter studies by patient token (P-0001), modality or finding..."
          searchKey={(w) => `${w.syntheticPatientId} ${w.findingSummary} ${w.modality}`}
          exportFileName="mipaas-clinical-worklist.csv"
        />
      ) : (
        /* SLA Settings Card */
        <div className="max-w-2xl p-6 rounded-2xl border border-white/10 bg-[#0E273A]/80 backdrop-blur-md space-y-4 shadow-xl">
          <div className="flex items-center gap-2 font-bold text-base text-white border-b border-white/10 pb-3">
            <Sliders className="w-5 h-5 text-teal-400" />
            <span>Clinical SLA Turnaround Target Rules (NABH Aligned)</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                STAT Emergency Case Target Window (Minutes) *
              </label>
              <input
                type="number"
                value={slaSettings.statSlaMinutes}
                onChange={(e) => setSlaSettings({ ...slaSettings, statSlaMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-teal-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Applies to Acute ICH, Tension Pneumothorax, and Pulmonary Embolism studies.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Routine Screening Study Target Window (Minutes) *
              </label>
              <input
                type="number"
                value={slaSettings.routineSlaMinutes}
                onChange={(e) => setSlaSettings({ ...slaSettings, routineSlaMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                On-Call Escalation Mobile Number (SMS / Call)
              </label>
              <input
                type="text"
                value={slaSettings.escalationContactPhone}
                onChange={(e) => setSlaSettings({ ...slaSettings, escalationContactPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setNotice('SLA turnaround settings saved.');
                  addAuditLog({
                    action: 'sla:update',
                    resource: 'clinical_ops',
                    scope: 'site',
                    reason: `Updated clinical turnaround SLA parameters: STAT ${slaSettings.statSlaMinutes}m, Routine ${slaSettings.routineSlaMinutes}m`,
                  });
                }}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-black font-bold"
              >
                Save SLA Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminNotice message={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}
