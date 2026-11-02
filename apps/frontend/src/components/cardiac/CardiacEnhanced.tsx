'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AnatomyViewer from '@/components/common/AnatomyViewer';
import { useRBAC } from '@/context/RBACContext';
import { ROLE_DEFINITIONS } from '@/types/rbac';
import {
  ShieldCheck,
  Activity,
  Heart,
  FileCheck2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Layers,
  Zap,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';

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
  crimson: '#FF4154',
  line: 'rgba(255,255,255,.08)',
} as const;

/* ── data ── */
const PIPELINE = [
  { title: 'Cine MRI Ingestion', desc: 'Multi-phase 2D+time DICOM direct to GCS bucket', colour: C.lav },
  { title: 'Spatiotemporal Prep', desc: 'Isotropic in-plane resampling, z-score intensity norm', colour: C.tealDim },
  { title: 'ACDC U-Net AI', desc: 'Automated 4-class segmentation (LV, RV, Myo, BG)', colour: C.teal },
  { title: 'Volumetric Dynamics', desc: 'EDV/ESV curves, ejection fraction, stroke volume', colour: C.crimson },
  { title: 'Clinical Report', desc: '17-segment AHA bullseye report with DICOM-SR', colour: C.teal },
];

const FEATURES = [
  { tag: 'ACDC Challenge Winner', title: 'Deep U-Net segmentation', desc: 'Voxel-accurate delineation of myocardium and ventricles across cardiac cycle.', stat: 'Dice 0.92 on LV' },
  { tag: 'Hemodynamics Engine', title: 'Automated LVEF & RVEF', desc: 'Real-time calculation of end-diastolic and end-systolic volumes.', stat: '±2.1% clinical error' },
  { tag: 'AHA 17-Segment', title: 'Wall motion scoring', desc: 'Segmental myocardial strain and thickening analysis for ischemic disease.', stat: '17 regional zones' },
  { tag: 'Multi-Phase Cine', title: 'Temporal 4D tracking', desc: 'Processes 25 phases per cycle with optical flow boundary propagation.', stat: '25 frames/cycle' },
  { tag: 'XAI Attribution', title: 'Grad-CAM++ contours', desc: 'Evidence heatmaps identifying abnormal myocardial thickening regions.', stat: 'Sub-pixel heatmaps' },
  { tag: 'PACS Integration', title: 'Structured DICOM-SR', desc: 'Direct automated export to clinical PACS and cardiology reporting stations.', stat: '< 2.5s turnaround' },
];

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function CardiacEnhanced() {
  const stepsRef = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, isIamAuthenticated, addAuditLog } = useRBAC();
  const router = useRouter();
  const isAuthenticated = isIamAuthenticated;

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/cardiac');
  }, [router]);

  /* ── state ── */
  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counters, setCounters] = useState([0, 0, 0, 0]);

  /* ── workstation state ── */
  const [activeFrame, setActiveFrame] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [selectedZone, setSelectedZone] = useState('Anterior Basal');
  const [reportSigned, setReportSigned] = useState(false);

  const COUNTER_TARGETS = [92.4, 62.8, 1.6, 98.5];
  const COUNTER_SUFFIXES = ['%', '%', 's', '%'];
  const COUNTER_LABELS  = ['LV Dice accuracy', 'LVEF calculated', 'Inference latency', 'Radiologist consensus'];

  /* ── Cine player loop ── */
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveFrame((prev) => (prev >= 25 ? 1 : prev + 1));
    }, 70);
    return () => clearInterval(interval);
  }, [isPlaying]);

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

    setUploadFiles(files);
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
      setUploadError(err instanceof Error && err.message ? err.message : 'Error processing DICOM image');
      setUploadPhase('idle');
    }
  };

  const resetUpload = () => {
    setUploadPhase('idle');
    setUploadPct(0);
    setUploadFiles([]);
    setUploadError(null);
  };

  return (
    <div className="lc-page">
      <style jsx global>{`
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
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px;
          min-height: 44px; padding: 12px 22px; font-weight: 600; font-size: 15px; border: 1px solid ${C.line};
          background: rgba(255,255,255,.05); color: ${C.ink}; cursor: pointer;
          transition: background .2s, border-color .2s; text-decoration: none;
        }
        .lc-btn:hover { background: #173240; border-color: ${C.teal}; }
        .lc-btn:focus-visible, .lc-nav a:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 4px; }
        .lc-btn-p { background: ${C.coral}; border: 1px solid ${C.coral}; color: #17232E; }
        .lc-btn-p:hover { background: #FF9385; border-color: #FF9385; }
        .lc-tag { font-size: 12px; padding: 5px 10px; border-radius: 6px; background: rgba(120,185,179,.12); color: ${C.teal}; font-weight: 500; letter-spacing: .02em; }

        /* header */
        .lc-header {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          backdrop-filter: blur(16px) saturate(1.4); background: rgba(6,11,17,.8);
          border-bottom: 1px solid ${C.line};
        }
        .lc-header-inner { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 72px; padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap; }
        .lc-header-inner > div, .lc-header-inner > div > div { flex-wrap: wrap; }
        .lc-header-inner .lc-btn { white-space: nowrap; }
        .lc-brand { font: 700 20px Sora; display: flex; gap: 10px; align-items: center; text-decoration: none; color: #fff; }
        .lc-brand-icon { width: 24px; height: 24px; border-radius: 6px; background: ${C.tealDim}; }
        .lc-nav { display: flex; gap: 22px; color: ${C.teal}; font-size: 14px; }
        .lc-nav a { text-decoration: none; color: inherit; transition: color .2s; }
        .lc-nav a:hover { color: #fff; }
        @media(max-width:1100px){ .lc-nav { display: none; } }

        /* hero */
        .lc-hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 0 80px; overflow: hidden; }
        .lc-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; width: 100%; }
        .lc-hero h1 { font-size: clamp(38px, 5.2vw, 62px); }
        .lc-hero h1 em { font-style: normal; color: ${C.teal}; }
        .lc-hero-p { color: ${C.mute}; max-width: 48ch; margin: 22px 0 36px; font-size: 17px; line-height: 1.7; }
        .lc-acts { display: flex; gap: 14px; flex-wrap: wrap; }
        .lc-strip { display: flex; gap: 36px; margin-top: 44px; }
        .lc-strip-n { font: 700 30px Sora; font-variant-numeric: tabular-nums; }
        .lc-strip span { color: ${C.mute}; font-size: 13px; display: block; margin-top: 2px; }

        /* illustrative anatomy stage */
        .lc-stage { position: relative; height: 540px; min-width: 0; border-radius: 14px; background: ${C.bg2}; border: 1px solid #2A3C4B; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,.2); }

        /* upload */
        .lc-drop {
          border: 2px dashed rgba(255,65,84,.3); border-radius: 12px; padding: 56px 24px;
          text-align: center; background: rgba(255,255,255,.015); transition: all .25s;
          min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; cursor: pointer;
        }
        .lc-drop:hover, .lc-drop.over { border-color: ${C.crimson}; background: rgba(255,65,84,.04); transform: scale(1.005); }
        .lc-bar { width: min(440px, 100%); height: 8px; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
        .lc-bar-fill { height: 100%; background: ${C.teal}; border-radius: 9px; transition: width .15s; }
        .lc-spin { width: 56px; height: 56px; border-radius: 50%; border: 3px solid rgba(255,255,255,.1); border-top-color: ${C.crimson}; animation: lc-sp 1s linear infinite; }
        @keyframes lc-sp { to { transform: rotate(360deg); } }
        .lc-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; margin-top: 10px; }
        .lc-meta > div { background: rgba(255,255,255,.04); border-radius: 14px; padding: 14px; font-size: 13px; color: ${C.mute}; text-align: left; border: 1px solid rgba(255,255,255,.05); }
        .lc-meta b { display: block; color: #fff; font-size: 14px; margin-top: 2px; }

        /* pipeline */
        .lc-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .lc-step { padding: 24px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,.06); opacity: .3; transform: translateY(18px); transition: all .6s cubic-bezier(.16,1,.3,1); background: rgba(255,255,255,.02); }
        .lc-step.on { opacity: 1; transform: none; border-color: ${C.tealDim}; background: rgba(120,185,179,.04); }
        .lc-step-num { font: 700 13px Sora; margin-bottom: 12px; }
        .lc-step h3 { font-size: 18px; margin: 0 0 8px; }
        .lc-step p { margin: 0; font-size: 13px; color: ${C.mute}; line-height: 1.5; }

        /* features grid */
        .lc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .lc-page .feat-card { padding: 26px; border-radius: 12px; background: ${C.bg2}; border: 1px solid #2A3C4B; transition: border-color .2s; }
        .lc-page .feat-card:hover { border-color: ${C.tealDim}; }
        .feat-card h3 { font-size: 19px; margin-top: 14px; }
        .feat-card p { color: ${C.mute}; font-size: 14px; margin: 10px 0 18px; line-height: 1.6; }
        .feat-card small { font: 600 13px Sora; color: ${C.crimson}; }

        /* stats */
        .lc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; text-align: center; }
        .lc-stat-n { font: 700 clamp(44px, 5vw, 68px) Sora; color: #fff; line-height: 1; }
        .lc-stat-l { color: ${C.mute}; font-size: 15px; margin-top: 12px; }

        @media(max-width:900px){
          .lc-hero-grid { grid-template-columns: 1fr; }
          .lc-steps { grid-template-columns: 1fr; }
          .lc-grid { grid-template-columns: 1fr; }
          .lc-stats { grid-template-columns: repeat(2, 1fr); }
          .lc-meta { grid-template-columns: repeat(2, 1fr); }
          .lc-stage { height: 460px; }
        }
        @media(max-width:600px){ .lc-wrap { padding-left: 18px; padding-right: 18px; } .lc-hero { padding-top: 180px; } .lc-strip { gap: 18px; flex-wrap: wrap; } .lc-stage { height: 420px; } .lc-section { padding: 64px 0; } }
        @media(prefers-reduced-motion: reduce){ .lc-page *, .lc-page *::before, .lc-page *::after { animation-duration: 0s !important; transition-duration: 0s !important; } .lc-page .lc-step { opacity: 1; transform: none; } }
      `}</style>

      {/* ━━━━━ HEADER ━━━━━ */}
      <header className="lc-header">
        <div className="lc-wrap lc-header-inner">
          <Link className="lc-brand" href="/">
            <span className="lc-brand-icon" />
            MiPAAS <span style={{ fontSize: 13, color: C.mute, fontWeight: 400 }}>· Cardiac AI</span>
          </Link>
          <nav className="lc-nav">
            <a href="#upload">Upload Cine</a>
            <a href="#pipeline">Pipeline</a>
            <a href="#features">Capabilities</a>
            <a href="#clinical-station">Workstation</a>
            <a href="#stats">Hemodynamics</a>
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
              <span className="lc-tag">ACDC U-Net · Cardiac Cine MRI</span>
              <h1 style={{ marginTop: 18 }}>
                AI Ventricular <em>Segmentation & Ejection</em> Fraction.
              </h1>
              <p className="lc-hero-p">
                Automated 4-chamber cardiac cine MRI volumetric analysis. Segment Left Ventricle, Right Ventricle, and Myocardium with temporal motion tracking and 17-segment AHA wall strain quantification.
              </p>
              <div className="lc-acts">
                <a className="lc-btn lc-btn-p" href="#upload">
                  <Activity style={{ width: 16, height: 16 }} />
                  Analyze Cine MRI
                </a>
                <a className="lc-btn" href="#pipeline">See how it works</a>
              </div>
              <div className="lc-strip">
                <div>
                  <div className="lc-strip-n" style={{ color: C.crimson }}>0.92</div>
                  <span>LV Cavity Dice</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.teal }}>25</div>
                  <span>Phases / cycle</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.gold }}>&lt; 1.6s</div>
                  <span>Inference latency</span>
                </div>
              </div>
            </div>

            <div className="lc-stage">
              <AnatomyViewer kind="heart" />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━ UPLOAD SECTION ━━━━━ */}
      <section id="upload" className="lc-section lc-alt">
        <div className="lc-wrap">
          <h2 className="lc-h2">Upload Short-Axis Cine MRI</h2>
          <p className="lc-sub">Drop multi-phase DICOM files (.dcm) or NIfTI (.nii.gz) for automated ventricular volumetric modeling.</p>

          {uploadError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '14px 18px',
              borderRadius: 12,
              marginBottom: 20,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>{uploadError}</span>
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
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,65,84,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Heart style={{ width: 28, height: 28, color: C.crimson }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 20 }}>Drag and drop cardiac study here</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Or click to browse · Supports DICOM series & Cine NIfTI</div>
              </>
            )}

            {uploadPhase === 'uploading' && (
              <>
                <h3 style={{ margin: 0, fontSize: 20 }}>Uploading series ({uploadPct}%)</h3>
                <div className="lc-bar">
                  <div className="lc-bar-fill" style={{ width: `${uploadPct}%` }} />
                </div>
              </>
            )}

            {uploadPhase === 'processing' && (
              <>
                <div className="lc-spin" />
                <h3 style={{ margin: 0, fontSize: 20 }}>Spatiotemporal Processing</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Interpolating 25 cardiac phases · Segmenting myocardium</div>
              </>
            )}

            {uploadPhase === 'done' && (
              <>
                <h3 style={{ margin: 0, fontSize: 20, color: C.teal }}>✓ Cine MRI ready</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Study #CARDIAC-CINE-802 · 25 phases aligned</div>
                <div className="lc-acts">
                  <button className="lc-btn" onClick={(e) => { e.stopPropagation(); resetUpload(); }}>Replace</button>
                  <a className="lc-btn lc-btn-p" href="#clinical-station" onClick={(e) => e.stopPropagation()}>
                    Inspect in Workstation →
                  </a>
                </div>
                <div className="lc-meta">
                  <div>Modality<b>MRI CINE</b></div>
                  <div>Phases<b>25 phases</b></div>
                  <div>Resolution<b>256 × 256 px</b></div>
                  <div>Protocol<b>Short-Axis LV/RV</b></div>
                </div>
              </>
            )}
          </div>

          <input ref={fileRef} type="file" accept=".dcm,.dicom,.nii,.nii.gz,.zip" multiple hidden onChange={(e) => e.target.files && startUpload([...e.target.files])} />
          <p style={{ fontSize: 13, color: C.mute, textAlign: 'center', marginTop: 18 }}>
            🔒 HIPAA-compliant · De-identified in memory · End-to-end encrypted
          </p>
        </div>
      </section>

      {/* ━━━━━ PIPELINE ━━━━━ */}
      <section id="pipeline" className="lc-section">
        <div className="lc-wrap">
          <h2 className="lc-h2">Hemodynamic processing pipeline</h2>
          <p className="lc-sub">Five stages from raw cine DICOM series to 17-segment wall motion analysis.</p>
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
          <h2 className="lc-h2">Cardiovascular AI & Deep Learning Stack</h2>
          <p className="lc-sub">High-precision ventricular volumetrics validated against gold-standard manual radiologist contours.</p>
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
          <h2 className="lc-h2">Clinical-grade accuracy benchmarks</h2>
          <p className="lc-sub">Evaluated on ACDC benchmark and multi-vendor MRI datasets (Siemens, Philips, GE).</p>
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
              <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', color: C.crimson }}>
                Interactive Workstation
              </span>
              <h2 className="lc-h2" style={{ margin: '6px 0 0' }}>Cardiac Cine Volumetric Console</h2>
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
                  Sign In for PACS Export
                </button>
              )}
            </div>
          </div>
          <p className="lc-sub" style={{ marginBottom: 36 }}>
            Scrub through 25 cardiac cycle phases, inspect automated Left Ventricle (LV), Myocardium, and Right Ventricle (RV) contours.
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
            {/* Header info */}
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
                    background: 'rgba(255, 65, 84, 0.15)',
                    border: '1px solid rgba(255, 65, 84, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Heart style={{ width: 18, height: 18, color: C.crimson }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    Study #CINE-2026-LV4 · Short-Axis Mid-Ventricular Slice
                  </div>
                  <div style={{ fontSize: 12, color: C.mute }}>
                    Cardiac MRI 1.5T · TR 42ms · TE 1.3ms · FOV 340mm
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="lc-btn"
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  {isPlaying ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
                  <span>{isPlaying ? 'Pause Cine' : 'Play Cine'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowContours((p) => !p)}
                  className="lc-btn"
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    borderColor: showContours ? C.crimson : 'rgba(255,255,255,0.1)',
                    color: showContours ? C.crimson : C.mute,
                  }}
                >
                  <Layers style={{ width: 13, height: 13 }} />
                  <span>Contours: {showContours ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                gap: 24,
                marginTop: 24,
              }}
            >
              {/* Left Column: Simulated Cine Canvas */}
              <div>
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 20,
                    overflow: 'hidden',
                    background: '#04070B',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Simulated Cine MRI Slice */}
                  <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
                    {/* Background thoracic tissue noise */}
                    <rect width="300" height="300" fill="#080e14" />
                    <circle cx="150" cy="150" r="120" fill="#101922" />

                    {/* Contraction scaling factor */}
                    {(() => {
                      const phaseAngle = ((activeFrame - 1) / 25) * Math.PI * 2;
                      const contraction = (Math.cos(phaseAngle) + 1) / 2; // 1 = End Diastole (large), 0 = End Systole (small)
                      const lvRadius = 38 + contraction * 18;
                      const myoThickness = 16 - contraction * 4;

                      return (
                        <>
                          {/* Right Ventricle Crescent (Teal) */}
                          <path
                            d={`M ${150 - lvRadius - 12} ${150 - 45} A ${lvRadius + 28} ${lvRadius + 28} 0 0 0 ${150 - lvRadius - 12} ${150 + 45} A ${lvRadius + 8} ${lvRadius + 8} 0 0 1 ${150 - lvRadius - 12} ${150 - 45} Z`}
                            fill={showContours ? 'rgba(0, 220, 206, 0.22)' : 'none'}
                            stroke={showContours ? '#00DCCE' : '#2A3C4D'}
                            strokeWidth={showContours ? '2' : '1'}
                          />

                          {/* Epicardium / Myocardium Ring (Green) */}
                          <circle
                            cx="150"
                            cy="150"
                            r={lvRadius + myoThickness}
                            fill={showContours ? 'rgba(124, 92, 252, 0.18)' : '#182430'}
                            stroke={showContours ? '#7C5CFC' : '#324558'}
                            strokeWidth={showContours ? '2' : '1.5'}
                          />

                          {/* Endocardium / Left Ventricle Cavity (Red/Crimson) */}
                          <circle
                            cx="150"
                            cy="150"
                            r={lvRadius}
                            fill={showContours ? 'rgba(255, 65, 84, 0.35)' : '#0e1620'}
                            stroke={showContours ? '#FF4154' : '#45596D'}
                            strokeWidth={showContours ? '2.5' : '1.5'}
                          />

                          {/* Papillary Muscles */}
                          <circle cx={150 + lvRadius * 0.45} cy={150 + lvRadius * 0.35} r="7" fill="#7C5CFC" opacity="0.6" />
                          <circle cx={150 - lvRadius * 0.35} cy={150 + lvRadius * 0.45} r="6" fill="#7C5CFC" opacity="0.6" />
                        </>
                      );
                    })()}
                  </svg>

                  {/* HUD Overlay */}
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
                    <div>PHASE: <span style={{ color: C.crimson, fontWeight: 700 }}>{activeFrame} / 25</span> ({activeFrame < 9 ? 'SYSTOLE' : 'DIASTOLE'})</div>
                    <div>HR: <span style={{ color: '#fff' }}>68 bpm</span> · R-R: <span style={{ color: '#fff' }}>882 ms</span></div>
                  </div>

                  <div
                    style={{
                      position: 'absolute',
                      bottom: 14,
                      right: 14,
                      display: 'flex',
                      gap: 8,
                      fontSize: 11,
                    }}
                  >
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,65,84,0.2)', color: C.crimson, border: '1px solid rgba(255,65,84,0.4)', fontWeight: 600 }}>LV Cavity</span>
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(124,92,252,0.2)', color: C.violet, border: '1px solid rgba(124,92,252,0.4)', fontWeight: 600 }}>Myocardium</span>
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(0,220,206,0.2)', color: C.teal, border: '1px solid rgba(0,220,206,0.4)', fontWeight: 600 }}>RV Cavity</span>
                  </div>
                </div>

                {/* Timeline Scrubber */}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: C.mute, minWidth: 60 }}>Phase {activeFrame}:</span>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={activeFrame}
                    onChange={(e) => { setIsPlaying(false); setActiveFrame(Number(e.target.value)); }}
                    style={{ flex: 1, accentColor: C.crimson, cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    onClick={() => { setActiveFrame(1); setIsPlaying(true); }}
                    style={{ background: 'none', border: 'none', color: C.mute, cursor: 'pointer', padding: 4 }}
                    title="Reset to Phase 1"
                  >
                    <RotateCcw style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>

              {/* Right Column: Quantitative Hemodynamic Findings */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.mute, marginBottom: 8 }}>
                    Automated Ventricular Volumetrics
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,65,84,0.1)', border: '1px solid rgba(255,65,84,0.25)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>Left Ventricle EF</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 2 }}>62.8%</div>
                      <div style={{ fontSize: 11, color: C.teal, marginTop: 4 }}>Normal (&gt; 55%)</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(0,220,206,0.08)', border: '1px solid rgba(0,220,206,0.2)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>Right Ventricle EF</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 2 }}>54.1%</div>
                      <div style={{ fontSize: 11, color: C.teal, marginTop: 4 }}>Normal (&gt; 45%)</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>End-Diastolic Vol (EDV)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 2 }}>142 mL</div>
                      <div style={{ fontSize: 11, color: C.mute, marginTop: 4 }}>Indexed: 78 mL/m²</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>End-Systolic Vol (ESV)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 2 }}>53 mL</div>
                      <div style={{ fontSize: 11, color: C.mute, marginTop: 4 }}>Stroke Vol: 89 mL</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Myocardial Mass (ED):</span>
                      <strong style={{ color: C.violet }}>118 g (Normal)</strong>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span>Global Longitudinal Strain (GLS):</span>
                      <strong style={{ color: C.teal }}>-18.5% (Preserved)</strong>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                  {reportSigned ? (
                    <div style={{ padding: '12px', borderRadius: 14, background: 'rgba(0,220,206,0.1)', border: '1px solid rgba(0,220,206,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 style={{ width: 18, height: 18, color: C.teal }} />
                      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                        Signed off & exported to Cardiology PACS (DICOM-SR #SR-8024)
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
                      <span>{isAuthenticated ? 'Verify & Sign-off Cardiac Report' : 'Sign In to Authorize Report'}</span>
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
              <Link href="/lung-cancer" className="lc-btn" style={{ fontSize: 13 }}>qCT Lung (Lung Cancer) →</Link>
              <Link href="/brain-tumor" className="lc-btn" style={{ fontSize: 13 }}>qBrain (Brain Tumor) →</Link>
              <Link href="/qxr" className="lc-btn" style={{ fontSize: 13 }}>qXR (Chest Radiography) →</Link>
              <Link href="/stroke" className="lc-btn" style={{ fontSize: 13 }}>qStroke (Stroke Care) →</Link>
              <Link href="/tb" className="lc-btn" style={{ fontSize: 13 }}>qTrack (TB Screening) →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
