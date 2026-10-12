'use client';

import React from 'react';
import DicomUploader from '@/components/dicom/DicomUploader';

export default function LungUploader() {
  return (
    <section id="upload" className="bg-[#0A1823] py-20 lg:py-28 border-t border-b border-white/10">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#FF7869]">
            Step 01 · Clinical Ingestion
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl text-white mt-3 mb-4"
            style={{ fontFamily: "'Josefin Sans', sans-serif", fontWeight: 700 }}
          >
            Upload Your DICOM Scan
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto leading-relaxed text-sm">
            Drag and drop your DICOM files (.dcm / .dicom). Only valid DICOM medical images are accepted.
            Upon ingestion, you are automatically redirected to the Doctor Workstation to inspect model findings.
          </p>
        </div>

        {/* Upload zone */}
        <div className="max-w-3xl mx-auto">
          <DicomUploader
            title="Upload Chest CT / X-Ray DICOM Study"
            subtitle="Analyzed by our trained DenseNet-121 neural models with zero fallback architectures. Auto-redirects to Doctor Workstation."
          />
        </div>
      </div>
    </section>
  );
}
