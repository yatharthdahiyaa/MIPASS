'use client';

export default function DevelopmentsSection() {
  return (
    <section id="evidence" className="relative w-full bg-gray-100 py-16 md:py-24 border-b border-gray-200 scroll-mt-28">
      {/* Top half white backdrop */}
      <div className="absolute top-0 left-0 right-0 h-[280px] md:h-1/3 bg-white -z-10" />

      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#FF7869] to-[#833766] bg-clip-text text-transparent pb-8 md:pb-12">
          Explore Our Latest Developments
        </h2>

        {/* Row 1: Featured (2/3) + Secondary (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Featured purple study card (2/3 width on desktop) */}
          <div className="lg:col-span-2 bg-[#833766] rounded-2xl p-6 sm:p-10 flex flex-col sm:flex-row gap-8 justify-between shadow-xl overflow-hidden relative">
            <div className="sm:w-1/2 flex flex-col justify-between gap-6 z-10">
              <div>
                <span className="inline-block text-xs uppercase tracking-wider font-semibold text-white/80 bg-white/15 px-3 py-1 rounded-full mb-3">
                  Research Study
                </span>
                <h3 className="text-white text-2xl sm:text-3xl font-light leading-snug mb-3">
                  AI Helps Doctors Treat Stroke Faster: MiPAAS Study Reveals Significant Real-World Impact
                </h3>
                <a
                  href="#evidence"
                  className="text-[#FF7869] text-sm sm:text-base font-medium underline hover:text-[#ff9b90] transition-colors"
                >
                  Read Study &rarr;
                </a>
              </div>

              <div>
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-5">
                  Dr. Sarah Chen, Dr. Raj Patel, Dr. Michael Torres, Dr. Lisa Kim, Dr. Priya Sharma, Dr. James Wilson
                </p>
                <a
                  href="#evidence"
                  className="inline-block rounded-full border border-[#FF7869] text-[#FF7869] hover:bg-[#FF7869] hover:text-white px-7 py-2.5 text-sm font-semibold transition-all cursor-pointer"
                >
                  See More Evidence
                </a>
              </div>
            </div>

            <div className="sm:w-1/2 h-[260px] sm:h-auto rounded-xl overflow-hidden relative shadow-lg">
              <img
                src="/images/mipaas_stroke_care.jpg"
                alt="Stroke Care Study"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#833766]/60 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Secondary news card (1/3 width on desktop) */}
          <div id="insights" className="bg-[#0F2332] rounded-2xl p-6 flex flex-col justify-between gap-6 shadow-xl border border-white/10 scroll-mt-28">
            <div className="flex flex-col gap-4">
              <div className="h-44 rounded-xl overflow-hidden relative">
                <img
                  src="/images/mipaas_regulatory_award.jpg"
                  alt="Regulatory Clearance"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="text-[#00DCCE] font-medium">News</span>
                <span>•</span>
                <span>Sep 2026</span>
              </div>

              <h4 className="text-white text-lg font-medium leading-snug">
                MiPAAS Clinical Decision Support System Wins Landmark Class II Regulatory Clearance
              </h4>

              <a
                href="#insights"
                className="text-[#FF7869] text-xs font-semibold underline hover:text-[#ff9b90]"
              >
                Know More &rarr;
              </a>
            </div>

            <a
              href="#insights"
              className="w-full text-center rounded-full border border-white/30 text-white hover:bg-white hover:text-[#0F2332] py-2.5 text-xs font-semibold transition-all cursor-pointer"
            >
              Read More News
            </a>
          </div>
        </div>

        {/* Row 2: Community update (1/3) + Big blog banner (2/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#0F2332] rounded-2xl p-6 sm:p-8 flex flex-col justify-between text-white shadow-xl border border-white/10">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-[#00DCCE] bg-[#00DCCE]/10 px-3 py-1 rounded-full">
                Global Updates
              </span>
              <h4 className="text-xl font-bold mt-4 mb-2">
                Join the Movement
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed">
                Over 5,500 healthcare institutions across 105 countries deploy MiPAAS AI to accelerate diagnosis, reduce clinician burnout, and expand access to rural and underserved populations.
              </p>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between">
              <span className="text-xs text-gray-400">Follow our journey</span>
              <a
                href="#"
                className="text-xs font-semibold text-[#00DCCE] hover:underline"
              >
                @MiPAAS_AI &rarr;
              </a>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl overflow-hidden relative shadow-xl min-h-[260px] sm:min-h-[320px]">
            <img
              src="/images/mipaas_radiology_future.jpg"
              alt="Healthcare Innovation Blog"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 sm:p-10">
              <h3 className="text-white text-xl sm:text-2xl font-bold mb-4 max-w-lg">
                The Future of Radiology: Bridging the Gap Between Rural Clinics and Global Standards
              </h3>
              <a
                href="#insights"
                className="rounded-full border border-white text-white hover:bg-white hover:text-[#0F2332] px-7 py-2.5 text-sm font-semibold transition-all w-fit cursor-pointer"
              >
                Read The Full Blog
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
