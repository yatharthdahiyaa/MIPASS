'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const impactCards = [
  {
    title: 'The Global Impact of AI:',
    subtitle: 'Real Stories, Real Lives Transformed',
    description: 'Explore the clinical workspace behind our healthcare pathways.',
    buttonText: 'Explore the doctor workspace',
    href: '/doctor',
    image: '/images/mipaas_global_impact.jpg',
  },
  {
    title: 'From Aims to Achievements:',
    subtitle: 'Fulfilling Clinical & Business Goals',
    description: 'Explore the staff portal for operational workflows.',
    buttonText: 'Explore the staff portal',
    href: '/staff',
    image: '/images/mipaas_clinical_achievement.jpg',
  },
];

export default function ImpactSection() {
  return (
    <section id="product" aria-labelledby="impact-heading" className="scroll-mt-28 bg-white py-20 text-slate-900 border-b border-slate-200/80">
      <div className="site-container">
        <header className="mb-12 grid gap-6 border-b border-slate-200 pb-8 md:grid-cols-2 md:gap-12">
          <div>
            <p className="eyebrow mb-2 !text-blue-600 font-bold text-xs uppercase tracking-wider">Impact & implementation</p>
            <h2 id="impact-heading" className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              From pathways to practice
            </h2>
          </div>
          <p className="max-w-lg self-end text-sm leading-relaxed text-slate-600 md:text-base">
            These demonstration stories illustrate the platform’s intended use. They are not verified case studies or evidence of clinical or business outcomes.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-2 lg:gap-10">
          {impactCards.map((card) => (
            <article key={card.href} className="flex flex-col bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 hover:shadow-lg hover:border-blue-200 transition-all">
              <div className="relative mb-6 aspect-[16/10] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xs">
                <Image
                  src={card.image}
                  alt=""
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  loading="lazy"
                  className="object-cover hover:scale-105 transition-transform duration-500"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">Demonstration story</p>
              <h3 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 mb-2">
                <span>{card.title} </span>
                <span className="text-slate-600 font-semibold">{card.subtitle}</span>
              </h3>
              <p className="text-sm leading-relaxed text-slate-500 mb-6">{card.description}</p>
              <div className="mt-auto pt-2">
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-md transition-all group"
                >
                  <span>{card.buttonText}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
