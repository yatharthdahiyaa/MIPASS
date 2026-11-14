'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth/SessionProvider';
import { Grain, MonoLabel, cx } from './ui';

const EXPLORE = [
  { label: 'Chest X-ray', href: '/chest-xray' },
  { label: 'Platform', href: '/#platform' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Agents', href: '/agents' },
  { label: 'Developers', href: '/developer' },
];

/**
 * Footer that sits fixed underneath the page and is revealed as the dark content
 * scrolls off it. Falls back to a normal footer when it is taller than the viewport.
 */
export default function RevealFooter() {
  const { user } = useSession();
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(0);
  const [fixed, setFixed] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      setHeight(h);
      setFixed(h <= window.innerHeight && window.innerWidth >= 768);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const touch = user
    ? [
        { label: 'Your account', href: '/account' },
        { label: 'Doctor workstation', href: '/doctor' },
        { label: 'Agents console', href: '/agents' },
      ]
    : [
        { label: 'Create an account', href: '/signup' },
        { label: 'Sign in', href: '/login' },
        { label: 'Doctor workstation', href: '/doctor' },
      ];
  const linkClass = 'block text-[21px] leading-[29px] tracking-[-0.01em] text-[var(--h-ink)] transition-opacity hover:opacity-60';

  return (
    <>
      {/* transparent spacer: scrolling past it uncovers the fixed footer */}
      {fixed && <div aria-hidden="true" style={{ height }} />}

      <footer
        ref={ref}
        className={cx('h-alloy inset-x-0 bottom-0', fixed ? 'fixed z-0' : 'relative')}
      >
        <Grain />
        <div className="h-container relative pb-8 pt-20">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-6">
            <p className="h-title text-[var(--h-ink-muted)] lg:col-span-5">
              Read every scan. Miss nothing.<sup className="ml-0.5 text-[11px]">™</sup>
            </p>

            <nav aria-label="Explore" className="lg:col-span-2">
              <MonoLabel className="text-[var(--h-ink-muted)]">Explore</MonoLabel>
              <ul className="mt-4">
                {EXPLORE.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Get in touch" className="lg:col-span-2">
              <MonoLabel className="text-[var(--h-ink-muted)]">Get in touch</MonoLabel>
              <ul className="mt-4">
                {touch.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="lg:col-span-3">
              <p className="h-title text-[var(--h-ink)]">Clinical AI updates, monthly.</p>
              {subscribed ? (
                <p className="mt-4 rounded-xl bg-white/60 px-5 py-4 text-[15px] text-[var(--h-ink)]">
                  Thanks. We’ll be in touch at {email}.
                </p>
              ) : (
                <form
                  className="mt-4 flex h-[60px] items-center rounded-xl bg-white/80 p-[6px] pl-5 focus-within:ring-2 focus-within:ring-[var(--h-ink)]/30"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (email.includes('@')) setSubscribed(true);
                  }}
                >
                  <label htmlFor="footer-email" className="sr-only">
                    Work email
                  </label>
                  <input
                    id="footer-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Work email"
                    className="min-w-0 flex-1 bg-transparent text-[17px] text-[var(--h-ink)] outline-none placeholder:text-[var(--h-ink-muted)]"
                  />
                  <button
                    type="submit"
                    aria-label="Subscribe"
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-[9px] bg-[var(--h-ink)] text-white transition-colors hover:bg-black"
                  >
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                      <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                    </svg>
                  </button>
                </form>
              )}
              <p className="mt-3 text-[13px] leading-[19px] text-[var(--h-ink-muted)]">
                No patient data, ever. Unsubscribe anytime.
              </p>
            </div>
          </div>

          {/* giant lock-up */}
          {/* SVG lock-up so mark + wordmark always span the full container width */}
          <svg viewBox="0 0 1280 196" className="mt-24 block w-full text-[var(--h-ink)] lg:mt-36" aria-hidden="true">
            <g transform="translate(0 6) scale(7.83)" fill="none">
              <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="2.4" />
              <path d="M5.5 12.5h3l1.8-4 3.4 8 1.8-4h3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <text
              x="236"
              y="190"
              textLength="1044"
              lengthAdjust="spacingAndGlyphs"
              fill="currentColor"
              fontFamily="var(--font-display)"
              fontWeight="500"
              fontSize="252"
              letterSpacing="-12"
            >
              MIPAAS
            </text>
          </svg>

          <div className="mt-8 flex flex-col gap-3 text-[15px] text-[var(--h-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-6">
              <Link href="#" className="hover:text-[var(--h-ink)]">
                Privacy Policy
              </Link>
              <Link href="#" className="hover:text-[var(--h-ink)]">
                Terms of Use
              </Link>
            </div>
            <p>© {new Date().getFullYear()} MIPAAS. All rights reserved.</p>
            <a href="#top" className="h-totop inline-flex items-center gap-1.5 hover:text-[var(--h-ink)]">
              Back to top
              <span className="inline-flex overflow-hidden">
                <svg viewBox="0 0 12 12" className="h-totop-icon h-3 w-3" aria-hidden="true">
                  <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
