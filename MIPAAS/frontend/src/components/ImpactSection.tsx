'use client';

import Image from 'next/image';
import Link from 'next/link';

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
    <section id="impact" aria-labelledby="impact-heading" className="scroll-mt-28 bg-[#0F2332] py-16 text-white md:py-24">
      <div className="site-container">
        <header className="mb-10 grid gap-5 border-b border-white/15 pb-8 md:mb-12 md:grid-cols-2 md:gap-12">
          <div>
            <p className="eyebrow mb-4 !text-slate-300">Impact & implementation</p>
            <h2 id="impact-heading" className="section-heading !text-white">From pathways to practice</h2>
          </div>
          <p className="max-w-lg self-end text-sm leading-relaxed text-slate-300 md:text-base">
            These demonstration stories illustrate the platform’s intended use. They are not verified case studies or evidence of clinical or business outcomes.
          </p>
        </header>

        <div className="grid gap-10 md:grid-cols-2 md:gap-8 lg:gap-12">
          {impactCards.map((card) => (
            <article key={card.href} className="flex flex-col">
              <div className="relative mb-6 aspect-[16/10] overflow-hidden rounded-lg border border-white/15 bg-[#19394B]">
                <Image
                  src={card.image}
                  alt=""
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  loading="lazy"
                  className="object-cover"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              </div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#FF7869]">Demonstration story</p>
              <h3 className="max-w-xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
                <span className="block text-white">{card.title}</span>
                <span className="mt-1 block text-slate-300">{card.subtitle}</span>
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">{card.description}</p>
              <div className="mt-auto pt-6">
                <Link href={card.href} className="button-primary">{card.buttonText} <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
