'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Shield,
  Activity,
  FileText,
  GitBranch,
  Calendar,
  Lock,
  BarChart,
  HelpCircle,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Terminal,
  Sparkles,
  Layers,
  ChevronRight,
  ExternalLink,
  Code2
} from 'lucide-react';

interface AgentCard {
  id: string;
  name: string;
  autonomy: 'L0' | 'L1' | 'L2';
  is_clinical: boolean;
  uses_llm: string;
  trigger: string;
  goal: string;
  guardrails: string;
  metrics: string;
  github_repo: string;
  repo_name: string;
  upstream_framework: string;
  benchmark_reference: string;
  core_algorithms: string[];
  sampleInput: any;
}

export default function AgentsConsole() {
  const [selectedAgent, setSelectedAgent] = useState<AgentCard | null>(null);
  const [executing, setExecuting] = useState(false);
  const [outputJson, setOutputJson] = useState<any>(null);

  const agentsList: AgentCard[] = [
    {
      id: 'intake_quality',
      name: 'Agent 1: Intake & Quality',
      autonomy: 'L2',
      is_clinical: false,
      uses_llm: 'Mostly No (Rules + Vision Classifier)',
      trigger: 'Upload complete',
      goal: 'Validate DICOM conformance, compute MRQy image quality metrics (SNR, CNR, blur), and reject unusable images before paid calls.',
      guardrails: 'Strict deny-by-default on corrupted files; confidence threshold >= 0.92; zero PII access.',
      metrics: 'Pre-inference rejection rate, technician override rate (< 1%), latency < 2.5s.',
      github_repo: 'https://github.com/ccipd/MRQy',
      repo_name: 'ccipd/MRQy',
      upstream_framework: 'CCIPD MRQy / RadQy & pydicom',
      benchmark_reference: 'TCIA Multi-Site Medical Image Quality Metrics Suite',
      core_algorithms: [
        'Laplacian Blur Variance Filtering (> 45.0 threshold)',
        'Signal-to-Noise Ratio (SNR foreground/background)',
        'Contrast-to-Noise Ratio (CNR)',
        'DICOM Part 10 Transfer Syntax Conformance Gate',
      ],
      sampleInput: {
        case_id: 'cxr_upload_8841',
        metadata: { modality: 'CXR', body_part_examined: 'CHEST', view_position: 'PA' },
        pixel_stats: { laplacian_variance: 58.4, snr_db: 24.8, motion_detected: false },
        detected_body_part: 'CHEST',
      },
    },
    {
      id: 'routing',
      name: 'Agent 2: Routing',
      autonomy: 'L2',
      is_clinical: false,
      uses_llm: 'No (Config rules & circuit breaker)',
      trigger: 'Case validated',
      goal: 'Pick the model(s) for the study across all 9 disease pathways, fall back to secondary endpoint if primary fails, and control cost.',
      guardrails: 'Strict tenant isolation; never routes to uncontracted or experimental models.',
      metrics: 'Routing latency < 35ms; fallback trigger rate; cost adherence.',
      github_repo: 'https://github.com/mlmed/torchxrayvision',
      repo_name: 'mlmed/torchxrayvision',
      upstream_framework: 'Stanford TorchXRayVision & MONAI Deploy Router',
      benchmark_reference: 'Stanford AIMI / NIH-14 Multi-Domain Evaluation',
      core_algorithms: [
        'Modality & Body-Part Multi-Classifier Dispatcher',
        'Circuit-Breaker Endpoint Health Verification',
        'Tenant SLA & Budget Enforcement',
        'Zero-Downtime Hot Secondary Fallback Dispatch',
      ],
      sampleInput: {
        case_id: 'case_validated_991',
        tenant_id: 'metro_general',
        modality: 'CXR',
        body_part: 'CHEST',
      },
    },
    {
      id: 'triage_escalation',
      name: 'Agent 3: Triage & Escalation',
      autonomy: 'L1',
      is_clinical: true,
      uses_llm: 'No (Rule-based risk scoring)',
      trigger: 'Result stored',
      goal: 'Rank worklist by priority (STAT, URGENT, ROUTINE), run SLA countdowns, and page for critical findings per CheXpert & RSNA criteria.',
      guardrails: 'Monotonic escalation: can upgrade priority automatically, NEVER downgrade without human override.',
      metrics: 'Time to alert < 5s; SLA adherence; alert acknowledgement latency.',
      github_repo: 'https://github.com/stanfordmlgroup/chexpert',
      repo_name: 'stanfordmlgroup/chexpert',
      upstream_framework: 'Stanford CheXpert Emergency Alert & RSNA Triage Suite',
      benchmark_reference: 'Stanford CheXpert Critical Alert / Joint Commission NPSG',
      core_algorithms: [
        'Life-Threatening Critical Pathology Classifier (Tension PTX, Hemorrhage, PE)',
        'Monotonic Priority Escalation (Never Downgrade without MD Authorization)',
        'Joint Commission Emergency Response SLA Countdown (15m STAT window)',
        'Automated On-Call Radiologist Paging & Acknowledgment Gate',
      ],
      sampleInput: {
        case_id: 'case_crit_01',
        requested_priority: 'ROUTINE',
        findings: [{ name: 'Tension_Pneumothorax', probability: 0.94, positive: true }],
      },
    },
    {
      id: 'report_drafting',
      name: 'Agent 4: Report Drafting',
      autonomy: 'L0',
      is_clinical: true,
      uses_llm: 'Yes (Constrained medical text)',
      trigger: 'Clinician opens case',
      goal: 'Draft structured report in the lab’s template via RadFM multimodal generation and CheXbert observations for clinician e-sign.',
      guardrails: 'Strict sentence grounding: every sentence must cite a source finding ID. If any claim is uncited, prose is suppressed.',
      metrics: 'Clinician edit distance; time saved; zero uncited claims caught.',
      github_repo: 'https://github.com/chaoyi-wu/RadFM',
      repo_name: 'chaoyi-wu/RadFM',
      upstream_framework: 'RadFM Multimodal Foundation Model & CheXbert',
      benchmark_reference: 'RadFM 2D/3D Benchmark & CheXbert 14 Clinical Observations',
      core_algorithms: [
        'RadFM Multi-Task Visual-Language Report Generation',
        'CheXbert 14-Observation Pathology Alignment',
        'ACR Lung-RADS v2022 / RadLex Structured Template Engine',
        'Sentence Provenance Grounding Verification & Prose Suppression Guardrail',
      ],
      sampleInput: {
        case_id: 'case_draft_01',
        template_id: 'CHEST_XR_STANDARD',
        findings: [
          { id: 'fnd_rul_nodule', name: 'Solid Nodule', probability: 0.88, location: 'Right Upper Lobe', dimensions_mm: 8.4 }
        ],
      },
    },
    {
      id: 'longitudinal',
      name: 'Agent 5: Longitudinal Comparison',
      autonomy: 'L0',
      is_clinical: true,
      uses_llm: 'Optional (Delta calculator)',
      trigger: 'Case has prior studies',
      goal: 'Summarise change versus prior studies using VoxelMorph 3D alignment, RECIST 1.1 metric delta, and Schwartz volume doubling time.',
      guardrails: 'Registration confidence check >= 0.80; cross-modality comparison blocks.',
      metrics: 'Agreement rate with radiologist trend assessment; calculation accuracy of VDT.',
      github_repo: 'https://github.com/voxelmorph/voxelmorph',
      repo_name: 'voxelmorph/voxelmorph',
      upstream_framework: 'VoxelMorph 3D Deformable Registration & Elastix',
      benchmark_reference: 'VoxelMorph Unsupervised Registration & RECIST 1.1 Criteria',
      core_algorithms: [
        'VoxelMorph Unsupervised 3D Spatial Deformation Alignment',
        'RECIST 1.1 Target Lesion Unidimensional Comparison (PD >= +20%)',
        'Volumetric Expansion Percentage (3D Ellipsoid V2/V1 Delta)',
        'Schwartz Volume Doubling Time (VDT) High-Risk Calculation (< 400d)',
      ],
      sampleInput: {
        case_id: 'case_followup_02',
        pseudonym_id: 'MIP-8842-X',
        findings: [{ id: 'rul_nodule_cur', dimensions_mm: 8.4, location: 'Right Upper Lobe' }],
      },
    },
    {
      id: 'referral_followup',
      name: 'Agent 6: Referral & Follow-up',
      autonomy: 'L1',
      is_clinical: true,
      uses_llm: 'Light (Message wording)',
      trigger: 'Clinician signs positive result',
      goal: 'Suggest next steps from Fleischner / BI-RADS protocols, track loop-closure in Medplum FHIR, and prepare consented reminders.',
      guardrails: 'Locked until clinician cryptographic signature verified; strict patient consent validation.',
      metrics: 'Closed-loop follow-up rate; physician order adoption rate; zero unconsented messages.',
      github_repo: 'https://github.com/medplum/medplum',
      repo_name: 'medplum/medplum',
      upstream_framework: 'Medplum Open-Source FHIR Platform & SMART Workflows',
      benchmark_reference: 'HL7 FHIR R4 ServiceRequest & Fleischner 2017 Guidelines',
      core_algorithms: [
        'Fleischner 2017 & ACR Lung-RADS Protocol Matcher',
        'HL7 FHIR R4 ServiceRequest & Task Staging Engine',
        'Automated Closed-Loop Recall & Incidental Finding Tracker',
        'Clinician-in-the-Loop Sign-off Authorization Gate (L1)',
      ],
      sampleInput: {
        case_id: 'case_signed_01',
        signed_by_doctor_id: 'DR-RAD-4412',
        diagnostic_code: 'LUNG_NODULE',
        lesion_size_mm: 8.4,
        patient_consented_to_reminders: true,
      },
    },
    {
      id: 'consent_privacy',
      name: 'Agent 7: Consent & Privacy',
      autonomy: 'L2',
      is_clinical: false,
      uses_llm: 'No (Zero-trust policy engine)',
      trigger: 'Every data access event',
      goal: 'Enforce purpose-specific consent, apply Presidio HIPAA 18-identifier PHI redaction, and handle GDPR erasure requests.',
      guardrails: 'Fail-secure default: access denied if consent missing or ambiguous; irreversible pseudonymization.',
      metrics: 'Consent check latency < 15ms; 100% unauthorized interception rate; erasure SLA < 24h.',
      github_repo: 'https://github.com/microsoft/presidio',
      repo_name: 'microsoft/presidio',
      upstream_framework: 'Microsoft Presidio & Kitware DICOM Anonymizer',
      benchmark_reference: 'HIPAA Safe Harbor 18 Identifiers & DICOM PS 3.15 Profile',
      core_algorithms: [
        'Presidio Context-Aware NLP Entity Recognition (Names, Dates, Locations, MRN)',
        'DICOM PS 3.15 Tag Stripping & Burned-In Pixel Scrubbing',
        'Deterministic Salted HMAC-SHA256 Pseudonymization (MIP-HASH)',
        'GDPR Article 17 Right-to-Erasure Cascading Purge & Audit Trail',
      ],
      sampleInput: {
        action: 'EVALUATE_ACCESS',
        actor_id: 'RESEARCH_STUDENT_01',
        purpose: 'SECONDARY_RESEARCH',
        patient_id: 'REAL_SSN_992144',
      },
    },
    {
      id: 'model_qa',
      name: 'Agent 8: Model QA',
      autonomy: 'L0',
      is_clinical: false,
      uses_llm: 'No (Statistical drift & PSI)',
      trigger: 'Nightly batch / threshold breach',
      goal: 'Watch clinician override rates, calculate Evidently AI distribution drift (PSI), and detect site-specific anomalies.',
      guardrails: 'Zero PHI access; k-anonymized aggregate statistics only; sample size validation >= 50.',
      metrics: 'Time to detect drift < 24h; 100% override reason fidelity.',
      github_repo: 'https://github.com/evidentlyai/evidently',
      repo_name: 'evidentlyai/evidently',
      upstream_framework: 'Evidently AI & whylogs ML Observability Suite',
      benchmark_reference: 'Population Stability Index (PSI) & Clinician Override Monitoring',
      core_algorithms: [
        'Population Stability Index (PSI) Statistical Drift Test (Threshold > 0.15)',
        'Kolmogorov-Smirnov Continuous Distribution Shift Detection',
        'Clinician Override Rate & Clinical Justification Telemetry Aggregator',
        'Automated Multi-Channel MLOps Alerting (Slack / Webhooks)',
      ],
      sampleInput: {
        tenant_id: 'metro_general',
        model_id: 'DenseNet121_ChestXray14',
        current_mean_prediction: 0.48,
      },
    },
    {
      id: 'support',
      name: 'Agent 9: Support',
      autonomy: 'L0',
      is_clinical: false,
      uses_llm: 'Yes (RAG documentation chat)',
      trigger: 'User chat or doc query',
      goal: 'Answer integration, PACS configuration, and how-to questions via MEDITRON & BioGPT without accessing patient data.',
      guardrails: 'Zero PHI barrier: immediately rejects any input containing clinical or patient data.',
      metrics: 'First-contact resolution rate; documentation grounding accuracy.',
      github_repo: 'https://github.com/epfl-llm/meditron',
      repo_name: 'epfl-llm/meditron',
      upstream_framework: 'EPFL MEDITRON & Microsoft BioGPT Generative AI',
      benchmark_reference: 'MedQA / PubMedQA Biomedical Benchmarks',
      core_algorithms: [
        'MEDITRON-Grounding Medical Knowledge & Integration Q&A',
        'Dual-Persona Translation (Physician Technical vs Patient 6th-Grade Lay-Summary)',
        'Zero-PHI Input Filter Barrier (Intercepting & Blocking Unsanitized Clinical Prompts)',
        'DICOMweb / C-STORE Networking Documentation Search',
      ],
      sampleInput: {
        query: 'How do I configure the PACS C-STORE AE title and listening port?',
      },
    },
  ];

  const handleSelectAgent = (agent: AgentCard) => {
    setSelectedAgent(agent);
    setOutputJson(null);
  };

  const executeAgent = () => {
    if (!selectedAgent) return;
    setExecuting(true);
    setOutputJson(null);

    // Call backend endpoint or client simulation fallback
    setTimeout(() => {
      setExecuting(false);
      if (selectedAgent.id === 'intake_quality') {
        setOutputJson({
          case_id: 'cxr_upload_8841',
          validation_status: 'PASSED',
          modality_check: { declared: 'CXR', conforming: true },
          bodypart_check: { declared: 'CHEST', predicted: 'CHEST', confidence: 0.98, match: true },
          quality_metrics: { laplacian_variance: 58.4, snr_db: 24.8, motion_detected: false, quality_score: 0.95 },
          rejection_code: 'NONE',
          technician_message: 'Scan successfully verified. Quality metrics optimal for diagnostic inference.',
        });
      } else if (selectedAgent.id === 'triage_escalation') {
        setOutputJson({
          case_id: 'case_crit_01',
          assigned_priority: 'STAT',
          critical_alert: {
            triggered: true,
            pathology: 'TENSION_PNEUMOTHORAX',
            sla_minutes: 15,
            deadline_timestamp: '2026-10-13T01:15:00Z',
          },
          escalation_actions: [
            { action: 'WORKLIST_REORDER', status: 'COMPLETED', priority: 'STAT' },
            { action: 'PAGE_ON_CALL_ROSTER', status: 'DISPATCHED', requires_ack: true },
          ],
        });
      } else if (selectedAgent.id === 'report_drafting') {
        setOutputJson({
          draft_id: 'draft_case_draft_01',
          case_id: 'case_draft_01',
          template_id: 'CHEST_XR_STANDARD',
          sections: [
            { name: 'EXAMINATION', text: 'Standard Chest Radiograph (RadLex Aligned)', source_finding_ids: [] },
            { name: 'FINDINGS', text: 'Solid Nodule: Identified at Right Upper Lobe measuring 8.4mm (AI detection confidence: 88.0%).', source_finding_ids: ['fnd_rul_nodule'] },
            { name: 'IMPRESSION', text: 'Primary radiological impression: Solid Nodule requiring correlated clinical follow-up.', source_finding_ids: ['fnd_rul_nodule'] },
          ],
          disclaimer: 'AI-drafted, requires clinician review and e-signature',
          grounding_check_passed: true,
        });
      } else if (selectedAgent.id === 'referral_followup') {
        setOutputJson({
          case_id: 'case_signed_01',
          applied_guideline: 'FLEISCHNER_2017_SOLID_NODULE',
          recommended_interval_months: 3,
          recommended_modality: 'High-Resolution Chest CT',
          order_draft: {
            procedure_name: 'High-Resolution Chest CT',
            status: 'PENDING_PHYSICIAN_SIGNATURE',
            rationale: 'High-risk solid nodule >= 8mm per Fleischner 2017 guidelines.',
          },
          patient_communication: {
            consented: true,
            channel: 'SECURE_PORTAL_SMS',
            draft_message: 'Your care team has scheduled a routine follow-up scan in 3 months. Access your secure portal details here.',
          },
          requires_physician_signature: true,
        });
      } else if (selectedAgent.id === 'routing') {
        setOutputJson({
          case_id: 'cxr_route_004',
          routing_status: 'DISPATCHED',
          upstream_repo: 'mlmed/torchxrayvision',
          target_pipeline: 'DenseNet121_Multitask_Frontal',
          target_device: 'CUDA:0 (A100 Tensor Core)',
          body_region: 'CHEST',
          modality: 'DX',
          confidence_score: 0.964,
          circuit_breaker: {
            status: 'CLOSED_HEALTHY',
            latency_ms: 42,
            fallback_active: false,
          },
        });
      } else if (selectedAgent.id === 'longitudinal') {
        setOutputJson({
          case_id: 'case_followup_02',
          pseudonym_id: 'MIP-8842-X',
          upstream_engine: 'voxelmorph/voxelmorph & elastix',
          registration_type: '3D_DEFORMABLE_SPATIAL_ALIGNMENT',
          interval_days: 184,
          target_lesion: {
            location: 'Right Upper Lobe',
            prior_diameter_mm: 6.2,
            current_diameter_mm: 8.4,
            delta_diameter_percent: '+35.5%',
            recist_classification: 'PROGRESSIVE_DISEASE (PD >= +20%)',
            volume_doubling_time_days: 218.4,
            vdt_risk_category: 'HIGH_MALIGNANCY_RISK (VDT < 400d)',
          },
          spatial_overlap_dice_score: 0.912,
        });
      } else if (selectedAgent.id === 'consent_privacy') {
        setOutputJson({
          action: 'EVALUATE_ACCESS',
          access_decision: 'PERMITTED_PSEUDONYMIZED',
          upstream_engine: 'microsoft/presidio',
          presidio_sanitization: {
            entities_redacted: 4,
            redacted_tokens: ['[PATIENT_NAME]', '[MRN_ID]', '[PHONE]', '[GEO_ZIP]'],
            hipaa_safe_harbor_compliant: true,
          },
          pseudonym_hash: 'MIP-HASH-992144-88F4',
          gdpr_purpose_verified: 'SECONDARY_RESEARCH_APPROVED',
          audit_entry_id: 'AUDIT_TX_881942',
        });
      } else if (selectedAgent.id === 'model_qa') {
        setOutputJson({
          tenant_id: 'metro_general',
          model_id: 'DenseNet121_ChestXray14',
          upstream_engine: 'evidentlyai/evidently',
          evidently_drift_report: {
            psi_score: 0.184,
            drift_detected: true,
            drift_threshold: 0.15,
            ks_test_p_value: 0.0084,
            flagged_features: ['contrast_variance', 'elderly_cohort_ratio'],
          },
          telemetry: {
            override_rate_30d: '6.4%',
            total_evaluations: 2450,
          },
          action_taken: 'SLACK_ALERT_DISPATCHED_TO_MLOPS',
        });
      } else if (selectedAgent.id === 'support') {
        setOutputJson({
          response_text: 'MIPAAS supports standard C-STORE SCP on default port 11112. Configure Calling AE Title in Lab Admin Settings.\n\n*System Health Status: ALL_SYSTEMS_OPERATIONAL (99.98% uptime)*',
          citations: [{ title: 'PACS DIMSE & DICOMweb Integration Manual', section: 'Section 3.1: AE Title & Port Setup' }],
          escalate_to_human: false,
          zero_phi_block_applied: false,
        });
      } else {
        setOutputJson({
          status: 'SUCCESS',
          agent_name: selectedAgent.name,
          autonomy: selectedAgent.autonomy,
          output: 'Agent workflow evaluated according to strict allowable tools and safety constraints.',
        });
      }
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-6 md:p-8">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-wider">
                Autonomous Agent Command Center
              </span>
              <span className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                Clinical Safety Invariant: No L2 on Clinical
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">
              The 9 Autonomous &amp; Assistive Medical Agents
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Standardized agent framework: Goal · Trigger · Inputs · Allowed Tools · Schema · Autonomy (L0/L1/L2) · Guardrails · Metrics · Safe Fallback.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/doctor"
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-all"
            >
              <span>Clinician Station</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-700" />
            </Link>
          </div>
        </div>

        {/* Invariant Legend */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
              L0 · Suggests Only
            </span>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Passive drafts and summaries. Absolutely zero persistence without clinician editing and e-signature.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
              L1 · Acts After Human Approval
            </span>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Stages high-impact clinical escalations and referrals. Executes only upon explicit human sign-off.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              L2 · Acts Alone (Non-Clinical Only)
            </span>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Autonomous operations strictly restricted to technical intake, network routing, and privacy governance.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agent Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-2">
            <Layers className="w-5 h-5 text-[#0D9488]" />
            <span>Select Agent to Inspect Architecture &amp; Test Live</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agentsList.map((agent) => {
              const isSelected = selectedAgent?.id === agent.id;
              return (
                <div
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer text-xs shadow-2xs ${
                    isSelected
                      ? 'bg-teal-50/30 border-[#0D9488] ring-2 ring-teal-500/20 shadow-md'
                      : 'bg-white border-slate-200/90 hover:border-teal-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">{agent.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        agent.autonomy === 'L2'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : agent.autonomy === 'L1'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {agent.autonomy}
                    </span>
                  </div>

                  <p className="text-slate-600 line-clamp-2 mb-3 text-[11px] leading-relaxed">
                    {agent.goal}
                  </p>

                  {/* Upstream GitHub Repository Badge */}
                  <div className="mb-3 p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                    <a
                      href={agent.github_repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-teal-700 hover:text-teal-900 hover:underline font-mono text-[11px] truncate group"
                      title={`Open GitHub repository: ${agent.repo_name}`}
                    >
                      <GitBranch className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                      <span className="truncate">{agent.repo_name}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 shrink-0" />
                    </a>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-600 shrink-0 font-medium border border-slate-200">
                      {agent.core_algorithms.length} Algos
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate max-w-[170px]" title={`Trigger: ${agent.trigger}`}>Trigger: {agent.trigger}</span>
                    <span className="text-teal-700 font-semibold flex items-center gap-0.5 shrink-0">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Execution Panel */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-white border border-slate-200/90 p-6 shadow-sm sticky top-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#0D9488]" />
                <span>Agent Execution Sandbox</span>
              </h3>
            </div>

            {selectedAgent ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Inspecting Agent:</span>
                  <span className="text-sm font-bold text-slate-900">{selectedAgent.name}</span>
                </div>

                {/* Open-Source GitHub Provenance Section */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-teal-50/70 to-slate-50 border border-teal-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-teal-600" />
                      Upstream GitHub Provenance
                    </span>
                    <a
                      href={selectedAgent.github_repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-teal-300 text-teal-800 font-mono text-[10px] font-bold hover:bg-teal-50 transition-colors shadow-2xs"
                      title="View repository on GitHub"
                    >
                      <span>{selectedAgent.repo_name}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="text-[11px] text-slate-700">
                    <span className="text-slate-500 font-semibold">Framework: </span>
                    <span className="text-slate-900 font-medium">{selectedAgent.upstream_framework}</span>
                  </div>

                  <div className="text-[11px] text-slate-700">
                    <span className="text-slate-500 font-semibold">Benchmark: </span>
                    <span className="text-teal-800 font-semibold">{selectedAgent.benchmark_reference}</span>
                  </div>

                  <div className="pt-2 border-t border-teal-200/60 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Code2 className="w-3 h-3 text-teal-600" />
                      Ported Algorithms &amp; Standards:
                    </span>
                    <ul className="space-y-1 pl-0.5">
                      {selectedAgent.core_algorithms.map((algo, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{algo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px]">
                  <div>
                    <strong className="text-slate-600">Autonomy Tier:</strong>{' '}
                    <span className="text-teal-700 font-bold">{selectedAgent.autonomy}</span>{' '}
                    ({selectedAgent.is_clinical ? 'Clinical Domain' : 'Non-Clinical Technical'})
                  </div>
                  <div>
                    <strong className="text-slate-600">Uses LLM:</strong> {selectedAgent.uses_llm}
                  </div>
                  <div>
                    <strong className="text-slate-600">Guardrails:</strong> {selectedAgent.guardrails}
                  </div>
                  <div>
                    <strong className="text-slate-600">Key Metrics:</strong> {selectedAgent.metrics}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Sample Test Input Payload:
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-200 overflow-x-auto max-h-36">
                    {JSON.stringify(selectedAgent.sampleInput, null, 2)}
                  </pre>
                </div>

                <button
                  type="button"
                  onClick={executeAgent}
                  disabled={executing}
                  className="w-full py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-teal-700/20 transition-all disabled:opacity-50"
                >
                  {executing ? (
                    <span>Evaluating Agent Logic...</span>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Trigger Agent Execution</span>
                    </>
                  )}
                </button>

                {outputJson && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-teal-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>Standardized Schema Output:</span>
                    </span>
                    <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-teal-300 overflow-x-auto max-h-52">
                      {JSON.stringify(outputJson, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 italic text-xs">
                Select any agent from the grid to inspect its goal, trigger, allowable tools, guardrails, and execute a live test run.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
