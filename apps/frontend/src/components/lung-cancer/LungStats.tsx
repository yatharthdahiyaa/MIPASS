'use client';

import { useEffect, useRef, useState } from 'react';

const stats = [
  {
    value: 98.2,
    suffix: '%',
    label: 'AUC Score',
    subtext: 'On NLST validation cohort',
    color: '#00DCCE',
  },
  {
    value: 94,
    suffix: '%',
    label: 'Sensitivity',
    subtext: 'True positive detection rate',
    color: '#FF7869',
  },
  {
    value: 6,
    suffix: '-Year',
    label: 'Risk Window',
    subtext: 'Longitudinal cancer prediction',
    color: '#98AED9',
  },
  {
    value: 2.8,
    suffix: 's',
    label: 'Avg Inference',
    subtext: 'GPU-accelerated on Cloud Run',
    color: '#008280',
  },
];

function AnimatedCounter({
  target,
  suffix,
  duration = 2000,
  active,
}: {
  target: number;
  suffix: string;
  duration?: number;
  active: boolean;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const isDecimal = target % 1 !== 0;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setValue(isDecimal ? parseFloat(current.toFixed(1)) : Math.round(current));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, active]);

  return (
    <span>
      {value}
      {suffix}
    </span>
  );
}

export default function LungStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setActive(true);
      },
      { threshold: 0.4 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-[#0E273A] py-20 lg:py-28 overflow-hidden">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0" ref={ref}>
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#008280]">
            Performance
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl text-white mt-3"
            style={{ fontFamily: "'Josefin Sans', sans-serif", fontWeight: 700 }}
          >
            Clinical-Grade Accuracy
          </h2>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`relative group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center transition-all duration-700 hover:border-white/10 overflow-hidden ${
                active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              {/* Background glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 100%, ${stat.color}12, transparent 70%)`,
                }}
              />

              {/* Number */}
              <div
                className="text-4xl sm:text-5xl lg:text-[56px] font-bold leading-none mb-3 relative z-10"
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  color: stat.color,
                }}
              >
                <AnimatedCounter target={stat.value} suffix={stat.suffix} active={active} />
              </div>

              {/* Label */}
              <div className="text-white font-semibold text-sm mb-1 relative z-10">{stat.label}</div>
              <div className="text-gray-500 text-xs relative z-10">{stat.subtext}</div>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-[20%] right-[20%] h-[2px] rounded-full transition-all duration-500 group-hover:left-[10%] group-hover:right-[10%]"
                style={{ backgroundColor: stat.color, opacity: 0.4 }}
              />
            </div>
          ))}
        </div>

        {/* Validation badge */}
        <div className="flex justify-center mt-12">
          <div className="inline-flex items-center gap-3 rounded-full bg-white/[0.03] border border-white/[0.06] px-6 py-3">
            <svg className="w-5 h-5 text-[#00DCCE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="text-sm text-gray-300">
              Validated on <strong className="text-white">NLST</strong> (26,722 patients) · Published in{' '}
              <strong className="text-white">Journal of Clinical Oncology</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
