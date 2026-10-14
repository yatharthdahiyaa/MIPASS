'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function DevelopmentsSection() {
  return (
    <section id="evidence" aria-labelledby="developments-heading" className="scroll-mt-28 border-b border-slate-200 bg-white py-16 text-[#0F2332] md:py-24">
      <div className="site-container">
        <header className="mb-10 max-w-3xl md:mb-12">
          <p className="eyebrow mb-4 !text-[#006B69]">Evidence & insights</p>
          <h2 id="developments-heading" className="section-heading">Explore Our Latest Developments</h2>
          <p className="section-description mt-5 !max-w-2xl !text-slate-600">
            Explore the clinical pathways behind these stories. The studies, news and deployment figures below are demonstration content, not verified evidence or regulatory announcements.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <article className="overflow-hidden rounded-xl border border-[#0F2332] bg-[#0F2332] text-white lg:col-span-2">
            <div className="grid h-full sm:grid-cols-[1.15fr_1fr]">
              <div className="flex flex-col p-6 sm:p-8">
                <p className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#FF7869]">Research study · Demo</p>
                <h3 className="text-2xl font-semibold leading-snug tracking-tight">
                  AI Helps Doctors Treat Stroke Faster: MiPAAS Study Reveals Significant Real-World Impact
                </h3>
                <p className="mt-5 text-sm leading-relaxed text-slate-300">
                  Dr. Sarah Chen, Dr. Raj Patel, Dr. Michael Torres, Dr. Lisa Kim, Dr. Priya Sharma, Dr. James Wilson
                </p>
                <p className="mt-4 text-xs leading-relaxed text-slate-300">
                  Illustrative study and author list. No published study is provided here; treatment-time improvements are not verified.
                </p>
                <div className="mt-auto pt-7">
                  <Link href="/stroke" className="button-primary">Explore qStroke <span aria-hidden="true">→</span></Link>
                </div>
              </div>
              <div className="relative min-h-64 bg-[#19394B]">
                <Image
                  src="/images/mipaas_stroke_care.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 45vw, 30vw"
                  loading="lazy"
                  className="object-cover"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>
          </article>

          <article id="insights" className="flex scroll-mt-28 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-48 bg-slate-100">
              <Image
                src="/images/mipaas_regulatory_award.jpg"
                alt=""
                fill
                sizes="(max-width: 1023px) 100vw, 33vw"
                loading="lazy"
                className="object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="flex flex-1 flex-col p-6 sm:p-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#008280]">News · Sep 2026 · Demo</p>
              <h3 className="text-xl font-semibold leading-snug">
                MiPAAS Clinical Decision Support System Wins Landmark Class II Regulatory Clearance
              </h3>
              <p className="mt-4 text-xs leading-relaxed text-slate-600">
                Illustrative headline only. Regulatory clearance has not been verified; requirements vary by product and deployment.
              </p>
              <Link href="/qer" className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-[#006B69] underline underline-offset-4 hover:text-[#0F2332] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008280]">
                Explore qER <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>

          <article className="flex flex-col rounded-xl border border-[#008280]/20 bg-[#F1F7F6] p-6 sm:p-8">
            <p className="eyebrow mb-4 !text-[#006B69]">Global updates · Demo</p>
            <h3 className="text-2xl font-semibold tracking-tight">Join the Movement</h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              Over 5,500 healthcare institutions across 105 countries deploy MiPAAS AI to accelerate diagnosis, reduce clinician burnout, and expand access to rural and underserved populations.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              Demonstration figures and outcome claims; deployment scale and clinical benefits are not verified.
            </p>
            <div className="mt-6 border-t border-[#008280]/20 pt-6">
              <Link href="/tb" className="inline-flex items-center gap-2 text-sm font-semibold text-[#006B69] underline underline-offset-4 hover:text-[#0F2332] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008280]">
                Explore qTrack for TB <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>

          <article className="grid overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFB] sm:grid-cols-2 lg:col-span-2">
            <div className="relative min-h-64 bg-slate-200">
              <Image
                src="/images/mipaas_radiology_future.jpg"
                alt=""
                fill
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                loading="lazy"
                className="object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="eyebrow mb-4 !text-[#006B69]">Radiology perspective · Demo</p>
              <h3 className="text-2xl font-semibold leading-snug tracking-tight">
                The Future of Radiology: Bridging the Gap Between Rural Clinics and Global Standards
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Explore the chest X-ray pathway. This illustrative story is not a published article or evidence of clinical outcomes.
              </p>
              <Link href="/qxr" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#006B69] underline underline-offset-4 hover:text-[#0F2332] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008280]">
                Explore qXR <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
