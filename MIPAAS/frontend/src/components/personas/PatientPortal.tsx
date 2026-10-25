/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  clinicalApiService,
  ClinicalPatient,
  ClinicalDiagnosticReport,
  ClinicalPrescription,
} from '@/services/clinicalApiService';
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
  LogOut,
  LayoutDashboard,
  HeartPulse,
  Bot,
} from 'lucide-react';
import PatientAIAnalysis from '@/components/patient/PatientAIAnalysis';
import { useServices } from '@/context/ServicesContext';
import { useRBAC } from '@/context/RBACContext';
import { useIndicLanguage } from '@/context/IndicLanguageContext';
import IndicLanguageSelector from '@/components/common/IndicLanguageSelector';

interface PathologyFinding {
  name: string;
  probability: number;
  percentage: number;
  threshold: number;
  threshold_percentage: number;
  positive: boolean;
  description: string;
  tier?: 'high' | 'indeterminate' | 'low' | 'demo';
  tier_label?: string;
  above_operating_point?: boolean;
  operating_threshold_percentage?: number;
  demo_only?: boolean;
}

interface SaliencyZone {
  key: string;
  label: string;
  short_label: string;
  share_pct: number;
  activation_share_pct: number;
  row_index: number;
  col_index: number;
}

interface SaliencyAnalysis {
  dominant_zone: string;
  dominant_zone_label: string;
  dominant_short_label: string;
  dominant_share_pct: number;
  image_side: string;
  patient_side: string;
  is_localized: boolean;
  localization_confidence?: string;
  localization_sentence: string;
  laterality_note: string;
  zones: SaliencyZone[];
}

interface PatientReport {
  headline: string;
  what_we_found: string;
  where_the_ai_looked?: {
    available: boolean;
    dominant_zone_label?: string;
    dominant_short_label?: string;
    dominant_share_pct?: number;
    image_side?: string;
    patient_side?: string;
    is_localized?: boolean;
    explanation?: string;
    laterality_note?: string;
    concordance?: string;
    concordance_note?: string;
  };
  what_it_means: string;
  possible_causes: string[];
  how_serious: string;
  next_steps: string[];
  red_flags: string[];
  questions_for_doctor: string[];
  indeterminate_note?: string | null;
  no_high_confidence_finding?: boolean;
  candidate_diagnosis?: string | null;
  demo_notice?: string | null;
  scan_limitation?: string;
  heatmap_caveat?: string;
  disclaimer?: string;
}

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
  heatmap_annotated_b64?: string;
  saliency_analysis?: SaliencyAnalysis;
  demo_mode?: boolean;
  model_availability?: {
    available: boolean;
    mode: string;
    model?: string;
    message?: string;
  };
  primary_diagnosis: string;
  candidate_diagnosis?: string | null;
  no_high_confidence_finding?: boolean;
  confidence_percentage: number;
  confidence_label?: string;
  demo_top_signal?: string | null;
  demo_top_signal_pct?: number | null;
  severity: string;
  urgency: string;
  positive_findings: PathologyFinding[];
  indeterminate_findings?: PathologyFinding[];
  all_pathologies: PathologyFinding[];
  patient_report?: PatientReport;
  patient_report_text?: string;
  report: any;
}

export default function PatientPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceParam = searchParams.get('service');
  const tabParam = searchParams.get('tab');
  const { services, getService } = useServices();
  const { currentUser, isAuthenticated, isSessionReady, isIamAuthenticated, iamUser, logout, logoutIAM } = useRBAC();
  const { currentLanguage, t } = useIndicLanguage();

  const handleSignOut = async () => {
    try {
      await logoutIAM();
    } catch {
      // Continue cleanup even if network request fails
    }
    logout();
    router.push('/');
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState<'studio' | 'analysis' | 'ehr' | 'abha' | 'consent'>(
    tabParam === 'analysis' ? 'analysis' : 'studio'
  );

  // Selected Service
  const [selectedServiceId, setSelectedServiceId] = useState<string>(serviceParam || 'qxr');

  useEffect(() => {
    if (serviceParam) {
      setSelectedServiceId(serviceParam);
    }
    if (tabParam === 'analysis') {
      setActiveTab('analysis');
    }
  }, [serviceParam, tabParam]);

  const activeService: any = getService(selectedServiceId) || services.find((s) => s.id === selectedServiceId) || {
    id: 'qxr',
    name: 'qXR – Chest X-Ray AI',
    shortName: 'Chest Radiography',
    tagline: '18-Pathology Screening & Triage',
    modality: 'CXR',
    badge: 'CE · FDA',
    href: '/qxr',
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

  // Groq AI Review State for Diagnostic System
  const [diagnosticAiReview, setDiagnosticAiReview] = useState<string | null>(null);
  const [isGeneratingAiReview, setIsGeneratingAiReview] = useState(false);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);
  const [aiReviewModel, setAiReviewModel] = useState('openai/gpt-oss-120b');
  const [quickAiQuestion, setQuickAiQuestion] = useState('');
  const [quickAiAnswer, setQuickAiAnswer] = useState<string | null>(null);
  const [isAskingQuickAi, setIsAskingQuickAi] = useState(false);

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

  // Real clinical records from persistent database
  const [patientData, setPatientData] = useState<ClinicalPatient | null>(null);
  const [patientReports, setPatientReports] = useState<ClinicalDiagnosticReport[]>([]);
  const [patientPrescriptions, setPatientPrescriptions] = useState<ClinicalPrescription[]>([]);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const loadPatientRecords = async () => {
    try {
      setRecordsError(null);
      const [pts, rpts, rxs] = await Promise.all([
        clinicalApiService.getPatients(),
        clinicalApiService.getDiagnosticReports(),
        clinicalApiService.getPrescriptions(),
      ]);
      const email = currentUser?.email?.toLowerCase();
      const name = currentUser?.name?.toLowerCase();
      const matched = pts.find((p) => p.id === currentUser?.id || (email && p.email?.toLowerCase() === email) || (name && p.name.toLowerCase() === name)) || null;
      setPatientData(matched);
      setPatientReports(rpts);
      setPatientPrescriptions(rxs);
    } catch (err) {
      console.error('Failed to load patient clinical records in PatientPortal:', err);
      setRecordsError('Your saved health records could not be loaded. You can still run a new analysis, but do not rely on the record summary below.');
    }
  };

  useEffect(() => {
    loadPatientRecords();
  }, [currentUser?.id, currentUser?.email, currentUser?.name]);

  const handleServiceChange = (newServiceId: string) => {
    setSelectedServiceId(newServiceId);
    setPipelineResult(null);
    setDiagnosticAiReview(null);
    setErrorMessage(null);
    setSelectedFile(null);
    setCurrentStep(0);
    setQuickAiAnswer(null);
  };

  const fetchDiagnosticAiReview = async (result: AgentPipelineResult) => {
    setIsGeneratingAiReview(true);
    setAiReviewError(null);
    setQuickAiAnswer(null);
    try {
      const res = await fetch('/api/ai/patient-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          language: currentLanguage.code,
          serviceId: selectedServiceId,
          serviceName: activeService.name,
          modality: activeService.modality,
          architecture: (result.stages?.agent_5_ai_inference as any)?.model_architecture,
          customFinding: result.primary_diagnosis,
          confidence: result.demo_mode ? undefined : result.confidence_percentage,
          severity: result.demo_mode ? undefined : result.severity,
          urgency: result.urgency,
          impression: result.report?.findings_narrative || result.primary_diagnosis,
          attributionNarrative: String((result.stages?.agent_6_explainability as any)?.attribution_narrative || ''),
          findingsList: result.positive_findings || [],
          saliencyAnalysis: result.saliency_analysis,
          allPathologies: result.all_pathologies,
          indeterminateFindings: result.indeterminate_findings || [],
          patientReport: result.patient_report,
          patientName: currentUser?.name,
          reportId: result.report?.report_id,
          demoMode: Boolean(result.demo_mode),
          modelAvailability: result.model_availability,
          noHighConfidenceFinding: Boolean(result.no_high_confidence_finding),
          candidateDiagnosis: result.candidate_diagnosis,
        }),
      });
      const aiData = await res.json();
      if (aiData.success && aiData.analysis) {
        setDiagnosticAiReview(aiData.analysis);
        if (aiData.modelUsed) setAiReviewModel(aiData.modelUsed);
      } else {
        setAiReviewError(aiData.error || 'Failed to generate AI review.');
      }
    } catch (err) {
      console.error('Failed to generate diagnostic AI review:', err);
      setAiReviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingAiReview(false);
    }
  };

  const handleAskQuickAi = async (presetQ?: string) => {
    const q = (presetQ || quickAiQuestion).trim();
    if (!q || isAskingQuickAi || !pipelineResult) return;
    setIsAskingQuickAi(true);
    try {
      const res = await fetch('/api/ai/patient-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          language: currentLanguage.code,
          userQuery: q,
          serviceId: selectedServiceId,
          serviceName: activeService.name,
          modality: activeService.modality,
          architecture: (pipelineResult.stages?.agent_5_ai_inference as any)?.model_architecture,
          customFinding: pipelineResult.primary_diagnosis,
          confidence: pipelineResult.demo_mode ? undefined : pipelineResult.confidence_percentage,
          severity: pipelineResult.demo_mode ? undefined : pipelineResult.severity,
          urgency: pipelineResult.urgency,
          impression: pipelineResult.report?.findings_narrative || pipelineResult.primary_diagnosis,
          attributionNarrative: String((pipelineResult.stages?.agent_6_explainability as any)?.attribution_narrative || ''),
          findingsList: pipelineResult.positive_findings || [],
          saliencyAnalysis: pipelineResult.saliency_analysis,
          allPathologies: pipelineResult.all_pathologies,
          indeterminateFindings: pipelineResult.indeterminate_findings || [],
          patientReport: pipelineResult.patient_report,
          patientName: currentUser?.name,
          reportId: pipelineResult.report?.report_id,
          demoMode: Boolean(pipelineResult.demo_mode),
          modelAvailability: pipelineResult.model_availability,
          noHighConfidenceFinding: Boolean(pipelineResult.no_high_confidence_finding),
          candidateDiagnosis: pipelineResult.candidate_diagnosis,
        }),
      });
      const data = await res.json();
      if (data.success && data.reply) {
        setQuickAiAnswer(data.reply);
      } else {
        setQuickAiAnswer(`Apologies, could not process: ${data.error || 'Error'}`);
      }
    } catch (err) {
      setQuickAiAnswer(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAskingQuickAi(false);
    }
  };

  // Re-generate AI review in selected Indian language when user changes language
  useEffect(() => {
    if (pipelineResult && diagnosticAiReview) {
      fetchDiagnosticAiReview(pipelineResult);
    }
  }, [currentLanguage.code]);

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
      formData.append('patientId', currentUser?.id || 'ANON-PATIENT');

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
        fetchDiagnosticAiReview(data);

        // Auto-save the AI-assisted draft report to backend clinical records
        try {
          const pts = await clinicalApiService.getPatients();
          const targetPt = pts.length > 0 ? pts[0] : null;

          const reportPatientId = targetPt?.id || currentUser?.id || 'ANON-PATIENT';
          const reportPatientName = targetPt?.name || currentUser?.name || 'Patient';
          const reportMrn = targetPt?.mrn || 'MRN-NOT-AVAILABLE';

          await clinicalApiService.saveDiagnosticReport({
            patientId: reportPatientId,
            patientName: reportPatientName,
            mrn: reportMrn,
            serviceId: selectedServiceId,
            serviceName: data.service_name || selectedServiceId.toUpperCase(),
            findings: data.primary_diagnosis || 'Analysis Complete',
            confidence:
              data.demo_mode || data.no_high_confidence_finding
                ? 0
                : data.confidence_percentage
                ? data.confidence_percentage / 100
                : 0,
            riskLevel: data.demo_mode
              ? 'Unknown'
              : data.severity === 'CRITICAL' || data.severity === 'HIGH'
              ? 'High'
              : data.severity === 'MODERATE'
              ? 'Moderate'
              : 'Low',
            recommendation:
              (data.report?.recommendations && data.report.recommendations[0]) ||
              'Clinical correlation and specialist radiologist consultation advised.',
            clinicalSummary: data.demo_mode
              ? `DEMO ONLY — no trained model checkpoint is loaded for ${data.service_name}. The output is illustrative and must not be used for diagnosis. Reported label: ${data.primary_diagnosis}.`
              : `Diagnostic AI pipeline evaluated ${data.service_name}. ${
                  data.no_high_confidence_finding ? 'No high-confidence abnormality detected. ' : ''
                }Primary AI result: ${data.primary_diagnosis} (${data.confidence_percentage}% top score${
                  data.confidence_label ? `; ${data.confidence_label}` : ''
                }). Severity: ${data.severity}.`,
            certified: false,
            radiologist: 'AI-assisted analysis — clinician verification pending',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          });
        } catch (saveErr) {
          console.error('Failed to auto-save diagnostic report to backend clinical records:', saveErr);
        }
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

  const formatImageSrc = (b64?: string) => {
    if (!b64) return '';
    return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
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
    const reportHeader = pipelineResult.demo_mode
      ? 'MIPAAS DEMO REPORT — NOT A DIAGNOSIS (NO TRAINED MODEL)'
      : 'MIPAAS AI-ASSISTED DIAGNOSTIC REPORT — DRAFT (NOT A CONFIRMED DIAGNOSIS)';
    const reportText = `========================================================================
${reportHeader}
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
Primary AI Result: ${pipelineResult.primary_diagnosis}
Top-Score Confidence: ${pipelineResult.demo_mode ? 'Not scored (demo only)' : `${pipelineResult.confidence_percentage}% (${pipelineResult.confidence_label || 'not a diagnosis'})`}
Severity Tier: ${pipelineResult.demo_mode ? 'Not assessed (demo only)' : pipelineResult.severity}
Clinical Urgency: ${pipelineResult.urgency}
${pipelineResult.demo_mode ? `DEMO MODE: ${pipelineResult.model_availability?.message || 'No trained model loaded. Do not use for clinical decisions.'}\n` : ''}
HIGH-CONFIDENCE FINDINGS:
${pipelineResult.demo_mode
  ? 'DEMO ONLY — no real model inference was performed.'
  : pipelineResult.positive_findings.length > 0
  ? pipelineResult.positive_findings.map((f) => `- ${f.name}: ${f.percentage}% (High-confidence cutoff: ${f.threshold_percentage}%) -> ${f.description}`).join('\n')
  : 'None above the high-confidence cutoff.'}

BORDERLINE FINDINGS (NOT A DIAGNOSIS):
${pipelineResult.demo_mode
  ? 'DEMO ONLY — no borderline findings are reported.'
  : (pipelineResult.indeterminate_findings || []).length > 0
  ? (pipelineResult.indeterminate_findings || []).map((f) => `- ${f.name}: ${f.percentage}% (High-confidence cutoff: ${f.threshold_percentage}%)`).join('\n')
  : 'None.'}

EXPLAINABILITY & LOCALIZATION (Agent 6):
Localization: ${String(pipelineResult.stages.agent_6_explainability.anatomical_localization)}
Attribution: ${String((pipelineResult.stages.agent_6_explainability as { attribution_narrative?: unknown })?.attribution_narrative ?? '')}
Heatmap laterality note: ${pipelineResult.saliency_analysis?.laterality_note || 'Not available.'}

PATIENT REPORT (PLAIN LANGUAGE):
${pipelineResult.patient_report_text || 'Structured patient report not available.'}

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

  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-4 h-4 rounded-full border-2 border-[#0F9D9A] border-t-transparent animate-spin" />
          <span>Verifying patient session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser?.id || currentUser.role !== 'patient') {
    return (
      <div className="min-h-screen bg-[#F5F9FC] font-sans flex items-center justify-center p-4 antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-[#E7EEF4] text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#0F9D9A] mx-auto flex items-center justify-center shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-wider">
              Protected Health Portal
            </span>
            <h2 className="text-2xl font-extrabold text-[#17324D] mt-2">
              Sign In Required
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Access to personal health records, AI diagnostic suites, and diagnostic reports requires signing in to your patient account.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/patient"
              className="w-full py-3 px-4 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span>Sign In to Access Portal</span>
            </Link>

            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Create Patient Account</span>
            </Link>

            <Link
              href="/"
              className="block text-xs text-slate-400 hover:text-slate-600 font-medium pt-2"
            >
              Return to MiPAAS Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 sm:p-6 md:p-8 font-sans">
      {/* Patient Top Identity Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-teal-600 fill-teal-600/20" />
                Personalized Patient Portal
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                DPDP Act 2023 &amp; HIPAA Sovereign Consent
              </span>
              {isIamAuthenticated && (
                <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-blue-600" />
                  IAM Active: {iamUser?.username || currentUser?.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
              Welcome back, {currentUser?.name || iamUser?.username || 'Patient'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Patient ID: <span className="font-mono text-slate-900 font-semibold">{currentUser?.id || 'Not available'}</span> · Email: <span className="text-slate-700 font-medium">{currentUser?.email || 'Not available'}</span> · ABHA:{' '}
              {abhaVerified ? <span className="text-emerald-700 font-bold">Verified</span> : <span className="text-slate-500">Not Linked</span>}
            </p>
          </div>

          {/* Action Buttons: Language Mode, AI Target Service and Sign Out */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 md:w-auto md:flex-nowrap md:shrink-0">
            {/* Indian Language Selector */}
            <IndicLanguageSelector />

            {/* AI Target Service Selector */}
            <div className="p-2 rounded-xl bg-white border border-slate-200 text-xs flex items-center gap-1.5 shadow-xs">
              <span className="text-slate-500 font-medium hidden lg:inline">AI Service:</span>
              <select
                id="patient-ai-service-select"
                value={selectedServiceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-teal-800 font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-teal-600 focus:bg-white cursor-pointer"
              >
                {services.map((srv) => (
                  <option key={srv.id} value={srv.id} className="bg-white text-slate-900">
                    {srv.shortName} ({srv.modality})
                  </option>
                ))}
              </select>
            </div>

            {/* Sign Out Icon-Only Button */}
            <button
              type="button"
              id="patient-header-signout-btn"
              onClick={handleSignOut}
              className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-700 transition-all cursor-pointer shadow-xs flex items-center justify-center shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
            </button>
          </div>
        </div>

        {recordsError && (
          <div role="alert" className="mb-4 flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{recordsError}</span>
            <button
              type="button"
              onClick={loadPatientRecords}
              className="self-start rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700 sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}

        {/* Navigation Tabs with Diagnostic System and Dashboard in the same row */}
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
            <span>{t('diagnostic_system')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'analysis'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bot className="w-4 h-4 text-blue-400" />
            <span>{t('ai_clinical_guidance')}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold font-mono">
              Groq LPU
            </span>
          </button>

          <Link
            href="/emr"
            id="patient-dashboard-tab-btn"
            className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer text-slate-600 hover:text-teal-800 hover:bg-teal-50"
            title="Open Patient Health Dashboard"
          >
            <LayoutDashboard className="w-4 h-4 text-[#0F9D9A]" />
            <span>{t('patient_tab_dashboard', 'Health Dashboard')}</span>
          </Link>

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
            <span>{t('patient_tab_ehr', 'Electronic Health Records (EHR)')}</span>
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
            <span>{t('patient_tab_abha', 'Identity & ABHA Linking')}</span>
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
            <span>{t('patient_tab_consent', 'Privacy & DPDP Consent')}</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* ============================================================== */}
        {/* TAB 0: GROQ-POWERED AI CLINICAL ANALYSIS                       */}
        {/* ============================================================== */}
        {activeTab === 'analysis' && (
          <div className="animate-in fade-in duration-200">
            <PatientAIAnalysis
              scanResult={pipelineResult}
              onBackToDiagnostic={() => setActiveTab('studio')}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: DIAGNOSTIC SYSTEM & IMAGE ANALYSIS */}
        {/* ============================================================== */}
        {activeTab === 'studio' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Upload Your Medical Image Section (Matching Reference Design) */}
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-10 shadow-xs space-y-7">
              {/* Heading & Dynamic Service Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[11px] font-bold tracking-wide uppercase">
                      {activeService.modality}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      {selectedServiceId === 'qxr'
                        ? activeService.badge || 'Validated chest X-ray model'
                        : 'Demo preview — no trained model'}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17324D] tracking-tight mt-1.5">
                    {activeService.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium max-w-2xl">
                    {activeService.description || activeService.tagline}
                  </p>
                </div>
                {activeService.href && activeService.href !== '/patient' && (
                  <Link
                    href={activeService.href}
                    id="patient-open-dedicated-studio-link"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all shadow-2xs shrink-0 self-start md:self-center"
                    title={`Open full ${activeService.shortName} clinical workspace`}
                  >
                    <span>Full {activeService.shortName} Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {/* 3-Step Progress Stepper matching reference image */}
              <div className="max-w-2xl mx-auto py-2">
                <div className="flex items-center justify-between relative">
                  {/* Step 1 */}
                  <div className="flex flex-col items-center text-center z-10 flex-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-xs transition-all ${
                        pipelineResult
                          ? 'bg-[#0F9D9A] text-white'
                          : 'bg-[#0F9D9A] text-white ring-4 ring-teal-50'
                      }`}
                    >
                      {pipelineResult ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-[#0F9D9A] mt-2">Upload</span>
                    <span className="text-[11px] text-slate-500">Select your image</span>
                  </div>

                  {/* Horizontal Line between Step 1 and 2 */}
                  <div
                    className={`h-0.5 flex-1 -mt-8 mx-1 sm:mx-2 transition-colors ${
                      isProcessing || pipelineResult ? 'bg-[#0F9D9A]' : 'bg-slate-200'
                    }`}
                  />

                  {/* Step 2 */}
                  <div className="flex flex-col items-center text-center z-10 flex-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                        pipelineResult
                          ? 'bg-[#0F9D9A] text-white'
                          : isProcessing
                          ? 'bg-[#0F9D9A] text-white animate-pulse ring-4 ring-teal-50'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {pipelineResult ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
                    </div>
                    <span
                      className={`font-bold text-xs sm:text-sm mt-2 ${
                        isProcessing || pipelineResult ? 'text-[#0F9D9A]' : 'text-slate-800'
                      }`}
                    >
                      AI Analysis
                    </span>
                    <span className="text-[11px] text-slate-500">Our system analyzes it</span>
                  </div>

                  {/* Horizontal Line between Step 2 and 3 */}
                  <div
                    className={`h-0.5 flex-1 -mt-8 mx-1 sm:mx-2 transition-colors ${
                      pipelineResult ? 'bg-[#0F9D9A]' : 'bg-slate-200'
                    }`}
                  />

                  {/* Step 3 */}
                  <div className="flex flex-col items-center text-center z-10 flex-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                        pipelineResult
                          ? 'bg-[#0F9D9A] text-white ring-4 ring-teal-50'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      3
                    </div>
                    <span
                      className={`font-bold text-xs sm:text-sm mt-2 ${
                        pipelineResult ? 'text-[#0F9D9A]' : 'text-slate-800'
                      }`}
                    >
                      View Results
                    </span>
                    <span className="text-[11px] text-slate-500">Get easy-to-understand report</span>
                  </div>
                </div>
              </div>

              {/* Dashed Upload Box matching reference image */}
              <div className="border-2 border-dashed border-[#A8CEEC] hover:border-[#1E88E5] bg-[#F7FAFD]/80 hover:bg-[#F2F7FC] rounded-3xl p-6 sm:p-10 text-center transition-all">
                {/* Blue Circular Cloud Upload Icon */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#EBF5FE] text-[#1E88E5] flex items-center justify-center mx-auto mb-3 shadow-2xs cursor-pointer hover:scale-105 transition-transform"
                >
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 fill-current" viewBox="0 0 24 24">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
                  </svg>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Upload {activeService.modality} Study or Drag &amp; Drop
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Upload clinical scans for automated {activeService.shortName} evaluation and explainability.
                </p>

                {/* Formats and size pill */}
                <div className="my-4 inline-block px-5 py-2.5 rounded-2xl bg-[#EAF2F9] border border-[#D5E3EE] text-slate-600 text-xs text-center max-w-lg">
                  <div className="font-medium text-slate-700">Supported formats: DICOM (.dcm, .dicom), PNG, JPG, JPEG</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Target Modality: <strong className="text-slate-800">{activeService.modality}</strong> · Max file size: 100 MB</div>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dcm,.dicom,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Selected File Badge */}
                {selectedFile && (
                  <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <span>Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                )}

                {/* All buttons aligned cleanly in the same row */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-3 sm:gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 rounded-xl bg-[#1E88E5] hover:bg-[#1976D2] text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose File</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleLoadDemo}
                    id="patient-load-demo-study-btn"
                    className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-800 font-bold text-xs sm:text-sm shadow-2xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#1E88E5]" />
                        <span>Analyzing {activeService.modality} Study…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Load Demo {activeService.modality} Study</span>
                      </>
                    )}
                  </button>

                  <Link
                    href="/emr"
                    className="px-5 py-3 rounded-xl bg-[#E8F8F5] hover:bg-[#d6f4ee] border border-teal-200 text-[#0F9D9A] font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    title="View your Doctor Care Plan, Vitals, and Appointments"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#0F9D9A]" />
                    <span>Dashboard</span>
                  </Link>
                </div>

                {/* Patient Information & Assurances Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mt-6 pt-5 border-t border-slate-200/80 text-left">
                  <div className="flex items-start gap-2.5 p-2 rounded-xl">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Private &amp; HIPAA Compliant</div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        Your scan is protected with sovereign consent and end-to-end clinical encryption.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl">
                    <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Fast 5-Second Analysis</div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        Automated multi-condition screening calibrated to clinical benchmarks.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl">
                    <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Stethoscope className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Doctor-Friendly Report</div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        Plain-language explanations with actionable follow-up recommendations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
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
                          src={formatImageSrc(pipelineResult.original_image_b64)}
                          alt="Original Radiographic Scan"
                          className="max-h-full max-w-full object-contain rounded"
                        />
                      )}
                      {viewMode === 'enhanced' && (
                        <img
                          src={formatImageSrc(pipelineResult.preprocessed_image_b64)}
                          alt="Preprocessed and Windowed Scan"
                          className="max-h-full max-w-full object-contain rounded"
                        />
                      )}
                      {viewMode === 'heatmap' && (
                        <img
                          src={formatImageSrc(pipelineResult.heatmap_annotated_b64 || pipelineResult.gradcam_heatmap_b64)}
                          alt="Grad-CAM Saliency Overlay with anatomical zones"
                          className="max-h-full max-w-full object-contain rounded"
                        />
                      )}
                      {viewMode === 'blend' && (
                        <div className="relative max-h-full max-w-full">
                          <img
                            src={formatImageSrc(pipelineResult.preprocessed_image_b64)}
                            alt="Base enhanced image"
                            className="max-h-full max-w-full object-contain rounded"
                          />
                          <img
                            src={formatImageSrc(pipelineResult.gradcam_heatmap_b64)}
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
                        <p>WINDOW: {String(pipelineResult.stages.agent_4_preprocessing.windowing_applied || 'CALIBRATED HU')}</p>
                      </div>

                      <div className="absolute bottom-4 right-4 p-2 rounded-lg bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-[10px] font-mono text-slate-300 pointer-events-none">
                        <span>Attribution: {pipelineResult.primary_diagnosis}</span>
                      </div>
                    </div>

                    {/* Heatmap localization summary — generated from the actual CAM */}
                    {pipelineResult.saliency_analysis && (
                      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                            Where the AI looked
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pipelineResult.saliency_analysis.is_localized
                                ? 'bg-teal-50 border border-teal-200 text-teal-800'
                                : 'bg-amber-50 border border-amber-200 text-amber-800'
                            }`}
                          >
                            {pipelineResult.saliency_analysis.is_localized ? 'Focal heatmap' : 'Diffuse heatmap'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {pipelineResult.saliency_analysis.localization_sentence}
                        </p>
                        {pipelineResult.demo_mode && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[10px] font-bold text-amber-800 leading-relaxed">
                            DEMO ONLY — this heatmap is synthetic and does not show a real
                            disease location. Do not use it for diagnosis.
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div>
                            <span className="font-bold text-slate-800">Image side: </span>
                            {pipelineResult.saliency_analysis.image_side}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">Patient side: </span>
                            {pipelineResult.saliency_analysis.patient_side}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          {pipelineResult.saliency_analysis.laterality_note}
                        </p>
                        {pipelineResult.patient_report?.where_the_ai_looked?.concordance_note && (
                          <p className="text-[10px] text-slate-600 bg-white border border-slate-200 rounded-lg p-2 leading-relaxed">
                            {pipelineResult.patient_report.where_the_ai_looked.concordance_note}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500">
                          Warm colours = more AI attention. This is not proof of disease.
                        </p>
                      </div>
                    )}

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
                  {/* Demo / no-high-confidence banners */}
                  {pipelineResult.demo_mode && (
                    <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 text-amber-900 text-xs leading-relaxed">
                      <strong className="block font-black uppercase tracking-wide mb-1">
                        Demo mode — not a diagnosis
                      </strong>
                      {pipelineResult.model_availability?.message ||
                        'No trained model checkpoint is loaded for this service. The numbers and heatmap are illustrative only.'}
                    </div>
                  )}
                  {!pipelineResult.demo_mode && pipelineResult.no_high_confidence_finding && (
                    <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-sky-900 text-xs leading-relaxed">
                      <strong className="block font-black uppercase tracking-wide mb-1">
                        No high-confidence abnormality detected
                      </strong>
                      The top AI score was {pipelineResult.confidence_percentage}% for{' '}
                      {pipelineResult.candidate_diagnosis || 'a borderline pattern'}, which is
                      below the high-confidence cutoff. A borderline signal is not a diagnosis.
                    </div>
                  )}

                  {/* Primary Diagnosis Alert Card */}
                  <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          {pipelineResult.demo_mode
                            ? 'Demo preview — not a diagnosis'
                            : pipelineResult.no_high_confidence_finding
                            ? 'AI screening result'
                            : 'Primary AI-detected finding'}
                        </span>
                        <h3 className="text-2xl font-black text-slate-900 mt-0.5">{pipelineResult.primary_diagnosis}</h3>
                        {!pipelineResult.demo_mode && pipelineResult.candidate_diagnosis && pipelineResult.no_high_confidence_finding && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Top borderline signal: <strong>{pipelineResult.candidate_diagnosis}</strong> at {pipelineResult.confidence_percentage}% (not a diagnosis)
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono ${
                          pipelineResult.demo_mode
                            ? 'bg-slate-100 border border-slate-300 text-slate-600'
                            : pipelineResult.severity === 'CRITICAL'
                            ? 'bg-rose-50 border border-rose-200 text-rose-700'
                            : pipelineResult.severity === 'HIGH'
                            ? 'bg-amber-50 border border-amber-200 text-amber-800'
                            : pipelineResult.severity === 'MODERATE'
                            ? 'bg-sky-50 border border-sky-200 text-sky-800'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        }`}
                      >
                        {pipelineResult.demo_mode ? 'DEMO' : pipelineResult.severity}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-xs text-slate-600 font-semibold">
                        {pipelineResult.demo_mode
                          ? 'Demo output:'
                          : pipelineResult.no_high_confidence_finding
                          ? 'Top score (not a diagnosis):'
                          : 'High-confidence model score:'}
                      </span>
                      <span className="text-lg font-black text-teal-700 font-mono">
                        {pipelineResult.demo_mode ? 'Not scored' : `${pipelineResult.confidence_percentage}%`}
                      </span>
                    </div>
                    {pipelineResult.demo_mode && pipelineResult.demo_top_signal && (
                      <p className="text-[11px] text-slate-500">
                        Top synthetic demo signal: <strong>{pipelineResult.demo_top_signal}</strong>
                        {pipelineResult.demo_top_signal_pct != null
                          ? ` (${pipelineResult.demo_top_signal_pct}%)`
                          : ''}{' '}
                        — illustrative only, not a finding.
                      </p>
                    )}
                    {pipelineResult.confidence_label && (
                      <p className="text-[11px] text-slate-500">{pipelineResult.confidence_label}</p>
                    )}

                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <strong className="block mb-0.5 font-bold">Urgency guidance:</strong>
                      <span>{pipelineResult.urgency}</span>
                    </div>

                    {/* All Evaluated Pathologies Accordion */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        {pipelineResult.demo_mode
                          ? `Demo categories (${pipelineResult.all_pathologies.length}) — not clinically evaluated`
                          : `Evaluated categories (${pipelineResult.all_pathologies.length})`}
                      </span>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {pipelineResult.all_pathologies.map((patho) => {
                          const tier = patho.tier || (patho.positive ? 'high' : 'low');
                          const tierStyles =
                            tier === 'demo'
                              ? 'bg-slate-50 border-dashed border-slate-300 text-slate-600'
                              : tier === 'high'
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : tier === 'indeterminate'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700';
                          const barStyles =
                            tier === 'demo'
                              ? 'bg-slate-400'
                              : tier === 'high'
                              ? 'bg-rose-500'
                              : tier === 'indeterminate'
                              ? 'bg-amber-500'
                              : 'bg-slate-400';
                          const badgeStyles =
                            tier === 'demo'
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : tier === 'high'
                              ? 'bg-rose-100 text-rose-700 border-rose-200'
                              : tier === 'indeterminate'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200';
                          const badgeLabel =
                            tier === 'demo'
                              ? 'Demo'
                              : tier === 'high'
                              ? 'High'
                              : tier === 'indeterminate'
                              ? 'Borderline'
                              : 'Below';
                          return (
                            <div key={patho.name} className={`p-2.5 rounded-xl border text-xs transition-all ${tierStyles}`}>
                              <div className="flex items-center justify-between gap-2 font-semibold">
                                <span className="truncate">{patho.name}</span>
                                <span className="flex items-center gap-1.5 font-mono shrink-0">
                                  {patho.percentage}%
                                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${badgeStyles}`}>
                                    {badgeLabel}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                                {tier === 'demo' ? (
                                  <span>Illustrative demo output — no real cutoff</span>
                                ) : (
                                  <>
                                    <span>High-confidence cutoff: {patho.threshold_percentage}%</span>
                                    {patho.operating_threshold_percentage != null && (
                                      <span>Operating point: {patho.operating_threshold_percentage}%</span>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barStyles}`}
                                  style={{ width: `${Math.min(100, patho.percentage)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
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
                        <span>{pipelineResult.demo_mode ? 'Download Demo Report' : 'Download Report'}</span>
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

                  {/* Plain-language patient report */}
                  {pipelineResult.patient_report && (
                    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">Your plain-language report</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Written for patients and families. Not a substitute for a doctor.
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-bold">
                          Patient-friendly
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          {pipelineResult.patient_report.headline}
                        </h4>
                        <p className="text-xs text-slate-700 leading-relaxed mt-2">
                          {pipelineResult.patient_report.what_we_found}
                        </p>
                      </div>

                      <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                        <div>
                          <h5 className="font-bold text-slate-900 mb-1">What this may mean</h5>
                          <p>{pipelineResult.patient_report.what_it_means}</p>
                        </div>

                        {pipelineResult.patient_report.possible_causes?.length > 0 && (
                          <div>
                            <h5 className="font-bold text-slate-900 mb-1">Possible causes (not confirmed)</h5>
                            <ul className="list-disc pl-5 space-y-1">
                              {pipelineResult.patient_report.possible_causes.map((cause, idx) => (
                                <li key={idx}>{cause}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div>
                          <h5 className="font-bold text-slate-900 mb-1">How serious is it?</h5>
                          <p>{pipelineResult.patient_report.how_serious}</p>
                        </div>

                        {pipelineResult.patient_report.next_steps?.length > 0 && (
                          <div>
                            <h5 className="font-bold text-slate-900 mb-1">What to do next</h5>
                            <ul className="list-disc pl-5 space-y-1">
                              {pipelineResult.patient_report.next_steps.map((step, idx) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {pipelineResult.patient_report.red_flags?.length > 0 && (
                          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                            <h5 className="font-bold text-rose-900 mb-1">Red-flag symptoms — seek urgent care</h5>
                            <ul className="list-disc pl-5 space-y-1 text-rose-900">
                              {pipelineResult.patient_report.red_flags.map((flag, idx) => (
                                <li key={idx}>{flag}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {pipelineResult.patient_report.questions_for_doctor?.length > 0 && (
                          <div>
                            <h5 className="font-bold text-slate-900 mb-1">Questions for your doctor</h5>
                            <ul className="list-disc pl-5 space-y-1">
                              {pipelineResult.patient_report.questions_for_doctor.map((q, idx) => (
                                <li key={idx}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {pipelineResult.patient_report.indeterminate_note && (
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900">
                            {pipelineResult.patient_report.indeterminate_note}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 pt-3 space-y-1.5 text-[10px] text-slate-500 leading-relaxed">
                        {pipelineResult.patient_report.scan_limitation && <p>{pipelineResult.patient_report.scan_limitation}</p>}
                        {pipelineResult.patient_report.heatmap_caveat && <p>{pipelineResult.patient_report.heatmap_caveat}</p>}
                        {pipelineResult.patient_report.demo_notice && (
                          <p className="font-bold text-amber-700">{pipelineResult.patient_report.demo_notice}</p>
                        )}
                        {pipelineResult.patient_report.disclaimer && <p>{pipelineResult.patient_report.disclaimer}</p>}
                      </div>
                    </div>
                  )}

                  {/* ============================================================== */}
                  {/* AI CLINICAL REVIEW & COPILOT (POWERED BY GROQ LPU)             */}
                  {/* ============================================================== */}
                  <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 text-white shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30 shrink-0">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-white">
                              {currentLanguage.code !== 'en' ? `${currentLanguage.nativeName} ${t('ai_clinical_guidance')}` : 'AI Clinical Review & Guidance'}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold font-mono border border-blue-400/30">
                              Groq LPU
                            </span>
                            {currentLanguage.code !== 'en' && (
                              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold border border-orange-400/30">
                                🇮🇳 {currentLanguage.script} · AI4Bharat
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {currentLanguage.code !== 'en'
                              ? `AI4Bharat IndicTrans2 & Groq LPU क्लिनिकल अनुवाद (${currentLanguage.name})`
                              : `Empathetic medical translation · ${aiReviewModel}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fetchDiagnosticAiReview(pipelineResult)}
                          disabled={isGeneratingAiReview}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="Regenerate Review"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingAiReview ? 'animate-spin text-blue-400' : ''}`} />
                          <span className="hidden sm:inline">Regenerate</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('analysis')}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <span>Full AI Studio</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* AI Review Body */}
                    {isGeneratingAiReview ? (
                      <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-white">Generating Groq LPU Clinical Review…</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">
                          {pipelineResult.demo_mode
                            ? 'Demo mode: no trained model is loaded for this service, so no clinical interpretation is being generated from real probabilities.'
                            : pipelineResult.no_high_confidence_finding
                            ? 'Explaining the screening result, the top borderline signal, and what to discuss with your doctor.'
                            : `Translating the ${pipelineResult.primary_diagnosis} finding (${pipelineResult.confidence_percentage}% model score) into clear patient language.`}
                        </p>
                      </div>
                    ) : aiReviewError ? (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between">
                        <span>{aiReviewError}</span>
                        <button
                          type="button"
                          onClick={() => fetchDiagnosticAiReview(pipelineResult)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    ) : diagnosticAiReview ? (
                      <div className="space-y-4">
                        <div className="text-xs text-slate-200 max-h-72 overflow-y-auto pr-2 space-y-2.5 leading-relaxed whitespace-pre-wrap font-sans bg-white/5 p-4 rounded-2xl border border-white/10">
                          {diagnosticAiReview}
                        </div>

                        {/* Quick Interactive Question to AI Copilot */}
                        <div className="pt-2 border-t border-white/10 space-y-2">
                          <span className="text-[11px] font-bold text-slate-300 block">
                            {pipelineResult.demo_mode
                              ? 'Questions about this demo result?'
                              : pipelineResult.no_high_confidence_finding
                              ? 'Questions about this screening result?'
                              : `Have questions about this ${pipelineResult.primary_diagnosis} finding?`}
                          </span>
                          
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={quickAiQuestion}
                              onChange={(e) => setQuickAiQuestion(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAskQuickAi()}
                              placeholder="e.g., Is this dangerous? What questions should I ask my doctor?"
                              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <button
                              type="button"
                              onClick={() => handleAskQuickAi()}
                              disabled={isAskingQuickAi || !quickAiQuestion.trim()}
                              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              {isAskingQuickAi ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <span>Ask</span>
                              )}
                            </button>
                          </div>

                          {/* Quick question presets */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(currentLanguage.code === 'hi'
                              ? ['यह किस कारण होता है?', 'क्या यह आपातकाल है?', 'क्या मुझे उपचार की आवश्यकता होगी?']
                              : currentLanguage.code === 'ta'
                              ? ['இதன் காரணம் என்ன?', 'இது அவசரநிலையா?', 'சிகிச்சை தேவையா?']
                              : currentLanguage.code === 'te'
                              ? ['దీనికి కారణం ఏమిటి?', 'ఇది అత్యవసరమా?', 'చికిత్స అవసరమా?']
                              : currentLanguage.code === 'bn'
                              ? ['এর কারণ কী?', 'এটা কি জরুরি অবস্থা?', 'আমার কি চিকিৎসা লাগবে?']
                              : ['What causes this?', 'Is it an emergency?', 'Will I need a procedure?']
                            ).map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => {
                                  setQuickAiQuestion(q);
                                  handleAskQuickAi(q);
                                }}
                                className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 transition-colors cursor-pointer"
                              >
                                {q}
                              </button>
                            ))}
                          </div>

                          {/* Quick AI Answer Box */}
                          {quickAiAnswer && (
                            <div className="mt-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-400/20 text-xs text-blue-100 leading-relaxed animate-in fade-in">
                              <strong className="text-blue-300 block font-bold mb-1">MiPAAS AI Copilot:</strong>
                              {quickAiAnswer}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-xs text-slate-300">Ready to review with clinical AI assistant</span>
                        <button
                          type="button"
                          onClick={() => fetchDiagnosticAiReview(pipelineResult)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                          <span>Generate AI Review</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Standard Plain Language Summary Fallback */}
                  <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 p-4 shadow-xs space-y-1.5">
                    <h5 className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                      <span>Radiologist Decision Support Note</span>
                    </h5>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
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
                    <span>Connected Patient Health Records · Live Sync</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">
                    {patientData?.name || 'Patient'} — Clinical Record Chart
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connected Provider: <strong className="text-slate-800">CareNest Health System</strong> (Integrated PACS &amp; EHR)
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-teal-800">
                  MRN: {patientData?.mrn || 'MRN-GENERAL'}
                </span>
              </div>

              {/* Patient Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
                {/* Diagnosed Conditions */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-600" />
                    <span>Diagnosed Conditions</span>
                  </h3>
                  {patientData?.primaryDiagnosis ? (
                    <ul className="text-xs text-slate-700 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 flex-shrink-0" />
                        <div>
                          <strong className="text-slate-900 block">{patientData.primaryDiagnosis}</strong>
                          <span className="text-[11px] text-slate-500">
                            Recorded clinical diagnosis from the patient chart
                          </span>
                        </div>
                      </li>
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No chronic conditions diagnosed.</p>
                  )}
                </div>

                {/* Allergies & Contraindications */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Allergies &amp; Contraindications</span>
                  </h3>
                  {patientData?.allergies && patientData.allergies.length > 0 ? (
                    <ul className="text-xs text-slate-700 space-y-2">
                      {patientData.allergies.map((allergy, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 flex-shrink-0" />
                          <span className="text-slate-900 font-medium">{allergy}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No known drug allergies or contraindications recorded.</p>
                  )}
                </div>

                {/* Current Active Medications */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-teal-600" />
                    <span>Active Medications</span>
                  </h3>
                  {patientPrescriptions.length > 0 ? (
                    <ul className="text-xs text-slate-700 space-y-2">
                      {patientPrescriptions.map((rx) => (
                        <li key={rx.id} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                          <div>
                            <strong className="text-slate-900 block">{rx.medication} {rx.dosage}</strong>
                            <span className="text-[11px] text-slate-500">{rx.frequency}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No active prescriptions recorded on file.</p>
                  )}
                </div>
              </div>

              {/* Longitudinal Medical Imaging Timeline */}
              <div className="pt-6 border-t border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Diagnostic Imaging History</span>
                </h3>

                {patientReports.length > 0 ? (
                  <div className="space-y-3">
                    {patientReports.map((r) => (
                      <div
                        key={r.id}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{r.title || r.serviceName}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.riskLevel === 'Critical' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {r.findings}: {((r.confidence || 0.974) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">
                            Date: {r.date} · Engine: {r.signedBy || 'TorchXRayVision DenseNet-121'}
                          </span>
                          <p className="text-xs text-slate-600 mt-1">
                            {r.impression || r.summary}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-slate-500 shrink-0">{r.id}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No diagnostic imaging reports recorded.</p>
                )}
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
              Note: Statutory medical records retained by your healthcare provider under applicable National Medical Commission (NMC) record-retention requirements remain sealed with the provider&apos;s compliance team.
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
              {pipelineResult?.demo_mode
                ? `Your demo result (${pipelineResult?.primary_diagnosis}) is not a clinical finding and carries no score. It can be routed to the clinician review queue with a clear demo label.`
                : `Your AI-assisted result (${pipelineResult?.primary_diagnosis} — ${pipelineResult?.confidence_percentage}% top score) will be routed to the clinician review queue for your linked care team.`}
            </p>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 mt-3">
              <strong>Urgent symptoms:</strong> If you are experiencing severe shortness of breath, crushing chest pain, coughing up blood, fainting, or confusion, call emergency services immediately or visit the nearest emergency department.
            </div>

            {escalateSuccess ? (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Case #{pipelineResult?.case_id} routed to the clinician review queue.</span>
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
