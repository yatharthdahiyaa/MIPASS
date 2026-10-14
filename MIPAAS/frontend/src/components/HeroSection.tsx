'use client';

import Link from 'next/link';
import { ArrowRight, Layers, FileCheck2, Stethoscope } from 'lucide-react';
import { useRBAC } from '@/context/RBACContext';

const IAM_SIGNIN_URL = process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:5173/signin';

export default function HeroSection() {
  const { isIamAuthenticated } = useRBAC();

  return (
    <section className="hero-section" aria-labelledby="hero-heading">
      <div className="site-container hero-grid">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> Built for the people behind every diagnosis</p>
          <h1 id="hero-heading">India&apos;s emerging<br />healthcare AI.<br /><span>Care comes first.</span></h1>
          <p className="hero-description">From the first scan to clinical review, MiPAAS brings imaging, explainable insights, and care teams into one considered workflow.</p>
          <div className="hero-actions">
            {isIamAuthenticated ? (
              <>
                <Link href="/doctor" className="button-primary">Open workstation <ArrowRight size={17} /></Link>
                <a href="#products" className="button-secondary">Explore pathways <ArrowRight size={17} /></a>
              </>
            ) : (
              <>
                <a href="#products" className="button-primary">Explore pathways <ArrowRight size={17} /></a>
                <a href={IAM_SIGNIN_URL} className="button-secondary">Sign in <ArrowRight size={17} /></a>
              </>
            )}
          </div>
          <div className="hero-workflow" aria-label="Clinical workflow">
            <div><Layers size={19} /><span>Review imaging</span></div>
            <div><FileCheck2 size={19} /><span>Understand findings</span></div>
            <div><Stethoscope size={19} /><span>Keep clinicians in control</span></div>
          </div>
        </div>
      </div>
      <div className="site-container hero-note"><span>Decision support, not a substitute for clinical judgment.</span><a href="#contact">Find the right workflow for your team <ArrowRight size={14} /></a></div>
    </section>
  );
}
