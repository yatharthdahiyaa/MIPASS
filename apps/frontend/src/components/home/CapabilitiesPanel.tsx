import React from 'react';
import { Grain, MonoLabel, PillLink, Reveal } from './ui';

const COLUMNS = [
  {
    title: 'Detect',
    items: [
      'Chest X-ray triage',
      'Head CT haemorrhage',
      'Stroke LVO & ASPECTS',
      'Lung nodule detection',
      'Brain tumour segmentation',
      'Cardiac MRI function',
      'Skin lesion risk',
      'Diabetic foot thermography',
    ],
  },
  {
    title: 'Explain',
    items: [
      'Grad-CAM++ heatmaps',
      'Integrated Gradients',
      'Occlusion sensitivity',
      'Confidence per finding',
      'Image quality checks',
      'Protocol compatibility',
      'Comparison with priors',
      'Model QA monitoring',
    ],
  },
  {
    title: 'Report',
    items: [
      'Structured findings',
      'Draft narrative reports',
      'Radiologist e-signature',
      'STAT worklist triage',
      'Referral & follow-up',
      'Patient-friendly summaries',
      'FHIR DiagnosticReport',
      'Longitudinal tracking',
    ],
  },
  {
    title: 'Integrate & govern',
    items: [
      'DICOM & DICOMweb',
      'OpenEMR & HL7 FHIR R4',
      'ABDM & ABHA linking',
      'Role-based access',
      'Break-glass approvals',
      'Complete audit trail',
      'Consent & erasure',
      'Pseudonymised analytics',
    ],
  },
];

export default function CapabilitiesPanel() {
  return (
    <section id="platform" className="scroll-mt-24 pt-[var(--h-section-y)]">
      <div className="h-container">
        <Reveal>
          <div className="h-alloy overflow-hidden rounded-[20px] px-6 py-14 sm:px-10 lg:p-20">
            <Grain />
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <MonoLabel className="text-[var(--h-ink-muted)]">What MIPAAS does</MonoLabel>
                <h2 className="h-display-l mt-3 text-[var(--h-ink)]">Mission-critical imaging AI.</h2>
              </div>
              <PillLink href="#how-it-works" tone="ink" className="lg:mb-2">
                See how it works
              </PillLink>
            </div>

            <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <h3 className="h-title text-[var(--h-ink)]">{col.title}</h3>
                  <ul className="mt-5 space-y-2">
                    {col.items.map((it) => (
                      <li key={it} className="h-body text-[var(--h-ink-muted)]">
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
