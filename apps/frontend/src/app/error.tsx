'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import '@/components/home/tokens.css';

/** Shown when a page throws while rendering. Nothing about the error is displayed to the visitor. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // The digest matches the server log entry for this failure.
    console.error('page_error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="home-root h-ambient flex min-h-[100svh] items-center justify-center px-6">
      <main className="max-w-[520px]">
        <p className="h-label text-[var(--h-muted)]">Something went wrong</p>
        <h1 className="h-display-l mt-4 text-[var(--h-text)]">This page didn’t load.</h1>
        <p className="mt-5 text-[17px] leading-[25px] text-[var(--h-muted)]">
          Nothing was lost. Try again, and if it keeps happening, tell us what you were doing
          {error.digest ? (
            <>
              {' '}
              and quote reference <span className="font-mono text-[var(--h-text-2)]">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className="h-btn h-key px-5">
            Try again
          </button>
          <Link href="/account" className="h-btn border border-[var(--h-border)] px-5 text-[var(--h-text)] hover:bg-white/[0.06]">
            Go to your account
          </Link>
        </div>
      </main>
    </div>
  );
}
