'use client';

import React from 'react';
import DicomUploader from '@/components/dicom/DicomUploader';

export default function DicomUploadSection() {
  return (
    <section id="upload" className="py-20 lg:py-28 bg-[#0A1823] border-t border-b border-white/10 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#00DCCE]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-[70rem] px-6 md:px-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00DCCE]/10 border border-[#00DCCE]/30 text-xs font-mono text-[#00DCCE] mb-4">
            <span className="w-2 h-2 rounded-full bg-[#00DCCE] animate-pulse" />
            Clinical Ingestion & Triage
          </div>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold font-sora text-white mb-4 tracking-tight"
          >
            Upload Clinical DICOM Scan
          </h2>
          <p className="text-sm lg:text-base text-gray-400 leading-relaxed font-sans">
            Only DICOM medical scans are accepted. Once ingested, you are automatically redirected to the
            Doctor Diagnostic Workstation to inspect model findings, calibrated probabilities, and Grad-CAM visual explainability.
          </p>
        </div>

        {/* The DICOM Uploader */}
        <div className="max-w-3xl mx-auto">
          <DicomUploader
            title="Drop Clinical DICOM Study Here"
            subtitle="Strict validation active: Non-DICOM files are rejected. Uploaded scans run directly on trained neural networks (zero fallback models)."
          />
        </div>
      </div>
    </section>
  );
}
