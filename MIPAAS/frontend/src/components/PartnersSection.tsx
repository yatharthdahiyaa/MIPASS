'use client';

const partnerLogos = [
  'Fujifilm',
  'Siemens Healthineers',
  'Medtronic',
  'AstraZeneca',
  'Philips',
  'Blackford Analysis',
  'AWS Healthcare',
  'Microsoft Health',
  'GE HealthCare',
  'Roche Diagnostics',
  'Fujifilm',
  'Siemens Healthineers',
  'Medtronic',
  'AstraZeneca',
];

const complianceBadges = [
  {
    name: 'CE Mark',
    src: '/images/ce_mark.webp',
  },
  {
    name: 'EU GDPR',
    src: '/images/eu_gdpr.webp',
  },
  {
    name: 'HIPAA Compliant',
    src: '/images/hipaa.webp',
  },
  {
    name: 'FDA Cleared',
    src: '/images/fda_cleared.webp',
  },
];

export default function PartnersSection() {
  return (
    <section className="bg-[#0A1823] py-8 overflow-hidden">
      {/* Logo slider */}
      <div className="relative mx-auto max-w-7xl overflow-hidden py-4">
        {/* Left & Right gradient fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 sm:w-36 bg-gradient-to-r from-[#0A1823] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 sm:w-36 bg-gradient-to-l from-[#0A1823] to-transparent" />

        <div className="flex w-max items-center animate-marquee hover:[animation-play-state:paused]">
          {[...partnerLogos, ...partnerLogos].map((name, i) => (
            <div
              key={i}
              className="mx-6 flex h-14 items-center justify-center px-4 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-medium text-gray-300 whitespace-nowrap hover:border-white/25 hover:text-white transition-all shadow-sm"
            >
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-auto max-w-[81rem] h-[1px] w-full bg-gradient-to-r from-transparent via-[#C0CCDA]/25 to-transparent my-6" />

      {/* Compliance badges */}
      <div className="mx-auto w-full max-w-2xl px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-center justify-center">
          {complianceBadges.map((badge) => (
            <div key={badge.name} className="flex items-center justify-center">
              <img
                src={badge.src}
                alt={badge.name}
                className="h-8 md:h-10 object-contain filter brightness-95 contrast-125 opacity-80 hover:opacity-100 transition-opacity"
                onError={(e) => {
                  // Fallback if image fails
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  if (target.nextElementSibling) {
                    (target.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              <div
                style={{ display: 'none' }}
                className="h-9 px-3 rounded-lg border border-white/20 bg-white/5 items-center justify-center text-[11px] font-bold text-gray-300"
              >
                {badge.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
