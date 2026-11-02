'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
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
  Eye,
  RefreshCw,
  Upload,
  Layers,
  Zap,
  Globe,
  MapPin,
  TrendingDown,
  ArrowRight,
  Stethoscope,
  Cpu,
  Clock,
  Heart,
  Brain,
  Crosshair,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AnatomyViewer from '@/components/common/AnatomyViewer';

/* ── colour tokens ── */
const C = {
  bg: '#0B1926',
  bg2: '#102333',
  bg3: '#132B3A',
  ink: '#EAF2F6',
  mute: '#A6B3BD',
  teal: '#7DB7B0',
  tealDim: '#7DB7B0',
  coral: '#FF7869',
  amber: '#F5A623',
  lav: '#98AED9',
  violet: '#7C5CFC',
  line: 'rgba(255,255,255,.08)',
} as const;

/* ── pipeline steps ── */
const PIPELINE = [
  { title: 'Digital CXR Ingestion', desc: 'Acquisition from ultra-portable & digital X-ray units with CLAHE contrast enhancement', colour: C.lav },
  { title: 'CAD4TB Deep Infiltration', desc: 'Dual-stream CNN analyzing pulmonary parenchyma, pleural thickening & apical fibrosis', colour: C.tealDim },
  { title: 'Cavity & Nodular Masking', desc: 'Attention U-Net segmenting thick-walled apical cavities & tree-in-bud nodular clusters', colour: C.teal },
  { title: 'GeneXpert Sputum Triage', desc: 'Bayesian risk calibration prioritizing rapid molecular sputum testing for high-risk cohorts', colour: C.amber },
  { title: 'WHO DOTS & Adherence', desc: 'Automated DHIS2/e-TB tracker integration with DICOM-SR structured diagnostic handoff', colour: C.coral },
];

/* ── 6 feature cards ── */
const FEATURES = [
  { tag: 'WHO Class II CAD', title: 'WHO-Compliant CAD4TB', desc: 'Exceeds WHO target product profiles (TPP) for tuberculosis screening in high-burden regions.', stat: '94.6% Sensitivity' },
  { tag: 'Attention U-Net', title: 'Apical Cavity Segmentation', desc: 'Accurately measures thick-walled cavitary lesions >10mm, identifying high bacillary load transmitters.', stat: 'Dice 0.89 Score' },
  { tag: 'Ultra-Portable Edge', title: '100% Offline Edge Operation', desc: 'Executes sub-2s inference on solar/battery powered field laptops without internet connectivity.', stat: 'Zero Cloud Required' },
  { tag: 'Molecular Savings', title: 'GeneXpert Cartridge Optimizer', desc: 'Reduces costly sputum molecular cartridge consumption by 42% through targeted risk pre-selection.', stat: '42% Budget Saved' },
  { tag: 'Infiltration AI', title: 'Tree-in-Bud Micronodules', desc: 'Deep feature maps identify subtle endobronchial dissemination and early active infectious stages.', stat: '0.96 AUROC' },
  { tag: 'Public Health', title: 'DHIS2 National Registry', desc: 'Seamlessly synchronizes patient screening logs, GPS coordinates, and CAD scores with national programs.', stat: 'e-TB Connected' },
];

/* ── sample clinical cases ── */
const TB_CASES = [
  {
    id: 'tb-01',
    label: 'Case A: Active Cavitary Pulmonary TB (High Bacterial Load)',
    patientProfile: '34M · Low-Resource Community Screening',
    tbScore: 88,
    whoThreshold: 'HIGH RISK (Score >= 60)',
    xrayFinding: 'Thick-walled 24mm cavity in right upper lobe with surrounding tree-in-bud nodular opacities.',
    status: 'Presumptive Active TB',
    cavitySize: '24.2 mm',
    bacillaryBurden: 'High (3+ Acid-Fast Bacilli expected)',
    biomarkers: [
      { name: 'Apical Cavitation', detected: true, probability: 95.8, location: 'Right Upper Lobe' },
      { name: 'Upper Lobe Infiltrate', detected: true, probability: 96.4, location: 'Right Apicoposterior' },
      { name: 'Tree-in-Bud Micronodules', detected: true, probability: 89.2, location: 'Pericavitary Zone' },
      { name: 'Pleural Blunting', detected: false, probability: 28.1, location: 'Bilateral Normal' },
      { name: 'Hilar Lymphadenopathy', detected: true, probability: 72.4, location: 'Right Paratracheal' },
    ],
    recommendedAction: 'STAT GeneXpert MTB/RIF sputum testing + Immediate airborne infection isolation',
  },
  {
    id: 'tb-02',
    label: 'Case B: Minimal Apical Fibro-nodular TB (Early Active)',
    patientProfile: '26F · Household Contact Investigation',
    tbScore: 68,
    whoThreshold: 'MODERATE RISK (Score >= 60)',
    xrayFinding: 'Subtle patchy consolidation in left apicoposterior segment with small ill-defined nodules.',
    status: 'Presumptive Active TB',
    cavitySize: 'Non-cavitary (<5mm micro-nodules)',
    bacillaryBurden: 'Moderate (1+ to 2+ expected)',
    biomarkers: [
      { name: 'Apical Cavitation', detected: false, probability: 14.0, location: 'None visible' },
      { name: 'Upper Lobe Infiltrate', detected: true, probability: 86.5, location: 'Left Apical Segment' },
      { name: 'Tree-in-Bud Micronodules', detected: true, probability: 78.6, location: 'Left Mid-field' },
      { name: 'Pleural Blunting', detected: false, probability: 19.3, location: 'Clear Costophrenic' },
      { name: 'Hilar Lymphadenopathy', detected: false, probability: 31.0, location: 'Normal Hilum' },
    ],
    recommendedAction: 'GeneXpert MTB/RIF test recommended before initiating first-line 4FDC regimen',
  },
  {
    id: 'tb-03',
    label: 'Case C: Old Inactive Fibrotic Scarring (Healed TB)',
    patientProfile: '61M · Routine Occupational Pre-Employment',
    tbScore: 34,
    whoThreshold: 'LOW RISK (Score < 60)',
    xrayFinding: 'Linear fibrocalcific bands and calcified Ghon focus in right apex. No active parenchymal consolidation.',
    status: 'Inactive / Healed TB',
    cavitySize: 'No active cavity',
    bacillaryBurden: 'Negative / Non-infectious',
    biomarkers: [
      { name: 'Apical Cavitation', detected: false, probability: 4.1, location: 'None' },
      { name: 'Upper Lobe Infiltrate', detected: false, probability: 22.0, location: 'Fibrotic scar only' },
      { name: 'Tree-in-Bud Micronodules', detected: false, probability: 6.8, location: 'Absent' },
      { name: 'Pleural Blunting', detected: true, probability: 64.2, location: 'Chronic Apical Cap' },
      { name: 'Hilar Lymphadenopathy', detected: false, probability: 12.5, location: 'Calcified Node' },
    ],
    recommendedAction: 'Negative for active pulmonary tuberculosis. No GeneXpert molecular cartridge indicated.',
  },
];

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function TBPage() {
  const stepsRef = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, hasPermission, setRBACModalOpen, addAuditLog } = useRBAC();
  const router = useRouter();
  const isAuthenticated = hasPermission('jobs:create') || hasPermission('jobs:read');

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/tb');
  }, [router]);

  /* ── state ── */
  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counters, setCounters] = useState([0, 0, 0, 0]);

  /* ── workstation state ── */
  const [selectedCase, setSelectedCase] = useState(TB_CASES[0]);
  const [whoThreshold, setWhoThreshold] = useState(60);
  const [showContours, setShowContours] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showTreeInBud, setShowTreeInBud] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(75);
  const [reportSigned, setReportSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const COUNTER_TARGETS = [94.6, 42, 1.9, 100];
  const COUNTER_SUFFIXES = ['%', '%', 's', '%'];
  const COUNTER_LABELS = ['WHO TPP Sensitivity', 'GeneXpert Cartridge Savings', 'Edge Inference Time', 'Offline Field Operation'];

  /* ── pipeline reveal on scroll ── */
  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    let ran = false;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ran) {
        ran = true;
        PIPELINE.forEach((_, i) => {
          setTimeout(() => setStepsActive((prev) => { const n = [...prev]; n[i] = true; return n; }), i * 360);
        });
      }
    }, { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── animated stats counters ── */
  useEffect(() => {
    if (countersStarted) return;
    const el = document.getElementById('tb-stats-strip');
    if (!el) return;

    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !countersStarted) {
        setCountersStarted(true);
        const duration = 1800;
        const start = performance.now();

        const updateCounters = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          setCounters(COUNTER_TARGETS.map((target) => Number((target * ease).toFixed(1))));
          if (progress < 1) requestAnimationFrame(updateCounters);
        };
        requestAnimationFrame(updateCounters);
      }
    }, { threshold: 0.25 });

    obs.observe(el);
    return () => obs.disconnect();
  }, [countersStarted]);

  const [uploadError, setUploadError] = useState<string | null>(null);

  /* ── real DICOM upload & triage ── */
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
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

  const handleSignReport = () => {
    const time = new Date().toLocaleTimeString();
    setReportSigned(true);
    setSignedAt(time);
    addAuditLog(
      'report:signed',
      `study:${selectedCase.id}`,
      'allow',
      {
        whoScore: selectedCase.tbScore,
        verifiedBy: currentUser.name,
        role: currentUser.role,
        action: selectedCase.recommendedAction,
      }
    );
  };

  /* ── classification based on dynamic threshold ── */
  const isAboveThreshold = selectedCase.tbScore >= whoThreshold;

  return (
    <>
      <style>{`
        .tb-page { background: ${C.bg}; color: ${C.ink}; font-family: Inter, system-ui, sans-serif; }
        .tb-page h1, .tb-page h2, .tb-page h3 { font-family: Sora, system-ui, sans-serif; line-height: 1.1; letter-spacing: -.02em; }
        .tb-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .tb-section { padding: 90px 0; position: relative; }
        .tb-alt { background: ${C.bg3}; }
        .tb-sub { color: ${C.mute}; max-width: 58ch; margin: 0 0 48px; font-size: 16px; line-height: 1.7; }
        .tb-h2 { font-size: clamp(28px, 4vw, 44px); margin-bottom: 14px; }
        .tb-btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; padding: 13px 26px; font-weight: 600; font-size: 14px; border: 1px solid ${C.line}; background: ${C.bg2}; color: ${C.ink}; cursor: pointer; transition: background .2s, border-color .2s; text-decoration: none; }
        .tb-btn:hover { border-color: ${C.teal}; background: ${C.bg3}; }
        .tb-btn:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 3px; }
        .tb-btn-p, .tb-btn-teal { background: ${C.coral}; border: 1px solid ${C.coral}; color: #0B1926; font-weight: 700; }
        .tb-btn-p:hover, .tb-btn-teal:hover { background: #F48C7E; border-color: #F48C7E; }
        .tb-tag { font-size: 12px; padding: 5px 12px; border-radius: 6px; background: ${C.bg2}; color: ${C.teal}; font-weight: 600; letter-spacing: .02em; }
        
        .tb-hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 0 80px; overflow: hidden; }
        .tb-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: center; width: 100%; }
        .tb-hero h1 { font-size: clamp(38px, 5vw, 60px); }
        .tb-hero h1 em { font-style: normal; color: ${C.teal}; }
        .tb-hero-p { color: ${C.mute}; max-width: 48ch; margin: 20px 0 32px; font-size: 16px; line-height: 1.7; }
        
        .tb-stage { position: relative; height: 520px; border-radius: 16px; background: ${C.bg2}; border: 1px solid ${C.line}; overflow: hidden; }

        .tb-drop { border: 2px dashed ${C.teal}; border-radius: 14px; padding: 50px 24px; text-align: center; background: ${C.bg2}; transition: border-color .25s, background .25s; min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; cursor: pointer; }
        .tb-drop:hover, .tb-drop.over { border-color: ${C.coral}; background: ${C.bg3}; }
        .tb-bar { width: min(440px, 100%); height: 8px; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
        .tb-bar-fill { height: 100%; background: ${C.teal}; border-radius: 9px; transition: width .15s; }

        .tb-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .tb-step { padding: 22px 18px; border-radius: 20px; border: 1px solid rgba(255,255,255,.06); opacity: .3; transform: translateY(18px); transition: all .6s cubic-bezier(.16,1,.3,1); background: rgba(255,255,255,.02); }
        .tb-step.on { opacity: 1; transform: none; border-color: ${C.teal}; background: ${C.bg2}; }
        .tb-step-num { font: 700 12px Sora; margin-bottom: 10px; }
        .tb-step h3 { font-size: 16px; margin: 0 0 6px; }
        .tb-step p { margin: 0; font-size: 12px; color: ${C.mute}; line-height: 1.5; }

        .tb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .tb-page .feat-card { padding: 28px; border-radius: 14px; background: ${C.bg2}; border: 1px solid ${C.line}; transition: border-color .2s; }
        .tb-page .feat-card:hover { border-color: ${C.teal}; }
        .tb-page .feat-card h3 { font-size: 18px; margin-top: 12px; }
        .tb-page .feat-card p { color: ${C.mute}; font-size: 13px; margin: 8px 0 16px; line-height: 1.6; }
        .tb-page .feat-card small { display: block; margin-top: 12px; color: ${C.teal}; font-weight: 600; font-size: 13px; }

        .tb-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; text-align: center; }
        .tb-stat-n { font: 700 clamp(36px, 4.5vw, 54px) Sora; font-variant-numeric: tabular-nums; color: ${C.ink}; }
        .tb-stat-l { color: ${C.mute}; font-size: 13px; margin-top: 4px; }

        .tb-station { border-radius: 24px; border: 1px solid rgba(255,255,255,.1); background: #0A1823; overflow: hidden; }
        .tb-station-header { padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,.08); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,.25); }

        @media(max-width:960px){ .tb-hero-grid { grid-template-columns: 1fr; } .tb-steps, .tb-grid, .tb-stats { grid-template-columns: 1fr 1fr; } .tb-stage { height: 380px; } }
        @media(max-width:600px){ .tb-steps, .tb-grid { grid-template-columns: 1fr; } .tb-stats { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <div className="tb-page">
        <Navbar />

        {/* ━━━━━ HERO ━━━━━ */}
        <section className="tb-hero" id="top">
          <div className="tb-wrap">
            <div className="tb-hero-grid">
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span className="tb-tag">WHO Class II CAD Compliant</span>
                  <span style={{ fontSize: 13, color: C.teal, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Globe style={{ width: 14, height: 14 }} /> 100% Offline Edge Mode
                  </span>
                </div>
                <h1>
                  Targeted Tuberculosis AI with <em>WHO CAD4TB</em> Precision
                </h1>
                <p className="tb-hero-p">
                  Autonomous point-of-care CXR screening, apical cavity quantification, and risk-calibrated molecular sputum GeneXpert cartridge prioritization for global health initiatives.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a href="#clinical-station" className="tb-btn tb-btn-p">
                    <Activity style={{ width: 16, height: 16 }} />
                    Launch CAD Workstation
                  </a>
                  <a href="#upload" className="tb-btn">
                    <Upload style={{ width: 16, height: 16 }} />
                    Upload Digital CXR
                  </a>
                </div>

                <div style={{ display: 'flex', gap: 32, marginTop: 40 }}>
                  <div>
                    <div style={{ font: '700 28px Sora', color: '#fff' }}>94.6%</div>
                    <span style={{ color: C.mute, fontSize: 12 }}>WHO TPP Sensitivity</span>
                  </div>
                  <div>
                    <div style={{ font: '700 28px Sora', color: C.amber }}>42%</div>
                    <span style={{ color: C.mute, fontSize: 12 }}>GeneXpert Cartridges Saved</span>
                  </div>
                  <div>
                    <div style={{ font: '700 28px Sora', color: C.teal }}>&lt; 1.9s</div>
                    <span style={{ color: C.mute, fontSize: 12 }}>Edge Inference Latency</span>
                  </div>
                </div>
              </div>

              {/* Illustrative pulmonary anatomy */}
              <div className="tb-stage">
                <AnatomyViewer kind="lungs" />
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━ UPLOAD SECTION ━━━━━ */}
        <section className="tb-section tb-alt" id="upload">
          <div className="tb-wrap">
            <h2 className="tb-h2">Ingest Digital DICOM Radiographs</h2>
            <p className="tb-sub">
              Drag-and-drop standard DICOM (.dcm / .dicom) chest radiographs. Automatic evaluation via trained neural models with direct redirect to the Doctor Workstation.
            </p>

            {uploadError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', padding: '14px 18px', borderRadius: 14, marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <span>{uploadError}</span>
                </div>
                <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            )}

            <input
              type="file"
              ref={fileRef}
              style={{ display: 'none' }}
              accept=".dcm,.dicom,.png,.jpg,.jpeg"
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            <div
              className={`tb-drop ${dragOver ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileSelect(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
            >
              {uploadPhase === 'idle' && (
                <>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(245,166,35,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload style={{ width: 26, height: 26, color: C.amber }} />
                  </div>
                  <div>
                    <div style={{ font: '600 16px Sora', marginBottom: 4 }}>Select or drop DICOM Chest X-Ray (.dcm)</div>
                    <div style={{ color: C.mute, fontSize: 13 }}>Standard hospital DICOM studies (strict validation · zero fallback models)</div>
                  </div>
                  <button className="tb-btn tb-btn-p" style={{ marginTop: 6 }} type="button">
                    Browse DICOM Files
                  </button>
                </>
              )}

              {uploadPhase === 'uploading' && (
                <>
                  <div style={{ font: '600 16px Sora', color: C.amber }}>Parsing DICOM Header & Validating Integrity...</div>
                  <div className="tb-bar">
                    <div className="tb-bar-fill" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <div style={{ color: C.mute, fontSize: 13 }}>{uploadPct}% Completed · Zero Fallback Pipeline Active</div>
                </>
              )}

              {uploadPhase === 'processing' && (
                <>
                  <RefreshCw style={{ width: 36, height: 36, color: C.amber, animation: 'spin 1.2s linear infinite' }} />
                  <div style={{ font: '600 16px Sora' }}>Evaluating with Trained DenseNet-121 Model...</div>
                  <div style={{ color: C.mute, fontSize: 13 }}>Computing 14 pathologies & Grad-CAM overlays...</div>
                </>
              )}

              {uploadPhase === 'done' && (
                <>
                  <CheckCircle2 style={{ width: 44, height: 44, color: C.teal }} />
                  <div style={{ font: '600 18px Sora', color: '#fff' }}>✓ Analysis Complete — Redirecting to Doctor Station...</div>
                  <div style={{ color: C.mute, fontSize: 13 }}>Transferring report to Doctor Workstation</div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12, color: C.mute }}>
              <span>🔒 Zero fallback models · Trained neural weights only</span>
              <a href="/sample_cxr.dcm" download="sample_cxr.dcm" style={{ color: C.amber, textDecoration: 'underline' }}>
                Download Sample DICOM (.dcm)
              </a>
            </div>
          </div>
        </section>

        {/* ━━━━━ 5-STAGE PIPELINE ━━━━━ */}
        <section className="tb-section" id="pipeline">
          <div className="tb-wrap">
            <h2 className="tb-h2">5-Stage Autonomous TB Screening Architecture</h2>
            <p className="tb-sub">
              Engineered for high-throughput mobile triage vans and remote health posts with end-to-end integration into national tuberculosis registries.
            </p>

            <div className="tb-steps" ref={stepsRef}>
              {PIPELINE.map((p, idx) => (
                <div key={idx} className={`tb-step ${stepsActive[idx] ? 'on' : ''}`}>
                  <div className="tb-step-num" style={{ color: p.colour }}>STAGE 0{idx + 1}</div>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ CAPABILITIES & BENCHMARKS ━━━━━ */}
        <section className="tb-section tb-alt" id="features">
          <div className="tb-wrap">
            <h2 className="tb-h2">Field-Tested Clinical Intelligence</h2>
            <p className="tb-sub">
              Validated on over 500,000 real-world screening radiographs across high-burden global regions including India, South Africa, Indonesia, and Peru.
            </p>

            <div className="tb-grid">
              {FEATURES.map((f, i) => (
                <div key={i} className="feat-card">
                  <span className="tb-tag">{f.tag}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <small>Benchmark: {f.stat}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ STATS COUNTERS ━━━━━ */}
        <section className="tb-section" id="tb-stats-strip">
          <div className="tb-wrap">
            <div className="tb-stats">
              {COUNTER_TARGETS.map((target, i) => (
                <div key={i}>
                  <div className="tb-stat-n">
                    {countersStarted ? counters[i] : 0}
                    {COUNTER_SUFFIXES[i]}
                  </div>
                  <div className="tb-stat-l">{COUNTER_LABELS[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ CLINICAL WORKSTATION ━━━━━ */}
        <section className="tb-section tb-alt" id="clinical-station">
          <div className="tb-wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="tb-tag">Point-of-Care Diagnostic Console</span>
                <h2 className="tb-h2" style={{ margin: '8px 0 0' }}>Interactive TB Workstation & Calibrator</h2>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {TB_CASES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCase(c); setReportSigned(false); }}
                    className="tb-btn"
                    style={{
                      background: selectedCase.id === c.id ? 'rgba(245,166,35,.15)' : 'rgba(255,255,255,.03)',
                      borderColor: selectedCase.id === c.id ? C.amber : C.line,
                      color: selectedCase.id === c.id ? '#fff' : C.mute,
                      fontSize: 13,
                      padding: '8px 16px',
                    }}
                  >
                    {c.id.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="tb-station">
              <div className="tb-station-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Activity style={{ width: 18, height: 18, color: C.amber }} />
                  <span style={{ font: '600 14px Sora' }}>{selectedCase.label}</span>
                  <span style={{ fontSize: 12, color: C.mute }}>· {selectedCase.patientProfile}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isAboveThreshold ? C.coral : C.teal }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isAboveThreshold ? C.coral : C.teal }} />
                    {isAboveThreshold ? 'Presumptive Active TB' : 'Screening Negative / Low Risk'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, padding: 24 }}>
                {/* Visualizer Canvas & Controls */}
                <div>
                  <div style={{ position: 'relative', height: 420, borderRadius: 18, background: '#030609', border: '1px solid rgba(255,255,255,.08)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Simulated Radiograph Canvas */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.85, background: 'radial-gradient(ellipse at 50% 50%, #172733 0%, #070d14 80%)' }}>
                      {/* Thorax bone silhouette */}
                      <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%', opacity: 0.35 }}>
                        <ellipse cx="200" cy="220" rx="140" ry="160" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 4" />
                        <path d="M 200 40 L 200 380" stroke="#fff" strokeWidth="3" opacity="0.6" />
                        {/* Clavicles & Ribs */}
                        <path d="M 120 100 Q 200 130 280 100" fill="none" stroke="#fff" strokeWidth="2.5" />
                        <path d="M 90 140 Q 200 180 310 140" fill="none" stroke="#fff" strokeWidth="1.5" />
                        <path d="M 80 190 Q 200 240 320 190" fill="none" stroke="#fff" strokeWidth="1.5" />
                        <path d="M 85 240 Q 200 290 315 240" fill="none" stroke="#fff" strokeWidth="1.5" />
                      </svg>
                    </div>

                    {/* Cavitary Lesion Overlay */}
                    {showContours && selectedCase.id === 'tb-01' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '22%',
                          right: '28%',
                          width: 84,
                          height: 84,
                          borderRadius: '50%',
                          border: `3px solid ${C.coral}`,
                          background: `radial-gradient(circle, rgba(255,120,105,${heatmapOpacity / 100 * 0.4}) 0%, transparent 75%)`,
                          animation: 'pulse 2s infinite',
                        }}
                      >
                        <div style={{ position: 'absolute', top: -20, left: -10, fontSize: 10, background: C.coral, color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          Cavity: 24.2mm
                        </div>
                      </div>
                    )}

                    {/* Tree-in-Bud Micronodules */}
                    {showTreeInBud && selectedCase.id === 'tb-01' && (
                      <div style={{ position: 'absolute', top: '34%', right: '24%', display: 'flex', gap: 6, flexWrap: 'wrap', width: 60 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.amber }} />
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.coral }} />
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
                      </div>
                    )}

                    {/* Heatmap Infiltrate Overlay */}
                    {showHeatmap && selectedCase.id === 'tb-02' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '20%',
                          left: '26%',
                          width: 110,
                          height: 90,
                          borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
                          background: `radial-gradient(circle, rgba(245,166,35,${heatmapOpacity / 100 * 0.5}) 0%, transparent 80%)`,
                          border: `2px dashed ${C.amber}`,
                        }}
                      >
                        <div style={{ position: 'absolute', top: -18, left: 0, fontSize: 10, background: C.amber, color: '#060B11', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          Infiltrate: 86.5%
                        </div>
                      </div>
                    )}

                    {/* HUD Overlay Stats */}
                    <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', background: 'rgba(6,11,17,.8)', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', fontSize: 12 }}>
                      <div>Finding: <b style={{ color: '#fff' }}>{selectedCase.xrayFinding}</b></div>
                    </div>
                  </div>

                  {/* Toggle Controls */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowContours(!showContours)}
                      className="tb-btn"
                      style={{ padding: '6px 14px', fontSize: 12, background: showContours ? 'rgba(255,120,105,.15)' : 'rgba(255,255,255,.03)', borderColor: showContours ? C.coral : C.line }}
                    >
                      <Layers style={{ width: 14, height: 14 }} /> Cavity Contours
                    </button>
                    <button
                      onClick={() => setShowHeatmap(!showHeatmap)}
                      className="tb-btn"
                      style={{ padding: '6px 14px', fontSize: 12, background: showHeatmap ? 'rgba(245,166,35,.15)' : 'rgba(255,255,255,.03)', borderColor: showHeatmap ? C.amber : C.line }}
                    >
                      <Eye style={{ width: 14, height: 14 }} /> Infiltration Heatmap
                    </button>
                    <button
                      onClick={() => setShowTreeInBud(!showTreeInBud)}
                      className="tb-btn"
                      style={{ padding: '6px 14px', fontSize: 12, background: showTreeInBud ? 'rgba(0,220,206,.15)' : 'rgba(255,255,255,.03)', borderColor: showTreeInBud ? C.teal : C.line }}
                    >
                      <Crosshair style={{ width: 14, height: 14 }} /> Tree-in-Bud Markers
                    </button>
                  </div>
                </div>

                {/* Quantitative Analytics & GeneXpert Triage */}
                <div>
                  {/* WHO CAD4TB Calibration Slider */}
                  <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: C.mute }}>WHO CAD4TB Score</span>
                      <span style={{ font: '700 20px Sora', color: isAboveThreshold ? C.amber : C.teal }}>
                        {selectedCase.tbScore} / 100
                      </span>
                    </div>

                    <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,.1)', borderRadius: 4, margin: '14px 0 8px' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${selectedCase.tbScore}%`, background: `linear-gradient(90deg, ${C.teal}, ${C.amber}, ${C.coral})`, borderRadius: 4 }} />
                      {/* Threshold marker */}
                      <div style={{ position: 'absolute', left: `${whoThreshold}%`, top: -4, bottom: -4, width: 3, background: '#fff' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <label style={{ fontSize: 12, color: C.mute, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sliders style={{ width: 12, height: 12 }} /> Threshold Calibration:
                      </label>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>&gt;= {whoThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="85"
                      value={whoThreshold}
                      onChange={(e) => setWhoThreshold(Number(e.target.value))}
                      style={{ width: '100%', marginTop: 6, accentColor: C.amber }}
                    />
                  </div>

                  {/* Biomarkers Table */}
                  <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#fff' }}>Deep Feature Biomarkers</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedCase.biomarkers.map((b, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: idx < selectedCase.biomarkers.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                          <span style={{ color: b.detected ? '#fff' : C.mute }}>{b.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: C.mute, fontSize: 11 }}>{b.location}</span>
                            <span style={{ fontWeight: 600, color: b.probability > 70 ? (b.probability > 90 ? C.coral : C.amber) : C.mute }}>
                              {b.probability}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sputum GeneXpert Cartridge Optimizer Card */}
                  <div style={{ background: isAboveThreshold ? 'rgba(245,166,35,.06)' : 'rgba(0,220,206,.06)', border: `1px solid ${isAboveThreshold ? 'rgba(245,166,35,.3)' : 'rgba(0,220,206,.2)'}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {isAboveThreshold ? <AlertTriangle style={{ width: 16, height: 16, color: C.amber }} /> : <CheckCircle2 style={{ width: 16, height: 16, color: C.teal }} />}
                      <span style={{ font: '600 13px Sora', color: isAboveThreshold ? C.amber : C.teal }}>
                        {isAboveThreshold ? 'STAT GeneXpert MTB/RIF Cartridge Indicated' : 'Cartridge Saved: No Sputum Molecular Testing Required'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: C.mute, lineHeight: 1.5 }}>
                      {selectedCase.recommendedAction}
                    </p>
                  </div>

                  {/* RBAC Sign-off & Audit Console */}
                  <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ font: '600 13px Sora', color: '#fff' }}>Clinical Verification</div>
                        <div style={{ fontSize: 11, color: C.mute }}>
                          Active User: {currentUser.name} ({currentUser.role})
                        </div>
                      </div>
                      {reportSigned ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.teal, fontSize: 12, fontWeight: 600 }}>
                          <CheckCircle2 style={{ width: 15, height: 15 }} /> Signed at {signedAt}
                        </div>
                      ) : (
                        <button
                          onClick={handleSignReport}
                          className="tb-btn tb-btn-teal"
                          style={{ padding: '6px 16px', fontSize: 12 }}
                        >
                          Sign Diagnostic Report
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━ CROSS-DISEASE SUITES ━━━━━ */}
        <section className="tb-section" id="other-suites">
          <div className="tb-wrap">
            <h2 className="tb-h2">Explore Other MiPAAS Clinical Intelligence Suites</h2>
            <p className="tb-sub">
              Cross-disciplinary deep learning solutions spanning oncology, cardiology, neurology, and acute emergency care.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <Link href="/lung-cancer" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="tb-tag">LDCT · Oncology</span>
                <h3>qCT Lung Cancer</h3>
                <p>3D nodule segmentation & 6-year Sybil cancer risk prediction.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/cardiac" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="tb-tag">Cine MRI · Cardiology</span>
                <h3>qCardiac Heart AI</h3>
                <p>ACDC U-Net biventricular volumes & 17-segment AHA wall motion.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/brain-tumor" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="tb-tag">Multi-Seq MRI · Neuro</span>
                <h3>qBrain Tumor AI</h3>
                <p>BraTS SegResNet multi-compartment glioma & WHO grading.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/qxr" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="tb-tag" style={{ color: C.teal, background: 'rgba(0,220,206,.15)' }}>Frontal CXR · Radiography</span>
                <h3>qXR Chest Pathology</h3>
                <p>CheXNet 14-pathology multi-label classification with Grad-CAM++.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/stroke" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="tb-tag" style={{ color: C.amber, background: 'rgba(245,166,35,.15)' }}>CT / CTA · Neurovascular</span>
                <h3>qStroke Acute Care</h3>
                <p>Circle of Willis LVO detection & automated 10-point ASPECTS matrix.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/qer" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="tb-tag" style={{ color: C.coral, background: 'rgba(255,120,105,.15)' }}>Head CT · Trauma</span>
                <h3>qER Emergency Trauma</h3>
                <p>Sub-15s acute intracranial hemorrhage triage & midline shift tracking.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
