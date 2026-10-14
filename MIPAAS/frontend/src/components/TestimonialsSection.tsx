'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
  {
    quote:
      'As part of the EDISON Alliance’s 1 Billion Lives Challenge, AstraZeneca, along with MiPAAS, will be screening 5 million patients. We look forward to deepening collaboration to accelerate scalable and affordable digital solutions to help improve access to healthcare and transform patient outcomes, especially in underserved communities.',
    author: 'Leif Johannsson',
    role: 'Chairman',
    organization: 'AstraZeneca',
    image: '/images/leif_johannsson.jpg',
  },
  {
    quote:
      'We are thrilled to collaborate with MiPAAS to support surgeons in diagnosing and treating stroke by enabling quicker decision-making, streamlining data sharing between hospitals, and improving efficiencies so that more stroke patients can be treated within the critical time window.',
    author: 'Michael Blackwell',
    role: 'President and Managing Director',
    organization: 'Medtronic',
    image: '/images/michael_blackwell.jpg',
  },
  {
    quote:
      'MiPAAS AI has transformed our emergency triage protocol. The automated detection of traumatic intracranial hemorrhage within seconds has dramatically accelerated our critical care response times.',
    author: 'Dr. Sarah Henderson',
    role: 'Head of Emergency Medicine',
    organization: 'St. Thomas NHS Foundation Trust',
    image: '/images/dr_sarah_henderson.jpg',
  },
];

export default function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);

  const t = testimonials[current];
  const initials = t.author.replace(/^Dr\.\s*/, '').split(' ').map((name) => name[0]).slice(0, 2).join('');
  const controlClassName = 'flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white text-[#0F2332] transition-colors hover:border-[#008280] hover:bg-[#F1F7F6] hover:text-[#006B69] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008280]';

  return (
    <section id="clients" aria-labelledby="testimonials-heading" className="scroll-mt-28 bg-[#F7F9FA] py-16 text-[#0F2332] md:py-24">
      <div className="site-container">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_2fr] lg:gap-12">
          <header>
            <p className="eyebrow mb-4 !text-[#006B69]">Client perspectives</p>
            <h2 id="testimonials-heading" className="section-heading">Voices from healthcare</h2>
            <p className="section-description mt-5 !text-slate-600">
              Demonstration testimonials. Quotes, attributions, partnerships and outcome claims have not been verified and do not establish endorsements.
            </p>
            <p id="testimonial-instructions" className="mt-6 text-xs leading-relaxed text-slate-600">
              Focus the quote panel and use the left and right arrow keys, or use the previous and next buttons.
            </p>
          </header>

          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Demonstration testimonials"
            aria-describedby="testimonial-instructions"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                prev();
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                next();
              }
            }}
            className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008280] sm:p-10"
          >
            <div id="testimonial-slide" aria-live="polite" aria-atomic="true">
              <div role="group" aria-roledescription="slide" aria-label={`${current + 1} of ${testimonials.length}`}>
                <p className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#006B69]">Demonstration quote · {current + 1} of {testimonials.length}</p>
                <blockquote className="min-h-56 text-lg font-medium leading-relaxed tracking-tight text-[#0F2332] sm:text-xl lg:text-2xl">
                  <p>“{t.quote}”</p>
                </blockquote>
                <div className="mt-8 flex items-center gap-4 border-t border-slate-200 pt-6">
                  <div aria-hidden="true" className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#008280]/20 bg-[#E7F1F0] text-base font-semibold text-[#006B69]">
                    <span>{initials}</span>
                    {!failedImages.includes(t.image) && (
                      <Image
                        key={t.image}
                        src={t.image}
                        alt=""
                        fill
                        sizes="56px"
                        loading="lazy"
                        className="object-cover"
                        onError={() => setFailedImages((images) => images.includes(t.image) ? images : [...images, t.image])}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#0F2332]">{t.author}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
                      {t.role} · <span className="font-medium text-[#006B69]">{t.organization}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200 pt-6">
              <p className="text-sm tabular-nums text-slate-600" aria-hidden="true">{String(current + 1).padStart(2, '0')} / {String(testimonials.length).padStart(2, '0')}</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={prev} aria-label="Previous testimonial" aria-controls="testimonial-slide" className={controlClassName}>
                  <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                </button>
                <button type="button" onClick={next} aria-label="Next testimonial" aria-controls="testimonial-slide" className={controlClassName}>
                  <ChevronRight aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
