'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRBAC } from '@/context/RBACContext';
import { ROLE_DEFINITIONS } from '@/types/rbac';
import {
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
  FileText,
  Upload,
  ArrowLeft,
  LayoutDashboard,
  Clock,
  Check,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import AnatomyViewer from '@/components/common/AnatomyViewer';

/* ── colour tokens ── */
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

/* ── clinical pipeline stages ── */
const PIPELINE = [
  { title: 'Radiograph Intake & Quality Check', desc: 'DICOM validation verifying patient orientation (PA/AP), exposure, and inspiration', colour: C.lav },
  { title: 'Thoracic Contrast Calibration', desc: 'Adaptive contrast optimization highlighting subtle parenchymal and pleural details', colour: C.tealDim },
  { title: 'Multi-Zone Pathology Screening', desc: 'Simultaneous evaluation across 14 thoracic conditions with clinical thresholding', colour: C.teal },
  { title: 'Radiological Focus Mapping', desc: 'High-contrast focal overlays identifying consolidation, effusion, and cardiac margins', colour: C.coral },
  { title: 'Physician Diagnostic Report', desc: 'Standardized findings with ICD-10 coding, PACS C-STORE push, and doctor sign-off', colour: C.teal },
];

/* ── clinical capabilities ── */
const FEATURES = [
  { tag: 'Comprehensive Screening', title: '14 Thoracic Pathologies', desc: 'Automated screening for pneumonia, atelectasis, pneumothorax, cardiomegaly, and effusion.', stat: '14 simultaneous markers' },
  { tag: 'Decision Support', title: 'Radiological Focus Maps', desc: 'High-definition focal overlays pinpointing exact opacity, infiltration, and pleural regions.', stat: 'Sub-pixel localization' },
  { tag: 'Critical Care Triage', title: 'Rapid Acute Prioritization', desc: 'Immediately identifies life-threatening tension pneumothorax and massive effusion in under 2s.', stat: '98.4% sensitivity' },
  { tag: 'Multi-Center Validated', title: 'Clinical Hospital Cohorts', desc: 'Benchmarked and validated against consensus panels of certified board radiologists.', stat: 'Exceeds radiologist avg' },
  { tag: 'Care Coordination', title: 'STAT Alert Routing', desc: 'Auto-generates priority notifications routed straight to emergency workstations.', stat: '< 2.8s turnaround' },
  { tag: 'PACS & EHR Native', title: 'Certified Report Export', desc: 'Secondary capture overlays and structured DICOM-SR reports transmitted with zero latency.', stat: 'Standard C-STORE compatible' },
];


type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function QXRPage() {
  const stepsRef = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, isIamAuthenticated } = useRBAC();
  const router = useRouter();
  const isAuthenticated = isIamAuthenticated;

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/qxr');
  }, [router]);

  /* ── state ── */
  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counters, setCounters] = useState([0, 0, 0, 0]);


  const COUNTER_TARGETS = [98.4, 14, 2.8, 94.2];
  const COUNTER_SUFFIXES = ['%', '', 's', '%'];
  const COUNTER_LABELS  = ['Pneumothorax Sensitivity', 'Screened Pathologies', 'Screening Turnaround', 'Diagnostic Reliability'];

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

    // CHEST X-RAY INPUT: ACCEPTS DICOM (.dcm, .dicom), PNG, and JPEG/JPG
    const validExtensions = ['.dcm', '.dicom', '.png', '.jpg', '.jpeg', '.webp'];
    const isValid = validExtensions.some((ext) => name.endsWith(ext));

    if (!isValid) {
      setUploadError(
        `File "${file.name}" was rejected. Please upload a Chest X-Ray in DICOM (.dcm / .dicom) or standard image (.png, .jpg, .jpeg) format.`
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
        throw new Error(json.error?.message || 'Chest X-Ray processing failed on trained model');
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
      setUploadError(err instanceof Error && err.message ? err.message : 'Error processing Chest X-Ray image');
      setUploadPhase('idle');
    }
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
        .lc-spin { width: 56px; height: 56px; border-radius: 50%; border: 3px solid rgba(255,255,255,.1); border-top-color: ${C.teal}; animation: lc-sp 1s linear infinite; }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link className="lc-brand" href="/">
              <span className="lc-brand-icon" />
              MiPAAS
            </Link>
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(125, 183, 176, 0.12)', color: C.teal, fontWeight: 600 }}>
              Chest Radiography (CXR)
            </span>
          </div>

          <nav className="lc-nav">
            <a href="#upload">Upload CXR</a>
            <a href="#pipeline">Clinical Stages</a>
            <a href="#features">Capabilities</a>
            <a href="#clinical-station">Workstation</a>
            <a href="#stats">Accuracy</a>
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
              style={{ padding: '8px 14px', fontSize: 13, gap: 6, borderColor: 'rgba(125, 183, 176, 0.4)', color: C.teal }}
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
                  <span>{currentUser.name.split(',')[0]}</span>
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
      <section className="lc-hero">
        <div className="lc-wrap">
          <div className="lc-hero-grid">
            <div>
              <span className="lc-tag" style={{ display: 'inline-block', marginBottom: 16 }}>
                Digital Chest Radiography (CXR) · Thoracic Diagnostic Protocol
              </span>
              <h1 style={{ marginTop: 6 }}>
                Comprehensive Chest Radiography &{' '}
                <em>Thoracic Screening</em>
              </h1>
              <p className="lc-hero-p">
                Accredited radiographic assessment for 14 core thoracic pathologies including pneumothorax, bacterial consolidation, cardiomegaly, and pleural effusion with certified decision-support findings.
              </p>
              <div className="lc-acts">
                <a className="lc-btn lc-btn-p" href="#upload">
                  <Upload style={{ width: 16, height: 16 }} />
                  Upload Radiograph
                </a>
                <a className="lc-btn" href="#clinical-station">
                  Clinical Workstation
                </a>
                <Link href="/emr" className="lc-btn" style={{ borderColor: 'rgba(125, 183, 176, 0.4)', color: C.teal }}>
                  <LayoutDashboard style={{ width: 15, height: 15 }} />
                  Dashboard
                </Link>
              </div>
              <div className="lc-strip">
                <div>
                  <div className="lc-strip-n" style={{ color: C.teal }}>98.4%</div>
                  <span>Pneumothorax Sens</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.coral }}>14</div>
                  <span>Core Pathologies</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.gold }}>&lt; 2.8s</div>
                  <span>Screening Turnaround</span>
                </div>
              </div>
            </div>

            {/* Illustrative pulmonary anatomy */}
            <div className="lc-stage">
              <AnatomyViewer kind="lungs" />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━ UPLOAD SECTION ━━━━━ */}
      <section id="upload" className="lc-section lc-alt">
        <div className="lc-wrap">
          <h2 className="lc-h2">Upload Frontal Chest Radiograph</h2>
          <p className="lc-sub">
            Upload standard chest radiographs (PA/AP view) for immediate multi-pathology screening and clinical decision support.
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
                    boxShadow: '0 0 0 4px rgba(125, 183, 176, 0.2)',
                  }}
                >
                  {uploadPhase === 'done' ? <Check style={{ width: 18, height: 18, strokeWidth: 3 }} /> : '1'}
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.teal, marginTop: 8 }}>Upload Radiograph</span>
                <span style={{ fontSize: 11, color: C.mute }}>Select CXR scan or image</span>
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
                  Pathology Screening
                </span>
                <span style={{ fontSize: 11, color: C.mute }}>Multi-zone thoracic evaluation</span>
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

          {uploadError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', padding: '14px 18px', borderRadius: 14, marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span>{uploadError}</span>
              </div>
              <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

          {/* Dashed Upload Box */}
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
            style={{ padding: '44px 24px', background: 'rgba(16, 35, 51, 0.7)' }}
          >
            {uploadPhase === 'idle' && (
              <>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(125, 183, 176, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.teal, marginBottom: 4 }}>
                  <Upload style={{ width: 30, height: 30 }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>
                  Click to upload or drag and drop your chest radiograph
                </h3>
                <div style={{ color: C.mute, fontSize: 14, maxWidth: 540 }}>
                  Upload digital chest X-rays in standard clinical formats. Scans are de-identified and screened against 14 thoracic pathologies.
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
                  Supported formats: <strong style={{ color: '#fff' }}>DICOM (.dcm, .dicom), PNG, JPG, JPEG</strong> · Max 100 MB
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
                    <span>Choose Radiograph</span>
                  </button>


                  <Link
                    href="/emr"
                    className="lc-btn"
                    onClick={(e) => e.stopPropagation()}
                    style={{ padding: '12px 24px', fontSize: 14, borderColor: 'rgba(125, 183, 176, 0.4)', color: C.teal }}
                  >
                    <LayoutDashboard style={{ width: 16, height: 16 }} />
                    <span>Dashboard</span>
                  </Link>
                </div>
              </>
            )}

            {uploadPhase === 'uploading' && (
              <>
                <h3 style={{ margin: 0, fontSize: 20 }}>Uploading radiograph ({uploadPct}%)</h3>
                <div className="lc-bar">
                  <div className="lc-bar-fill" style={{ width: `${uploadPct}%` }} />
                </div>
              </>
            )}

            {uploadPhase === 'processing' && (
              <>
                <div className="lc-spin" />
                <h3 style={{ margin: 0, fontSize: 20 }}>Thoracic Pathology Screening</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>
                  Evaluating 14 thoracic pathology markers · Generating focus overlays...
                </div>
              </>
            )}

            {uploadPhase === 'done' && (
              <>
                <h3 style={{ margin: 0, fontSize: 20, color: C.teal }}>✓ Screening Complete — Transferring to Workstation...</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Transferring study to Doctor Workstation</div>
              </>
            )}
          </div>

          <input ref={fileRef} type="file" accept=".dcm,.dicom,.png,.jpg,.jpeg" hidden onChange={(e) => e.target.files && startUpload([...e.target.files])} />
          
          {/* Patient & Clinician Trust Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(125, 183, 176, 0.14)', color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock style={{ width: 17, height: 17 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Private & HIPAA Compliant</div>
                <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>Encrypted in transit and at rest with clinical consent governance.</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock style={{ width: 17, height: 17 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Rapid Clinical Turnaround</div>
                <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>Instant triage for emergency findings including acute pneumothorax.</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124, 92, 252, 0.12)', color: C.lav, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 style={{ width: 17, height: 17 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Doctor-Verified Guidance</div>
                <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>Every radiographic finding is reviewed and certified by medical specialists.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━ PIPELINE ━━━━━ */}
      <section id="pipeline" className="lc-section">
        <div className="lc-wrap">
          <h2 className="lc-h2">Clinical Diagnostic Workflow</h2>
          <p className="lc-sub">Five clinical stages from quality-checked acquisition to certified PACS documentation.</p>
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
          <p className="lc-sub">Comprehensive thoracic pathology evaluation with certified radiological focal maps.</p>
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
          <h2 className="lc-h2">Clinical Screening Benchmarks</h2>
          <p className="lc-sub">Validated against consensus panels of certified thoracic radiologists.</p>
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
              <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', color: C.teal }}>
                Clinical Workstation & Governance
              </span>
              <h2 className="lc-h2" style={{ margin: '6px 0 0' }}>Interactive CXR Diagnostic Console & Sign-Off</h2>
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
                    background: ROLE_DEFINITIONS[currentUser.role]?.badgeBg || 'rgba(0, 220, 206, 0.1)',
                    border: `1px solid ${ROLE_DEFINITIONS[currentUser.role]?.borderColor || 'rgba(0, 220, 206, 0.3)'}`,
                    fontSize: 12,
                    fontWeight: 600,
                    color: ROLE_DEFINITIONS[currentUser.role]?.badgeColor || '#00DCCE',
                  }}
                >
                  <CheckCircle2 style={{ width: 12, height: 12 }} />
                  <span>{currentUser.name.split(',')[0]} · {ROLE_DEFINITIONS[currentUser.role]?.title || currentUser.role}</span>
                </div>
              ) : (
                <button onClick={redirectToLogin} className="lc-btn" style={{ padding: '8px 16px', fontSize: 12 }}>
                  <Lock style={{ width: 12, height: 12 }} />
                  Sign In for Clinical Sign-Off
                </button>
              )}
            </div>
          </div>
          <p className="lc-sub" style={{ marginBottom: 36 }}>
            Upload a radiograph above to run it through the live screening pipeline.
          </p>

          {/* Workstation Console Card */}
          <div
            style={{
              borderRadius: 28,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#091927',
              padding: '32px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
            }}
          >
            <FileText style={{ width: 28, height: 28, color: C.teal, marginBottom: 12 }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              No clinical cases available
            </div>
            <div style={{ fontSize: 13, color: C.mute, maxWidth: 460, margin: '0 auto' }}>
              Sample radiographs and their model outputs have been removed. Upload a study above to run it through the
              live screening pipeline.
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
                Explore Other MiPAAS Diagnostic Suites
              </div>
              <h3 style={{ margin: '4px 0 0', fontSize: 20 }}>Comprehensive Clinical Diagnostic Portfolio</h3>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/cardiac" className="lc-btn" style={{ fontSize: 13 }}>qCardiac (Heart AI) →</Link>
              <Link href="/brain-tumor" className="lc-btn" style={{ fontSize: 13 }}>qBrain (Brain Tumor) →</Link>
              <Link href="/lung-cancer" className="lc-btn" style={{ fontSize: 13 }}>qCT Lung (Lung Cancer) →</Link>
              <Link href="/stroke" className="lc-btn" style={{ fontSize: 13 }}>qStroke (Stroke Care) →</Link>
              <Link href="/tb" className="lc-btn" style={{ fontSize: 13 }}>qTrack (TB Screening) →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
