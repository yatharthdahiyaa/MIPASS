'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileCheck,
  AlertTriangle,
  Search,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  ArrowRight,
  HardDrive,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface CaseItem {
  case_id: string;
  pseudonym_id: string;
  modality: string;
  study_description: string;
  slices: number;
  upload_timestamp: string;
  intake_status: 'VALIDATED' | 'REJECTED_QUALITY' | 'PENDING_VALIDATION';
  quality_score: number;
  blur_metric: number;
  snr_db: number;
  notes: string;
}

export default function StaffPortal() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadChunk, setUploadChunk] = useState({ current: 0, total: 16 });
  const [activeFeedbackModal, setActiveFeedbackModal] = useState<CaseItem | null>(null);

  const [cases, setCases] = useState<CaseItem[]>([
    {
      case_id: 'CASE-2026-001',
      pseudonym_id: 'MIP-8842-X',
      modality: 'CXR',
      study_description: 'Chest PA/Lateral Mobile',
      slices: 2,
      upload_timestamp: '2026-10-13 00:15 UTC',
      intake_status: 'VALIDATED',
      quality_score: 96,
      blur_metric: 64.2,
      snr_db: 25.8,
      notes: 'Optimal contrast dynamic range; header Part 10 conforming.',
    },
    {
      case_id: 'CASE-2026-002',
      pseudonym_id: 'MIP-1109-A',
      modality: 'CXR',
      study_description: 'Chest Portable (ED Resus)',
      slices: 1,
      upload_timestamp: '2026-10-13 00:08 UTC',
      intake_status: 'REJECTED_QUALITY',
      quality_score: 34,
      blur_metric: 16.4,
      snr_db: 11.2,
      notes: 'Severe respiratory motion blur detected. Laplacian variance below 45.0 threshold.',
    },
    {
      case_id: 'CASE-2026-003',
      pseudonym_id: 'MIP-5512-Y',
      modality: 'CT',
      study_description: 'Low-Dose Chest CT Volume',
      slices: 480,
      upload_timestamp: '2026-10-12 23:42 UTC',
      intake_status: 'VALIDATED',
      quality_score: 98,
      blur_metric: 78.1,
      snr_db: 28.4,
      notes: 'Isotropic 1mm reconstruction verified. Ready for Sybil/DenseNet inference.',
    },
    {
      case_id: 'CASE-2026-004',
      pseudonym_id: 'MIP-3199-Z',
      modality: 'DERM',
      study_description: 'Dermoscopic Polarized Lesion',
      slices: 1,
      upload_timestamp: '2026-10-12 22:15 UTC',
      intake_status: 'VALIDATED',
      quality_score: 92,
      blur_metric: 58.0,
      snr_db: 23.9,
      notes: 'Color calibration standard HAM10000 aligned.',
    },
  ]);

  const simulateResumableUpload = (scenario: 'valid' | 'blurry') => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadChunk({ current: 0, total: 16 });

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setUploadChunk({ current, total: 16 });
      const pct = Math.round((current / 16) * 100);
      setUploadProgress(pct);

      if (current >= 16) {
        clearInterval(interval);
        setIsUploading(false);

        const newCase: CaseItem = scenario === 'valid' ? {
          case_id: `CASE-2026-${Math.floor(100 + Math.random() * 900)}`,
          pseudonym_id: `MIP-${Math.floor(1000 + Math.random() * 9000)}-Q`,
          modality: 'CXR',
          study_description: 'Chest Radiograph Direct Ingest',
          slices: 2,
          upload_timestamp: 'Just now',
          intake_status: 'VALIDATED',
          quality_score: 95,
          blur_metric: 62.8,
          snr_db: 26.2,
          notes: 'Agent 1 (Intake & Quality L2) validated image and body part matching.',
        } : {
          case_id: `CASE-2026-${Math.floor(100 + Math.random() * 900)}`,
          pseudonym_id: `MIP-${Math.floor(1000 + Math.random() * 9000)}-R`,
          modality: 'CXR',
          study_description: 'Chest Portable (Re-take Needed)',
          slices: 1,
          upload_timestamp: 'Just now',
          intake_status: 'REJECTED_QUALITY',
          quality_score: 28,
          blur_metric: 14.8,
          snr_db: 9.8,
          notes: 'Excessive motion blur detected: Laplacian variance 14.8 < 45.0 cutoff.',
        };

        setCases((prev) => [newCase, ...prev]);
        setActiveFeedbackModal(newCase);
      }
    }, 120);
  };

  const filteredCases = cases.filter(
    (c) =>
      c.pseudonym_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.study_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-6 md:p-8">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold uppercase tracking-wider">
                Persona: Hospital &amp; Lab Staff
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                Agent 1 (Intake &amp; Quality L2) Active
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
              DICOM Ingestion &amp; Case Timeline Hub
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Multi-channel resumable chunk upload, pseudonymous patient timeline, and instant blur/motion quality gate.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/doctor"
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
            >
              <span>Clinician Worklist</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Station Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-teal-600" />
                <span>Resumable Upload Station</span>
              </h2>
              <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md font-mono">
                GCS Chunked (V4)
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-5">
              Supports single DICOM files, entire multi-frame CT/MRI series directories, or background PACS C-STORE push.
            </p>

            {/* Drag & drop dropzone */}
            <div className="border-2 border-dashed border-teal-200 hover:border-teal-500 rounded-2xl p-8 text-center bg-teal-50/20 hover:bg-teal-50/40 transition-all cursor-pointer group">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-teal-50 flex items-center justify-center border border-teal-200 group-hover:scale-105 transition-transform shadow-xs">
                <HardDrive className="w-7 h-7 text-teal-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Drag &amp; Drop DICOM Files or Folder</p>
              <p className="text-xs text-slate-500 mt-1">.dcm, .dicom, CT/MRI series folder up to 2 GB</p>

              {/* Demo Upload Triggers */}
              <div className="mt-5 grid grid-cols-2 gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => simulateResumableUpload('valid')}
                  className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold border border-teal-200 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  Test Good Ingest
                </button>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => simulateResumableUpload('blurry')}
                  className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-200 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  Test Blurry Re-take
                </button>
              </div>
            </div>

            {/* Upload Progress Tracker */}
            {isUploading && (
              <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-teal-300 animate-pulse shadow-xs">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="text-teal-700 font-semibold flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Chunk Stream ({uploadChunk.current}/{uploadChunk.total})
                  </span>
                  <span className="font-mono text-slate-900 font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-mono">
                  SHA-256 integrity hash verification active · Edge de-identification enabled
                </p>
              </div>
            )}

            {/* Ingestion Channels Status */}
            <div className="mt-6 space-y-2.5 pt-4 border-t border-slate-200">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
                Active Ingestion Channels
              </span>
              <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  PACS Push (C-STORE AE: MIPAAS_IN:11112)
                </span>
                <span className="text-emerald-700 font-mono text-[11px] font-bold">LISTENING</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  GCS Resumable Web Upload (TLS 1.3)
                </span>
                <span className="text-emerald-700 font-mono text-[11px] font-bold">READY</span>
              </div>
            </div>
          </div>
        </div>

        {/* Master Case List & Pseudonymous Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-teal-600" />
                  <span>Case Registry &amp; Patient Timeline</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Indexed strictly by cryptographic pseudonymous IDs. Zero raw PII exposed.
                </p>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Pseudonym ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Case List Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Pseudonym ID</th>
                    <th className="py-3 px-4">Modality</th>
                    <th className="py-3 px-4">Study Description</th>
                    <th className="py-3 px-4">Intake Status</th>
                    <th className="py-3 px-4">Quality Score</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredCases.map((c) => (
                    <tr key={c.case_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-teal-600" />
                        <span>{c.pseudonym_id}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 font-mono">
                          {c.modality}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{c.study_description}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{c.upload_timestamp} · {c.slices} slices</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {c.intake_status === 'VALIDATED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Validated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-semibold">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Blurry / Re-take
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                c.quality_score >= 80 ? 'bg-emerald-600' : 'bg-rose-600'
                              }`}
                              style={{ width: `${c.quality_score}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-slate-800">{c.quality_score}%</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Var: {c.blur_metric}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveFeedbackModal(c)}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-teal-50 text-teal-700 border border-slate-200 hover:border-teal-300 text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1 shadow-xs"
                        >
                          <Eye className="w-3 h-3 text-teal-600" />
                          <span>Quality</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Immediate Quality Feedback Modal */}
      {activeFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Agent 1: Intake &amp; Quality Diagnostic Report
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  Quality Evaluation: {activeFeedbackModal.pseudonym_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveFeedbackModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Alert Status Banner */}
              {activeFeedbackModal.intake_status === 'VALIDATED' ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">Study Passed Ingestion Conformance</h4>
                    <p className="text-xs text-emerald-800 mt-1">
                      {activeFeedbackModal.notes}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">
                      Immediate Warning: Blurry Scan Detected (Re-take Advised)
                    </h4>
                    <p className="text-xs text-rose-800 mt-1">
                      {activeFeedbackModal.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-center">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Blur Variance</span>
                  <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                    {activeFeedbackModal.blur_metric}
                  </span>
                  <span className="text-[9px] text-slate-400">Threshold: &gt; 45.0</span>
                </div>
                <div className="text-center border-x border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">SNR Dynamic</span>
                  <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                    {activeFeedbackModal.snr_db} dB
                  </span>
                  <span className="text-[9px] text-slate-400">Min: 18.0 dB</span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Overall Quality</span>
                  <span
                    className={`text-base font-bold font-mono mt-0.5 block ${
                      activeFeedbackModal.quality_score >= 80 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {activeFeedbackModal.quality_score}%
                  </span>
                  <span className="text-[9px] text-slate-400">Pass: &ge; 80%</span>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Autonomy Tier:</span>
                  <span className="font-semibold text-slate-900">L2 (Non-Clinical Operational Gate)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Modality Declared:</span>
                  <span className="font-mono text-slate-900 font-semibold">{activeFeedbackModal.modality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Downstream Paid Inference:</span>
                  <span className="font-semibold text-slate-900">
                    {activeFeedbackModal.intake_status === 'VALIDATED' ? 'Queued to Routing Agent (L2)' : 'Halted (Zero Cost Incurred)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
              {activeFeedbackModal.intake_status === 'REJECTED_QUALITY' ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFeedbackModal(null);
                    simulateResumableUpload('valid');
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Initiate Re-take Upload
                </button>
              ) : (
                <Link
                  href="/doctor"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  Open in Clinician Workstation
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
