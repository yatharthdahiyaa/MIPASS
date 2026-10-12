'use client';

import { useEffect, useRef, useState } from 'react';

const features = [
  {
    title: '3D ResNet Analysis',
    description:
      'Deep volumetric analysis using 3D Residual Networks trained on 200K+ CT scans. Detects nodules as small as 3mm with sub-second inference.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
      </svg>
    ),
    accent: '#00DCCE',
    tag: 'MONAI Compatible',
    stats: '200K+ Training Scans',
  },
  {
    title: 'Grad-CAM++ Visualization',
    description:
      'See exactly where the AI is looking. Enhanced Grad-CAM++ generates high-resolution attention heatmaps overlaid directly on your DICOM slices.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    accent: '#FF7869',
    tag: 'Primary XAI',
    stats: 'Pixel-Level Attribution',
  },
  {
    title: 'Sybil Risk Prediction',
    description:
      'MIT&apos;s clinically validated Sybil model predicts 1-6 year lung cancer risk from a single LDCT scan — no radiologist annotation needed.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    accent: '#98AED9',
    tag: 'NLST Validated',
    stats: 'AUC 0.94 (6-year)',
  },
  {
    title: 'Lesion Segmentation',
    description:
      'Automatic 3D segmentation of suspicious lesions using SHAP-guided feature attribution with morphological post-processing for clean masks.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    accent: '#008280',
    tag: 'DeepSHAP',
    stats: 'Dice Score 0.87',
  },
  {
    title: 'Occlusion Sensitivity',
    description:
      'Systematic patch occlusion reveals which regions most influence the model&apos;s predictions, providing validation for Grad-CAM++ findings.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    accent: '#FF7869',
    tag: 'Validation XAI',
    stats: 'Sliding Patch 8×8×8',
  },
  {
    title: 'Integrated Gradients',
    description:
      'Axiom-based attribution method satisfying sensitivity and implementation invariance — the gold standard for neural network interpretability.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    accent: '#98AED9',
    tag: 'Captum Engine',
    stats: '200 Interpolation Steps',
  },
];

export default function LungFeatures() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 },
    );
    if (gridRef.current) observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-[#0A1823] py-20 lg:py-28">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#98AED9]">
            Capabilities
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl text-white mt-3 mb-4"
            style={{ fontFamily: "'Josefin Sans', sans-serif", fontWeight: 700 }}
          >
            Full AI + XAI Stack
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto leading-relaxed">
            Every prediction comes with multiple layers of explainability. Nothing is a black box.
          </p>
        </div>

        {/* Feature grid */}
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-all duration-700 hover:bg-white/[0.04] hover:border-white/10 hover:shadow-xl overflow-hidden ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {/* Accent glow on hover */}
              <div
                className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[60px] pointer-events-none"
                style={{ backgroundColor: f.accent }}
              />

              {/* Icon + tag */}
              <div className="flex items-start justify-between mb-5 relative z-10">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center border transition-colors"
                  style={{
                    backgroundColor: `${f.accent}10`,
                    borderColor: `${f.accent}25`,
                    color: f.accent,
                  }}
                >
                  {f.icon}
                </div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md border"
                  style={{
                    color: f.accent,
                    borderColor: `${f.accent}25`,
                    backgroundColor: `${f.accent}08`,
                  }}
                >
                  {f.tag}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-white font-semibold text-lg mb-2 relative z-10">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10">{f.description}</p>

              {/* Stat */}
              <div className="mt-5 pt-4 border-t border-white/5 relative z-10">
                <span className="text-xs font-mono text-gray-500">{f.stats}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
