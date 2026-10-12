'use client';

const footerLinks = {
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
    { label: 'About Us', href: '#' },
    { label: 'Our Impact', href: '#impact' },
    { label: 'Careers', href: '#' },
    { label: 'News & Press', href: '#insights' },
    { label: 'Contact Us', href: '#contact' },
  ],
  Resources: [
    { label: 'Evidence Library', href: '#evidence' },
    { label: 'Case Studies', href: '#evidence' },
    { label: 'Blog & Insights', href: '#insights' },
    { label: 'Webinars', href: '#' },
    { label: 'API Documentation', href: '#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
    { label: 'GDPR Compliance', href: '#' },
  ],
};

const socialLinks = [
  {
    label: 'LinkedIn',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: 'Twitter',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#0A1823] border-t border-white/10 text-white scroll-mt-28">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0 py-16">
        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-12 mb-16">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#00DCCE] to-[#008280] flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">MiPAAS</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-sm">
              MiPAAS AI is on a mission to provide accessible, affordable, & timely AI assistance to healthcare professionals worldwide.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:bg-[#008280] hover:text-white transition-all"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4 text-xs tracking-wider uppercase">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-gray-400 text-sm hover:text-[#00DCCE] transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="bg-gradient-to-r from-[#0F2332] to-[#163045] border border-white/10 rounded-2xl p-6 sm:p-8 mb-12 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-white font-semibold text-lg sm:text-xl mb-1">
                Stay updated with MiPAAS
              </h3>
              <p className="text-gray-400 text-sm">
                Get the latest AI healthcare clinical news and product developments.
              </p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <input
                type="email"
                placeholder="Enter your work email"
                className="flex-1 md:w-72 rounded-full bg-white/10 border border-white/20 px-5 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#00DCCE]"
              />
              <button
                type="button"
                className="bg-[#FF7869] text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-[#ff6554] transition-all cursor-pointer whitespace-nowrap"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>
            © {new Date().getFullYear()} MiPAAS AI Platform Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Security & Compliance</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
