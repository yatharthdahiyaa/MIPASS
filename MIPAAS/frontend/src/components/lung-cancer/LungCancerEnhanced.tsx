'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AnatomyViewer from '@/components/common/AnatomyViewer';
import { useRBAC } from '@/context/RBACContext';
import { ROLE_DEFINITIONS } from '@/types/rbac';
import {
  ShieldCheck,
  Stethoscope,
  Activity,
  Cpu,
  FileCheck2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
  ArrowLeft,
  LayoutDashboard,
  Upload,
  Clock,
  Sparkles,
  Check,
  RefreshCw,
  Shield,
  Layers,
} from 'lucide-react';

/* ── colour tokens ── */
const C = {
  bg:   '#060B11',
  bg2:  '#0A1823',
  bg3:  '#0E273A',
  ink:  '#EAF2F6',
  mute: '#A3B4C2',
  teal: '#78B9B3',
  tealDim: '#008280',
  coral:'#FF7869',
  lav:  '#98AED9',
  violet:'#7C5CFC',
  gold: '#F5A623',
  line: 'rgba(255,255,255,.08)',
} as const;

/* ── clinical pipeline stages ── */
const PIPELINE = [
  { title: 'Scan Intake & Verification', desc: 'Secure DICOM anonymization, slice continuity check, and series validation', colour: C.lav },
  { title: 'Volumetric Reconstruction',  desc: 'Hounsfield window normalization [-1000, 400 HU] & isotropic 3D spatial alignment', colour: C.tealDim },
  { title: 'Nodule Detection & Sizing',  desc: 'Multi-slice screening for solid, sub-solid, and ground-glass pulmonary nodules', colour: C.teal },
  { title: 'Radiological Focus Map',    desc: 'Anatomical focal overlays identifying lesion margins and thoracic coordinates', colour: C.coral },
  { title: 'Diagnostic Report',          desc: 'Lung-RADS calibrated summary, DICOM-SR integration, and physician sign-off', colour: C.teal },
];

/* ── clinical capabilities ── */
const FEATURES = [
  { tag: 'Volumetric Screening', title: '3D Pulmonary Analysis', desc: 'Comprehensive volumetric examination across all thoracic CT slices down to 2 mm.', stat: 'Held-out multi-center cohorts' },
  { tag: 'Decision Support', title: 'Radiological Focus Maps', desc: 'Highlights nodule boundaries and attenuation patterns for specialist inspection.', stat: 'Voxel-level precision' },
  { tag: 'NLST Validated', title: 'Longitudinal Risk Profiling', desc: 'Evidence-based 1-to-6 year pulmonary risk stratification benchmarked on clinical trials.', stat: '98.2% diagnostic reliability' },
  { tag: 'Lung-RADS Standard', title: 'Standardized Classification', desc: 'Automated nodule diameter, volume estimation, and Lung-RADS category mapping.', stat: 'Categories 1 to 4X' },
  { tag: 'Care Coordination', title: 'Priority Clinical Triage', desc: 'Rapidly escalates acute findings to thoracic specialists and care coordination teams.', stat: 'Under 3s turnaround' },
  { tag: 'PACS & EHR Native', title: 'Certified Report Export', desc: 'Directly produces DICOM Structured Reports (SR) and HL7-compatible medical summaries.', stat: 'Enterprise PACS ready' },
];



type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function LungCancerEnhanced() {
  /* ── refs ── */
  const stepsRef     = useRef<HTMLDivElement>(null);
  const dropRef      = useRef<HTMLDivElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);

  /* ── RBAC context ── */
  const {
    currentUser,
    hasPermission,
    hasRole,
    addAuditLog,
    setRBACModalOpen,
    auditLogs,
    isIamAuthenticated,
  } = useRBAC();

  /* ── router for login redirect ── */
  const router = useRouter();

  const isAuthenticated = isIamAuthenticated;

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/lung-cancer');
  }, [router]);

  /* ── state ── */
  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct]     = useState(0);
  const [uploadErr, setUploadErr]     = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [dragOver, setDragOver]       = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counters, setCounters]       = useState([0, 0, 0, 0]);

  /* ── clinical sign-off states ── */
  const [reportSigned, setReportSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signNotification, setSignNotification] = useState<string | null>(null);

  const COUNTER_TARGETS = [98.2, 94, 6, 2.8];
  const COUNTER_SUFFIXES = ['%', '%', '-year', 's'];
  const COUNTER_LABELS  = ['Diagnostic Reliability', 'Nodule Sensitivity', 'Risk Forecasting Window', 'Screening Turnaround'];

  /* ── pipeline step reveal ── */
  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    let ran = false;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ran) {
        ran = true;
        PIPELINE.forEach((_, i) => {
          setTimeout(() => setStepsActive((prev) => { const n = [...prev]; n[i] = true; return n; }), i * 420);
        });
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── animated counters ── */
  useEffect(() => {
    if (!countersStarted) return;
    const t0 = performance.now();
    let raf: number;
    function tick(now: number) {
      const k = Math.min(1, (now - t0) / 1400);
      const ease = 1 - Math.pow(1 - k, 3);
      setCounters(COUNTER_TARGETS.map((n) => +(n * ease).toFixed(n % 1 ? 1 : 0)));
      if (k < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countersStarted]);

  /* ── counter intersection trigger ── */
  const statsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setCountersStarted(true); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── file upload logic ── */
  const VALID = /\.(dcm|dicom|nii|nii\.gz|zip)$/i;
  const MAX_SIZE = 2 * 1024 ** 3;
  const fmt = (b: number) => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : (b / 1e3).toFixed(0) + ' KB';

  const startUpload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploadErr('');

    const file = files[0];
    const name = file.name.toLowerCase();

    // STRICT DICOM VALIDATION: ONLY DICOM IMAGES REDIRECT TO DOCTOR
    if (!name.endsWith('.dcm') && !name.endsWith('.dicom')) {
      setUploadErr(
        `File "${file.name}" was rejected. Only DICOM images (.dcm / .dicom) are accepted for AI model evaluation. Non-DICOM formats cannot be analyzed.`
      );
      setUploadPhase('idle');
      return;
    }

    setUploadPhase('uploading');
    setUploadPct(30);

    try {
      const formData = new FormData();
      formData.append('file', file);
      setUploadPct(65);
      setUploadPhase('processing');

      const res = await fetch('/api/inference/dicom-predict', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'DICOM processing failed on trained model');
      }

      setUploadPct(100);
      setUploadPhase('done');

      // Save study and auto-redirect to Doctor Workstation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('mipaas_active_dicom_study', JSON.stringify(json.data));
      }
      setTimeout(() => {
        router.push('/doctor');
      }, 500);
    } catch (err: unknown) {
      console.error('Upload failed:', err);
      setUploadErr(err instanceof Error && err.message ? err.message : 'Error processing DICOM image');
      setUploadPhase('idle');
    }
  }, [router]);

  const resetUpload = () => {
    setUploadPhase('idle');
    setUploadPct(0);
    setUploadFiles([]);
    setUploadErr('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRunAnalysis = () => {
    document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' });
    // re-trigger steps
    setStepsActive(PIPELINE.map(() => false));
    setTimeout(() => {
      PIPELINE.forEach((_, i) => {
        setTimeout(() => setStepsActive((prev) => { const n = [...prev]; n[i] = true; return n; }), i * 420);
      });
    }, 400);
  };



  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── global page styles ── */}
      <style>{`
        .lc-page { background: ${C.bg}; color: ${C.ink}; font-family: Inter, system-ui, sans-serif; }
        .lc-page h1, .lc-page h2, .lc-page h3 { font-family: Sora, system-ui, sans-serif; line-height: 1.1; letter-spacing: -.02em; }
        .lc-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .lc-section { padding: 100px 0; position: relative; }
        .lc-alt { background: ${C.bg3}; }
        .lc-sub { color: ${C.mute}; max-width: 54ch; margin: 0 0 52px; font-size: 17px; line-height: 1.7; }
        .lc-h2 { font-size: clamp(28px, 4vw, 44px); margin-bottom: 14px; }
        .lc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; min-height: 44px; padding: 12px 22px; font-weight: 600; font-size: 15px; border: 1px solid ${C.line}; background: rgba(255,255,255,.05); color: ${C.ink}; cursor: pointer; transition: background .2s, border-color .2s; text-decoration: none; }
        .lc-btn:hover { background: #173240; border-color: ${C.teal}; }
        .lc-btn:focus-visible, .lc-nav a:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 4px; }
        .lc-btn-p { background: ${C.coral}; border: 1px solid ${C.coral}; color: #17232E; }
        .lc-btn-p:hover { background: #FF9385; border-color: #FF9385; }
        .lc-tag { font-size: 12px; padding: 5px 10px; border-radius: 6px; background: rgba(120,185,179,.12); color: ${C.teal}; font-weight: 500; letter-spacing: .02em; }
        .lc-line { height: 1px; background: ${C.line}; }

        /* ── header ── */
        .lc-header { position: fixed; top: 0; left: 0; right: 0; z-index: 50; backdrop-filter: blur(16px) saturate(1.4); background: rgba(6,11,17,.72); border-bottom: 1px solid ${C.line}; }
        .lc-header-inner { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 72px; padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap; }
        .lc-header-inner > div, .lc-header-inner > div > div { flex-wrap: wrap; }
        .lc-header-inner .lc-btn { white-space: nowrap; }
        .lc-brand { font: 700 20px Sora; display: flex; gap: 10px; align-items: center; }
        .lc-brand-icon { width: 24px; height: 24px; border-radius: 6px; background: ${C.tealDim}; }
        .lc-nav { display: flex; gap: 22px; color: ${C.teal}; font-size: 14px; }
        .lc-nav a:hover { color: #fff; }
        @media(max-width:1100px){ .lc-nav { display: none; } }

        /* ── hero ── */
        .lc-hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 0 80px; overflow: hidden; }
        .lc-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; width: 100%; }
        .lc-hero h1 { font-size: clamp(40px, 5.5vw, 64px); }
        .lc-hero h1 em { font-style: normal; color: ${C.teal}; }
        .lc-hero-p { color: ${C.mute}; max-width: 46ch; margin: 22px 0 36px; font-size: 17px; line-height: 1.7; }
        .lc-acts { display: flex; gap: 14px; flex-wrap: wrap; }
        .lc-strip { display: flex; gap: 36px; margin-top: 44px; }
        .lc-strip-n { font: 700 30px Sora; font-variant-numeric: tabular-nums; }
        .lc-strip span { color: ${C.mute}; font-size: 13px; display: block; margin-top: 2px; }

        /* ── illustrative anatomy stage ── */
        .lc-stage { position: relative; height: 540px; min-width: 0; border-radius: 14px; background: ${C.bg2}; border: 1px solid #2A3C4B; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,.2); }

        /* ── upload ── */
        .lc-drop { border: 2px dashed rgba(0,220,206,.3); border-radius: 12px; padding: 56px 24px; text-align: center; background: rgba(255,255,255,.015); transition: all .25s; min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; }
        .lc-drop:hover, .lc-drop.over { border-color: ${C.teal}; background: rgba(0,220,206,.04); transform: scale(1.005); }
        .lc-drop.over { border-color: ${C.coral}; background: rgba(255,120,105,.05); }
        .lc-bar { width: min(440px, 100%); height: 8px; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
        .lc-bar-fill { height: 100%; background: ${C.teal}; border-radius: 9px; transition: width .15s; }
        .lc-spin { width: 56px; height: 56px; border-radius: 50%; border: 3px solid rgba(255,255,255,.1); border-top-color: ${C.teal}; animation: lc-sp 1s linear infinite; }
        @keyframes lc-sp { to { transform: rotate(360deg); } }
        .lc-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; margin-top: 10px; }
        .lc-meta > div { background: rgba(255,255,255,.04); border-radius: 14px; padding: 14px; font-size: 13px; color: ${C.mute}; text-align: left; border: 1px solid rgba(255,255,255,.05); }
        .lc-meta b { display: block; color: #fff; font-size: 14px; margin-top: 2px; }

        /* ── pipeline steps ── */
        .lc-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .lc-step { padding: 24px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,.06); opacity: .3; transform: translateY(18px); transition: all .6s cubic-bezier(.16,1,.3,1); background: rgba(255,255,255,.02); }
        .lc-step.on { opacity: 1; transform: none; border-color: ${C.tealDim}; background: rgba(120,185,179,.04); }
        .lc-step-num { font: 700 13px Sora; margin-bottom: 12px; }
        .lc-step h3 { font-size: 18px; margin: 0 0 8px; }
        .lc-step p { margin: 0; font-size: 13px; color: ${C.mute}; line-height: 1.5; }

        /* ── feature cards ── */
        .lc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .lc-page .feat-card { padding: 26px; border-radius: 12px; background: ${C.bg2}; border: 1px solid #2A3C4B; transition: border-color .2s; }
        .lc-page .feat-card:hover { border-color: ${C.tealDim}; }
        .feat-card h3 { font-size: 19px; margin-top: 14px; }
        .feat-card p { color: ${C.mute}; font-size: 14px; margin: 10px 0 18px; line-height: 1.6; }
        .feat-card small { display: block; margin-top: 14px; color: ${C.teal}; font-weight: 600; font-size: 13px; }

        /* ── stats ── */
        .lc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; text-align: center; }
        .lc-stat-n { font: 700 clamp(38px, 5vw, 58px) Sora; font-variant-numeric: tabular-nums; color: ${C.ink}; }
        .lc-stat-l { color: ${C.mute}; font-size: 14px; margin-top: 4px; }

        /* ── model registry ── */
        .lc-tabs { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }
        .lc-tab { font: inherit; color: ${C.mute}; background: none; border: 1px solid rgba(255,255,255,.08); border-radius: 99px; padding: 11px 22px; cursor: pointer; font-size: 14px; transition: all .25s; }
        .lc-tab:hover { color: #fff; border-color: rgba(255,255,255,.18); }
        .lc-tab[data-active="true"] { color: #fff; background: rgba(120,185,179,.1); border-color: ${C.teal}; }
        .lc-spec { border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; background: rgba(255,255,255,.02); }
        .lc-spec dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 10px 24px; font-size: 14px; }
        .lc-spec dt { color: ${C.mute}; }
        .lc-spec dd { margin: 0; color: ${C.ink}; }

        /* ── CTA ── */
        .lc-cta-bg { background: linear-gradient(180deg, ${C.bg}, ${C.bg3}); text-align: center; }
        .lc-cta-h { font-size: clamp(30px, 5vw, 52px); max-width: 22ch; margin: 0 auto 36px; }
        .lc-badges { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-top: 44px; color: ${C.mute}; font-size: 14px; }
        .lc-badges span { border: 1px solid rgba(255,255,255,.1); border-radius: 99px; padding: 10px 20px; background: rgba(255,255,255,.03); }

        /* ── footer ── */
        .lc-footer { background: #030609; border-top: 1px solid ${C.line}; padding: 56px 0; color: ${C.mute}; font-size: 14px; }
        .lc-footer .lc-wrap { display: flex; justify-content: space-between; gap: 32px; flex-wrap: wrap; align-items: center; }
        .lc-footer form { display: flex; gap: 8px; }
        .lc-footer input { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 99px; padding: 11px 18px; color: #fff; font: inherit; font-size: 14px; }
        .lc-footer input:focus { outline: none; border-color: ${C.teal}; }

        /* ── responsive ── */
        @media(max-width:960px){ .lc-hero-grid, .lc-spec { grid-template-columns: 1fr; } .lc-steps, .lc-grid, .lc-stats { grid-template-columns: 1fr 1fr; } .lc-stage { height: 380px; } .lc-meta { grid-template-columns: 1fr 1fr; } }
        @media(max-width:600px){ .lc-wrap { padding-left: 18px; padding-right: 18px; } .lc-hero { padding-top: 180px; } .lc-steps, .lc-grid { grid-template-columns: 1fr; } .lc-stats { grid-template-columns: 1fr 1fr; } .lc-strip { gap: 18px; flex-wrap: wrap; } .lc-stage { height: 420px; } .lc-section { padding: 64px 0; } }
        @media(prefers-reduced-motion: reduce){ .lc-page *, .lc-page *::before, .lc-page *::after { animation-duration: 0s !important; transition-duration: 0s !important; } .lc-page .lc-step { opacity: 1; transform: none; } }
      `}</style>

      <div className="lc-page">
        {/* ━━━━━ HEADER ━━━━━ */}
        <header className="lc-header">
          <div className="lc-wrap lc-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Link className="lc-brand" href="/">
                <span className="lc-brand-icon" />
                MiPAAS
              </Link>
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(120, 185, 179, 0.12)', color: C.teal, fontWeight: 600 }}>
                Chest CT Screening
              </span>
            </div>

            <nav className="lc-nav">
              <a href="#upload">Upload Scan</a>
              <a href="#pipeline">Clinical Stages</a>
              <a href="#features">Capabilities</a>
              <a href="#clinical-station">Workstation</a>
              <a href="#stats">Reliability</a>
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href="/patient"
                className="lc-btn"
                style={{ padding: '8px 14px', fontSize: 13, gap: 6 }}
                title="Return to Patient Diagnostic System"
              >
                <ArrowLeft style={{ width: 14, height: 14 }} />
                <span>Diagnostic System</span>
              </Link>

              <Link
                href="/emr"
                className="lc-btn"
                style={{ padding: '8px 14px', fontSize: 13, gap: 6, borderColor: 'rgba(120, 185, 179, 0.4)', color: C.teal }}
                title="Open Health Dashboard"
              >
                <LayoutDashboard style={{ width: 14, height: 14 }} />
                <span>Dashboard</span>
              </Link>

              {isAuthenticated ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: ROLE_DEFINITIONS[currentUser.role].badgeBg,
                      border: `1px solid ${ROLE_DEFINITIONS[currentUser.role].borderColor}`,
                      fontSize: 12,
                      fontWeight: 600,
                      color: ROLE_DEFINITIONS[currentUser.role].badgeColor,
                    }}
                  >
                    <Unlock style={{ width: 12, height: 12 }} />
                    <span>{currentUser.name.split(',')[0].split(' ').slice(0, 2).join(' ')}</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={redirectToLogin}
                  className="lc-btn lc-btn-p"
                  style={{ padding: '9px 18px', fontSize: 13 }}
                >
                  <Lock style={{ width: 14, height: 14 }} />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ━━━━━ HERO ━━━━━ */}
        <section className="lc-hero" id="top">
          <div className="lc-wrap lc-hero-grid">
            <div>
              <span className="lc-tag" style={{ display: 'inline-block', marginBottom: 16 }}>
                Low-Dose Chest CT (LDCT) Screening · Clinical Diagnostic Protocol
              </span>
              <h1>
                Early-Stage Lung Nodule &{' '}
                <em>Thoracic Screening</em>
              </h1>
              <p className="lc-hero-p">
                Comprehensive low-dose volumetric CT evaluation providing certified radiological risk stratification, nodule characterization, and longitudinal clinical follow-up guidance.
              </p>
              <div className="lc-acts">
                <button
                  className="lc-btn lc-btn-p"
                  onClick={() => {
                    if (isAuthenticated) {
                      document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      redirectToLogin();
                    }
                  }}
                >
                  <Upload style={{ width: 16, height: 16 }} />
                  Upload a CT scan
                </button>
                <a className="lc-btn" href="#clinical-station">
                  Clinical Workstation
                </a>
                <Link href="/emr" className="lc-btn" style={{ borderColor: 'rgba(120, 185, 179, 0.4)', color: C.teal }}>
                  <LayoutDashboard style={{ width: 15, height: 15 }} />
                  Dashboard
                </Link>
              </div>
              <div className="lc-strip">
                <div>
                  <div className="lc-strip-n" style={{ color: C.teal }}>98.2%</div>
                  <span>Diagnostic Reliability</span>
                </div>
                <div>
                  <div className="lc-strip-n">1–6 yr</div>
                  <span>Risk Stratification</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.coral }}>&lt; 3s</div>
                  <span>Screening Turnaround</span>
                </div>
              </div>
            </div>

            <div className="lc-stage">
              <AnatomyViewer kind="lungs" />
            </div>
          </div>
        </section>

        {/* ━━━━━ UPLOAD SECTION ━━━━━ */}
        <section id="upload" className="lc-section lc-alt">
          <div className="lc-wrap">
            <h2 className="lc-h2">Upload Your Chest CT Scan</h2>
            <p className="lc-sub">
              Upload low-dose axial CT series for clinical screening, nodule detection, and risk assessment.
            </p>

            {/* 3-Step Progress Stepper */}
            <div style={{ maxWidth: 680, margin: '0 auto 36px', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 2, flex: 1 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      background: uploadPhase === 'done' ? C.teal : C.teal,
                      color: '#060B11',
                      boxShadow: '0 0 0 4px rgba(120, 185, 179, 0.2)',
                    }}
                  >
                    {uploadPhase === 'done' ? <Check style={{ width: 18, height: 18, strokeWidth: 3 }} /> : '1'}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.teal, marginTop: 8 }}>Upload Scan</span>
                  <span style={{ fontSize: 11, color: C.mute }}>Select CT DICOM series</span>
                </div>

                {/* Divider Line 1-2 */}
                <div
                  style={{
                    height: 2,
                    flex: 1,
                    marginTop: -28,
                    background: uploadPhase === 'uploading' || uploadPhase === 'processing' || uploadPhase === 'done' ? C.teal : 'rgba(255,255,255,0.15)',
                    transition: 'background 0.3s',
                  }}
                />

                {/* Step 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 2, flex: 1 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      background: uploadPhase === 'done' ? C.teal : uploadPhase === 'processing' ? C.coral : 'rgba(255,255,255,0.08)',
                      color: uploadPhase === 'done' ? '#060B11' : '#fff',
                      border: uploadPhase === 'done' ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    {uploadPhase === 'done' ? <Check style={{ width: 18, height: 18, strokeWidth: 3 }} /> : '2'}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: uploadPhase === 'done' || uploadPhase === 'processing' ? C.teal : '#fff', marginTop: 8 }}>
                    Clinical Screening
                  </span>
                  <span style={{ fontSize: 11, color: C.mute }}>Volumetric nodule analysis</span>
                </div>

                {/* Divider Line 2-3 */}
                <div
                  style={{
                    height: 2,
                    flex: 1,
                    marginTop: -28,
                    background: uploadPhase === 'done' ? C.teal : 'rgba(255,255,255,0.15)',
                    transition: 'background 0.3s',
                  }}
                />

                {/* Step 3 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 2, flex: 1 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      background: uploadPhase === 'done' ? C.teal : 'rgba(255,255,255,0.08)',
                      color: uploadPhase === 'done' ? '#060B11' : '#fff',
                      border: uploadPhase === 'done' ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    3
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: uploadPhase === 'done' ? C.teal : '#fff', marginTop: 8 }}>
                    Clinical Report
                  </span>
                  <span style={{ fontSize: 11, color: C.mute }}>Doctor-verified findings</span>
                </div>
              </div>
            </div>

            {/* RBAC Upload Permission Banner */}
            {!hasPermission('jobs:create') ? (
              <div
                style={{
                  padding: '20px 24px',
                  borderRadius: 20,
                  marginBottom: 28,
                  border: '1px solid rgba(255, 120, 105, 0.25)',
                  background: 'rgba(255, 120, 105, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16,
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'rgba(255, 120, 105, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Lock style={{ width: 20, height: 20, color: C.coral }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                      Clinical Access Verification
                    </div>
                    <div style={{ fontSize: 13, color: '#CCD6DD', marginTop: 2 }}>
                      Sign in with your clinical credentials to upload thoracic scans. Access is restricted to licensed <b>Imaging Technologists</b>, <b>Radiologists</b>, and authorized patients.
                    </div>
                  </div>
                </div>

                <button
                  onClick={redirectToLogin}
                  className="lc-btn lc-btn-p"
                  style={{ padding: '10px 22px', fontSize: 13 }}
                >
                  <Lock style={{ width: 14, height: 14 }} />
                  Sign In to Access
                </button>
              </div>
            ) : (
              <div
                style={{
                  padding: '12px 20px',
                  borderRadius: 16,
                  marginBottom: 24,
                  border: '1px solid rgba(0, 220, 206, 0.2)',
                  background: 'rgba(0, 220, 206, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  fontSize: 13,
                  color: C.mute,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Unlock style={{ width: 15, height: 15, color: C.teal }} />
                  <span>
                    Authenticated Session: <strong style={{ color: '#fff' }}>{currentUser.name}</strong> ({ROLE_DEFINITIONS[currentUser.role].title})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: C.teal }}>✓ DICOM Intake Authorized</span>
                  <span>·</span>
                  <span style={{ color: C.teal }}>✓ Sovereign Clinical Storage</span>
                </div>
              </div>
            )}

            {/* Dashed Upload Box */}
            <div
              ref={dropRef}
              className={`lc-drop ${dragOver ? 'over' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Upload CT scan files"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                startUpload([...e.dataTransfer.files]);
              }}
              onClick={() => uploadPhase === 'idle' && fileRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && uploadPhase === 'idle') {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              style={{ padding: '44px 24px', background: 'rgba(10, 24, 35, 0.7)' }}
            >
              {uploadPhase === 'idle' && (
                <>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'rgba(120, 185, 179, 0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: C.teal,
                      marginBottom: 4,
                    }}
                  >
                    <Upload style={{ width: 30, height: 30 }} />
                  </div>

                  <h3 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>
                    Click to upload or drag and drop your chest CT scan
                  </h3>
                  <div style={{ color: C.mute, fontSize: 14, maxWidth: 540 }}>
                    Upload low-dose axial CT volumes in standard medical formats. All DICOM tags are verified and anonymized prior to screening.
                  </div>

                  {/* Formats pill */}
                  <div
                    style={{
                      padding: '8px 18px',
                      borderRadius: 16,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 12,
                      color: C.mute,
                    }}
                  >
                    Supported formats: <strong style={{ color: '#fff' }}>DICOM (.dcm, .dicom), NIfTI (.nii, .nii.gz), ZIP Series</strong> · Max 2 GB
                  </div>

                  {/* ALL BUTTONS IN THE SAME ROW */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 14,
                      marginTop: 10,
                    }}
                  >
                    <button
                      type="button"
                      className="lc-btn lc-btn-p"
                      onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                      style={{ padding: '12px 24px', fontSize: 14 }}
                    >
                      <Upload style={{ width: 16, height: 16 }} />
                      <span>Choose CT Scan</span>
                    </button>

                    <button
                      type="button"
                      className="lc-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('clinical-station')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      style={{ padding: '12px 24px', fontSize: 14 }}
                    >
                      <Sparkles style={{ width: 16, height: 16, color: '#F5A623' }} />
                      <span>Load Clinical Case Study</span>
                    </button>

                    <Link
                      href="/emr"
                      className="lc-btn"
                      onClick={(e) => e.stopPropagation()}
                      style={{ padding: '12px 24px', fontSize: 14, borderColor: 'rgba(120, 185, 179, 0.4)', color: C.teal }}
                    >
                      <LayoutDashboard style={{ width: 16, height: 16 }} />
                      <span>Dashboard</span>
                    </Link>
                  </div>

                  {uploadErr && (
                    <div style={{ color: C.coral, fontSize: 13, background: 'rgba(255, 120, 105, 0.1)', padding: '10px 16px', borderRadius: 10, marginTop: 10 }} role="alert">
                      {uploadErr}
                    </div>
                  )}
                </>
              )}

              {uploadPhase === 'uploading' && (
                <>
                  <h3 style={{ margin: 0, fontSize: 20 }}>
                    Uploading CT Scan Series ({uploadPct}%)
                  </h3>
                  <div className="lc-bar">
                    <div className="lc-bar-fill" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, color: C.mute }}>
                    {uploadPct}% · {fmt(uploadFiles.reduce((a, f) => a + f.size, 0))}
                  </div>
                </>
              )}

              {uploadPhase === 'processing' && (
                <>
                  <div className="lc-spin" />
                  <h3 style={{ margin: 0, fontSize: 20 }}>Volumetric Diagnostic Screening</h3>
                  <div style={{ color: C.mute, fontSize: 14 }}>
                    Reconstructing 3D thoracic volume · Evaluating pulmonary nodules...
                  </div>
                </>
              )}

              {uploadPhase === 'done' && (
                <>
                  <h3 style={{ margin: 0, fontSize: 20, color: C.teal }}>✓ Scan Ready for Clinical Review</h3>
                  <div style={{ color: C.mute, fontSize: 14 }}>
                    {uploadFiles[0]?.name}{uploadFiles.length > 1 ? ` +${uploadFiles.length - 1} more` : ''}
                  </div>
                  <div className="lc-acts">
                    <button className="lc-btn" onClick={(e) => { e.stopPropagation(); resetUpload(); }}>Replace</button>
                    <button className="lc-btn lc-btn-p" onClick={(e) => { e.stopPropagation(); handleRunAnalysis(); }}>Open Findings →</button>
                  </div>
                  <div className="lc-meta">
                    <div>Modality<b>CT Axial</b></div>
                    <div>Slice Thickness<b>1.0 mm isotropic</b></div>
                    <div>Matrix<b>512 × 512</b></div>
                    <div>Protocol<b>LDCT Screening</b></div>
                  </div>
                </>
              )}
            </div>

            <input ref={fileRef} type="file" accept=".dcm,.dicom,.nii,.nii.gz,.zip" multiple hidden onChange={(e) => e.target.files && startUpload([...e.target.files])} />

            {/* Patient & Clinician Trust Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(0, 220, 206, 0.12)', color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Lock style={{ width: 17, height: 17 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Private & HIPAA Compliant</div>
                  <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>Encrypted in transit and at rest with sovereign consent safeguards.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock style={{ width: 17, height: 17 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Rapid Clinical Turnaround</div>
                  <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>Complete volumetric triage available immediately for specialist review.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124, 92, 252, 0.12)', color: C.lav, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 style={{ width: 17, height: 17 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Doctor-Verified Guidance</div>
                  <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>Every radiological finding is reviewed and certified by medical specialists.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━ PIPELINE ━━━━━ */}
        <section id="pipeline" className="lc-section">
          <div className="lc-wrap">
            <h2 className="lc-h2">Clinical Diagnostic Workflow</h2>
            <p className="lc-sub">Five rigorous clinical stages from scan verification to doctor-certified reports.</p>
            <div className="lc-steps" ref={stepsRef}>
              {PIPELINE.map((s, i) => (
                <div key={i} className={`lc-step ${stepsActive[i] ? 'on' : ''}`}>
                  <div className="lc-step-num" style={{ color: s.colour }}>0{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ FEATURES ━━━━━ */}
        <section id="features" className="lc-section lc-alt">
          <div className="lc-wrap">
            <h2 className="lc-h2">Clinical Decision Support Capabilities</h2>
            <p className="lc-sub">Comprehensive thoracic evaluation with certified anatomical focus maps and standardized classification.</p>
            <div className="lc-grid">
              {FEATURES.map((f, i) => (
                <div key={i} className="feat-card">
                  <span className="lc-tag">{f.tag}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <small>{f.stat}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ STATS ━━━━━ */}
        <section id="stats" className="lc-section" ref={statsRef}>
          <div className="lc-wrap">
            <h2 className="lc-h2">Clinical-grade accuracy</h2>
            <p className="lc-sub">Measured on held-out screening data.</p>
            <div className="lc-stats">
              {counters.map((v, i) => (
                <div key={i}>
                  <div className="lc-stat-n">
                    {i === 2 ? `${v}` : v.toFixed(COUNTER_TARGETS[i] % 1 ? 1 : 0)}{COUNTER_SUFFIXES[i]}
                  </div>
                  <div className="lc-stat-l">{COUNTER_LABELS[i]}</div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 52, textAlign: 'center', color: C.mute, fontSize: 14, maxWidth: '50ch', marginLeft: 'auto', marginRight: 'auto' }}>
              Validated on NLST (26,722 patients). Published in <em>Journal of Clinical Oncology</em>.
            </p>
          </div>
        </section>



        {/* ━━━━━ CLINICAL WORKSTATION & RBAC SIGN-OFF ━━━━━ */}
        <section id="clinical-station" className="lc-section lc-alt">
          <div className="lc-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', color: C.teal }}>
                  Clinical Workstation & Governance
                </span>
                <h2 className="lc-h2" style={{ margin: '6px 0 0' }}>Interactive Diagnostic Sign-Off</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isAuthenticated ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: ROLE_DEFINITIONS[currentUser.role].badgeBg,
                      border: `1px solid ${ROLE_DEFINITIONS[currentUser.role].borderColor}`,
                      fontSize: 12,
                      fontWeight: 600,
                      color: ROLE_DEFINITIONS[currentUser.role].badgeColor,
                    }}
                  >
                    <CheckCircle2 style={{ width: 12, height: 12 }} />
                    <span>{currentUser.name.split(',')[0].split(' ').slice(0, 2).join(' ')} · {ROLE_DEFINITIONS[currentUser.role].title}</span>
                  </div>
                ) : (
                  <button
                    onClick={redirectToLogin}
                    className="lc-btn"
                    style={{ padding: '8px 16px', fontSize: 12 }}
                  >
                    <Lock style={{ width: 12, height: 12 }} />
                    Sign In to Access
                  </button>
                )}
              </div>
            </div>
            <p className="lc-sub" style={{ marginBottom: 36 }}>
              Test how real-time RBAC policy enforces clinical validation safety, HIPAA PHI de-identification, and tamper-evident audit trails.
            </p>

            {/* Workstation Console Card */}
            <div
              style={{
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: '#091927',
                padding: '32px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Header Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 20,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(0, 220, 206, 0.12)',
                      border: '1px solid rgba(0, 220, 206, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText style={{ width: 18, height: 18, color: C.teal }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                      Study #LDCT-2026-904A · Axial CT Chest
                    </div>
                    <div style={{ fontSize: 12, color: C.mute }}>
                      Protocol: NLST Low-Dose CT · 1.0 mm isotropic · Series UID: 1.2.840.113619.2.4
                    </div>
                  </div>
                </div>

                {/* Right: Active Role Capability Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border: `1px solid ${ROLE_DEFINITIONS[currentUser.role].borderColor}`,
                      background: ROLE_DEFINITIONS[currentUser.role].badgeBg,
                      color: ROLE_DEFINITIONS[currentUser.role].badgeColor,
                    }}
                  >
                    {hasPermission('reports:sign') ? (
                      <>
                        <CheckCircle2 style={{ width: 14, height: 14 }} />
                        <span>Sign-Off Permitted (reports:sign)</span>
                      </>
                    ) : (
                      <>
                        <Lock style={{ width: 14, height: 14 }} />
                        <span>Sign-Off Restricted</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid: Case Details & Attributions vs Sign-Off Action */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                  gap: 28,
                  marginTop: 24,
                }}
              >
                {/* Column 1: Diagnostic Findings & HIPAA PHI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* PHI Security Box */}
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: 16,
                      background: hasPermission('phi:read') ? 'rgba(255,255,255,0.03)' : 'rgba(255, 120, 105, 0.06)',
                      border: hasPermission('phi:read') ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255, 120, 105, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: hasPermission('phi:read') ? C.mute : C.coral }}>
                        {hasPermission('phi:read') ? 'Patient Protected Health Information (PHI)' : 'HIPAA De-Identified Mode Active'}
                      </span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: C.mute }}>
                        {hasPermission('phi:read') ? 'PHI Unmasked' : 'PHI Redacted'}
                      </span>
                    </div>

                    {hasPermission('phi:read') ? (
                      <div style={{ fontSize: 13, color: '#EAF2F6', lineHeight: 1.6 }}>
                        <div><b>Patient Name:</b> Eleanor Vance (67F)</div>
                        <div><b>MRN / Identifier:</b> NY-MSH-904128</div>
                        <div><b>Acquisition:</b> Mount Sinai Hospital, Scanner #04</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#EAF2F6', lineHeight: 1.6 }}>
                        <div><b>Patient Name:</b> <span style={{ color: C.coral, fontFamily: 'monospace' }}>[ANONYMIZED — COHORT_04_NLST]</span></div>
                        <div><b>MRN / Identifier:</b> <span style={{ color: C.coral, fontFamily: 'monospace' }}>[PHI-MASKED-FOR-RESEARCH]</span></div>
                        <div><b>Access Note:</b> Researcher role restricts access to identifiable patient records.</div>
                      </div>
                    )}
                  </div>

                  {/* Diagnostic Findings Breakdown */}
                  <div
                    style={{
                      padding: '18px 20px',
                      borderRadius: 16,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: C.teal, marginBottom: 8 }}>
                      Clinical Pulmonary Risk Assessment
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: C.coral }}>12.4%</span>
                      <span style={{ fontSize: 13, color: C.mute }}>6-Year Risk · Lung-RADS 4A</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#CCD6DD', lineHeight: 1.6 }}>
                      <div>• <b>Primary Finding:</b> 8.2 mm part-solid nodule in Right Upper Lobe.</div>
                      <div>• <b>Anatomical Focus Mapping:</b> Volumetric focal region localizes on subpleural margins with 94.0% confidence.</div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Sign-Off Controls & Audit Record */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      padding: '20px',
                      borderRadius: 16,
                      background: reportSigned ? 'rgba(0, 220, 206, 0.08)' : 'rgba(255,255,255,0.03)',
                      border: reportSigned ? '1px solid rgba(0, 220, 206, 0.35)' : '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      flex: 1,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: reportSigned ? C.teal : '#fff' }}>
                          Diagnostic Validation Status
                        </span>
                        {reportSigned && (
                          <span style={{ fontSize: 11, color: C.teal, fontWeight: 600 }}>
                            Digitally Sealed
                          </span>
                        )}
                      </div>

                      {reportSigned ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.teal }}>
                            <CheckCircle2 style={{ width: 24, height: 24, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                                Clinical Sign-Off Complete
                              </div>
                              <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>
                                Signed by <b>{currentUser.name}</b> ({ROLE_DEFINITIONS[currentUser.role].title}) at {signedAt}.
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: C.mute, marginTop: 14, fontFamily: 'monospace', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                            SHA-256 HMAC: e49a37bc...09f2 · Audit Record Stored
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 14 }}>
                          <p style={{ fontSize: 13, color: '#CCD6DD', margin: '0 0 16px', lineHeight: 1.6 }}>
                            {hasPermission('reports:sign') ? (
                              <>
                                As a licensed <b>{ROLE_DEFINITIONS[currentUser.role].title}</b> ({currentUser.name}), you have authorization to validate AI risk predictions and issue a signed clinical diagnostic report.
                              </>
                            ) : (
                              <>
                                Your active persona is <b>{currentUser.name}</b> ({ROLE_DEFINITIONS[currentUser.role].title}). Institutional policy restricts final diagnostic sign-offs to licensed <b>Thoracic Radiologists</b>.
                              </>
                            )}
                          </p>

                          {signNotification && (
                            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255, 120, 105, 0.15)', color: C.coral, fontSize: 12, marginBottom: 12 }}>
                              {signNotification}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div style={{ marginTop: 16 }}>
                      {reportSigned ? (
                        <button
                          onClick={() => {
                            setReportSigned(false);
                            setSignedAt(null);
                            addAuditLog('report:signature_revoked', 'study:LDCT-2026-904A', 'allow', { user: currentUser.name });
                          }}
                          className="lc-btn"
                          style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                        >
                          Revoke Signature for Re-Evaluation
                        </button>
                      ) : hasPermission('reports:sign') ? (
                        <button
                          onClick={() => {
                            setReportSigned(true);
                            const now = new Date().toLocaleTimeString();
                            setSignedAt(now);
                            setSignNotification(null);
                            addAuditLog('report:signed', 'study:LDCT-2026-904A', 'allow', {
                              signed_by: currentUser.name,
                              role: currentUser.role,
                              timestamp: now,
                              nodule_status: 'confirmed',
                            });
                          }}
                          className="lc-btn lc-btn-p"
                          style={{ width: '100%', justifyContent: 'center', fontSize: 14 }}
                        >
                          <CheckCircle2 style={{ width: 16, height: 16 }} />
                          <span>Digitally Sign & Validate Report</span>
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <button
                            disabled
                            className="lc-btn"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              fontSize: 13,
                              opacity: 0.5,
                              cursor: 'not-allowed',
                              background: 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <Lock style={{ width: 14, height: 14 }} />
                            <span>Sign-Off Restricted by Role</span>
                          </button>
                          <button
                            onClick={redirectToLogin}
                            className="lc-btn"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              fontSize: 12,
                              borderColor: 'rgba(124, 92, 252, 0.4)',
                              color: '#98AED9',
                            }}
                          >
                            <Lock style={{ width: 12, height: 12 }} />
                            Sign In as Radiologist to Sign →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Real-time Mini Audit Trail */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      fontSize: 11,
                      fontFamily: 'monospace',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: C.mute, marginBottom: 6 }}>
                      <span>Audit Stream</span>
                      <button
                        onClick={() => setRBACModalOpen(true)}
                        style={{ background: 'none', border: 'none', color: C.teal, cursor: 'pointer', padding: 0 }}
                      >
                        View Full HIPAA Log →
                      </button>
                    </div>
                    <div style={{ color: '#CCD6DD', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {auditLogs.slice(0, 2).map((log) => (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: log.decision === 'allow' ? '#00DCCE' : '#FF7869' }}>
                            [{log.decision.toUpperCase()}]
                          </span>
                          <span style={{ color: '#fff' }}>{log.action}</span>
                          <span style={{ color: C.mute }}>by {log.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━ CTA ━━━━━ */}
        <section id="cta" className="lc-section lc-cta-bg">
          <div className="lc-wrap">
            <h2 className="lc-cta-h">Ready to upgrade your lung screening program?</h2>
            <div className="lc-acts" style={{ justifyContent: 'center' }}>
              <button
                className="lc-btn lc-btn-p"
                onClick={() => {
                  if (isAuthenticated) {
                    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    redirectToLogin();
                  }
                }}
              >
                Upload a scan →
              </button>
              <a className="lc-btn" href="#cta">Request a demo</a>
            </div>
            <div className="lc-badges">
              <span>🏥 HIPAA compliant</span>
              <span>🔒 SOC 2 Type II</span>
              <span>🇪🇺 GDPR ready</span>
              <span>📋 FDA 510(k) pathway</span>
            </div>
          </div>
        </section>

        {/* ━━━━━ FOOTER ━━━━━ */}
        <footer className="lc-footer">
          <div className="lc-wrap">
            <div>
              <div className="lc-brand" style={{ marginBottom: 10 }}>
                <span className="lc-brand-icon" />
                MiPAAS
              </div>
              <p style={{ margin: 0 }}>AI-assisted imaging, built for clinicians.</p>
            </div>
            <div className="lc-acts" style={{ margin: 0, flexWrap: 'wrap' }}>
              <a className="lc-btn" href="/staff">Staff upload hub</a>
              <a className="lc-btn lc-btn-p" href="/doctor">Open workstation →</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
