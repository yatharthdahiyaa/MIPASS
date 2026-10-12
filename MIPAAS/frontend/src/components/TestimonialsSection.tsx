'use client';
import { useState } from 'react';
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

  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);

  const t = testimonials[current];

  return (
    <section id="clients" className="bg-gray-100 py-16 md:py-24 overflow-hidden scroll-mt-28">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 sm:p-14 shadow-xl border border-gray-200/60 relative">
          {/* Quote decorative mark */}
          <div className="text-6xl font-serif text-[#833766]/20 leading-none select-none mb-2">
            &ldquo;
          </div>

          <div className="min-h-[160px] flex items-center">
            <p className="text-gray-800 text-lg sm:text-xl lg:text-2xl font-light leading-relaxed">
              {t.quote}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-8 mt-8 border-t border-gray-100">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full overflow-hidden bg-gray-200 border-2 border-[#833766]/30 flex-shrink-0">
                <img
                  src={t.image}
                  alt={t.author}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h4 className="text-gray-900 font-bold text-base sm:text-lg">
                  {t.author}
                </h4>
                <p className="text-gray-500 text-xs sm:text-sm">
                  {t.role} • <span className="text-[#008280] font-medium">{t.organization}</span>
                </p>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous testimonial"
                className="h-10 w-10 rounded-full border border-gray-300 hover:border-[#008280] hover:text-[#008280] flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next testimonial"
                className="h-10 w-10 rounded-full border border-gray-300 hover:border-[#008280] hover:text-[#008280] flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
