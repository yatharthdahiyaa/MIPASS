'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const testimonials = [
  {
    quote:
      'As part of the EDISON Alliance’s 1 Billion Lives Challenge, AstraZeneca, along with MIPASS, will be screening 5 million patients. We look forward to deepening collaboration to accelerate scalable and affordable digital solutions to help improve access to healthcare and transform patient outcomes, especially in underserved communities.',
    author: 'Leif Johannsson',
    role: 'Chairman',
    organization: 'AstraZeneca',
    image: '/images/leif_johannsson.jpg',
  },
  {
    quote:
      'We are thrilled to collaborate with MIPASS to support surgeons in diagnosing and treating stroke by enabling quicker decision-making, streamlining data sharing between hospitals, and improving efficiencies so that more stroke patients can be treated within the critical time window.',
    author: 'Michael Blackwell',
    role: 'President and Managing Director',
    organization: 'Medtronic',
    image: '/images/michael_blackwell.jpg',
  },
  {
    quote:
      'MIPASS AI has transformed our emergency triage protocol. The automated detection of traumatic intracranial hemorrhage within seconds has dramatically accelerated our critical care response times.',
    author: 'Dr. Sarah Henderson',
    role: 'Head of Emergency Medicine',
    organization: 'St. Thomas NHS Foundation Trust',
    image: '/images/dr_sarah_henderson.jpg',
  },
];

export default function TestimonialsSection() {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);

  const t = testimonials[current];
  const initials = t.author.replace(/^Dr\.\s*/, '').split(' ').map((name) => name[0]).slice(0, 2).join('');
  const controlClassName = 'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all hover:border-blue-500 hover:text-blue-600 hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

  return (
    <section id="clients" aria-labelledby="testimonials-heading" className="scroll-mt-28 bg-white py-20 text-slate-900 border-b border-slate-200/80">
      <div className="site-container">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_2fr] lg:gap-12">
          <header>
            <p className="eyebrow mb-2 !text-blue-600 font-bold text-xs uppercase tracking-wider">Client perspectives</p>
            <h2 id="testimonials-heading" className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Voices from healthcare
            </h2>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              Demonstration testimonials illustrating real-world adoption of MIPASS clinical AI across healthcare institutions.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous testimonial"
                className={controlClassName}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next testimonial"
                className={controlClassName}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="text-xs font-semibold text-slate-400 ml-2">
                {current + 1} of {testimonials.length}
              </span>
            </div>
          </header>

          <div className="relative rounded-3xl border border-slate-200/90 bg-slate-50/70 p-8 sm:p-12 shadow-[0_10px_35px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <Quote className="w-10 h-10 text-blue-200 mb-6 shrink-0" />
            <blockquote className="text-base sm:text-lg text-slate-800 leading-relaxed font-normal mb-8">
              &ldquo;{t.quote}&rdquo;
            </blockquote>

            <div className="flex items-center gap-4 pt-6 border-t border-slate-200/80">
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center font-bold text-sm text-blue-700 shrink-0 ring-2 ring-white">
                <Image
                  src={t.image}
                  alt={t.author}
                  fill
                  className="object-cover"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
                <span>{initials}</span>
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{t.author}</div>
                <div className="text-xs text-slate-500">{t.role} · {t.organization}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
