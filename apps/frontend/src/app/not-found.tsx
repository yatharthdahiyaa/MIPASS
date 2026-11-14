import type { Metadata } from 'next';
import Link from 'next/link';
import '@/components/home/tokens.css';

export const metadata: Metadata = {
  title: 'Page not found · MIPAAS',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="home-root h-ambient flex min-h-[100svh] items-center justify-center px-6">
      <main className="max-w-[520px]">
        <p className="h-label text-[var(--h-muted)]">Error 404</p>
        <h1 className="h-display-l mt-4 text-[var(--h-text)]">We can’t find that page.</h1>
        <p className="mt-5 text-[17px] leading-[25px] text-[var(--h-muted)]">
          The link may be old, or the page may have moved. Your health record is safe and where you left it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/account" className="h-btn h-key px-5">
            Go to your account
          </Link>
          <Link href="/" className="h-btn border border-[var(--h-border)] px-5 text-[var(--h-text)] hover:bg-white/[0.06]">
            MIPAAS home
          </Link>
        </div>
      </main>
    </div>
  );
}
