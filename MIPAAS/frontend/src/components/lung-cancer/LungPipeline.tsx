'use client';

import { useEffect, useRef, useState } from 'react';

const steps = [
  {
    id: 'upload',
    label: 'Upload',
    description: 'DICOM files securely transferred to GCS',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    color: '#98AED9',
    detail: 'Signed URL → GCS Bucket',
  },
  {
    id: 'preprocess',
    label: 'Preprocessing',
    description: 'CT windowing, voxel normalization, 3D reconstruction',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
    color: '#008280',
    detail: 'HU Range [-1000, 400] · Z-Score Norm',
  },
  {
    id: 'inference',
    label: 'AI Analysis',
    description: 'Sybil ensemble + 3D ResNet nodule classification',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    color: '#00DCCE',
    detail: 'GPU Inference · Cloud Run',
  },
  {
    id: 'xai',
    label: 'Explainability',
    description: 'Grad-CAM++, Occlusion Sensitivity, Integrated Gradients',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: '#FF7869',
    detail: 'Heatmap + Attention Maps',
  },
  {
    id: 'results',
    label: 'Results',
    description: 'Risk scores, heatmap overlays, downloadable report',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    color: '#00DCCE',
    detail: 'PDF + DICOM Viewer Overlay',
  },
];

export default function LungPipeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && activeStep === -1) {
          // Sequentially reveal steps
          let i = 0;
          const interval = setInterval(() => {
            setActiveStep(i);
            i++;
            if (i >= steps.length) clearInterval(interval);
          }, 400);
        }
      },
      { threshold: 0.3 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [activeStep]);

  return (
    <section id="pipeline" className="bg-[#0E273A] py-20 lg:py-28" ref={sectionRef}>
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#00DCCE]">
            Step 02
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl text-white mt-3 mb-4"
            style={{ fontFamily: "'Josefin Sans', sans-serif", fontWeight: 700 }}
          >
            Analysis Pipeline
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto leading-relaxed">
            From upload to explainable results in under 30 seconds. Every step is fully automated
            and powered by our async Cloud Run workers.
          </p>
        </div>

        {/* Pipeline steps */}
        <div className="relative">
          {/* Desktop: horizontal timeline */}
          <div className="hidden lg:block">
            {/* Connection line */}
            <div className="absolute top-[52px] left-[10%] right-[10%] h-[2px] bg-white/5" />
            <div
              className="absolute top-[52px] left-[10%] h-[2px] bg-gradient-to-r from-[#98AED9] via-[#00DCCE] to-[#FF7869] transition-all duration-1000 ease-out"
              style={{
                width: activeStep >= 0 ? `${Math.min((activeStep / (steps.length - 1)) * 80, 80)}%` : '0%',
              }}
            />

            <div className="grid grid-cols-5 gap-4">
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center transition-all duration-700 ${
                    i <= activeStep ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  {/* Circle */}
                  <div
                    className={`relative z-10 w-[104px] h-[104px] rounded-2xl flex items-center justify-center transition-all duration-500 border ${
                      i <= activeStep
                        ? 'bg-white/[0.05] border-white/10 shadow-xl'
                        : 'bg-white/[0.02] border-white/5'
                    }`}
                    style={
                      i <= activeStep
                        ? { boxShadow: `0 0 30px ${step.color}15, 0 0 60px ${step.color}08` }
                        : {}
                    }
                  >
                    <div style={{ color: i <= activeStep ? step.color : '#4a5568' }}>{step.icon}</div>
                    {i <= activeStep && (
                      <div
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: step.color }}
                      >
                        {i + 1}
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <h3 className="text-white font-semibold text-sm mt-5 mb-1">{step.label}</h3>
                  <p className="text-gray-500 text-xs text-center leading-relaxed px-2">
                    {step.description}
                  </p>
                  <span
                    className="mt-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5"
                    style={{ color: step.color }}
                  >
                    {step.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical timeline */}
          <div className="lg:hidden space-y-0">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={`relative flex gap-5 transition-all duration-700 ${
                  i <= activeStep ? 'opacity-100' : 'opacity-30'
                }`}
              >
                {/* Vertical line + circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all ${
                      i <= activeStep
                        ? 'bg-white/[0.05] border-white/10'
                        : 'bg-white/[0.02] border-white/5'
                    }`}
                    style={{ color: i <= activeStep ? step.color : '#4a5568' }}
                  >
                    {step.icon}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-[2px] flex-1 min-h-[40px] transition-colors duration-500 ${
                        i < activeStep ? 'bg-[#008280]' : 'bg-white/5'
                      }`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8 pt-1">
                  <h3 className="text-white font-semibold text-sm">{step.label}</h3>
                  <p className="text-gray-400 text-xs mt-1">{step.description}</p>
                  <span
                    className="inline-block mt-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.03] border border-white/5"
                    style={{ color: step.color }}
                  >
                    {step.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
