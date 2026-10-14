/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Shield,
  Share2,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Clock,
  Lock,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Activity,
  Layers,
  Sparkles,
  Download,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  RefreshCw,
  Info,
  Calendar,
  AlertCircle,
  CheckCircle,
  Building,
  User,
  SlidersHorizontal,
  FileCheck2,
  ArrowUpRight,
  Heart,
} from 'lucide-react';
import { useServices } from '@/context/ServicesContext';
import { useRBAC } from '@/context/RBACContext';

interface AgentPipelineResult {
  status: string;
  case_id: string;
  patient_id: string;
  service_id: string;
  service_name: string;
  timestamp: string;
  total_duration_ms: number;
  stage_timings_ms: Record<string, number>;
  stages: {
    agent_1_validation: any;
    agent_2_clinical_compatibility: any;
    agent_3_quality_assessment: any;
    agent_4_preprocessing: any;
    agent_5_ai_inference: any;
    agent_6_explainability: any;
    agent_7_report_generation: any;
  };
  original_image_b64: string;
  preprocessed_image_b64: string;
  gradcam_heatmap_b64: string;
  primary_diagnosis: string;
  confidence_percentage: number;
  severity: string;
  urgency: string;
  positive_findings: Array<{
    name: string;
    probability: number;
    percentage: number;
    threshold: number;
    threshold_percentage: number;
    positive: boolean;
    description: string;
  }>;
  all_pathologies: Array<{
    name: string;
    probability: number;
    percentage: number;
    threshold: number;
    threshold_percentage: number;
    positive: boolean;
    description: string;
  }>;
  report: any;
}

export default function PatientPortal() {
  const searchParams = useSearchParams();
  const serviceParam = searchParams.get('service');
  const { services, getService } = useServices();
  const { currentUser, isIamAuthenticated, iamUser } = useRBAC();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'studio' | 'ehr' | 'abha' | 'consent'>('studio');

  // Selected Service
  const [selectedServiceId, setSelectedServiceId] = useState<string>(serviceParam || 'qxr');

  useEffect(() => {
    if (serviceParam) {
      setSelectedServiceId(serviceParam);
    }
  }, [serviceParam]);

  const activeService = getService(selectedServiceId) || services.find((s) => s.id === selectedServiceId) || {
    id: 'qxr',
    name: 'qXR – Chest X-Ray AI',
    shortName: 'Chest Radiography',
    tagline: '14-Pathology Screening & Triage',
    modality: 'CXR',
    description: 'Multi-pathology chest radiograph triage with explainable AI heatmaps and calibrated thresholds.',
  };

  // Upload & Pipeline State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [pipelineResult, setPipelineResult] = useState<AgentPipelineResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'original' | 'enhanced' | 'heatmap' | 'blend'>('heatmap');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(75);
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);

  // Clinician Escalation Modal
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateSuccess, setEscalateSuccess] = useState(false);

  // Consent & Sharing States
  const [consents, setConsents] = useState({
    primary_care: true,
    institutional_qa: true,
    secondary_research: false,
    commercial_ai: false,
  });
  const [shareLinkActive, setShareLinkActive] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [erasureModalOpen, setErasureModalOpen] = useState(false);
  const [erasureSubmitted, setErasureSubmitted] = useState(false);

  // ABHA verification state
  const [abhaNumber, setAbhaNumber] = useState('');
  const [abhaOtpSent, setAbhaOtpSent] = useState(false);
  const [abhaOtp, setAbhaOtp] = useState('');
  const [abhaVerified, setAbhaVerified] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleConsent = (key: keyof typeof consents) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyLink = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Run the 7-Agent Diagnostic Pipeline
  const runPipeline = async (fileToUse?: File, useSample: boolean = false) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setCurrentStep(1);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < 6 ? prev + 1 : prev));
    }, 450);

    try {
      const formData = new FormData();
      formData.append('serviceId', selectedServiceId);
      formData.append('patientId', 'MIP-8842-X');

      if (useSample) {
        formData.append('isSample', 'true');
      } else if (fileToUse || selectedFile) {
        formData.append('file', (fileToUse || selectedFile) as Blob);
      } else {
        clearInterval(stepInterval);
        setIsProcessing(false);
        setErrorMessage('Please select a file or click "Load Demo DICOM Study".');
        return;
      }

      const res = await fetch('/api/inference/pipeline', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      clearInterval(stepInterval);

      if (data.status === 'success') {
        setCurrentStep(7);
        setPipelineResult(data);
      } else {
        setErrorMessage(data.message || data.error?.message || 'Pipeline encountered a validation error.');
        setCurrentStep(0);
      }
    } catch (err) {
      clearInterval(stepInterval);
      setErrorMessage(`Network or processing error: ${err instanceof Error ? err.message : String(err)}`);
      setCurrentStep(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      runPipeline(f, false);
    }
  };

  const handleLoadDemo = () => {
    setSelectedFile(null);
    runPipeline(undefined, true);
  };

  // Report Download
  const handleDownloadReport = () => {
    if (!pipelineResult) return;
    const reportText = `========================================================================
MIPAAS CERTIFIED CLINICAL DIAGNOSTIC REPORT (AI-ASSISTED)
Report ID: ${pipelineResult.report.report_id}
Date: ${pipelineResult.report.analysis_date}
Digital Signature: ${pipelineResult.report.digital_signature}
========================================================================

PATIENT & STUDY DETAILS:
Patient Pseudonym: ${pipelineResult.patient_id}
Selected Service: ${pipelineResult.service_name}
Imaging Modality: ${pipelineResult.report.study_details.modality}
Dimensions: ${pipelineResult.report.study_details.dimensions}
Study Instance UID: ${pipelineResult.report.study_details.dicom_study_uid}

QUALITY ASSESSMENT (Agent 3):
Technical Quality Score: ${pipelineResult.report.quality_assessment_summary.score}/100 (${pipelineResult.report.quality_assessment_summary.grade})
Laplacian Blur Metric: ${pipelineResult.report.quality_assessment_summary.blur_metric} (Threshold >= 45.0)
Signal-to-Noise Ratio: ${pipelineResult.report.quality_assessment_summary.snr_db} dB

PREPROCESSING (Agent 4):
Pipeline Version: ${pipelineResult.report.preprocessing_pipeline.version}
Windowing Applied: ${pipelineResult.report.preprocessing_pipeline.windowing}
Resampling: ${pipelineResult.report.preprocessing_pipeline.resampling}

AI DIAGNOSTIC INFERENCE (Agent 5):
Architecture: ${pipelineResult.report.model_metadata.name} (${pipelineResult.report.model_metadata.version})
Primary Finding: ${pipelineResult.primary_diagnosis}
Confidence: ${pipelineResult.confidence_percentage}%
Severity Tier: ${pipelineResult.severity}
Clinical Urgency: ${pipelineResult.urgency}

POSITIVE RADIOLOGICAL FINDINGS:
${pipelineResult.positive_findings.map((f) => `- ${f.name}: ${f.percentage}% (Cutoff: ${f.threshold_percentage}%) -> ${f.description}`).join('\n')}

EXPLAINABILITY & LOCALIZATION (Agent 6):
Localization: ${String(pipelineResult.stages.agent_6_explainability.anatomical_localization)}
Attribution: ${String((pipelineResult.stages.agent_6_explainability as { attribution_narrative?: unknown })?.attribution_narrative ?? '')}

RECOMMENDED CLINICAL ACTIONS:
${pipelineResult.report.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

REGULATORY DISCLAIMER:
${pipelineResult.report.medical_disclaimer}
========================================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pipelineResult.report.report_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 sm:p-6 md:p-8 font-sans">
      {/* Patient Top Identity Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold uppercase tracking-wider">
                Personalized Patient Portal
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                DPDP Act 2023 &amp; HIPAA Sovereign Consent
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                Demonstration Mode (Synthetic Cohort)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
              Welcome back, Rahul Sharma
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Patient ID: <span className="font-mono text-slate-900 font-semibold">MIP-8842-X</span> · Age: 54Y · Male · Facility: Metro General Hospital · ABHA:{' '}
              {abhaVerified ? <span className="text-emerald-700 font-bold">Verified</span> : <span className="text-slate-500">Not Linked</span>}
            </p>
          </div>

          {/* Service Switcher & Quick Meta */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs flex items-center gap-2 shadow-xs">
              <span className="text-slate-500 font-medium">Target Service:</span>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-teal-800 font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-teal-600 focus:bg-white"
              >
                {services.map((srv) => (
                  <option key={srv.id} value={srv.id} className="bg-white text-slate-900">
                    {srv.shortName} ({srv.modality})
                  </option>
                ))}
              </select>
            </div>

            <Link
              href="/eka"
              className="px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Open Eka.care Day-to-Day Health Manager"
            >
              <Heart className="w-3.5 h-3.5 fill-white" />
              <span>Eka.care Day-to-Day Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pt-4 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Diagnostic Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ehr')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'ehr'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Electronic Health Records (EHR)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('abha')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'abha'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Identity &amp; ABHA Linking</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('consent')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'consent'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Privacy &amp; DPDP Consent</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* ============================================================== */}
        {/* TAB 1: AI DIAGNOSTIC STUDIO & MULTI-AGENT WORKFLOW */}
        {/* ============================================================== */}
        {activeTab === 'studio' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Service Scope & Medical Disclaimer Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-teal-50/70 via-emerald-50/40 to-teal-50/50 border border-teal-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-800 uppercase tracking-wider">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  <span>Selected Service: {activeService.name}</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{activeService.tagline}</p>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Supported formats: <strong className="text-slate-800">DICOM (.dcm, .dicom)</strong>, PNG, JPEG. Validated for{' '}
                  <strong className="text-slate-800">{activeService.modality}</strong> imaging. Outputs are clinical decision-support
                  recommendations requiring qualified physician review.
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="px-3 py-1 rounded-xl bg-white border border-teal-200 text-teal-800 text-xs font-mono font-semibold shadow-xs">
                  Engine: DenseNet-121 NIH
                </span>
              </div>
            </div>

            {/* Upload & Ingestion Zone */}
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Upload className="w-5 h-5 text-teal-600" />
                <span>Upload Medical Study For 7-Agent Diagnostic Pipeline</span>
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Uploaded files pass through rigorous validation, image quality assessment, modality-specific preprocessing, neural inference, and Grad-CAM explainability.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Drag-and-drop file selector */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="md:col-span-2 border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/60 hover:bg-teal-50/30 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dcm,.dicom,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {selectedFile ? selectedFile.name : 'Click to select or drag and drop a medical image study'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    DICOM (.dcm), Frontal Radiograph (.png, .jpg) · Up to 100MB
                  </span>
                </div>

                {/* Instant 1-Click Demo Study Button */}
                <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Instant Clinical Demo</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Standard Chest Study</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      Test the pipeline immediately with our pre-loaded certified Chest X-Ray DICOM study (<code className="text-teal-700 font-mono font-semibold">sample_cxr.dcm</code>).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleLoadDemo}
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Running Pipeline…</span>
                      </>
                    ) : (
                      <>
                        <span>Load Demo DICOM Study</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                  <div>
                    <span className="font-bold block">Pipeline Exception</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Observable 7-Agent Stepper Progress */}
            {(isProcessing || pipelineResult) && (
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-teal-600" />
                      <span>Observable 7-Agent Diagnostic Pipeline</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Deterministic verification, quality filters, and PyTorch deep neural inference.
                    </p>
                  </div>
                  {pipelineResult && (
                    <span className="text-xs font-mono font-semibold text-emerald-800 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
                      Total Latency: {pipelineResult.total_duration_ms}ms · All 7 Agents Conforming
                    </span>
                  )}
                </div>

                {/* Agent Stepper Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { id: 1, name: 'Upload Validation', role: 'Agent 1', timing: pipelineResult?.stage_timings_ms?.agent_1 },
                    { id: 2, name: 'Context & Routing', role: 'Agent 2', timing: pipelineResult?.stage_timings_ms?.agent_2 },
                    { id: 3, name: 'Quality Check', role: 'Agent 3', timing: pipelineResult?.stage_timings_ms?.agent_3 },
                    { id: 4, name: 'Preprocessing', role: 'Agent 4', timing: pipelineResult?.stage_timings_ms?.agent_4 },
                    { id: 5, name: 'AI Inference', role: 'Agent 5', timing: pipelineResult?.stage_timings_ms?.agent_5 },
                    { id: 6, name: 'Explainability', role: 'Agent 6', timing: pipelineResult?.stage_timings_ms?.agent_6 },
                    { id: 7, name: 'Report & QC', role: 'Agent 7', timing: pipelineResult?.stage_timings_ms?.agent_7 },
                  ].map((agent) => {
                    const isDone = currentStep >= agent.id;
                    const isCurrent = currentStep === agent.id && isProcessing;
                    return (
                      <div
                        key={agent.id}
                        onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isDone
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                            : isCurrent
                            ? 'bg-teal-50 border-teal-400 text-teal-900 font-bold animate-pulse'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                          <span className={isDone ? 'text-emerald-700' : isCurrent ? 'text-teal-700' : 'text-slate-400'}>{agent.role}</span>
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : isCurrent ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                          )}
                        </div>
                        <span className="font-bold block truncate">{agent.name}</span>
                        {agent.timing !== undefined && (
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{agent.timing}ms</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Expanded Inspection Box for Agents */}
                {pipelineResult && expandedAgent && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                      <span className="font-bold text-teal-300">
                        Agent {expandedAgent} Telemetry &amp; Deterministic Outputs
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedAgent(null)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    {expandedAgent === 1 && (
                      <div className="space-y-1 font-mono text-[11px] text-slate-300">
                        <p>Format Signature: {String(pipelineResult.stages.agent_1_validation.file_signature)}</p>
                        <p>MIME Type: {String(pipelineResult.stages.agent_1_validation.mime_type)}</p>
                        <p>Size: {String(pipelineResult.stages.agent_1_validation.file_size_kb)} KB</p>
                        <p>Integrity Hash: {String(pipelineResult.stages.agent_1_validation.sha256_hash)}</p>
                        <p className="text-emerald-400">Verdict: {String(pipelineResult.stages.agent_1_validation.authenticity_verdict)}</p>
                      </div>
                    )}
                    {expandedAgent === 2 && (
                      <div className="space-y-1 font-mono text-[11px] text-slate-300">
                        <p>Target Service: {String(pipelineResult.stages.agent_2_clinical_compatibility.selected_service)}</p>
                        <p>Detected Modality / Anatomy: {String(pipelineResult.stages.agent_2_clinical_compatibility.detected_modality)} ({String(pipelineResult.stages.agent_2_clinical_compatibility.detected_anatomy)})</p>
                        <p>Non-Biasing Isolation: {pipelineResult.stages.agent_2_clinical_compatibility.patient_context.non_biasing_enforcement}</p>
                        <p className="text-emerald-400">Decision: Compatible</p>
                      </div>
                    )}
                    {expandedAgent === 3 && (
                      <div className="space-y-1 font-mono text-[11px] text-slate-300">
                        <p>Resolution: {String(pipelineResult.stages.agent_3_quality_assessment.dimensions)}</p>
                        <p>Laplacian Blur Variance: {String(pipelineResult.stages.agent_3_quality_assessment.laplacian_variance)} (Threshold: 45.0)</p>
                        <p>SNR: {String(pipelineResult.stages.agent_3_quality_assessment.snr_db)} dB · Grade: {String(pipelineResult.stages.agent_3_quality_assessment.quality_grade)}</p>
                        <p className="text-emerald-400">Decision: Suitable for diagnostic analysis</p>
                      </div>
                    )}
                    {expandedAgent === 4 && (
                      <div className="space-y-1 font-mono text-[11px] text-slate-300">
                        <p>Windowing: {String(pipelineResult.stages.agent_4_preprocessing.windowing_applied)}</p>
                        <p>Resampling: {String(pipelineResult.stages.agent_4_preprocessing.resampling_grid)}</p>
                        <p>Tensor Shape: {JSON.stringify(pipelineResult.stages.agent_4_preprocessing.input_tensor_shape)}</p>
                      </div>
                    )}
                    {expandedAgent === 5 && (
                      <div className="space-y-1 font-mono text-[11px] text-slate-300">
                        <p>Model: {String(pipelineResult.stages.agent_5_ai_inference.model_architecture)}</p>
                        <p>Primary Finding: {String(pipelineResult.stages.agent_5_ai_inference.primary_diagnosis)} ({String(pipelineResult.stages.agent_5_ai_inference.primary_confidence_pct)}%)</p>
                        <p>Calibrated Threshold: {pipelineResult.stages.agent_5_ai_inference.calibrated_threshold * 100}%</p>
                        <p className="text-amber-400">Severity: {String(pipelineResult.stages.agent_5_ai_inference.severity)}</p>
                      </div>
                    )}
                    {expandedAgent === 6 && (
                      <div className="space-y-1 font-mono text-[11px] text-slate-300">
                        <p>Attribution Method: {String(pipelineResult.stages.agent_6_explainability.method)}</p>
                        <p>Localization: {String(pipelineResult.stages.agent_6_explainability.anatomical_localization)}</p>
                        <p className="text-slate-400">{String((pipelineResult.stages.agent_6_explainability as { uncertainty_caveat?: unknown })?.uncertainty_caveat ?? '')}</p>
                      </div>
                    )}
                    {expandedAgent === 7 && (
                      <div className="space-y-1 font-mono text-[11px] text-slate-300">
                        <p>Report ID: {String(pipelineResult.stages.agent_7_report_generation.report_id)}</p>
                        <p>Digital Seal: {String(pipelineResult.stages.agent_7_report_generation.digital_signature)}</p>
                        <p className="text-emerald-400">Status: {String(pipelineResult.stages.agent_7_report_generation.verification_status)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* RESULTS VIEWPORT: Multi-mode Viewer & Diagnostic Findings */}
            {pipelineResult && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
                {/* Left Column: Interactive Image & Saliency Viewer */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Eye className="w-4 h-4 text-teal-600" />
                          <span>Multi-Modal Radiologic Viewport</span>
                        </h3>
                        <span className="text-[11px] text-slate-500">
                          Toggle between raw scan, preprocessed tensor, and Grad-CAM attention heatmap.
                        </span>
                      </div>

                      {/* View mode toggle buttons */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setViewMode('original')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            viewMode === 'original' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Raw Scan
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('enhanced')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            viewMode === 'enhanced' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Enhanced
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('heatmap')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            viewMode === 'heatmap' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Grad-CAM Heatmap
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('blend')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            viewMode === 'blend' ? 'bg-teal-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Blend
                        </button>
                      </div>
                    </div>

                    {/* Viewport Canvas Frame - High-contrast black for medical radiological scan display */}
                    <div className="relative aspect-square max-h-[500px] w-full rounded-xl bg-black border border-slate-200 overflow-hidden flex items-center justify-center p-2">
                      {viewMode === 'original' && (
                        <img
                          src={`data:image/png;base64,${pipelineResult.original_image_b64}`}
                          alt="Original Radiographic Scan"
                          className="max-h-full max-w-full object-contain rounded"
                        />
                      )}
                      {viewMode === 'enhanced' && (
                        <img
                          src={`data:image/png;base64,${pipelineResult.preprocessed_image_b64}`}
                          alt="Preprocessed and Windowed Scan"
                          className="max-h-full max-w-full object-contain rounded"
                        />
                      )}
                      {viewMode === 'heatmap' && (
                        <img
                          src={`data:image/png;base64,${pipelineResult.gradcam_heatmap_b64}`}
                          alt="Grad-CAM Saliency Overlay"
                          className="max-h-full max-w-full object-contain rounded"
                        />
                      )}
                      {viewMode === 'blend' && (
                        <div className="relative max-h-full max-w-full">
                          <img
                            src={`data:image/png;base64,${pipelineResult.preprocessed_image_b64}`}
                            alt="Base enhanced image"
                            className="max-h-full max-w-full object-contain rounded"
                          />
                          <img
                            src={`data:image/png;base64,${pipelineResult.gradcam_heatmap_b64}`}
                            alt="Heatmap overlay"
                            style={{ opacity: overlayOpacity / 100 }}
                            className="absolute inset-0 max-h-full max-w-full object-contain rounded mix-blend-screen"
                          />
                        </div>
                      )}

                      {/* Technical metadata HUD overlay */}
                      <div className="absolute top-4 left-4 p-2 rounded-lg bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-[10px] font-mono text-slate-300 pointer-events-none space-y-0.5">
                        <p className="text-teal-400 font-bold">CASE: {pipelineResult.case_id.split('-').slice(0, 2).join('-')}</p>
                        <p>MODALITY: {String(pipelineResult.stages.agent_2_clinical_compatibility.detected_modality)}</p>
                        <p>DIM: {String(pipelineResult.stages.agent_3_quality_assessment.dimensions)}</p>
                        <p>WINDOW: LUNG HU</p>
                      </div>

                      <div className="absolute bottom-4 right-4 p-2 rounded-lg bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-[10px] font-mono text-slate-300 pointer-events-none">
                        <span>Attribution: {pipelineResult.primary_diagnosis}</span>
                      </div>
                    </div>

                    {/* Blend Opacity Slider */}
                    {viewMode === 'blend' && (
                      <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4 text-xs">
                        <SlidersHorizontal className="w-4 h-4 text-teal-600" />
                        <span className="text-slate-700 font-semibold whitespace-nowrap">Heatmap Opacity:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={overlayOpacity}
                          onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                          className="w-full accent-teal-600 cursor-pointer"
                        />
                        <span className="font-mono text-teal-700 font-bold w-10 text-right">{overlayOpacity}%</span>
                      </div>
                    )}
                  </div>

                  {/* Anatomical Localization & Explainability Note */}
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-2">
                    <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      <span>Agent 6 Explainability &amp; Anatomical Focus</span>
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {String((pipelineResult.stages.agent_6_explainability as { attribution_narrative?: unknown })?.attribution_narrative ?? '')}
                    </p>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 mt-2">
                      <strong className="text-slate-900 block mb-0.5">Clinical Caveat:</strong>
                      {String((pipelineResult.stages.agent_6_explainability as { uncertainty_caveat?: unknown })?.uncertainty_caveat ?? '')}
                    </div>
                  </div>
                </div>

                {/* Right Column: AI Findings, Probabilities, & Report Actions */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Primary Diagnosis Alert Card */}
                  <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Primary AI-Detected Finding
                        </span>
                        <h3 className="text-2xl font-black text-slate-900 mt-0.5">{pipelineResult.primary_diagnosis}</h3>
                      </div>
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono ${
                          pipelineResult.severity === 'CRITICAL'
                            ? 'bg-rose-50 border border-rose-200 text-rose-700'
                            : pipelineResult.severity === 'HIGH'
                            ? 'bg-amber-50 border border-amber-200 text-amber-800'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        }`}
                      >
                        {pipelineResult.severity}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-600 font-semibold">Model Confidence:</span>
                      <span className="text-lg font-black text-teal-700 font-mono">
                        {pipelineResult.confidence_percentage}%
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <strong className="block mb-0.5 font-bold">Urgency Guidance:</strong>
                      <span>{pipelineResult.urgency}</span>
                    </div>

                    {/* All Evaluated Pathologies Accordion */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        Evaluated Thoracic Pathologies (14 Categories)
                      </span>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {pipelineResult.all_pathologies.map((patho) => (
                          <div
                            key={patho.name}
                            className={`p-2.5 rounded-xl border text-xs transition-all ${
                              patho.positive
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span>{patho.name}</span>
                              <span className="font-mono">
                                {patho.percentage}%{' '}
                                <small className="text-slate-500 font-normal">
                                  (Cutoff: {patho.threshold_percentage}%)
                                </small>
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  patho.positive ? 'bg-rose-500' : 'bg-teal-600'
                                }`}
                                style={{ width: `${Math.min(100, patho.percentage)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Report Download and Escalation CTA */}
                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleDownloadReport}
                        className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Certified Report</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEscalateModalOpen(true)}
                        className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Stethoscope className="w-4 h-4 text-teal-600" />
                        <span>Request Clinician Review</span>
                      </button>
                    </div>
                  </div>

                  {/* Plain Language Explanation for Patient */}
                  <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 p-5 shadow-xs space-y-2">
                    <h4 className="text-sm font-bold text-teal-800 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-teal-600" />
                      <span>Plain-Language Summary For You</span>
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {String((pipelineResult.report as { plain_language_patient_summary?: unknown })?.plain_language_patient_summary ?? '')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ELECTRONIC HEALTH RECORDS (EHR) INTEGRATION */}
        {/* ============================================================== */}
        {activeTab === 'ehr' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Modular EHR Integration Layer · Live Sandbox</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">Authorized Patient Clinical Records</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connected Provider: <strong className="text-slate-800">Metro General Hospital HIE</strong> (FHIR R4 Endpoint)
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-teal-800">
                  FHIR Patient ID: urn:uuid:mipaas-ehr-8842
                </span>
              </div>

              {/* Patient Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
                {/* Chronic Conditions */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-600" />
                    <span>Diagnosed Conditions</span>
                  </h3>
                  <ul className="text-xs text-slate-700 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-slate-900 block">Type 2 Diabetes Mellitus</strong>
                        <span className="text-[11px] text-slate-500">Diagnosed 2021 · Controlled (HbA1c 6.8%)</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-slate-900 block">Mild Chronic Bronchitis</strong>
                        <span className="text-[11px] text-slate-500">Occasional seasonal exacerbations</span>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Allergies & Contraindications */}
                <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 space-y-3">
                  <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Allergies &amp; Contraindications</span>
                  </h3>
                  <ul className="text-xs text-slate-700 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-slate-900 block">Penicillin G (Cutaneous)</strong>
                        <span className="text-[11px] text-rose-700">Severe maculopapular rash</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-slate-900 block">Iodinated Radiographic Contrast</strong>
                        <span className="text-[11px] text-amber-800">Mild pruritus · Premedication required</span>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Current Active Medications */}
                <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-200 space-y-3">
                  <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-teal-600" />
                    <span>Active Medications</span>
                  </h3>
                  <ul className="text-xs text-slate-700 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-slate-900 block">Metformin 500mg BID</strong>
                        <span className="text-[11px] text-slate-500">Oral hypoglycemic · Ongoing</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-slate-900 block">Salbutamol Inhaler 100mcg</strong>
                        <span className="text-[11px] text-slate-500">PRN for wheezing or cough</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Longitudinal Medical Imaging Timeline */}
              <div className="pt-6 border-t border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Prior Diagnostic Imaging Timeline</span>
                </h3>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">Chest Radiograph PA &amp; Lateral</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Verified Normal
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        Date: August 14, 2025 · Attending: Dr. Elena Vance, MD · Mount Sinai Health
                      </span>
                      <p className="text-xs text-slate-600 mt-1">
                        Clear lung fields bilaterally. Cardiothoracic ratio within normal physiological limits. No acute consolidation.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-500">SERIES-2025-0814</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">Plantar Infrared Thermogram (qThermo)</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          Symmetric (ΔT &lt; 0.4°C)
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        Date: November 02, 2024 · Podiatry Screening Clinic
                      </span>
                      <p className="text-xs text-slate-600 mt-1">
                        Normal bilateral thermal symmetry across medial plantar and hallux angiosomes. Zero pre-ulcerative hyperthermia.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-500">SERIES-2024-1102</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: IDENTITY & AADHAAR / ABHA INTEGRATION */}
        {/* ============================================================== */}
        {activeTab === 'abha' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-teal-600" />
                    <span>Ayushman Bharat Digital Mission (ABDM / ABHA) Identity</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Optional identity verification with strict DPDP Act 2023 privacy safeguards.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  Zero Aadhaar Storage Policy
                </span>
              </div>

              {/* Crucial Safeguard Disclaimer */}
              <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200 space-y-2 text-teal-950">
                <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-600" />
                  <span>Mandatory Privacy Architecture Principles</span>
                </h3>
                <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                  <li>
                    <strong>Never an EHR Repository:</strong> Aadhaar / ABHA is purely an identity-verification instrument, not a medical record repository.
                  </li>
                  <li>
                    <strong>No Storage of 12-digit Aadhaar:</strong> We do not store your Aadhaar number or demographic biometrics on any MiPAAS server.
                  </li>
                  <li>
                    <strong>Separation of Identity &amp; Clinical Records:</strong> Identity verification is maintained strictly separate from clinical record authorization.
                  </li>
                  <li>
                    <strong>No Automatic Record Merging:</strong> Scans and records are never merged automatically based only on phone numbers or Aadhaar IDs without explicit doctor-patient consent.
                  </li>
                </ul>
              </div>

              {/* ABHA Verification Form */}
              <div className="max-w-md p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Link Your ABHA Health ID</h3>
                <p className="text-xs text-slate-500">
                  Enter your 14-digit ABHA address (e.g., <code className="text-teal-700 font-semibold font-mono">91-8842-1209-4412</code>) to verify your patient profile.
                </p>

                {abhaVerified ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>ABHA Identity Linked Successfully</span>
                    </div>
                    <p className="text-[11px] text-slate-700">
                      Tokenized ABHA Address: <span className="font-mono text-slate-900 font-bold">rahul.sharma@abdm</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Consent Artifact: ABDM-CONSENT-9941-VERIFIED
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-700 block mb-1 font-semibold">14-Digit ABHA ID</label>
                      <input
                        type="text"
                        placeholder="91-8842-1209-4412"
                        value={abhaNumber}
                        onChange={(e) => setAbhaNumber(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600"
                      />
                    </div>

                    {!abhaOtpSent ? (
                      <button
                        type="button"
                        onClick={() => setAbhaOtpSent(true)}
                        className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                      >
                        Request Mobile OTP Challenge
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-700 block mb-1 font-semibold">
                            Enter 6-Digit OTP sent to UIDAI registered mobile
                          </label>
                          <input
                            type="text"
                            placeholder="123456"
                            value={abhaOtp}
                            onChange={(e) => setAbhaOtp(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setAbhaVerified(true)}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                        >
                          Verify &amp; Link Profile
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CONSENT CONTROLS & DPDP 2023 DATA RIGHTS */}
        {/* ============================================================== */}
        {activeTab === 'consent' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Dynamic Consent Controls */}
            <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-teal-600" />
                    <span>Digital Personal Data Protection (DPDP) Act 2023 Sovereign Consent</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    You hold full granular rights under India&apos;s DPDP Act 2023. Toggle permissions or withdraw consent at any time.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">Primary Diagnostic Care</span>
                    <span className="text-xs text-slate-500">
                      Essential for doctors and clinical care teams to interpret your scans.
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 px-3 py-1 rounded bg-emerald-50 border border-emerald-200">Required</span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">Hospital Quality Assurance (QA)</span>
                    <span className="text-xs text-slate-500">
                      Used by internal clinical peer review committees to audit scan quality.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleConsent('institutional_qa')}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      consents.institutional_qa ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-1 ${
                        consents.institutional_qa ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">Secondary Academic Research</span>
                    <span className="text-xs text-slate-500">
                      Allow fully de-identified imaging tensors to be used by university medical studies.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleConsent('secondary_research')}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      consents.secondary_research ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-1 ${
                        consents.secondary_research ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">Commercial AI Model Training</span>
                    <span className="text-xs text-slate-500">
                      Allow third-party AI algorithm improvement using pseudonymized data.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleConsent('commercial_ai')}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      consents.commercial_ai ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-1 ${
                        consents.commercial_ai ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Expiring Secure Share Links & Right to Erasure */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Share Link Card */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-teal-600" />
                  <span>Time-Limited Share Link</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Generate a secure, expiring link protected with an SMS code for second opinions with family physicians.
                </p>

                {shareLinkActive ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-teal-300 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-teal-800 font-semibold">
                      <span>https://mipaas.app/s/pt-8842?exp=7d</span>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Expires in 7 days · Access requires OTP SMS challenge</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShareLinkActive(true)}
                    className="w-full py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Generate 7-Day Expiring Link
                  </button>
                )}
              </div>

              {/* Right to Erasure Card */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                  <span>Right to Erasure (DPDP Act 2023)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Request irreversible deletion of your non-statutory medical records and research tensors from our cloud storage.
                </p>

                {erasureSubmitted ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Erasure request CERT-ERASURE-MIP88 submitted. Processing within 24h SLA.</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setErasureModalOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Submit Data Erasure Request
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Erasure */}
      {erasureModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Confirm Data Erasure Request</span>
            </h3>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Agent 7 (Consent &amp; Privacy L2) will execute cascading deletion of your uploaded DICOM files,
              extracted feature matrices, and patient portal account from GCS, Firestore, and Memorystore Redis.
            </p>
            <p className="text-[11px] text-slate-500 mt-2">
              Note: Statutory medical records retained by Metro General Hospital under the National Medical Commission (NMC) 3-year statutory malpractice laws remain sealed with hospital compliance.
            </p>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setErasureModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setErasureModalOpen(false);
                  setErasureSubmitted(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                Execute Erasure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clinician Review Escalation Modal */}
      {escalateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-600" />
              <span>Escalate to Attending Clinician</span>
            </h3>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Your AI-generated findings ({pipelineResult?.primary_diagnosis} - {pipelineResult?.confidence_percentage}%)
              will be directly routed into the attending radiologist queue at{' '}
              <strong className="text-slate-900">Metro General Hospital Department of Thoracic Radiology</strong>.
            </p>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 mt-3">
              <strong>STAT Protocol Notice:</strong> If you are experiencing acute shortness of breath, severe chest pain, or hemoptysis, please call emergency services immediately or visit the nearest emergency department.
            </div>

            {escalateSuccess ? (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Case #{pipelineResult?.case_id} routed to Dr. Sarah Lin (Turnaround SLA: 2 hours).</span>
              </div>
            ) : (
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEscalateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setEscalateSuccess(true)}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  Confirm Priority Escalation
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
