'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/** Lenis smooth scrolling for the homepage only; skipped under reduced motion. */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Route in-page anchor clicks through Lenis so they glide too.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href^="#"], a[href^="/#"]');
      if (!a) return;
      const hash = a.getAttribute('href')!.replace(/^\//, '');
      const el = hash.length > 1 ? document.querySelector(hash) : null;
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -24 });
    };
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
