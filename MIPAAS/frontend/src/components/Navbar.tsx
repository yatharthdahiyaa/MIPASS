'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X, ArrowRight } from 'lucide-react';
import { useServices } from '@/context/ServicesContext';
import { useRBAC } from '@/context/RBACContext';

export interface ProductItem {
  id: string;
  name: string;
  tagline: string;
  href: string;
  modality: string;
  badge?: string;
  accent: string;
  status?: string;
}

export const productList: ProductItem[] = [
  { id: 'lung-cancer', name: 'qCT Lung – Lung Cancer AI', tagline: '3D Nodule Detection & 6-Year Risk Forecasting', href: '/lung-cancer', modality: 'LDCT', badge: 'Sybil AI', accent: '#7C5CFC' },
  { id: 'cardiac', name: 'qCardiac – Heart & Ventricle AI', tagline: 'ACDC U-Net Cine MRI & Ejection Fraction', href: '/cardiac', modality: 'Cine MRI', badge: '17-AHA Segments', accent: '#FF5A78' },
  { id: 'brain-tumor', name: 'qBrain – Brain Tumor AI', tagline: 'BraTS Multi-Sequence Glioma & WHO Grade', href: '/brain-tumor', modality: 'MRI 4-Seq', badge: 'BraTS SegResNet', accent: '#A855F7' },
  { id: 'qxr', name: 'qXR – Chest X-Ray AI', tagline: '14-Pathology Screening & Triage', href: '/qxr', modality: 'CXR', badge: 'CE · FDA', accent: '#00DCCE' },
  { id: 'stroke', name: 'qStroke – Stroke Care AI', tagline: 'LVO Detection & Automated ASPECTS Scoring', href: '/stroke', modality: 'CT/CTA', badge: 'Acute Code', accent: '#F5A623' },
  { id: 'tb', name: 'qTrack – TB Monitoring', tagline: 'WHO-Compliant Tuberculosis Program AI', href: '/tb', modality: 'CXR', badge: 'WHO Class II', accent: '#00DCCE' },
  { id: 'qer', name: 'qER – Emergency Radiology AI', tagline: 'Critical Hemorrhage & Trauma in <15s', href: '/qer', modality: 'Head CT', badge: 'STAT Care', accent: '#FF7869' },
  { id: 'skin-cancer', name: 'qDerm – Skin Lesion AI', tagline: '7-Class Dermoscopy & Melanoma Risk', href: '/skin-cancer', modality: 'Dermoscopy', badge: 'HAM10000', accent: '#EC4899' },
  { id: 'diabetic-foot', name: 'qThermo – Diabetic Foot AI', tagline: 'Plantar Thermogram Bilateral Asymmetry & DM', href: '/diabetic-foot', modality: 'Thermal IR', badge: 'Thermogram ML', accent: '#10B981' },
];

const navLinks = [
  { label: 'Eka.care Hub', href: '/eka' },
  { label: 'OpenEMR Hub', href: '/emr' },
  { label: 'Agents', href: '/agents' },
  { label: 'Impact', href: '/#impact' },
  { label: 'Evidence', href: '/#evidence' },
];

const LOGIN_URL = '/login?redirect=/doctor';

export default function Navbar() {
  const { services, activeServices } = useServices();
  const navProductList = services.length > 0 ? services.filter((service) => service.showInNavbar) : productList;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const productTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen && !productOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) setProductOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProductOpen(false);
        setMobileOpen(false);
        (mobileOpen ? triggerRef : productTriggerRef).current?.focus();
      }
      if (event.key === 'Tab' && mobileOpen) {
        const elements = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button');
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [mobileOpen, productOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onResize = () => { if (window.innerWidth >= 1100) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('resize', onResize); };
  }, [mobileOpen]);

  const closeMobile = () => { setMobileOpen(false); triggerRef.current?.focus(); };

  const { iamUser, isIamAuthenticated, currentUser, logoutIAM } = useRBAC();

  return (
    <nav ref={navRef} className="main-navigation" aria-label="Main navigation">
      <div className="site-container main-navigation-inner">
        <Link href="/" className="brand" aria-label="MiPAAS home"><span className="brand-mark">M</span><span><strong>MiPAAS</strong><small>Healthcare AI</small></span></Link>
        <div className="desktop-navigation">
          <div className="product-navigation" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setProductOpen(false); }}>
            <button ref={productTriggerRef} type="button" className="nav-link" aria-expanded={productOpen} aria-controls="product-navigation-panel" onClick={() => setProductOpen(!productOpen)}>Pathways <ChevronDown size={15} className={productOpen ? 'rotate-180' : ''} /></button>
            {productOpen && <div id="product-navigation-panel" className="product-panel">
              <div className="product-panel-heading"><span>Clinical pathways</span><span>{activeServices.length} active</span></div>
              {navProductList.map((item) => <Link key={item.id} href={item.href} onClick={() => setProductOpen(false)} className="product-panel-link"><span><strong>{item.name}</strong><small>{item.tagline}</small>{item.status && item.status !== 'active' && <em>Temporarily unavailable</em>}</span><span className="product-panel-modality">{item.modality}</span></Link>)}
              <Link href="/#products" className="product-panel-all" onClick={() => setProductOpen(false)}>Explore all pathways <ArrowRight size={15} /></Link>
            </div>}
          </div>
          {navLinks.map((link) => <Link key={link.href} href={link.href} className="nav-link">{link.label}</Link>)}
        </div>
        <div className="desktop-navigation nav-actions">
          <Link href="/#contact" className="nav-link">Contact</Link>
          {isIamAuthenticated && iamUser ? (
            <div className="flex items-center gap-2">
              <a
                href="http://localhost:5173/dashboard"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all"
                title="Open IAM RBAC Management Console (Port 5173)"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">{iamUser.username}</span>
                <span className="text-[10px] text-[#00DCCE] font-mono uppercase">({currentUser.role})</span>
              </a>
              <button
                type="button"
                onClick={() => logoutIAM()}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors cursor-pointer"
                title="Sign out of IAM session"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link href={LOGIN_URL} className="button-primary nav-cta" title="Sign in to the MiPAAS platform">
              Login <ArrowRight size={15} />
            </Link>
          )}
        </div>
        <button ref={triggerRef} type="button" className="mobile-trigger" aria-label="Open menu" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(true)}><Menu size={25} /></button>
      </div>
      {mobileOpen && <div ref={menuRef} id="mobile-navigation" className="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation menu">
        <div className="mobile-navigation-header"><span className="brand"><span className="brand-mark">M</span><strong>MiPAAS</strong></span><button type="button" aria-label="Close menu" onClick={closeMobile}><X size={25} /></button></div>
        <button type="button" className="mobile-pathway-toggle" aria-expanded={mobileProductsOpen} aria-controls="mobile-pathways" onClick={() => setMobileProductsOpen(!mobileProductsOpen)}>Clinical pathways <ChevronDown size={20} className={mobileProductsOpen ? 'rotate-180' : ''} /></button>
        {mobileProductsOpen && <div id="mobile-pathways" className="mobile-pathways">{navProductList.map((item) => <Link key={item.id} href={item.href} onClick={closeMobile}><span>{item.name}{item.status && item.status !== 'active' && <small>Temporarily unavailable</small>}</span><span>{item.modality}</span></Link>)}</div>}
        <div className="mobile-nav-links">{navLinks.map((link) => <Link key={link.href} href={link.href} onClick={closeMobile}>{link.label}<ArrowRight size={18} /></Link>)}</div>
        <Link href={LOGIN_URL} onClick={closeMobile} className="button-primary">Login to MiPAAS <ArrowRight size={17} /></Link>
      </div>}
    </nav>
  );
}
