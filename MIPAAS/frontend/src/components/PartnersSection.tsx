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
    <section aria-labelledby="ecosystem-heading" className="border-b border-slate-200/80 bg-white py-16 text-slate-900 md:py-20">
      <div className="site-container">
        <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-12">
          <div>
            <p className="eyebrow mb-3 !text-blue-600 font-bold text-xs uppercase tracking-wider">Platform connections</p>
            <h2 id="ecosystem-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Integration ecosystem</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
              Listed organizations are shown for ecosystem context, not as verified integrations or endorsements.
            </p>
          </div>
          <ul aria-label="Listed ecosystem organizations" className="grid grid-cols-2 content-center gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {partnerLogos.map((name) => (
              <li key={name} className="text-sm font-semibold leading-relaxed text-slate-700 hover:text-blue-600 transition-colors">
                {name}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 grid gap-6 border-t border-slate-200/80 pt-10 md:grid-cols-[1fr_2fr] md:gap-12">
          <div>
            <h3 className="text-base font-bold text-slate-900">Certification & compliance context</h3>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-600">
              Certification requirements vary by product and deployment. Displayed badges do not establish platform-wide clearance or compliance.
            </p>
          </div>
          <ul aria-label="Illustrative certification and compliance badges" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {complianceBadges.map((badge) => (
              <li key={badge.name} className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-blue-200 hover:shadow-xs px-3 py-4 transition-all">
                <div className="relative h-9 w-20">
                  <Image
                    src={badge.src}
                    alt=""
                    fill
                    sizes="80px"
                    loading="lazy"
                    className="object-contain opacity-80"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <span className="text-center text-xs font-semibold text-slate-700">{badge.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
