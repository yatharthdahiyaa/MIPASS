'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import { AiAgentItem, ModelCatalogueItem } from '@/types/multiLevelRbac';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  Eye,
  FileCheck2,
  Flame,
  Info,
  Power,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  TrendingUp,
} from 'lucide-react';
import SensitiveActionModal from '../common/SensitiveActionModal';

export default function ModelsAgentsModule() {
  const { activeOrg, hasPermission, addAuditLog } = useMultiLevelAdmin();

  const [activeTab, setActiveTab] = useState<'models' | 'agents'>('models');

  // Diagnostic Models Catalogue
  const [models, setModels] = useState<ModelCatalogueItem[]>([
    {
      id: 'mod_lung_sybil',
      name: 'Sybil Lung Cancer Risk Assessment',
      modality: 'Low-Dose Chest CT',
      version: 'v3.2.0 (2026)',
      status: 'validated',
      accuracyMetric: 'AUC 0.982',
      sensitivity: 96.0,
      specificity: 91.2,
      orgEnabled: true,
      lastThresholdUpdate: '2026-10-12',
      requiresTwoPersonApproval: true,
    },
    {
      id: 'mod_brain_tumor',
      name: 'NeuroOnco Brain Tumor Segmentation',
      modality: 'Brain MRI (T1c, T2, FLAIR)',
      version: 'v2.8.4',
      status: 'validated',
      accuracyMetric: 'Dice 0.941',
      sensitivity: 94.8,
      specificity: 93.6,
      orgEnabled: true,
      lastThresholdUpdate: '2026-09-28',
      requiresTwoPersonApproval: true,
    },
    {
      id: 'mod_stroke_ich',
      name: 'Acute Intracranial Hemorrhage (qStroke)',
      modality: 'Non-Contrast Head CT',
      version: 'v4.1.0-RC',
      status: 'validated',
      accuracyMetric: 'AUC 0.991',
      sensitivity: 98.4,
      specificity: 96.8,
      orgEnabled: true,
      lastThresholdUpdate: '2026-10-04',
      requiresTwoPersonApproval: true,
    },
    {
      id: 'mod_qxr_tb',
      name: 'qXR Tuberculosis & Pulmonary Lesion Detector',
      modality: 'Chest X-Ray (CXR)',
      version: 'v5.0.1 (Shadow)',
      status: 'in_shadow',
      accuracyMetric: 'Sensitivity 97.2%',
      sensitivity: 97.2,
      specificity: 89.5,
      orgEnabled: false,
      lastThresholdUpdate: '2026-10-10',
      requiresTwoPersonApproval: true,
    },
  ]);

  // AI Autonomous Agents
  const [agents, setAgents] = useState<AiAgentItem[]>([
    {
      id: 'agt_l0_assist',
      name: 'Radiology Annotation Copilot',
      code: 'COPILOT-L0',
      autonomyLevel: 'L0_assistive',
      autonomyLabel: 'L0 · Assistive',
      description: 'Pre-populates DICOM segmentation contours and drafted report templates. Clinician must inspect and manually sign.',
      enabled: true,
      lastTrained: '2026-09-15',
      safetyGuardrails: ['Manual radiologist sign-off required', 'Zero automated report dispatch'],
    },
    {
      id: 'agt_l1_triage',
      name: 'Normal CXR Worklist Auto-Triager',
      code: 'TRIAGE-L1',
      autonomyLevel: 'L1_semi_autonomous',
      autonomyLabel: 'L1 · Semi-Autonomous',
      description: 'Automatically deprioritizes verified normal studies in routine worklists. Enforces a 10% random quality spot-audit.',
      enabled: true,
      lastTrained: '2026-10-01',
      safetyGuardrails: ['10% random spot-check audit', 'Never triages STAT or ICU cases'],
    },
    {
      id: 'agt_l2_stat',
      name: 'STAT Intracranial Hemorrhage Escalation Agent',
      code: 'AUTON-L2-STAT',
      autonomyLevel: 'L2_autonomous',
      autonomyLabel: 'L2 · Autonomous',
      description: 'Instantly alerts the on-call neurosurgical resident via emergency phone page and SMS upon ICH detection with >98% confidence.',
      enabled: false,
      lastTrained: '2026-10-08',
      safetyGuardrails: [
        'Dual clinical sign-off required to enable',
        'Auto-terminates if PACS connection jitter > 500ms',
      ],
    },
  ]);

  const [selectedModel, setSelectedModel] = useState<ModelCatalogueItem | null>(null);
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);
  const [newSensitivity, setNewSensitivity] = useState(96.0);

  const canManageModels = hasPermission('models', 'update', 'organisation');

  const handleToggleModelEnable = (model: ModelCatalogueItem) => {
    if (!canManageModels) return;
    const nextState = !model.orgEnabled;
    setModels(models.map((m) => (m.id === model.id ? { ...m, orgEnabled: nextState } : m)));
    addAuditLog({
      action: nextState ? 'models:enable' : 'models:disable',
      resource: 'models',
      scope: 'organisation',
      reason: `Toggled organisation enablement for ${model.name} to ${nextState}`,
    });
  };

  const handleToggleAgent = (agent: AiAgentItem) => {
    if (!canManageModels) return;
    const nextState = !agent.enabled;
    setAgents(agents.map((a) => (a.id === agent.id ? { ...a, enabled: nextState } : a)));
    addAuditLog({
      action: nextState ? 'agents:enable' : 'agents:disable',
      resource: 'agents',
      scope: 'organisation',
      reason: `Toggled agent ${agent.name} (${agent.autonomyLevel}) to ${nextState}`,
    });
  };

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Model Catalogue, ROC Thresholds & Autonomous AI Agents
          </h1>
          <p className="text-gray-400 mt-1">
            Validated clinical AI engines and L0–L2 autonomy safety guardrails for{' '}
            <strong className="text-white">{activeOrg.name}</strong>.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('models')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'models'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Diagnostic Models ({models.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'agents'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Autonomous AI Agents ({agents.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'models' ? (
        /* Models Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((model) => (
            <div
              key={model.id}
              className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-4 shadow-xl"
            >
              {/* Card Top */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-sm text-white">{model.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        model.status === 'validated'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : model.status === 'in_shadow'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {model.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono">
                    Modality: <strong className="text-gray-200">{model.modality}</strong> · Version: {model.version}
                  </div>
                </div>

                {/* Enablement Switch */}
                <button
                  onClick={() => handleToggleModelEnable(model)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                    model.orgEnabled
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}
                  title={model.orgEnabled ? 'Click to disable for tenant' : 'Click to enable for tenant'}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{model.orgEnabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>

              {/* Threshold Calibration Bars */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Sensitivity Calibration:</span>
                  <span className="font-bold text-teal-400">{model.sensitivity}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-teal-400" style={{ width: `${model.sensitivity}%` }} />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Target Specificity:</span>
                  <span className="text-purple-400">{model.specificity}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-white/5">
                  <span>Metric: {model.accuracyMetric}</span>
                  <span>Calibrated: {model.lastThresholdUpdate}</span>
                </div>
              </div>

              {/* Threshold Workflow Trigger */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Two-Person Sign-Off Required for Threshold Edits</span>
                </span>
                <button
                  onClick={() => {
                    setSelectedModel(model);
                    setNewSensitivity(model.sensitivity);
                    setThresholdModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-colors"
                >
                  Propose Threshold Change
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Autonomous AI Agents Grid */
        <div className="space-y-4">
          {/* Autonomy Level Definition Panel */}
          <div className="p-4 rounded-2xl border border-teal-500/30 bg-teal-950/20 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-teal-300">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>MIPaaS Medical AI Autonomy Safety Standard</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-gray-300">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <div className="font-bold text-teal-400 mb-1">L0 · Assistive Copilot</div>
                <p className="text-[11px] text-gray-400">
                  Pre-populates DICOM overlays; zero action taken without explicit radiologist sign-off.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <div className="font-bold text-purple-400 mb-1">L1 · Semi-Autonomous</div>
                <p className="text-[11px] text-gray-400">
                  Auto-triages normal cases to reduce backlog with mandatory 10% random quality spot-audits.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <div className="font-bold text-amber-400 mb-1">L2 · Autonomous STAT</div>
                <p className="text-[11px] text-gray-400">
                  Direct emergency dispatch to on-call surgeon roster for critical life-threatening findings.
                </p>
              </div>
            </div>
          </div>

          {/* Agents List */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-3.5 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-bold text-sm text-white">{agent.name}</span>
                      <div className="text-[11px] font-mono text-teal-400">{agent.code}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        agent.autonomyLevel === 'L0_assistive'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          : agent.autonomyLevel === 'L1_semi_autonomous'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {agent.autonomyLabel}
                    </span>
                  </div>

                  <p className="text-gray-300 text-xs leading-relaxed mb-3">{agent.description}</p>

                  <div className="space-y-1 pt-2 border-t border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      Safety Guardrails
                    </span>
                    {agent.safetyGuardrails.map((g, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-[11px] text-gray-500 font-mono">Trained: {agent.lastTrained}</span>
                  <button
                    onClick={() => handleToggleAgent(agent)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 ${
                      agent.enabled
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{agent.enabled ? 'Agent Active' : 'Suspended'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensitive Action Modal for Proposing Threshold Changes */}
      {selectedModel && (
        <SensitiveActionModal
          isOpen={thresholdModalOpen}
          onClose={() => setThresholdModalOpen(false)}
          onConfirm={(reason) => {
            alert(`Threshold change proposed for ${selectedModel.name}. Routed to Clinical Governance for second sign-off.`);
            addAuditLog({
              action: 'thresholds:propose',
              resource: 'thresholds',
              scope: 'organisation',
              reason: `Proposed threshold change for ${selectedModel.name}: ${reason}`,
            });
          }}
          title={`Propose Diagnostic Threshold: ${selectedModel.name}`}
          actionLabel="Submit for Dual Sign-Off"
          impactSummary={`Changing sensitivity threshold for ${selectedModel.name} affects false-positive rates across ${activeOrg.sites.length} radiology hospital sites.`}
          isDestructive={false}
        />
      )}
    </div>
  );
}
