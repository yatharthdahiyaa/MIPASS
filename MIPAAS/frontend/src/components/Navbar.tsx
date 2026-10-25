'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X, ArrowRight } from 'lucide-react';
import { useServices } from '@/context/ServicesContext';
import { useRBAC } from '@/context/RBACContext';
import { useIndicLanguage } from '@/context/IndicLanguageContext';
import IndicLanguageSelector from '@/components/common/IndicLanguageSelector';

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

const staticNavLinks = [
  { label: 'Agents', href: '/agents' },
  { label: 'Impact', href: '/#impact' },
  { label: 'Evidence', href: '/#evidence' },
];

const LOGIN_URL = '/login';

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

  const { iamUser, isIamAuthenticated, currentUser, isAuthenticated, switchPersona, logout, logoutIAM } = useRBAC();
  const { t } = useIndicLanguage();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  const isPatient = isAuthenticated && currentUser?.role === 'patient' && Boolean(currentUser?.id);
  const isDoctor = isAuthenticated && (currentUser?.role === 'doctor' || currentUser?.role === 'radiologist') && Boolean(currentUser?.id);

  // Dynamic portal links matching user's authenticated persona
  const portalLinks = [
    ...(isDoctor ? [{ label: t('doctor_nav_dashboard', 'Doctor Portal'), href: '/doctor', badge: 'Doctor' }] : []),
    ...(isPatient ? [{ label: t('emr_portal_title', 'Patient Portal'), href: '/emr', badge: 'Patient' }] : []),
    ...staticNavLinks.map((l) => ({ ...l, label: t(l.label) })),
  ];

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
          {portalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link flex items-center gap-1.5">
              <span>{link.label}</span>
              {'badge' in link && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0F9D9A]/20 text-[#00DCCE]">
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div className="desktop-navigation nav-actions flex items-center gap-2 sm:gap-3">
          <IndicLanguageSelector />
          {isAuthenticated && currentUser && currentUser.id ? (
            <div className="flex items-center gap-3">
              {/* Authenticated User Profile Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/90 flex items-center gap-2 cursor-pointer transition-colors"
                  title={`Signed in as ${currentUser.name}`}
                >
                  <span className={`w-2 h-2 rounded-full ${isDoctor ? 'bg-[#00DCCE]' : isPatient ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  <span className="font-semibold text-[11px] truncate max-w-[140px]">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-teal-300 font-mono uppercase">
                    ({currentUser.role})
                  </span>
                  <ChevronDown size={12} className="text-white/60" />
                </button>

                {showRoleSwitcher && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0B1724] border border-white/15 shadow-2xl p-3 z-50 animate-in fade-in text-xs">
                    <div className="p-2.5 bg-white/5 rounded-xl mb-2">
                      <div className="font-bold text-white text-sm truncate">{currentUser.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{currentUser.email || currentUser.roleTitle}</div>
                      <div className="mt-2.5 flex items-center gap-2">
                        {isDoctor && (
                          <Link
                            href="/doctor"
                            onClick={() => setShowRoleSwitcher(false)}
                            className="px-2.5 py-1 rounded-lg bg-[#0F9D9A] text-white font-semibold text-[11px] hover:bg-[#0D8B88]"
                          >
                            Doctor Portal &rarr;
                          </Link>
                        )}
                        {isPatient && (
                          <Link
                            href="/emr"
                            onClick={() => setShowRoleSwitcher(false)}
                            className="px-2.5 py-1 rounded-lg bg-[#0F9D9A] text-white font-semibold text-[11px] hover:bg-[#0D8B88]"
                          >
                            Patient Portal &rarr;
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            setShowRoleSwitcher(false);
                            try { await logoutIAM(); } catch { /* ignore */ }
                            logout();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-semibold cursor-pointer ml-auto"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Role Portal CTA */}
              {isDoctor && (
                <Link href="/doctor" className="button-primary nav-cta !bg-[#0F9D9A] hover:!bg-[#0D8B88]" title="Open Doctor Clinical Workstation">
                  Doctor Portal <ArrowRight size={15} />
                </Link>
              )}

              {isPatient && (
                <Link href="/emr" className="button-primary nav-cta !bg-[#0F9D9A] hover:!bg-[#0D8B88]" title="Open Patient Health Portal">
                  Patient Portal <ArrowRight size={15} />
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href={LOGIN_URL} className="button-primary nav-cta !bg-[#0F9D9A] hover:!bg-[#0D8B88]" title="Sign in to access MiPAAS">
                Sign In <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
        <button ref={triggerRef} type="button" className="mobile-trigger" aria-label="Open menu" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(true)}><Menu size={25} /></button>
      </div>
      {mobileOpen && <div ref={menuRef} id="mobile-navigation" className="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation menu">
        <div className="mobile-navigation-header"><span className="brand"><span className="brand-mark">M</span><strong>MiPAAS</strong></span><button type="button" aria-label="Close menu" onClick={closeMobile}><X size={25} /></button></div>
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-white/5">
          <span className="text-xs text-white/70 font-medium">Select Language:</span>
          <IndicLanguageSelector />
        </div>
        <button type="button" className="mobile-pathway-toggle" aria-expanded={mobileProductsOpen} aria-controls="mobile-pathways" onClick={() => setMobileProductsOpen(!mobileProductsOpen)}>Clinical pathways <ChevronDown size={20} className={mobileProductsOpen ? 'rotate-180' : ''} /></button>
        {mobileProductsOpen && <div id="mobile-pathways" className="mobile-pathways">{navProductList.map((item) => <Link key={item.id} href={item.href} onClick={closeMobile}><span>{item.name}{item.status && item.status !== 'active' && <small>Temporarily unavailable</small>}</span><span>{item.modality}</span></Link>)}</div>}
        <div className="mobile-nav-links">{portalLinks.map((link) => <Link key={link.href} href={link.href} onClick={closeMobile}>{link.label}<ArrowRight size={18} /></Link>)}</div>
        {isDoctor ? (
          <Link href="/doctor" onClick={closeMobile} className="button-primary">Doctor Portal <ArrowRight size={17} /></Link>
        ) : isPatient ? (
          <Link href="/emr" onClick={closeMobile} className="button-primary">Patient Portal <ArrowRight size={17} /></Link>
        ) : (
          <Link href={LOGIN_URL} onClick={closeMobile} className="button-primary">Login to MiPAAS <ArrowRight size={17} /></Link>
        )}
      </div>}
    </nav>
  );
}
