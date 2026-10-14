import Link from 'next/link';

const footerLinks: Record<string, { label: string; href?: string }[]> = {
  Products: [
    { label: 'qCT Lung – Lung Cancer', href: '/lung-cancer' },
    { label: 'qCardiac – Heart AI', href: '/cardiac' },
    { label: 'qBrain – Brain Tumor AI', href: '/brain-tumor' },
    { label: 'qDerm – Skin Cancer AI', href: '/skin-cancer' },
    { label: 'qThermo – Diabetic Foot AI', href: '/diabetic-foot' },
    { label: 'qXR – Chest X-Ray AI', href: '/qxr' },
    { label: 'qStroke – Stroke Care', href: '/stroke' },
    { label: 'qTrack – TB Monitoring', href: '/tb' },
    { label: 'qER – Emergency Radiology', href: '/qer' },
  ],
  Company: [
    { label: 'About Us' },
    { label: 'Our Impact', href: '#impact' },
    { label: 'Careers' },
    { label: 'News & Press', href: '#insights' },
    { label: 'Contact Us', href: '#contact' },
  ],
  Resources: [
    { label: 'Evidence Library', href: '#evidence' },
    { label: 'Case Studies', href: '#evidence' },
    { label: 'Blog & Insights', href: '#insights' },
    { label: 'Webinars' },
    { label: 'API Documentation' },
    { label: 'Lab Admin & Service CMS', href: '/admin' },
  ],
  Legal: [
    { label: 'Privacy Policy' },
    { label: 'Terms of Service' },
    { label: 'Cookie Policy' },
    { label: 'GDPR Compliance' },
  ],
};

const socialResources = ['LinkedIn', 'Twitter', 'YouTube'];

export default function Footer() {
  return (
    <footer id="contact" className="scroll-mt-28 border-t border-white/10 bg-[#0A1823] text-white">
      <div className="site-container py-16">
        <div className="mb-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <div aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-md bg-[#008280] text-sm font-bold text-white">M</div>
              <span className="text-xl font-bold tracking-tight">MiPAAS</span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-300">
              MiPAAS AI is on a mission to provide accessible, affordable, & timely AI assistance to healthcare professionals worldwide.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
              {socialResources.map((name) => <li key={name} className="hover:text-white transition-colors cursor-pointer">{name}</li>)}
            </ul>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label} className="text-sm leading-relaxed">
                    {link.href ? (
                      <Link href={link.href} className="text-slate-300 transition-colors hover:text-white hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF7869]">
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-slate-400">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-between items-center gap-4 border-t border-white/15 pt-6 text-xs leading-relaxed text-slate-400 md:flex-row">
          <p>© {new Date().getFullYear()} MiPAAS AI Platform Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Security & Compliance</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
