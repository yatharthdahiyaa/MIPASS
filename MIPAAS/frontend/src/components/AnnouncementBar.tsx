'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, ArrowUpRight } from 'lucide-react';

const portals = [
  { href: '/doctor', label: 'Clinician' },
  { href: '/staff', label: 'Staff' },
  { href: '/admin', label: 'Lab admin' },
  { href: '/patient', label: 'Patient' },
  { href: '/internal', label: 'ML operations' },
  { href: '/developer', label: 'Developer' },
  { href: '/agents', label: 'Agent engine' },
];

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="portal-bar">
      <div className="site-container portal-bar-inner">
        <span className="portal-label">Your workspace</span>
        <nav aria-label="Role-specific portals" className="portal-links">{portals.map((portal) => <Link key={portal.href} href={portal.href}>{portal.label}<ArrowUpRight size={12} aria-hidden="true" /></Link>)}</nav>
        <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss workspace shortcuts" className="portal-dismiss"><X size={16} /></button>
      </div>
    </div>
  );
}
