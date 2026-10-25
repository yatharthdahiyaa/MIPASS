'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface DicomUploaderProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export default function DicomUploader({
  title = "Upload DICOM Clinical Image",
  subtitle = "Directly triaged by our trained deep-learning models (Zero fallback architecture). Only valid .dcm / .dicom medical images are accepted.",
  compact = false,
}: DicomUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setErrorMessage(null);

    const name = file.name.toLowerCase();
    // STRICT VALIDATION: ONLY DICOM IMAGES ARE ACCEPTED
    if (!name.endsWith('.dcm') && !name.endsWith('.dicom')) {
      setErrorMessage(
        `File "${file.name}" was rejected. Only DICOM images (.dcm / .dicom) are accepted for model analysis. Non-DICOM formats cannot be evaluated.`
      );
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage('Ingesting DICOM study & verifying headers...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('serviceId', 'qxr');

      setStatusMessage('Executing trained neural model (DenseNet-121, zero fallback)...');

      const response = await fetch('/api/inference/dicom-predict', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to analyze DICOM image');
      }

      setStatusMessage('Generating Grad-CAM visual attention overlays...');

      // Store in sessionStorage for the Doctor Diagnostic Workstation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('mipaas_active_dicom_study', JSON.stringify(json.data));
      }

      setStatusMessage('Redirecting to Doctor Workstation...');
      // REDIRECT TO DOCTOR FINDINGS PAGE
      router.push('/doctor');
    } catch (err) {
      console.error('DICOM upload error:', err);
      setErrorMessage((err instanceof Error ? err.message : String(err)) || 'An error occurred while evaluating the DICOM image.');
      setIsProcessing(false);
    }
  }, [router]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
      }
    },
    [processFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      {/* ── Error Toast / Alert ── */}
      {errorMessage && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-3 shadow-lg">
          <svg className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Upload Rejected — DICOM Required</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400/80 hover:text-red-400 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Upload Zone ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`
          relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
          ${isDragging ? 'border-[#00DCCE] bg-[#00DCCE]/10 scale-[1.01]' : 'border-white/15 bg-white/[0.02] hover:border-[#00DCCE]/60 hover:bg-[#00DCCE]/5'}
          ${isProcessing ? 'border-[#008280]/40 bg-[#0A1823]/80 cursor-wait' : ''}
          ${compact ? 'p-6' : 'p-8 lg:p-12'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".dcm,.dicom"
          className="hidden"
          onChange={handleFileSelect}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#008280]/30" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00DCCE] animate-spin" />
              <div className="absolute inset-2 rounded-full border border-transparent border-b-[#FF7869] animate-[spin_1.2s_linear_infinite_reverse]" />
            </div>
            <h4 className="text-base font-bold font-sora text-white mb-1">Processing DICOM Scan</h4>
            <p className="text-xs font-mono text-[#00DCCE]">{statusMessage}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            {/* DICOM Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00DCCE]/20 to-[#008280]/10 border border-[#00DCCE]/20 flex items-center justify-center mb-4 text-[#00DCCE]">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <h3 className="text-lg lg:text-xl font-bold font-sora text-white mb-2">
              {isDragging ? 'Release to Ingest DICOM Scan' : title}
            </h3>
            <p className="text-xs lg:text-sm text-gray-400 max-w-lg mb-4 leading-relaxed">
              {subtitle}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-[#00DCCE]">
                .dcm
              </span>
              <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-[#00DCCE]">
                .dicom
              </span>
              <span className="px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
                ✓ Auto-redirects to Doctor Station
              </span>
            </div>

            <p className="text-xs text-gray-500">
              Click to browse files or drop directly into this dropzone
            </p>
          </div>
        )}
      </div>

      {/* ── Test Sample helper link ── */}
      <div className="flex items-center justify-between text-xs text-gray-500 mt-3 px-1">
        <span>🔒 Zero fallback models · Evaluated strictly with trained neural weights</span>
        <a
          href="/sample_cxr.dcm"
          download="sample_cxr.dcm"
          className="text-[#00DCCE] hover:underline underline-offset-2 flex items-center gap-1 font-mono"
        >
          <span>Download Sample DICOM (.dcm)</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    </div>
  );
}
