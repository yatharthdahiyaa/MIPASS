'use client';

import Image from 'next/image';

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
];

const complianceBadges = [
  { name: 'CE Mark', src: '/images/ce_mark.webp' },
  { name: 'EU GDPR', src: '/images/eu_gdpr.webp' },
  { name: 'HIPAA Compliant', src: '/images/hipaa.webp' },
  { name: 'FDA Cleared', src: '/images/fda_cleared.webp' },
];

export default function PartnersSection() {
  return (
    <section aria-labelledby="ecosystem-heading" className="border-b border-white/10 bg-[#0A1823] py-12 text-[#EAF2F6] md:py-16">
      <div className="site-container">
        <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-12">
          <div>
            <p className="eyebrow mb-3 !text-[#91C6C0]">Platform connections</p>
            <h2 id="ecosystem-heading" className="text-2xl font-semibold tracking-tight">Integration ecosystem</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
              Listed organizations are shown for ecosystem context, not as verified integrations or endorsements.
            </p>
          </div>
          <ul aria-label="Listed ecosystem organizations" className="grid grid-cols-2 content-center gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {partnerLogos.map((name) => (
              <li key={name} className="text-sm font-semibold leading-relaxed text-slate-300">{name}</li>
            ))}
          </ul>
        </div>

        <div className="mt-8 grid gap-6 border-t border-white/10 pt-8 md:grid-cols-[1fr_2fr] md:gap-12">
          <div>
            <h3 className="text-sm font-semibold">Certification & compliance context</h3>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-300">
              Certification requirements vary by product and deployment. Displayed badges do not establish platform-wide clearance or compliance.
            </p>
          </div>
          <ul aria-label="Illustrative certification and compliance badges" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {complianceBadges.map((badge) => (
              <li key={badge.name} className="flex flex-col items-center justify-center gap-3 rounded-md border border-white/10 bg-[#122B3B] px-3 py-4">
                <div className="relative h-9 w-20">
                  <Image
                    src={badge.src}
                    alt=""
                    fill
                    sizes="80px"
                    loading="lazy"
                    className="object-contain opacity-70 grayscale"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <span className="text-center text-xs font-medium text-slate-300">{badge.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
