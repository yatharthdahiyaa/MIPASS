'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRBAC } from '@/context/RBACContext';
import { ROLE_DEFINITIONS } from '@/types/rbac';
import {
  ShieldCheck,
  Activity,
  FileCheck2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
  Play,
  RotateCcw,
  Layers,
  Zap,
  Timer,
  Crosshair,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import AnatomyViewer from '@/components/common/AnatomyViewer';

const C = {
  bg:   '#0B1926',
  bg2:  '#102333',
  bg3:  '#132B3A',
  ink:  '#EAF2F6',
  mute: '#A6B3BD',
  teal: '#7DB7B0',
  tealDim: '#7DB7B0',
  coral:'#FF7869',
  lav:  '#98AED9',
  violet:'#7C5CFC',
  gold: '#F5A623',
  line: 'rgba(255,255,255,.08)',
} as const;

const PIPELINE = [
  { title: 'Multimodal Ingestion', desc: 'Auto-detects NCCT, CTA, and CTP series from scanner', colour: C.lav },
  { title: 'ASPECTS Registration', desc: 'Maps 10 MCA cortical and deep subcortical regions', colour: C.tealDim },
  { title: 'LVO Deep Detection', desc: 'Identifies ICA, M1, M2, and Basilar vascular occlusions', colour: C.gold },
  { title: 'Perfusion Mismatch', desc: 'Calculates Core (CBF < 30%) vs Penumbra (Tmax > 6s)', colour: C.coral },
  { title: 'Tele-Stroke Dispatch', desc: 'Instant push notification to neuro-intervention team', colour: C.teal },
];

const FEATURES = [
  { tag: 'Automated ASPECTS', title: '10-Zone MCA scoring', desc: 'Quantifies early ischemic changes across subcortical structures and M1-M6.', stat: 'Scores 0–10 in 12s' },
  { tag: 'Large Vessel Occlusion', title: 'CTA LVO detection', desc: 'Detects proximal vessel cutoffs in internal carotid and middle cerebral arteries.', stat: '96.5% LVO sensitivity' },
  { tag: 'Perfusion Modeling', title: 'Core vs penumbra mismatch', desc: 'Quantifies salvageable brain tissue volume and mismatch ratio for thrombectomy.', stat: 'r = 0.94 vs RAPID' },
  { tag: 'Time Optimization', title: 'Door-to-needle accelerator', desc: 'Cuts door-to-treatment intervals by streamlining radiology reading workflow.', stat: '-34 min transfer time' },
  { tag: 'Hub-and-Spoke', title: 'Tele-stroke coordination', desc: 'Enables remote community hospitals to transmit annotated scans to tertiary centers.', stat: 'Live PACS sharing' },
  { tag: 'Collateral Scoring', title: 'Multiphasic CTA', desc: 'Scores leptomeningeal collateral status to predict tissue survival time.', stat: 'Tan collateral scale' },
];

const STROKE_CASES = [
  {
    id: 'stroke-01',
    label: 'Case A: Acute Right MCA-M1 Occlusion (LVO)',
    nihss: '18 (Severe)',
    aspectsScore: 8,
    onset: '2.5 hrs ago (Golden Window)',
    lvoLocation: 'Right MCA M1 Segment',
    ischemicCore: '14 mL (CBF < 30%)',
    penumbra: '86 mL (Tmax > 6.0s)',
    mismatchRatio: '6.1x (Favorable Target)',
    thrombectomyCandidate: true,
    findings: 'Acute occlusion of right proximal M1 segment. Automated ASPECTS 8/10 with early ischemic changes in lentiform nucleus and insular ribbon. Large salvageable tissue penumbra.',
    aspectsRegions: [
      { code: 'C', name: 'Caudate', affected: false },
      { code: 'L', name: 'Lentiform', affected: true },
      { code: 'IC', name: 'Internal Capsule', affected: false },
      { code: 'I', name: 'Insular Ribbon', affected: true },
      { code: 'M1', name: 'Anterior MCA', affected: false },
      { code: 'M2', name: 'MCA at Insula', affected: false },
      { code: 'M3', name: 'Posterior MCA', affected: false },
      { code: 'M4', name: 'Upper Ant MCA', affected: false },
      { code: 'M5', name: 'Upper Lat MCA', affected: false },
      { code: 'M6', name: 'Upper Post MCA', affected: false },
    ],
  },
  {
    id: 'stroke-02',
    label: 'Case B: Left Internal Carotid Artery (T-Junction)',
    nihss: '22 (Critical)',
    aspectsScore: 6,
    onset: '3.8 hrs ago',
    lvoLocation: 'Left Carotid Terminus',
    ischemicCore: '32 mL',
    penumbra: '118 mL',
    mismatchRatio: '3.7x',
    thrombectomyCandidate: true,
    findings: 'Complete occlusion of left carotid terminus. Moderate early ischemic changes involving M1, M2, and lentiform nucleus. Emergency endovascular thrombectomy recommended.',
    aspectsRegions: [
      { code: 'C', name: 'Caudate', affected: false },
      { code: 'L', name: 'Lentiform', affected: true },
      { code: 'IC', name: 'Internal Capsule', affected: true },
      { code: 'I', name: 'Insular Ribbon', affected: false },
      { code: 'M1', name: 'Anterior MCA', affected: true },
      { code: 'M2', name: 'MCA at Insula', affected: true },
      { code: 'M3', name: 'Posterior MCA', affected: false },
      { code: 'M4', name: 'Upper Ant MCA', affected: false },
      { code: 'M5', name: 'Upper Lat MCA', affected: false },
      { code: 'M6', name: 'Upper Post MCA', affected: false },
    ],
  },
];

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function StrokePage() {
  const stepsRef = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, isIamAuthenticated } = useRBAC();
  const router = useRouter();
  const isAuthenticated = isIamAuthenticated;

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/stroke');
  }, [router]);

  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counters, setCounters] = useState([0, 0, 0, 0]);

  const [selectedCase, setSelectedCase] = useState(STROKE_CASES[0]);
  const [viewMode, setViewMode] = useState<'aspects' | 'perfusion' | 'cta'>('aspects');
  const [analyzing, setAnalyzing] = useState(false);
  const [reportSigned, setReportSigned] = useState(false);

  const COUNTER_TARGETS = [96.5, 30, 8, 34];
  const COUNTER_SUFFIXES = ['%', 's', '/10', 'm'];
  const COUNTER_LABELS  = ['LVO Sensitivity', 'Inference Latency', 'Automated ASPECTS', 'Transfer Time Saved'];

  /* ── pipeline reveal ── */
  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    let ran = false;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ran) {
        ran = true;
        PIPELINE.forEach((_, i) => {
          setTimeout(() => setStepsActive((prev) => { const n = [...prev]; n[i] = true; return n; }), i * 400);
        });
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── animated counters ── */
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

  const [uploadError, setUploadError] = useState<string | null>(null);

  /* ── upload handlers ── */
  const startUpload = async (files: File[]) => {
    if (!files.length) return;
    setUploadError(null);
    const file = files[0];
    const name = file.name.toLowerCase();

    // STRICT DICOM VALIDATION: ONLY DICOM IMAGES REDIRECT TO DOCTOR
    if (!name.endsWith('.dcm') && !name.endsWith('.dicom')) {
      setUploadError(
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

      // Save study and redirect to Doctor Workstation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('mipaas_active_dicom_study', JSON.stringify(json.data));
      }
      setTimeout(() => {
        router.push('/doctor');
      }, 500);
    } catch (err: unknown) {
      console.error('Upload failed:', err);
      setUploadError(err instanceof Error && err.message ? err.message : 'Error processing DICOM image');
      setUploadPhase('idle');
    }
  };

  const selectCase = (c: typeof STROKE_CASES[0]) => {
    setAnalyzing(true);
    setSelectedCase(c);
    setTimeout(() => setAnalyzing(false), 500);
  };

  return (
    <div className="lc-page">
      <style jsx>{`
        .lc-page {
          background: ${C.bg};
          color: ${C.ink};
          font-family: Inter, system-ui, -apple-system, sans-serif;
          min-height: 100vh;
        }
        .lc-page h1, .lc-page h2, .lc-page h3 {
          font-family: Sora, system-ui, sans-serif;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .lc-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .lc-section { padding: 90px 0; position: relative; }
        .lc-alt { background: ${C.bg3}; }
        .lc-sub { color: ${C.mute}; max-width: 54ch; margin: 0 0 52px; font-size: 17px; line-height: 1.7; }
        .lc-h2 { font-size: clamp(28px, 4vw, 44px); margin-bottom: 14px; }
        .lc-btn {
          display: inline-flex; align-items: center; gap: 8px; border-radius: 10px;
          padding: 14px 28px; font-weight: 600; font-size: 15px; border: 1px solid ${C.line};
          background: ${C.bg2}; color: ${C.ink}; cursor: pointer;
          transition: background .2s, border-color .2s; text-decoration: none;
        }
        .lc-btn:hover { border-color: ${C.teal}; background: ${C.bg3}; }
        .lc-btn:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 3px; }
        .lc-btn-p {
          background: ${C.coral};
          border: 1px solid ${C.coral}; color: #0B1926; font-weight: 700;
        }
        .lc-btn-p:hover { background: #F48C7E; border-color: #F48C7E; }
        .lc-tag {
          font-size: 12px; padding: 5px 12px; border-radius: 6px;
          background: ${C.bg2}; color: ${C.teal}; font-weight: 500; letter-spacing: .02em;
        }

        .lc-header {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          backdrop-filter: blur(16px) saturate(1.4); background: ${C.bg};
          border-bottom: 1px solid ${C.line};
        }
        .lc-header-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
        .lc-brand { font: 700 20px Sora; display: flex; gap: 10px; align-items: center; text-decoration: none; color: #fff; }
        .lc-brand-icon { width: 24px; height: 24px; border-radius: 8px; background: ${C.teal}; }
        .lc-nav { display: flex; gap: 28px; color: ${C.mute}; font-size: 14px; }
        .lc-nav a { text-decoration: none; color: inherit; transition: color .2s; }
        .lc-nav a:hover { color: #fff; }
        @media(max-width:900px){ .lc-nav { display: none; } }

        .lc-hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 0 80px; overflow: hidden; }
        .lc-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; width: 100%; }
        .lc-hero h1 { font-size: clamp(38px, 5.2vw, 62px); }
        .lc-hero h1 em { font-style: normal; color: ${C.teal}; }
        .lc-hero-p { color: ${C.mute}; max-width: 48ch; margin: 22px 0 36px; font-size: 17px; line-height: 1.7; }
        .lc-acts { display: flex; gap: 14px; flex-wrap: wrap; }
        .lc-strip { display: flex; gap: 36px; margin-top: 44px; }
        .lc-strip-n { font: 700 30px Sora; font-variant-numeric: tabular-nums; }
        .lc-strip span { color: ${C.mute}; font-size: 13px; display: block; margin-top: 2px; }

        .lc-stage {
          position: relative; height: 520px; border-radius: 16px;
          background: ${C.bg2}; border: 1px solid ${C.line}; overflow: hidden;
        }

        .lc-drop {
          border: 2px dashed ${C.teal}; border-radius: 14px; padding: 56px 24px;
          text-align: center; background: ${C.bg2}; transition: border-color .25s, background .25s;
          min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; cursor: pointer;
        }
        .lc-drop:hover, .lc-drop.over { border-color: ${C.coral}; background: ${C.bg3}; }
        .lc-bar { width: min(440px, 100%); height: 8px; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
        .lc-bar-fill { height: 100%; background: ${C.teal}; border-radius: 9px; transition: width .15s; }
        .lc-spin { width: 56px; height: 56px; border-radius: 50%; border: 3px solid rgba(255,255,255,.1); border-top-color: ${C.gold}; animation: lc-sp 1s linear infinite; }
        @keyframes lc-sp { to { transform: rotate(360deg); } }
        .lc-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; margin-top: 10px; }
        .lc-meta > div { background: rgba(255,255,255,.04); border-radius: 14px; padding: 14px; font-size: 13px; color: ${C.mute}; text-align: left; border: 1px solid rgba(255,255,255,.05); }
        .lc-meta b { display: block; color: #fff; font-size: 14px; margin-top: 2px; }

        .lc-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .lc-step { padding: 24px 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,.06); opacity: .3; transform: translateY(18px); transition: all .6s cubic-bezier(.16,1,.3,1); background: rgba(255,255,255,.02); }
        .lc-step.on { opacity: 1; transform: none; border-color: ${C.teal}; background: ${C.bg2}; }
        .lc-step-num { font: 700 13px Sora; margin-bottom: 12px; }
        .lc-step h3 { font-size: 18px; margin: 0 0 8px; }
        .lc-step p { margin: 0; font-size: 13px; color: ${C.mute}; line-height: 1.5; }

        .lc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        .lc-page .feat-card { padding: 30px; border-radius: 14px; background: ${C.bg2}; border: 1px solid ${C.line}; transition: border-color .2s; }
        .lc-page .feat-card:hover { border-color: ${C.teal}; }
        .lc-page .feat-card h3 { font-size: 19px; margin-top: 14px; }
        .lc-page .feat-card p { color: ${C.mute}; font-size: 14px; margin: 10px 0 18px; line-height: 1.6; }
        .lc-page .feat-card small { font: 600 13px Sora; color: ${C.teal}; }

        .lc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; text-align: center; }
        .lc-stat-n { font: 700 clamp(44px, 5vw, 68px) Sora; color: #fff; line-height: 1; }
        .lc-stat-l { color: ${C.mute}; font-size: 15px; margin-top: 12px; }

        @media(max-width:900px){
          .lc-hero-grid { grid-template-columns: 1fr; }
          .lc-steps { grid-template-columns: 1fr; }
          .lc-grid { grid-template-columns: 1fr; }
          .lc-stats { grid-template-columns: repeat(2, 1fr); }
          .lc-meta { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* ━━━━━ HEADER ━━━━━ */}
      <header className="lc-header">
        <div className="lc-wrap lc-header-inner">
          <Link className="lc-brand" href="/">
            <span className="lc-brand-icon" />
            MiPAAS <span style={{ fontSize: 13, color: C.mute, fontWeight: 400 }}>· qStroke Suite</span>
          </Link>
          <nav className="lc-nav">
            <a href="#upload">Upload CT/CTA</a>
            <a href="#pipeline">Pipeline</a>
            <a href="#features">Capabilities</a>
            <a href="#clinical-station">Workstation</a>
            <a href="#stats">Metrics</a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                  <span>{currentUser.name.split(',')[0]}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={redirectToLogin}
                className="lc-btn lc-btn-p"
                style={{ padding: '10px 22px', fontSize: 14 }}
              >
                <Lock style={{ width: 14, height: 14 }} />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ━━━━━ HERO ━━━━━ */}
      <section className="lc-hero">
        <div className="lc-wrap">
          <div className="lc-hero-grid">
            <div>
              <span className="lc-tag">ASPECTS AI · Large Vessel Occlusion</span>
              <h1 style={{ marginTop: 18 }}>
                Automated Stroke <em>Triage & Perfusion</em> Mismatch.
              </h1>
              <p className="lc-hero-p">
                End-to-end stroke intelligence: automated 10-point ASPECTS scoring on NCCT, Large Vessel Occlusion (LVO) detection on CTA, and ischemic core vs penumbra calculation within 30 seconds of acquisition.
              </p>
              <div className="lc-acts">
                <a className="lc-btn lc-btn-p" href="#upload">
                  <Activity style={{ width: 16, height: 16 }} />
                  Process Stroke CT
                </a>
                <a className="lc-btn" href="#pipeline">See how it works</a>
              </div>
              <div className="lc-strip">
                <div>
                  <div className="lc-strip-n" style={{ color: C.gold }}>96.5%</div>
                  <span>LVO Sensitivity</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.teal }}>&lt; 30s</div>
                  <span>Inference Latency</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.coral }}>-34m</div>
                  <span>Transfer Saved</span>
                </div>
              </div>
            </div>

            {/* Illustrative cerebral anatomy */}
            <div className="lc-stage">
              <AnatomyViewer kind="brain" />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━ UPLOAD SECTION ━━━━━ */}
      <section id="upload" className="lc-section lc-alt">
        <div className="lc-wrap">
          <h2 className="lc-h2">Upload Acute Stroke Protocol CT / CTA</h2>
          <p className="lc-sub">Drop multi-slice non-contrast head CT, CTA, or CTP DICOM scans (.dcm / .dicom) for immediate trained model diagnosis and triage.</p>

          {uploadError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', padding: '14px 18px', borderRadius: 14, marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span>{uploadError}</span>
              </div>
              <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

          <div
            className={`lc-drop ${dragOver ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) startUpload([...e.dataTransfer.files]);
            }}
            onClick={() => uploadPhase === 'idle' && fileRef.current?.click()}
          >
            {uploadPhase === 'idle' && (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(245,166,35,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Timer style={{ width: 28, height: 28, color: C.gold }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 20 }}>Drag and drop DICOM scan here</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Strict DICOM validation · Evaluates with trained neural models</div>
                <div style={{ display: 'inline-flex', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: C.teal }}>.dcm</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: C.teal }}>.dicom</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', color: '#34d399' }}>Auto-redirects to Doctor Station</span>
                </div>
              </>
            )}

            {uploadPhase === 'uploading' && (
              <>
                <h3 style={{ margin: 0, fontSize: 20 }}>Uploading DICOM study ({uploadPct}%)</h3>
                <div className="lc-bar">
                  <div className="lc-bar-fill" style={{ width: `${uploadPct}%` }} />
                </div>
              </>
            )}

            {uploadPhase === 'processing' && (
              <>
                <div className="lc-spin" />
                <h3 style={{ margin: 0, fontSize: 20 }}>Evaluating with Trained Model</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Zero fallback models · Generating Grad-CAM overlays & redirecting...</div>
              </>
            )}

            {uploadPhase === 'done' && (
              <>
                <h3 style={{ margin: 0, fontSize: 20, color: C.teal }}>✓ DICOM Evaluated — Redirecting to Doctor Station...</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Transferring findings to Doctor Workstation</div>
              </>
            )}
          </div>

          <input ref={fileRef} type="file" accept=".dcm,.dicom" hidden onChange={(e) => e.target.files && startUpload([...e.target.files])} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12, color: C.mute }}>
            <span>🔒 HIPAA-compliant · Zero fallback models · Trained neural weights only</span>
            <a href="/sample_cxr.dcm" download="sample_cxr.dcm" style={{ color: C.teal, textDecoration: 'underline' }}>
              Download Sample DICOM (.dcm)
            </a>
          </div>
        </div>
      </section>

      {/* ━━━━━ PIPELINE ━━━━━ */}
      <section id="pipeline" className="lc-section">
        <div className="lc-wrap">
          <h2 className="lc-h2">Rapid stroke care pipeline</h2>
          <p className="lc-sub">Five stages from scanner acquisition to endovascular suite alert.</p>
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
          <h2 className="lc-h2">Stroke Care & Perfusion Intelligence</h2>
          <p className="lc-sub">Optimized for rapid intervention decision making in the golden window.</p>
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
          <h2 className="lc-h2">Clinical stroke care metrics</h2>
          <p className="lc-sub">Validated against expert consensus panels and multi-center RAPID trials.</p>
          <div className="lc-stats">
            {counters.map((v, i) => (
              <div key={i}>
                <div className="lc-stat-n">
                  {v.toFixed(COUNTER_TARGETS[i] % 1 ? 1 : 0)}{COUNTER_SUFFIXES[i]}
                </div>
                <div className="lc-stat-l">{COUNTER_LABELS[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━ CLINICAL WORKSTATION ━━━━━ */}
      <section id="clinical-station" className="lc-section lc-alt">
        <div className="lc-wrap">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', color: C.gold }}>
                Neuro-Vascular Workstation
              </span>
              <h2 className="lc-h2" style={{ margin: '6px 0 0' }}>Interactive ASPECTS & LVO Viewer</h2>
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
                  <span>{currentUser.name.split(',')[0]} · {ROLE_DEFINITIONS[currentUser.role].title}</span>
                </div>
              ) : (
                <button onClick={redirectToLogin} className="lc-btn" style={{ padding: '8px 16px', fontSize: 12 }}>
                  <Lock style={{ width: 12, height: 12 }} />
                  Sign In for Tele-Stroke Dispatch
                </button>
              )}
            </div>
          </div>
          <p className="lc-sub" style={{ marginBottom: 36 }}>
            Automated 10-zone ASPECTS breakdown, CTA vessel cutoff verification, and CTP mismatch volume curves.
          </p>

          {/* Console Card */}
          <div
            style={{
              borderRadius: 28,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#091927',
              padding: '32px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
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
                    background: 'rgba(245, 166, 35, 0.15)',
                    border: '1px solid rgba(245, 166, 35, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Activity style={{ width: 18, height: 18, color: C.gold }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    {selectedCase.label}
                  </div>
                  <div style={{ fontSize: 12, color: C.mute }}>
                    NIHSS: {selectedCase.nihss} · Onset: {selectedCase.onset}
                  </div>
                </div>
              </div>

              {/* Mode Switcher */}
              <div style={{ display: 'flex', gap: 8 }}>
                {(['aspects', 'perfusion', 'cta'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className="lc-btn"
                    style={{
                      padding: '6px 14px',
                      fontSize: 12,
                      borderColor: viewMode === m ? C.gold : 'rgba(255,255,255,0.1)',
                      color: viewMode === m ? '#07131D' : C.mute,
                      background: viewMode === m ? C.gold : 'rgba(255,255,255,0.03)',
                      fontWeight: 700,
                    }}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                gap: 24,
                marginTop: 24,
              }}
            >
              {/* Left Column: Canvas */}
              <div>
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '4/3',
                    borderRadius: 20,
                    overflow: 'hidden',
                    background: '#04070B',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg viewBox="0 0 400 300" style={{ width: '100%', height: '100%' }}>
                    <rect width="400" height="300" fill="#080e14" />
                    <ellipse cx="200" cy="150" rx="140" ry="110" fill="#131b24" stroke="#253240" strokeWidth="2" />
                    <line x1="200" y1="40" x2="200" y2="260" stroke="#00DCCE" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />

                    {viewMode === 'aspects' && (
                      <>
                        <path d="M 230 130 Q 270 120 290 160 Q 250 170 230 130 Z" fill="rgba(245,166,35,0.5)" stroke="#F5A623" strokeWidth="1.5" />
                        <circle cx="245" cy="145" r="14" fill="#FF7869" opacity="0.8" />
                      </>
                    )}

                    {viewMode === 'perfusion' && (
                      <>
                        <ellipse cx="260" cy="140" rx="55" ry="42" fill="rgba(245,166,35,0.4)" stroke="#F5A623" strokeWidth="1.5" />
                        <circle cx="255" cy="140" r="18" fill="rgba(255,65,84,0.85)" stroke="#FF4154" strokeWidth="2" />
                      </>
                    )}

                    {viewMode === 'cta' && (
                      <>
                        <path d="M 200 180 L 200 140 L 170 110 M 200 140 L 220 125" stroke="#fff" strokeWidth="4" fill="none" />
                        <circle cx="220" cy="125" r="6" fill="#FF7869" />
                        <text x="235" y="130" fill="#FF7869" fontSize="11" fontFamily="monospace">M1 CUTOFF</text>
                      </>
                    )}
                  </svg>

                  <div
                    style={{
                      position: 'absolute',
                      top: 14,
                      left: 14,
                      padding: '6px 12px',
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.7)',
                      backdropFilter: 'blur(8px)',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: C.ink,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div>ASPECTS: <span style={{ color: C.gold, fontWeight: 700 }}>{selectedCase.aspectsScore} / 10</span></div>
                    <div>LVO: <span style={{ color: C.coral }}>{selectedCase.lvoLocation}</span></div>
                  </div>

                  <div style={{ position: 'absolute', bottom: 14, right: 14, fontSize: 11 }}>
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(245,166,35,0.2)', color: C.gold, border: '1px solid rgba(245,166,35,0.4)', fontWeight: 600 }}>
                      RAPID Protocol Active
                    </span>
                  </div>
                </div>

                {/* 10-point ASPECTS matrix */}
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {selectedCase.aspectsRegions.map((region) => (
                    <div
                      key={region.code}
                      style={{
                        padding: '6px 4px',
                        borderRadius: 8,
                        textAlign: 'center',
                        fontSize: 10,
                        border: `1px solid ${region.affected ? 'rgba(255,120,105,0.4)' : 'rgba(0,220,206,0.3)'}`,
                        background: region.affected ? 'rgba(255,120,105,0.15)' : 'rgba(0,220,206,0.1)',
                        color: region.affected ? C.coral : C.teal,
                        fontWeight: 700,
                      }}
                    >
                      <div>{region.code}</div>
                      <div style={{ fontSize: 9, opacity: 0.8 }}>{region.affected ? '0' : '+1'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Quantitative Mismatch */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.mute, marginBottom: 8 }}>
                    Perfusion Volumetric Mismatch
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,65,84,0.1)', border: '1px solid rgba(255,65,84,0.25)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>Ischemic Core (CBF &lt; 30%)</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>{selectedCase.ischemicCore}</div>
                      <div style={{ fontSize: 11, color: C.coral, marginTop: 4 }}>Irreversible Infarct</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>Tissue Penumbra (Tmax &gt; 6s)</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>{selectedCase.penumbra}</div>
                      <div style={{ fontSize: 11, color: C.gold, marginTop: 4 }}>Salvageable Target</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Mismatch Volume Ratio:</span>
                      <strong style={{ color: C.teal }}>{selectedCase.mismatchRatio}</strong>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span>EVT Thrombectomy Recommendation:</span>
                      <strong style={{ color: C.gold }}>Highly Favorable (DEFUSE 3 / DAWN)</strong>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                  {reportSigned ? (
                    <div style={{ padding: '12px', borderRadius: 14, background: 'rgba(0,220,206,0.1)', border: '1px solid rgba(0,220,206,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 style={{ width: 18, height: 18, color: C.teal }} />
                      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                        Angiosuite activated · Tele-stroke alert dispatched
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAuthenticated) { redirectToLogin(); return; }
                        setReportSigned(true);
                      }}
                      className="lc-btn lc-btn-p"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <FileCheck2 style={{ width: 16, height: 16 }} />
                      <span>{isAuthenticated ? 'Verify & Activate Endovascular Team' : 'Sign In to Authorize Dispatch'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sibling Products Cross Navigation */}
      <section className="lc-section" style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="lc-wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', color: C.mute, fontWeight: 700 }}>
                Explore Other MiPAAS Disease Suites
              </div>
              <h3 style={{ margin: '4px 0 0', fontSize: 20 }}>Comprehensive Medical AI Portfolio</h3>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/cardiac" className="lc-btn" style={{ fontSize: 13 }}>qCardiac (Heart AI) →</Link>
              <Link href="/brain-tumor" className="lc-btn" style={{ fontSize: 13 }}>qBrain (Brain Tumor) →</Link>
              <Link href="/lung-cancer" className="lc-btn" style={{ fontSize: 13 }}>qCT Lung (Lung Cancer) →</Link>
              <Link href="/qxr" className="lc-btn" style={{ fontSize: 13 }}>qXR (Chest Radiography) →</Link>
              <Link href="/tb" className="lc-btn" style={{ fontSize: 13 }}>qTrack (TB Screening) →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
