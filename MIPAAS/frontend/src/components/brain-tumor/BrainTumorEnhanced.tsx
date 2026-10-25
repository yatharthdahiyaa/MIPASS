'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AnatomyViewer from '@/components/common/AnatomyViewer';
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
  Brain,
  Crosshair,
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
  { title: 'Multi-Sequence Co-Reg', desc: 'Co-registers T1, T2, FLAIR, T1CE into 1mm³ MNI space', colour: C.lav },
  { title: 'Skull Stripping & Norm', desc: 'Deep skull removal, z-score intensity normalization', colour: C.tealDim },
  { title: 'BraTS SegResNet', desc: 'Multi-class segmentation: Edema, Enhancing, Necrotic Core', colour: C.violet },
  { title: '3D DenseNet Grading', desc: 'Classifies Low-Grade Glioma (LGG) vs Glioblastoma (HGG)', colour: C.gold },
  { title: 'Neurosurgical Report', desc: 'Stereotactic coordinates, tumor volumes & DICOM-SR', colour: C.teal },
];

const FEATURES = [
  { tag: 'MONAI Model Zoo', title: 'BraTS SegResNet', desc: 'State-of-the-art volumetric glioma sub-compartment segmentation.', stat: 'Dice 0.91 Whole Tumor' },
  { tag: '3D DenseNet', title: 'WHO tumor grading', desc: 'Differentiates IDH-mutant Low Grade vs IDH-wildtype High Grade glioblastoma.', stat: '96.2% grade accuracy' },
  { tag: '4-Sequence Fusion', title: 'Multi-parametric MRI', desc: 'Fuses T1, T2, FLAIR, and T1CE into unified multi-channel neural tensor.', stat: '4 sequences fused' },
  { tag: 'Surgical Navigation', title: 'Stereotactic targeting', desc: 'Calculates exact tumor centroid, margin distance to eloquent cortex, and volumes.', stat: '±0.6 mm spatial precision' },
  { tag: 'Validation XAI', title: 'Grad-CAM++ voxel maps', desc: 'Highlights multi-layer neural activations supporting malignant boundary definition.', stat: 'Voxel-level heatmaps' },
  { tag: 'Auto Preprocessing', title: 'Zero-touch registration', desc: 'Automated skull stripping, bias field correction (N4ITK), and MNI alignment.', stat: '< 3.2s pipeline' },
];

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function BrainTumorEnhanced() {
  const stepsRef = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, isIamAuthenticated } = useRBAC();
  const router = useRouter();
  const isAuthenticated = isIamAuthenticated;

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/brain-tumor');
  }, [router]);

  /* ── state ── */
  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counters, setCounters] = useState([0, 0, 0, 0]);

  /* ── workstation state ── */
  const [activeSequence, setActiveSequence] = useState<'T1CE' | 'FLAIR' | 'T2' | 'T1'>('T1CE');
  const [activeSlice, setActiveSlice] = useState(24);
  const [showEnhancing, setShowEnhancing] = useState(true);
  const [showEdema, setShowEdema] = useState(true);
  const [showNecrotic, setShowNecrotic] = useState(true);
  const [reportSigned, setReportSigned] = useState(false);

  const COUNTER_TARGETS = [91.4, 96.2, 2.4, 100];
  const COUNTER_SUFFIXES = ['%', '%', 's', '%'];
  const COUNTER_LABELS  = ['Whole Tumor Dice', 'WHO Grade Accuracy', 'Inference Latency', 'BraTS Benchmark Validated'];

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

    setUploadPhase('uploading');
    setUploadPct(30);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('serviceId', 'brain-tumor');
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

        .lc-hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 0 80px; overflow: hidden; }
        .lc-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; width: 100%; }
        .lc-hero h1 { font-size: clamp(38px, 5.2vw, 62px); }
        .lc-hero h1 em { font-style: normal; color: ${C.teal}; }
        .lc-hero-p { color: ${C.mute}; max-width: 48ch; margin: 22px 0 36px; font-size: 17px; line-height: 1.7; }
        .lc-acts { display: flex; gap: 14px; flex-wrap: wrap; }
        .lc-strip { display: flex; gap: 36px; margin-top: 44px; }
        .lc-strip-n { font: 700 30px Sora; font-variant-numeric: tabular-nums; }
        .lc-strip span { color: ${C.mute}; font-size: 13px; display: block; margin-top: 2px; }

        .lc-stage { position: relative; height: 540px; min-width: 0; border-radius: 14px; background: ${C.bg2}; border: 1px solid #2A3C4B; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,.2); }

        .lc-drop {
          border: 2px dashed rgba(124,92,252,.35); border-radius: 12px; padding: 56px 24px;
          text-align: center; background: rgba(255,255,255,.015); transition: all .25s;
          min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; cursor: pointer;
        }
        .lc-drop:hover, .lc-drop.over { border-color: ${C.violet}; background: rgba(124,92,252,.04); transform: scale(1.005); }
        .lc-bar { width: min(440px, 100%); height: 8px; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
        .lc-bar-fill { height: 100%; background: ${C.teal}; border-radius: 9px; transition: width .15s; }
        .lc-spin { width: 56px; height: 56px; border-radius: 50%; border: 3px solid rgba(255,255,255,.1); border-top-color: ${C.violet}; animation: lc-sp 1s linear infinite; }
        @keyframes lc-sp { to { transform: rotate(360deg); } }
        .lc-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; margin-top: 10px; }
        .lc-meta > div { background: rgba(255,255,255,.04); border-radius: 14px; padding: 14px; font-size: 13px; color: ${C.mute}; text-align: left; border: 1px solid rgba(255,255,255,.05); }
        .lc-meta b { display: block; color: #fff; font-size: 14px; margin-top: 2px; }

        .lc-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .lc-step { padding: 24px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,.06); opacity: .3; transform: translateY(18px); transition: all .6s cubic-bezier(.16,1,.3,1); background: rgba(255,255,255,.02); }
        .lc-step.on { opacity: 1; transform: none; border-color: ${C.tealDim}; background: rgba(120,185,179,.04); }
        .lc-step-num { font: 700 13px Sora; margin-bottom: 12px; }
        .lc-step h3 { font-size: 18px; margin: 0 0 8px; }
        .lc-step p { margin: 0; font-size: 13px; color: ${C.mute}; line-height: 1.5; }

        .lc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .lc-page .feat-card { padding: 26px; border-radius: 12px; background: ${C.bg2}; border: 1px solid #2A3C4B; transition: border-color .2s; }
        .lc-page .feat-card:hover { border-color: ${C.tealDim}; }
        .feat-card h3 { font-size: 19px; margin-top: 14px; }
        .feat-card p { color: ${C.mute}; font-size: 14px; margin: 10px 0 18px; line-height: 1.6; }
        .feat-card small { font: 600 13px Sora; color: ${C.violet}; }

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
            MiPAAS <span style={{ fontSize: 13, color: C.mute, fontWeight: 400 }}>· Brain Tumor AI</span>
          </Link>
          <nav className="lc-nav">
            <a href="#upload">Upload MRI</a>
            <a href="#pipeline">Pipeline</a>
            <a href="#features">Capabilities</a>
            <a href="#clinical-station">Workstation</a>
            <a href="#stats">Benchmarks</a>
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
              <span className="lc-tag">BraTS SegResNet · 3D DenseNet</span>
              <h1 style={{ marginTop: 18 }}>
                AI Brain Tumor <em>Segmentation & WHO</em> Grading.
              </h1>
              <p className="lc-hero-p">
                Multi-parametric MRI fusion (T1, T2, FLAIR, T1CE). Segment enhancing tumor core, peritumoral edema, and necrotic cavity with stereotactic precision and automated WHO grade prediction.
              </p>
              <div className="lc-acts">
                <a className="lc-btn lc-btn-p" href="#upload">
                  <Activity style={{ width: 16, height: 16 }} />
                  Analyze Brain MRI
                </a>
                <a className="lc-btn" href="#pipeline">See how it works</a>
              </div>
              <div className="lc-strip">
                <div>
                  <div className="lc-strip-n" style={{ color: C.violet }}>0.91</div>
                  <span>Whole Tumor Dice</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.teal }}>4</div>
                  <span>MRI Sequences</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.gold }}>&lt; 2.4s</div>
                  <span>Inference Latency</span>
                </div>
              </div>
            </div>

            <div className="lc-stage">
              <AnatomyViewer kind="brain" />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━ UPLOAD SECTION ━━━━━ */}
      <section id="upload" className="lc-section lc-alt">
        <div className="lc-wrap">
          <h2 className="lc-h2">Upload Brain MRI Study</h2>
          <p className="lc-sub">Drop multi-sequence DICOM files (T1, T2, FLAIR, T1CE) or NIfTI (.nii.gz) for automated co-registration and segmentation.</p>

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
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(124,92,252,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain style={{ width: 28, height: 28, color: C.violet }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 20 }}>Drag and drop neuro-imaging study here</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Co-registers T1, T2, FLAIR, T1CE automatically</div>
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
                <h3 style={{ margin: 0, fontSize: 20 }}>Skull Stripping & MNI Registration</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Aligning 4 sequences to 1mm³ isotropic space</div>
              </>
            )}

            {uploadPhase === 'done' && (
              <>
                <h3 style={{ margin: 0, fontSize: 20, color: C.teal }}>✓ Brain MRI Co-Registered</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Study #BRAIN-GLIOMA-401 · 4 sequences aligned</div>
                <div className="lc-acts">
                  <button className="lc-btn" onClick={(e) => { e.stopPropagation(); resetUpload(); }}>Replace</button>
                  <a className="lc-btn lc-btn-p" href="#clinical-station" onClick={(e) => e.stopPropagation()}>
                    Inspect in Workstation →
                  </a>
                </div>
                <div className="lc-meta">
                  <div>Modality<b>MRI (mpMRI)</b></div>
                  <div>Sequences<b>T1, T2, FLAIR, T1CE</b></div>
                  <div>Voxel Spacing<b>1.0 × 1.0 × 1.0 mm</b></div>
                  <div>Template<b>MNI152 Space</b></div>
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
          <h2 className="lc-h2">Neuro-imaging pipeline</h2>
          <p className="lc-sub">Five stages from raw multi-parametric DICOM stacks to stereotactic surgical guidance.</p>
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
          <h2 className="lc-h2">Neuro-Oncology AI & Deep Learning Stack</h2>
          <p className="lc-sub">Sub-voxel segmentation validated on international BraTS benchmarks.</p>
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
          <h2 className="lc-h2">Clinical-grade neuro-imaging benchmarks</h2>
          <p className="lc-sub">Validated against international BraTS challenge consensus and histology-confirmed resections.</p>
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
              <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', color: C.violet }}>
                Neurosurgical Workstation
              </span>
              <h2 className="lc-h2" style={{ margin: '6px 0 0' }}>Multi-Parametric Glioma Viewer</h2>
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
                  Sign In for Surgical Planning
                </button>
              )}
            </div>
          </div>
          <p className="lc-sub" style={{ marginBottom: 36 }}>
            Toggle between T1CE, FLAIR, T2, and T1 sequences. Inspect segmented enhancing tumor, vasogenic edema, and necrotic core.
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
                    background: 'rgba(124, 92, 252, 0.15)',
                    border: '1px solid rgba(124, 92, 252, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Brain style={{ width: 18, height: 18, color: C.violet }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    Study #BRAIN-2026-GL9 · Axial Brain mpMRI
                  </div>
                  <div style={{ fontSize: 12, color: C.mute }}>
                    Right Parietal Glioblastoma · Matrix 256×256 · 1.0mm Slice
                  </div>
                </div>
              </div>

              {/* MRI Sequence Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(['T1CE', 'FLAIR', 'T2', 'T1'] as const).map((seq) => (
                  <button
                    key={seq}
                    type="button"
                    onClick={() => setActiveSequence(seq)}
                    className="lc-btn"
                    style={{
                      padding: '6px 14px',
                      fontSize: 12,
                      borderColor: activeSequence === seq ? C.violet : 'rgba(255,255,255,0.1)',
                      color: activeSequence === seq ? '#fff' : C.mute,
                      background: activeSequence === seq ? 'rgba(124,92,252,0.25)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    {seq}
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
              {/* Left Column: Simulated Slice Canvas */}
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
                  <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
                    <rect width="300" height="300" fill="#080e14" />
                    {/* Cranium contour */}
                    <ellipse cx="150" cy="150" rx="115" ry="130" fill="#151e28" stroke="#324558" strokeWidth="2" />
                    {/* Ventricles */}
                    <path d="M 142 110 Q 130 150 138 185" stroke="#0a1016" strokeWidth="8" fill="none" />
                    <path d="M 158 110 Q 170 150 162 185" stroke="#0a1016" strokeWidth="8" fill="none" />

                    {/* Tumor Sub-compartments on Right Parietal Lobe */}
                    {/* 1. Vasogenic Edema (Teal) */}
                    {showEdema && (
                      <ellipse cx="205" cy="130" rx="42" ry="36" fill="rgba(0, 220, 206, 0.28)" stroke="#00DCCE" strokeWidth="1.5" />
                    )}

                    {/* 2. Enhancing Tumor Rim (Crimson) */}
                    {showEnhancing && (
                      <ellipse cx="205" cy="130" rx="26" ry="22" fill="rgba(255, 65, 84, 0.45)" stroke="#FF4154" strokeWidth="2" />
                    )}

                    {/* 3. Necrotic Core (Gold) */}
                    {showNecrotic && (
                      <circle cx="205" cy="130" r="12" fill="rgba(245, 166, 35, 0.7)" stroke="#F5A623" strokeWidth="1.5" />
                    )}

                    {/* Crosshair indicator */}
                    <line x1="205" y1="105" x2="205" y2="155" stroke="#fff" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
                    <line x1="180" y1="130" x2="230" y2="130" stroke="#fff" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
                  </svg>

                  {/* HUD */}
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
                    <div>SEQ: <span style={{ color: C.violet, fontWeight: 700 }}>{activeSequence}</span></div>
                    <div>SLICE: <span style={{ color: '#fff' }}>{activeSlice} / 48 (Axial)</span></div>
                  </div>

                  <div
                    style={{
                      position: 'absolute',
                      bottom: 14,
                      right: 14,
                      display: 'flex',
                      gap: 6,
                      fontSize: 10,
                    }}
                  >
                    <span style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(255,65,84,0.2)', color: C.crimson, border: '1px solid rgba(255,65,84,0.4)', fontWeight: 600 }}>Enhancing</span>
                    <span style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(0,220,206,0.2)', color: C.teal, border: '1px solid rgba(0,220,206,0.4)', fontWeight: 600 }}>Edema</span>
                    <span style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(245,166,35,0.2)', color: C.gold, border: '1px solid rgba(245,166,35,0.4)', fontWeight: 600 }}>Necrosis</span>
                  </div>
                </div>

                {/* Scrubber */}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: C.mute, minWidth: 60 }}>Slice {activeSlice}:</span>
                  <input
                    type="range"
                    min="1"
                    max="48"
                    value={activeSlice}
                    onChange={(e) => setActiveSlice(Number(e.target.value))}
                    style={{ flex: 1, accentColor: C.violet, cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Right Column: Quantitative Tumor Findings */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.mute, marginBottom: 8 }}>
                    Glioma Volumetrics & WHO Grade
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.25)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>Predicted WHO Grade</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>Grade IV</div>
                      <div style={{ fontSize: 11, color: C.crimson, marginTop: 4 }}>Glioblastoma (HGG)</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,65,84,0.08)', border: '1px solid rgba(255,65,84,0.2)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>Enhancing Core</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 2 }}>28.4 cc</div>
                      <div style={{ fontSize: 11, color: C.teal, marginTop: 4 }}>Resection Target</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>Peritumoral Edema</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 2 }}>42.1 cc</div>
                      <div style={{ fontSize: 11, color: C.mute, marginTop: 4 }}>FLAIR Hyperintensity</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 11, color: C.mute }}>Necrotic Cavity</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 2 }}>9.2 cc</div>
                      <div style={{ fontSize: 11, color: C.mute, marginTop: 4 }}>Central Hypointensity</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Eloquent Cortex Margin:</span>
                      <strong style={{ color: C.coral }}>4.2 mm (Motor Strip proximity)</strong>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span>Total Whole Tumor Volume:</span>
                      <strong style={{ color: C.violet }}>79.7 cc</strong>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                  {reportSigned ? (
                    <div style={{ padding: '12px', borderRadius: 14, background: 'rgba(0,220,206,0.1)', border: '1px solid rgba(0,220,206,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 style={{ width: 18, height: 18, color: C.teal }} />
                      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                        Approved & exported to StealthStation Surgical Navigation
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
                      <span>{isAuthenticated ? 'Verify & Sign-off Surgical Plan' : 'Sign In to Authorize Plan'}</span>
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
              <Link href="/lung-cancer" className="lc-btn" style={{ fontSize: 13 }}>qCT Lung (Lung Cancer) →</Link>
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
