'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function DevelopmentsSection() {
  return (
    <section id="pricing" aria-labelledby="developments-heading" className="scroll-mt-28 border-b border-slate-200/80 bg-slate-50/70 py-20 text-slate-900">
      <div className="site-container">
        <header className="mb-12 max-w-3xl">
          <p className="eyebrow mb-2 !text-blue-600 font-bold text-xs uppercase tracking-wider">Evidence & insights</p>
          <h2 id="developments-heading" className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Explore Our Latest Developments
          </h2>
          <p className="mt-4 max-w-2xl text-slate-600 text-sm sm:text-base leading-relaxed">
            Explore the clinical pathways behind these stories. The studies, news, and deployment figures below illustrate MIPASS AI in clinical practice.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Card 1: Lead Research Study */}
          <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-all lg:col-span-2 flex flex-col">
            <div className="grid h-full sm:grid-cols-[1.15fr_1fr]">
              <div className="flex flex-col p-6 sm:p-8">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-600">Research study · Demo</p>
                <h3 className="text-2xl font-bold leading-snug tracking-tight text-slate-900">
                  AI Helps Doctors Treat Stroke Faster: MIPASS Study Reveals Significant Real-World Impact
                </h3>
                <p className="mt-4 text-xs font-medium text-slate-500">
                  Dr. Sarah Chen, Dr. Raj Patel, Dr. Michael Torres, Dr. Lisa Kim, Dr. Priya Sharma, Dr. James Wilson
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  Illustrative study and author list. Demonstrating clinical acceleration through automated imaging triage.
                </p>
                <div className="mt-auto pt-6">
                  <Link
                    href="/stroke"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm"
                  >
                    <span>Explore qStroke</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
              <div className="relative min-h-64 bg-slate-100">
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

          {/* Card 2: Regulatory Clearance */}
          <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-all">
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
            <div className="flex flex-1 flex-col p-6 sm:p-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">News · Sep 2026 · Demo</p>
              <h3 className="text-lg font-bold leading-snug text-slate-900">
                MIPASS Clinical Decision Support System Wins Landmark Class II Clearance
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Illustrative headline. Regulatory clearance standards align with rigorous global software-as-a-medical-device protocols.
              </p>
              <div className="mt-auto pt-5">
                <Link
                  href="/qer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <span>Explore qER</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </article>

          {/* Card 3: Global Movement */}
          <article className="flex flex-col rounded-2xl border border-blue-100 bg-blue-50/60 p-6 sm:p-8 hover:shadow-md transition-all">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">Global updates · Demo</p>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Join the Movement</h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Over 5,500 healthcare institutions across 105 countries deploy MIPASS AI to accelerate diagnosis, reduce clinician burnout, and expand access to rural and underserved populations.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Demonstration figures and outcome metrics.
            </p>
            <div className="mt-auto pt-6 border-t border-blue-100">
              <Link
                href="/tb"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <span>Explore qTrack for TB</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </article>

          {/* Card 4: Radiology Perspective */}
          <article className="grid overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-all sm:grid-cols-2 lg:col-span-2">
            <div className="relative min-h-64 bg-slate-100">
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
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">Radiology perspective · Demo</p>
              <h3 className="text-2xl font-bold leading-snug tracking-tight text-slate-900">
                The Future of Radiology: Bridging the Gap Between Rural Clinics and Global Standards
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Explore the chest X-ray pathway. Demonstrating real-time pathology screening in primary healthcare settings.
              </p>
              <div className="pt-6 mt-auto">
                <Link
                  href="/qxr"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <span>Explore qXR</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
