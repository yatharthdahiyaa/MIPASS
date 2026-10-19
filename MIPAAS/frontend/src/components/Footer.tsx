'use client';

import Link from 'next/link';
import { Activity } from 'lucide-react';

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
    { label: 'About Us', href: '#features' },
    { label: 'Our Impact', href: '#product' },
    { label: 'Careers', href: '#pricing' },
    { label: 'News & Press', href: '#pricing' },
    { label: 'Contact Us', href: '#contact' },
  ],
  Resources: [
    { label: 'Evidence Library', href: '#pricing' },
    { label: 'Case Studies', href: '#product' },
    { label: 'Blog & Insights', href: '#pricing' },
    { label: 'API Documentation', href: '/doctor' },
    { label: 'Clinical Admin Portal', href: '/admin' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
    { label: 'GDPR Compliance', href: '#' },
  ],
};

const socialResources = ['LinkedIn', 'Twitter', 'YouTube'];

export default function Footer() {
  return (
    <footer id="contact" className="scroll-mt-28 border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="site-container py-16">
        <div className="mb-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <Activity className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="text-xl font-black text-white tracking-tight">MIPASS</span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              MIPASS is on a mission to provide accessible, affordable, & timely AI assistance to healthcare professionals worldwide.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
              {socialResources.map((name) => (
                <li key={name} className="hover:text-white transition-colors cursor-pointer font-medium">
                  {name}
                </li>
              ))}
            </ul>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">{category}</h3>
              <ul className="space-y-2.5 text-xs text-slate-400">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <Link href={link.href} className="hover:text-blue-400 transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <span>{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-800 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} MIPASS Healthcare Technologies Inc. All rights reserved.</p>
          <p>Built for the people behind every diagnosis.</p>
        </div>
      </div>
    </footer>
  );
}
