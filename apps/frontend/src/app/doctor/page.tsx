import type { Metadata } from 'next';
import Link from 'next/link';
import '@/components/home/tokens.css';

export const metadata: Metadata = {
  title: 'Doctor workstation · MIPAAS',
  robots: { index: false },
};

/** The clinical workstation moved to the desktop Diagnostic Panel (apps/desktop). */
export default function DoctorPage() {
  return (
    <div className="home-root flex min-h-[100svh] items-center justify-center px-6">
      <main className="max-w-[520px]">
        <p className="h-label text-[var(--h-muted)]">Doctor workstation</p>
        <h1 className="h-display-l mt-4 text-[var(--h-text)]">Use the Diagnostic Panel app.</h1>
        <p className="mt-5 text-[17px] leading-[25px] text-[var(--h-muted)]">
          Study review and signed reports, your connected patients, messages and consultations all run in the MIPAAS Diagnostic Panel desktop app for verified doctors.
        </p>
        <Link href="/account" className="mt-8 inline-flex h-btn border border-[var(--h-border)] px-5 text-[var(--h-text)] hover:bg-white/[0.06]">
          Back to your account
        </Link>
      </main>
    </div>
  );
}
