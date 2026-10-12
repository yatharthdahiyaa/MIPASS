'use client';

export default function LungCTA() {
  return (
    <section className="bg-[#0A1823] py-20 lg:py-28">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0E273A] via-[#0A1823] to-[#0E273A]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,130,128,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,120,105,0.08),transparent_60%)]" />

          {/* Border */}
          <div className="absolute inset-0 rounded-3xl border border-white/[0.06]" />

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Content */}
          <div className="relative z-10 py-16 lg:py-24 px-8 lg:px-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#008280]/10 border border-[#008280]/20 px-4 py-1.5 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00DCCE] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00DCCE]" />
              </span>
              <span className="text-xs font-medium text-[#00DCCE] tracking-wide">
                Available for Integration
              </span>
            </div>

            <h2
              className="text-3xl sm:text-4xl lg:text-5xl text-white mb-5"
              style={{ fontFamily: "'Josefin Sans', sans-serif", fontWeight: 700 }}
            >
              Ready to Transform Your
              <br />
              <span className="bg-gradient-to-r from-[#00DCCE] to-[#98AED9] bg-clip-text text-transparent">
                Lung Cancer Screening?
              </span>
            </h2>

            <p className="text-gray-400 max-w-2xl mx-auto text-base lg:text-lg leading-relaxed mb-10">
              Deploy our AI pipeline in your radiology workflow. Full DICOM integration, HIPAA
              compliance, and real-time explainable results — all on your own infrastructure.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#upload"
                className="group bg-gradient-to-r from-[#FF7869] to-[#ff5c4a] text-white rounded-full px-10 py-4 text-sm font-semibold tracking-wide transition-all duration-300 cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-[#FF7869]/20 hover:shadow-[#FF7869]/40 hover:scale-[1.02]"
              >
                <span>Try Now — Upload a Scan</span>
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="#contact"
                className="rounded-full border border-white/15 bg-white/5 px-8 py-4 text-sm font-medium text-white hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm"
              >
                Request a Demo
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 pt-8 border-t border-white/5">
              {[
                { icon: '🏥', label: 'HIPAA Compliant' },
                { icon: '🔒', label: 'SOC 2 Type II' },
                { icon: '🇪🇺', label: 'GDPR Ready' },
                { icon: '📋', label: 'FDA 510(k) Pathway' },
              ].map((badge) => (
                <div key={badge.label} className="flex items-center gap-2 text-gray-500 text-xs">
                  <span className="text-sm">{badge.icon}</span>
                  <span>{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
