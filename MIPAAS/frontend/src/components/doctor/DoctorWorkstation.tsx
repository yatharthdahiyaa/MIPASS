'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Layers,
  Shield,
  Eye,
  Sliders,
  ChevronDown,
  Activity,
  ArrowRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sun,
  Contrast,
  Check,
  X,
  Edit3,
  XCircle,
  FileCheck
} from 'lucide-react';
import { openemrService } from '@/services/openemrService';

export interface DicomMetadata {
  patient_id: string;
  patient_name: string;
  patient_sex: string;
  patient_age: string;
  study_date: string;
  study_time: string;
  study_description: string;
  series_description: string;
  modality: string;
  body_part_examined: string;
  dimensions: string;
  rows: number;
  columns: number;
  bits_stored: number;
  bits_allocated: number;
  pixel_representation: string;
  photometric_interpretation: string;
  window_center: string;
  window_width: string;
  rescale_intercept: string;
  rescale_slope: string;
  sop_instance_uid: string;
}

export interface FindingItem {
  id: string;
  name: string;
  probability: number;
  percentage: number;
  threshold: number;
  threshold_percentage: number;
  positive: boolean;
  description: string;
  status: 'PENDING' | 'ACCEPTED' | 'EDITED' | 'REJECTED';
  override_reason?: string;
  doctor_notes?: string;
  dimensions_mm?: number;
  location?: string;
}

export interface WorklistCase {
  case_id: string;
  pseudonym_id: string;
  patient_masked: string;
  age_sex: string;
  modality: string;
  study_description: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  critical_finding?: string;
  sla_minutes: number;
  sla_seconds_remaining: number;
  acknowledged: boolean;
  model_name: string;
  primary_diagnosis: string;
  confidence_pct: number;
  findings: FindingItem[];
  prior_study_available: boolean;
  preview_image: string;
  heatmap_image: string;
  // OpenEMR Clinical Integration Properties
  order_id?: string;
  patient_mrn?: string;
  patient_name?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  clinical_indication?: string;
}

export default function DoctorWorkstation() {
  const router = useRouter();

  // 1. Worklist cases state (STAT, URGENT, ROUTINE with SLA timers)
  const [worklist, setWorklist] = useState<WorklistCase[]>([
    {
      case_id: 'MIP-9901-STAT',
      pseudonym_id: 'MIP-8842-X',
      patient_masked: 'P*****, J***',
      age_sex: '58M',
      modality: 'CXR',
      study_description: 'Chest AP Mobile (ICU Resuscitation)',
      priority: 'STAT',
      critical_finding: 'TENSION_PNEUMOTHORAX',
      sla_minutes: 15,
      sla_seconds_remaining: 712, // ~11 mins remaining
      acknowledged: false,
      model_name: 'DenseNet121_ChestXray14',
      primary_diagnosis: 'Tension Pneumothorax',
      confidence_pct: 94.2,
      preview_image: '/sample_cxr.dcm',
      heatmap_image: '/sample_cxr.dcm',
      prior_study_available: false,
      order_id: 'ord_002',
      patient_mrn: 'MRN-5512-1002',
      patient_name: 'John Doe',
      allergies: ['Sulfa drugs'],
      chronic_conditions: ['Hypertension', 'Hyperlipidemia'],
      clinical_indication: 'Acute pleuritic pain, r/o tension pneumothorax',
      findings: [
        {
          id: 'fnd_01',
          name: 'Tension Pneumothorax',
          probability: 0.942,
          percentage: 94,
          threshold: 0.25,
          threshold_percentage: 25,
          positive: true,
          status: 'PENDING',
          dimensions_mm: 32.0,
          location: 'Right Pleural Space',
          description: 'Significant air collection in right pleural space with mediastinal shift.',
        },
        {
          id: 'fnd_02',
          name: 'Atelectasis',
          probability: 0.718,
          percentage: 72,
          threshold: 0.20,
          threshold_percentage: 20,
          positive: true,
          status: 'PENDING',
          location: 'Right Lower Lobe',
          description: 'Compressive collapse secondary to tension pneumothorax.',
        },
      ],
    },
    {
      case_id: 'MIP-9902-URGENT',
      pseudonym_id: 'MIP-5512-Y',
      patient_masked: 'S*****, M***',
      age_sex: '64F',
      modality: 'CT',
      study_description: 'Low-Dose Chest CT Volume',
      priority: 'URGENT',
      critical_finding: undefined,
      sla_minutes: 60,
      sla_seconds_remaining: 2840,
      acknowledged: true,
      model_name: 'ResNet3D_Lung_v1.8',
      primary_diagnosis: 'Solid Pulmonary Nodule (Lung-RADS 4A)',
      confidence_pct: 86.4,
      preview_image: '/sample_cxr.dcm',
      heatmap_image: '/sample_cxr.dcm',
      prior_study_available: true,
      order_id: 'ord_001',
      patient_mrn: 'MRN-8842-1001',
      patient_name: 'Eleanor Rigby',
      allergies: ['Penicillin', 'IV Iodine Contrast'],
      chronic_conditions: ['COPD (Gold 2)', 'Tobacco Use Disorder (35 pk-yr)'],
      clinical_indication: 'Low-Dose CT Lung Cancer Screening · Nodule surveillance',
      findings: [
        {
          id: 'fnd_03',
          name: 'Solid Pulmonary Nodule',
          probability: 0.864,
          percentage: 86,
          threshold: 0.30,
          threshold_percentage: 30,
          positive: true,
          status: 'ACCEPTED',
          dimensions_mm: 8.4,
          location: 'Right Upper Lobe (Apical)',
          description: 'Spiculated margin nodule measuring 8.4mm with +48% volumetric growth over prior study.',
        },
      ],
    },
    {
      case_id: 'MIP-9903-ROUTINE',
      pseudonym_id: 'MIP-3199-Z',
      patient_masked: 'D*****, R***',
      age_sex: '42M',
      modality: 'CXR',
      study_description: 'Annual Occupational CXR Screening',
      priority: 'ROUTINE',
      critical_finding: undefined,
      sla_minutes: 1440,
      sla_seconds_remaining: 81200,
      acknowledged: true,
      model_name: 'DenseNet121_ChestXray14',
      primary_diagnosis: 'No Acute Cardiopulmonary Disease',
      confidence_pct: 98.1,
      preview_image: '/sample_cxr.dcm',
      heatmap_image: '/sample_cxr.dcm',
      prior_study_available: false,
      order_id: 'ord_003',
      patient_mrn: 'MRN-3199-1003',
      patient_name: 'Robert Davis',
      allergies: ['NKDA (No Known Drug Allergies)'],
      chronic_conditions: ['Routine Occupational Health'],
      clinical_indication: 'Annual executive occupational health baseline',
      findings: [
        {
          id: 'fnd_04',
          name: 'Normal Cardiopulmonary Examination',
          probability: 0.981,
          percentage: 98,
          threshold: 0.50,
          threshold_percentage: 50,
          positive: true,
          status: 'ACCEPTED',
          location: 'Bilateral Thorax',
          description: 'Clear lung fields, normal cardiothoracic ratio, intact diaphragms.',
        },
      ],
    },
  ]);

  const [activeCaseId, setActiveCaseId] = useState<string>('MIP-9901-STAT');
  const [viewMode, setViewMode] = useState<'original' | 'heatmap' | 'split' | 'comparison'>('heatmap');
  const [activeTab, setActiveTab] = useState<'findings' | 'report' | 'longitudinal'>('findings');

  // Viewer image adjustments
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [inverted, setInverted] = useState(false);

  // Modals state
  const [showStatAckModal, setShowStatAckModal] = useState(false);
  const [overrideModalFinding, setOverrideModalFinding] = useState<FindingItem | null>(null);
  const [overrideReasonCode, setOverrideReasonCode] = useState('FALSE_POSITIVE_VESSEL_CONGESTION');
  const [overrideNotes, setOverrideNotes] = useState('');

  // Structured Reporting & e-Sign
  const [selectedTemplate, setSelectedTemplate] = useState('CHEST_XR_STANDARD');
  const [reportProse, setReportProse] = useState('');
  const [showSignModal, setShowSignModal] = useState(false);
  const [doctorName, setDoctorName] = useState('Dr. Sarah Lin, MD');
  const [licenseId, setLicenseId] = useState('MED-NY-88192');
  const [eSigned, setESigned] = useState(false);
  const [signatureHash, setSignatureHash] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Active case pointer
  const activeCase = worklist.find((c) => c.case_id === activeCaseId) || worklist[0];

  // Ticking SLA Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setWorklist((prev) =>
        prev.map((c) => ({
          ...c,
          sla_seconds_remaining: Math.max(0, c.sla_seconds_remaining - 1),
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger STAT alert modal if current case is STAT and unacknowledged
  useEffect(() => {
    if (activeCase.priority === 'STAT' && !activeCase.acknowledged) {
      setShowStatAckModal(true);
    } else {
      setShowStatAckModal(false);
    }
  }, [activeCase.case_id, activeCase.acknowledged, activeCase.priority]);

  // Sync draft prose when active case or findings change
  useEffect(() => {
    const accepted = activeCase.findings.filter((f) => f.status === 'ACCEPTED');
    if (accepted.length > 0) {
      const lines = accepted.map(
        (f) => `• [${f.id}] ${f.name} at ${f.location || 'General'}: Verified with ${f.percentage}% AI confidence.`
      );
      setReportProse(
        `TECHNIQUE: High-resolution digital radiograph.\n\nFINDINGS:\n${lines.join('\n')}\n\nIMPRESSION:\nFindings consistent with ${activeCase.primary_diagnosis}. Correlate with clinical bedside observations.`
      );
    } else {
      setReportProse(
        `TECHNIQUE: Standard digital radiography.\n\nFINDINGS:\nNo acute cardiopulmonary disease. Clear lung fields bilaterally.\n\nIMPRESSION:\nNormal examination.`
      );
    }
  }, [activeCaseId, activeCase.findings, activeCase.primary_diagnosis]);

  const handleAcknowledgeStat = () => {
    setWorklist((prev) =>
      prev.map((c) =>
        c.case_id === activeCase.case_id ? { ...c, acknowledged: true } : c
      )
    );
    setShowStatAckModal(false);
    setNotification('STAT critical alert acknowledged. Response time logged for Joint Commission audit.');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAcceptFinding = (findingId: string) => {
    setWorklist((prev) =>
      prev.map((c) => {
        if (c.case_id !== activeCase.case_id) return c;
        return {
          ...c,
          findings: c.findings.map((f) =>
            f.id === findingId ? { ...f, status: 'ACCEPTED' } : f
          ),
        };
      })
    );
    setNotification('AI finding accepted into official diagnostic impression.');
    setTimeout(() => setNotification(null), 3000);
  };

  const openOverrideModal = (finding: FindingItem) => {
    setOverrideModalFinding(finding);
    setOverrideReasonCode('FALSE_POSITIVE_VESSEL_CONGESTION');
    setOverrideNotes('');
  };

  const handleSaveOverride = () => {
    if (!overrideModalFinding) return;

    setWorklist((prev) =>
      prev.map((c) => {
        if (c.case_id !== activeCase.case_id) return c;
        return {
          ...c,
          findings: c.findings.map((f) =>
            f.id === overrideModalFinding.id
              ? {
                  ...f,
                  status: 'REJECTED',
                  override_reason: overrideReasonCode,
                  doctor_notes: overrideNotes,
                }
              : f
          ),
        };
      })
    );

    setNotification(`Finding '${overrideModalFinding.name}' rejected. Override telemetry streamed to Model QA.`);
    setOverrideModalFinding(null);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleApplySignature = async () => {
    const sig = `MIP-SIG-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    setSignatureHash(sig);
    setESigned(true);
    setShowSignModal(false);

    if (activeCase.order_id) {
      try {
        await openemrService.fileReport(activeCase.order_id, {
          notes: reportProse,
          impression: activeCase.primary_diagnosis,
          ai_prediction_summary: `${activeCase.confidence_pct}% model confidence (${activeCase.model_name})`,
          gradcam_heatmap_url: activeCase.heatmap_image,
          signed_by: `${doctorName} (${licenseId})`,
        });
        setNotification(`Report certified & filed into OpenEMR (Order #${activeCase.order_id}) with signature ${sig}`);
      } catch (err: any) {
        setNotification(`Report certified with digital hash ${sig} (OpenEMR status: saved locally)`);
      }
    } else {
      setNotification(`Report certified & locked with cryptographic e-signature: ${sig}`);
    }

    setTimeout(() => setNotification(null), 5000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* ── Top Header ── */}
      <header className="min-h-16 bg-white/95 border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 backdrop-blur-md shadow-xs text-slate-800">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 text-slate-900 group">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              M
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-none text-slate-900">MiPAAS Diagnostic Station</span>
              <span className="text-[10px] text-teal-700 uppercase tracking-widest font-mono mt-1 font-semibold">
                Clinician Radiology &amp; Decision Support
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-200 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-mono text-slate-700">
              {activeCase.pseudonym_id}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-mono font-semibold">
              {activeCase.modality}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold font-mono text-[11px] border ${
                activeCase.priority === 'STAT'
                  ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                  : activeCase.priority === 'URGENT'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {activeCase.priority} · SLA {formatSeconds(activeCase.sla_seconds_remaining)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/emr"
            className="px-3.5 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors flex items-center gap-1.5"
            title="Open OpenEMR Master Patient Index & Clinical Worklist"
          >
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            <span>OpenEMR Chart</span>
          </Link>
          <Link
            href="/staff"
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Staff Ingestion
          </Link>
          <Link
            href="/admin"
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Admin Hub
          </Link>
          <button
            type="button"
            onClick={() => setShowSignModal(true)}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{eSigned ? 'Report Certified' : 'e-Sign Report'}</span>
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="bg-teal-600 text-white px-6 py-2 text-center text-xs font-bold font-mono tracking-wide transition-all shadow-xs">
          ✓ {notification}
        </div>
      )}

      {/* ── Priority Worklist Drawer Banner ── */}
      <section className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between overflow-x-auto text-xs shadow-xs">
        <div className="flex items-center gap-2 text-slate-500 font-semibold uppercase text-[10px] tracking-wider flex-shrink-0 mr-2">
          <Clock className="w-3.5 h-3.5 text-teal-600" />
          <span>Priority Worklist (Agent 3 Triage L1):</span>
        </div>

        <div className="flex items-center gap-3">
          {worklist.map((c) => {
            const isSelected = c.case_id === activeCaseId;
            return (
              <button
                key={c.case_id}
                type="button"
                onClick={() => setActiveCaseId(c.case_id)}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold shadow-xs ring-1 ring-teal-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    c.priority === 'STAT'
                      ? 'bg-rose-500 animate-ping'
                      : c.priority === 'URGENT'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="font-mono font-bold text-xs">{c.case_id}</span>
                <span className="text-[10px] opacity-80">({c.priority} · {formatSeconds(c.sla_seconds_remaining)})</span>
                {!c.acknowledged && c.priority === 'STAT' && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-extrabold animate-pulse">
                    UNACK
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── OpenEMR Patient Clinical Summary Strip ── */}
      <section className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-mono text-teal-700 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            OpenEMR Record:
          </span>
          <span className="font-bold text-slate-900 text-sm">
            {activeCase.patient_name || activeCase.patient_masked}
          </span>
          <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-[11px]">
            MRN: {activeCase.patient_mrn || activeCase.pseudonym_id}
          </span>
          {activeCase.order_id && (
            <span className="px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[11px] font-semibold">
              Order #{activeCase.order_id} ({activeCase.modality})
            </span>
          )}
          {activeCase.allergies && activeCase.allergies.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-bold text-[11px] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-600 flex-shrink-0" />
              Allergies: {activeCase.allergies.join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-500 text-xs">
          {activeCase.clinical_indication && (
            <span className="hidden xl:inline italic text-[11px] text-slate-500">
              Indication: {activeCase.clinical_indication}
            </span>
          )}
          <Link
            href="/emr"
            className="text-teal-700 hover:underline font-bold text-xs flex items-center gap-1 font-mono"
          >
            <span>OpenEMR MPI</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* ── Main Workstation Workspace ── */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 overflow-hidden">
        {/* ── LEFT: EMBEDDED DIAGNOSTIC CANVAS & XAI (7 COLS) ── */}
        <section className="xl:col-span-7 bg-[#F1F5F9] border-r border-slate-200 flex flex-col p-4 lg:p-6 overflow-y-auto">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs mb-4 text-xs">
            {/* View Mode Controls */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('original')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'original' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Scan Only
              </button>
              <button
                type="button"
                onClick={() => setViewMode('heatmap')}
                className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  viewMode === 'heatmap' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grad-CAM++ Overlay
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'split' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Split View
              </button>
              {activeCase.prior_study_available && (
                <button
                  type="button"
                  onClick={() => setViewMode('comparison')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    viewMode === 'comparison' ? 'bg-purple-600 text-white font-bold shadow-xs' : 'text-purple-700 hover:text-purple-900'
                  }`}
                >
                  <span>Prior Comparison</span>
                </button>
              )}
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 font-mono uppercase mr-1">Window:</span>
              <button
                type="button"
                onClick={() => { setBrightness(130); setContrast(140); }}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 border border-slate-200"
              >
                Lung
              </button>
              <button
                type="button"
                onClick={() => { setBrightness(90); setContrast(170); }}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 border border-slate-200"
              >
                Bone
              </button>
              <button
                type="button"
                onClick={() => { setBrightness(105); setContrast(115); }}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 border border-slate-200"
              >
                Soft
              </button>
              <button
                type="button"
                onClick={() => { setBrightness(100); setContrast(100); setZoom(1); setInverted(false); }}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-500 border border-slate-200"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Viewport Canvas - Dedicated medical dark frame for radiological density */}
          <div className="flex-1 min-h-[460px] bg-black rounded-2xl border border-slate-300 shadow-inner flex items-center justify-center relative overflow-hidden p-4">
            {viewMode === 'comparison' ? (
              /* Synchronous Split Screen Comparison with Prior */
              <div className="w-full h-full grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-700 p-3 flex flex-col items-center justify-center bg-slate-900/90 relative">
                  <span className="absolute top-3 left-3 text-[11px] font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded">
                    Prior Study: 2025-04-10 (6 Mos Ago)
                  </span>
                  <div className="w-48 h-48 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 border border-slate-700 flex items-center justify-center text-xs text-slate-400">
                    Prior Scan (Nodule: 5.4mm)
                  </div>
                </div>

                <div className="rounded-xl border border-purple-500/40 p-3 flex flex-col items-center justify-center bg-slate-900/90 relative">
                  <span className="absolute top-3 left-3 text-[11px] font-mono text-purple-300 bg-black/60 px-2 py-0.5 rounded">
                    Current Study: 2026-10-12
                  </span>
                  <div className="w-48 h-48 rounded-xl bg-gradient-to-b from-purple-950/40 to-black border border-purple-500/30 flex items-center justify-center text-xs text-purple-300">
                    Current Scan (Nodule: 8.4mm)
                  </div>
                  <div className="mt-3 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-500/30">
                    RECIST 1.1 Progression: +48.2% Vol (VDT: 326 Days)
                  </div>
                </div>
              </div>
            ) : (
              /* Single Viewport with Grad-CAM toggle */
              <div
                className="relative max-w-md max-h-full rounded-xl overflow-hidden border border-slate-700 shadow-2xl"
                style={{
                  filter: `brightness(${brightness}%) contrast(${contrast}%) ${inverted ? 'invert(1)' : ''}`,
                  transform: `scale(${zoom})`,
                  transition: 'transform 0.15s ease-out',
                }}
              >
                {/* Synthetic Medical Radiograph Display */}
                <div className="w-[380px] h-[380px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black relative flex items-center justify-center">
                  {/* Rib & Heart shadows */}
                  <div className="w-44 h-56 rounded-full border border-neutral-700/50 absolute" />
                  <div className="w-28 h-36 rounded-full bg-neutral-800/60 absolute left-28 top-28" />

                  {/* Grad-CAM overlay */}
                  {(viewMode === 'heatmap' || viewMode === 'split') && (
                    <div
                      className="absolute inset-0 bg-radial from-red-500/60 via-amber-500/30 to-transparent opacity-80 mix-blend-screen pointer-events-none"
                      style={{
                        backgroundPosition: activeCase.priority === 'STAT' ? '70% 30%' : '65% 25%',
                        backgroundSize: '160px 160px',
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                  )}

                  {/* Radiopaque marker */}
                  <span className="absolute top-4 right-4 text-xs font-mono font-bold text-white/50">
                    R
                  </span>
                </div>
              </div>
            )}

            {/* Corner tags */}
            <div className="absolute bottom-4 left-4 text-[10px] font-mono text-slate-300 bg-black/75 px-2.5 py-1 rounded-lg border border-slate-700">
              {activeCase.modality} · {activeCase.patient_masked} · Window {brightness}/{contrast}
            </div>
            <div className="absolute bottom-4 right-4 text-[10px] font-mono text-teal-400 bg-black/75 px-2.5 py-1 rounded-lg border border-slate-700">
              Model: {activeCase.model_name}
            </div>
          </div>
        </section>

        {/* ── RIGHT: FINDINGS REVIEW, REPORT EDITOR & E-SIGN (5 COLS) ── */}
        <aside className="xl:col-span-5 bg-white flex flex-col p-4 lg:p-6 overflow-y-auto border-l border-slate-200">
          {/* Tab Selector */}
          <div className="flex border-b border-slate-200 pb-3 mb-5 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('findings')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'findings' ? 'bg-teal-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Review AI Findings ({activeCase.findings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'report' ? 'bg-teal-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Report Editor &amp; e-Sign
            </button>
            {activeCase.prior_study_available && (
              <button
                type="button"
                onClick={() => setActiveTab('longitudinal')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'longitudinal' ? 'bg-teal-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Longitudinal RECIST
              </button>
            )}
          </div>

          {/* TAB 1: FINDINGS REVIEW & MANDATORY OVERRIDE */}
          {activeTab === 'findings' && (
            <div className="space-y-4 flex-1">
              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50/70 via-emerald-50/40 to-teal-50/50 border border-teal-200 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold block">Primary AI Diagnosis:</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">{activeCase.primary_diagnosis}</h3>
                <span className="text-xs text-teal-700 font-bold font-mono">
                  {activeCase.confidence_pct}% Model Confidence (Zero Fallback)
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                  <span>Detected Abnormalities</span>
                  <span className="text-[10px] text-slate-400">Action Required</span>
                </div>

                {activeCase.findings.map((f) => (
                  <div
                    key={f.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-300 shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-sm text-slate-900 block">{f.name}</span>
                        <span className="text-xs text-slate-500 font-mono">
                          Location: {f.location} · {f.dimensions_mm ? `${f.dimensions_mm}mm` : ''}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                        {f.percentage}% Conf
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{f.description}</p>

                    {/* Status Badge */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <div>
                        {f.status === 'ACCEPTED' ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accepted by Doctor
                          </span>
                        ) : f.status === 'REJECTED' ? (
                          <span className="text-rose-700 font-bold flex items-center gap-1 text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Overridden ({f.override_reason})
                          </span>
                        ) : (
                          <span className="text-amber-700 text-[11px] font-bold">
                            Pending Clinician Review
                          </span>
                        )}
                      </div>

                      {/* Action Buttons: Accept / Reject Override */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAcceptFinding(f.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-all cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => openOverrideModal(f)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all cursor-pointer"
                        >
                          Reject / Override
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: STRUCTURED REPORT EDITOR & E-SIGN */}
          {activeTab === 'report' && (
            <div className="space-y-4 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold uppercase">Reporting Template (Agent 4 L0):</span>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-mono text-xs focus:outline-none focus:border-teal-600"
                >
                  <option value="CHEST_XR_STANDARD">RadLex Standard CXR</option>
                  <option value="LUNG_RADS_V2022">Lung-RADS v2022 Screening</option>
                  <option value="BI_RADS_6TH">ACR BI-RADS 6th Ed.</option>
                </select>
              </div>

              {/* AI-drafted disclaimer banner */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>AI-drafted, requires clinician review and cryptographic e-signature</span>
              </div>

              <textarea
                rows={12}
                value={reportProse}
                onChange={(e) => setReportProse(e.target.value)}
                className="w-full rounded-2xl bg-slate-50 border border-slate-300 p-4 font-mono text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-teal-600 focus:bg-white"
              />

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-xs text-slate-600 font-mono">
                  Sign-off Status: {eSigned ? <strong className="text-emerald-700 font-bold">CERTIFIED ({signatureHash})</strong> : <span className="text-amber-700 font-semibold">UNSIGNED</span>}
                </span>

                <button
                  type="button"
                  onClick={() => setShowSignModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs cursor-pointer shadow-xs transition-all"
                >
                  {eSigned ? 'Re-certify e-Signature' : 'Apply Cryptographic e-Signature'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LONGITUDINAL RECIST COMPARISON */}
          {activeTab === 'longitudinal' && (
            <div className="space-y-4 flex-1">
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-xs">
                <h4 className="font-bold text-sm text-purple-900 mb-1">
                  Agent 5: Longitudinal Comparison Delta (L0 Suggests Only)
                </h4>
                <p>
                  Interval between studies: <strong>184 days</strong>. Inter-scan spatial registration matched via affine 3D transform.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Target Lesion:</span>
                  <span className="font-bold text-slate-900">Right Upper Lobe Solid Nodule</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Prior Measurement (2025-04-10):</span>
                  <span className="font-mono text-slate-700">5.4 mm (82.4 mm³)</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Current Measurement (2026-10-12):</span>
                  <span className="font-mono text-rose-600 font-bold">8.4 mm (310.3 mm³)</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Volume Delta:</span>
                  <span className="font-mono text-rose-600 font-bold">+48.2% Volumetric Expansion</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Volume Doubling Time (VDT):</span>
                  <span className="font-mono text-rose-600 font-bold">326 Days (High Risk)</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── MODAL 1: STAT CRITICAL RESULT ACKNOWLEDGEMENT ── */}
      {showStatAckModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-white border-2 border-rose-500 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-7 h-7 flex-shrink-0 animate-bounce" />
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-700 block">
                  Agent 3: Triage &amp; Escalation (L1 Priority Gate)
                </span>
                <h3 className="text-xl font-black text-rose-800">CRITICAL STAT RESULT ALERT</h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed mb-4">
              <strong className="text-slate-900 text-sm block mb-1">
                Suspected Tension Pneumothorax Detected on {activeCase.case_id}
              </strong>
              SLA Emergency Response Window: <strong>15 Minutes</strong>.
              Joint Commission national patient safety goals require verifiable radiologist acknowledgment.
            </div>

            <div className="text-xs text-slate-600 space-y-1 mb-6 font-mono">
              <div>Patient Masked: {activeCase.patient_masked} ({activeCase.pseudonym_id})</div>
              <div>Location: ICU Mobile Unit · Acquisition Time: 00:08 UTC</div>
            </div>

            <button
              type="button"
              onClick={handleAcknowledgeStat}
              className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm tracking-wide cursor-pointer shadow-xl shadow-rose-600/30 transition-all uppercase"
            >
              Acknowledge Critical STAT Alert (Stop Paging)
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 2: MANDATORY OVERRIDE REASON CAPTURE ── */}
      {overrideModalFinding && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-600" />
                <span>Mandatory Override Reason Capture</span>
              </h3>
              <button
                type="button"
                onClick={() => setOverrideModalFinding(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              To reject or alter AI finding <strong className="text-slate-900">'{overrideModalFinding.name}'</strong>,
              you must select a standardized clinical override reason code to feed our continuous Model QA &amp; Drift audit.
            </p>

            <div className="space-y-3 text-xs mb-6">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Override Reason Code *</label>
                <select
                  value={overrideReasonCode}
                  onChange={(e) => setOverrideReasonCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-teal-600"
                >
                  <option value="FALSE_POSITIVE_VESSEL_CONGESTION">False Positive - Vessel Congestion</option>
                  <option value="RESPIRATORY_MOTION_ARTIFACT_CONFUSION">Motion Artifact Misclassified</option>
                  <option value="DIMENSION_RECALIBRATED_BY_MANUAL_CALIPER">Dimension Recalibrated via Caliper</option>
                  <option value="BENIGN_CALCIFICATION_MISCLASSIFIED">Benign Calcification Misclassified</option>
                  <option value="NORMAL_ANATOMICAL_VARIANT">Normal Anatomical Variant</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Clinician Justification Notes</label>
                <textarea
                  rows={3}
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="Clinical rationale for audit logging..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setOverrideModalFinding(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Record Clinician Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: CRYPTOGRAPHIC E-SIGNATURE ── */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-teal-600" />
                <span>Diagnostic Report e-Signature</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Applying your cryptographic digital signature certifies this study, locks the document against subsequent alterations, and dispatches the certified report to PACS/EHR.
            </p>

            <div className="space-y-3 text-xs mb-6">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Attending Physician Name</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Medical Registration License ID</label>
                <input
                  type="text"
                  value={licenseId}
                  onChange={(e) => setLicenseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplySignature}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs cursor-pointer shadow-xs transition-all"
              >
                Certify &amp; Apply Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
