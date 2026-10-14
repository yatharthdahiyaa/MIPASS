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
  Clock,
  Crosshair,
  ArrowRight,
  Siren,
  Maximize2,
  Radio,
  Flame,
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
  red: '#FF453A',
  amber: '#F5A623',
  lav: '#98AED9',
  violet: '#7C5CFC',
  line: 'rgba(255,255,255,.08)',
} as const;

/* ── 5-stage emergency pipeline ── */
const PIPELINE = [
  { title: 'STAT DICOM Ingestion', desc: 'Zero-latency auto-routing from emergency trauma CT scanner via DICOM C-STORE protocol', colour: C.lav },
  { title: 'Volumetric 3D ResNet', desc: 'Volumetric multi-slice CNN simultaneously classifying SDH, EDH, SAH, IPH, and IVH', colour: C.tealDim },
  { title: 'Midline Shift Extraction', desc: 'Automated falx cerebri vector alignment and septum pellucidum deviation measurement', colour: C.coral },
  { title: 'Hematoma Volumetrics', desc: 'Voxel-level cubic centimeter segmentation with automated uncal/subfalcine herniation alerts', colour: C.amber },
  { title: 'STAT Neuro-OR Paging', desc: 'Sub-15s automated push notification to on-call trauma surgeon, PACS console, and trauma pager', colour: C.red },
];

/* ── 6 feature cards ── */
const FEATURES = [
  { tag: 'STAT Response', title: 'Sub-15s Emergency Triage', desc: 'Notifies trauma care team and alerts neurosurgery before the patient is even moved off the scanner table.', stat: '< 12s Latency' },
  { tag: 'Multi-Lesion AI', title: '5 Bleed Subtype Detection', desc: 'Simultaneously segments Subdural, Epidural, Subarachnoid, Intraparenchymal, and Intraventricular hemorrhages.', stat: '98.7% Sensitivity' },
  { tag: 'Caliper Precision', title: 'Automated Midline Shift', desc: 'Quantifies lateral falx displacement down to 0.1 mm precision, automatically flagging surgical >5 mm thresholds.', stat: '0.1 mm Accuracy' },
  { tag: 'Cranial Windowing', title: 'Bone Fracture Algorithm', desc: 'Identifies linear, depressed, basilar, and facial fractures on dedicated bone algorithm reconstructions.', stat: '96.2% Fracture AUC' },
  { tag: 'Mass Effect AI', title: 'Volumetric Mass Quantification', desc: 'Measures exact 3D hematoma volume in cc with ventricular effacement and uncal herniation risk indices.', stat: 'Dice 0.91 Volumetrics' },
  { tag: 'Level 1 Trauma', title: 'STAT PACS & Pager Push', desc: 'Native HL7/FHIR push alerts to EPIC, Cerner, and trauma on-call smartphones with interactive thumbnail views.', stat: 'Zero PACS Delay' },
];

/* ── emergency clinical cases ── */
const EMERGENCY_CASES = [
  {
    id: 'qer-01',
    label: 'Case A: Acute Right Subdural Hematoma (SDH)',
    demographics: '59M · Trauma Code STAT · GCS 9',
    bleedType: 'Acute Subdural Hematoma',
    volume: '38.4 cc',
    midlineShift: '6.8 mm (Right to Left)',
    isStatCritical: true,
    herniationRisk: 'High (Impending Uncal)',
    findings: 'Hyperdense crescentic extra-axial fluid collection along right cerebral convexity crossing suture lines. 6.8 mm midline shift with marked compression of ipsilateral lateral ventricle.',
    abnormalities: [
      { name: 'Acute Subdural Hemorrhage', probability: 98.7, critical: true, location: 'Right Frontoparietal' },
      { name: 'Midline Shift (>5mm)', probability: 96.2, critical: true, location: '6.8 mm deviation' },
      { name: 'Mass Effect / Effacement', probability: 91.5, critical: true, location: 'Right Lateral Ventricle' },
      { name: 'Impending Uncal Herniation', probability: 84.0, critical: true, location: 'Medial Temporal Lobe' },
      { name: 'Calvarial Skull Fracture', probability: 14.2, critical: false, location: 'None detected' },
    ],
    recommendedAction: 'EMERGENCY: Immediate neurosurgical consultation for decompressive craniotomy / evacuation.',
  },
  {
    id: 'qer-02',
    label: 'Case B: Spontaneous Subarachnoid Hemorrhage (SAH)',
    demographics: '48F · Thunderclap Headache · GCS 13',
    bleedType: 'Subarachnoid Hemorrhage',
    volume: '14.2 cc (Basal Cisterns)',
    midlineShift: '0.8 mm (Minimal)',
    isStatCritical: true,
    herniationRisk: 'Low (Hydrocephalus Risk)',
    findings: 'Extensive hyperattenuation in basal cisterns, bilateral sylvian fissures, and anterior interhemispheric fissure consistent with ruptured anterior communicating artery aneurysm.',
    abnormalities: [
      { name: 'Subarachnoid Hemorrhage', probability: 99.1, critical: true, location: 'Basal Cisterns & Sylvian' },
      { name: 'Early Acute Hydrocephalus', probability: 82.0, critical: true, location: 'Temporal Horn Dilatation' },
      { name: 'Intraventricular Extension', probability: 74.6, critical: true, location: '4th Ventricle Sump' },
      { name: 'Midline Shift', probability: 6.4, critical: false, location: '0.8 mm (Within Normal)' },
      { name: 'Parenchymal Hematoma', probability: 8.1, critical: false, location: 'Absent' },
    ],
    recommendedAction: 'STAT CTA head/neck to identify ruptured aneurysm + NICU admission with BP control.',
  },
  {
    id: 'qer-03',
    label: 'Case C: Traumatic Intraparenchymal Bleed & Contusion',
    demographics: '31M · Motor Vehicle Accident · GCS 11',
    bleedType: 'Intracerebral Hemorrhage (ICH)',
    volume: '22.8 cc',
    midlineShift: '3.4 mm (Left to Right)',
    isStatCritical: true,
    herniationRisk: 'Moderate (Subfalcine Vector)',
    findings: 'High-density focus in left frontal lobe parenchyma with surrounding rim of hypodense perilesional vasogenic edema and contralateral midline displacement of 3.4 mm.',
    abnormalities: [
      { name: 'Intraparenchymal Bleed (ICH)', probability: 97.4, critical: true, location: 'Left Frontal Polar' },
      { name: 'Perilesional Vasogenic Edema', probability: 93.1, critical: true, location: 'Surrounding Parenchyma' },
      { name: 'Midline Falx Shift', probability: 88.5, critical: true, location: '3.4 mm displacement' },
      { name: 'Linear Calvarial Fracture', probability: 79.2, critical: true, location: 'Left Frontal Bone' },
      { name: 'Subdural Fluid Collection', probability: 21.0, critical: false, location: 'Trace Non-surgical' },
    ],
    recommendedAction: 'Trauma ICU neuro-monitoring, serial repeat CT head in 4-6h, ICP monitor placement eval.',
  },
];

/* ── CT window presets ── */
const WINDOW_PRESETS = [
  { id: 'brain', label: 'Brain (WW: 80, WL: 40)', ww: 80, wl: 40 },
  { id: 'subdural', label: 'Subdural (WW: 150, WL: 75)', ww: 150, wl: 75 },
  { id: 'bone', label: 'Bone (WW: 2500, WL: 500)', ww: 2500, wl: 500 },
  { id: 'stroke', label: 'Stroke (WW: 30, WL: 30)', ww: 30, wl: 30 },
];

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function QERPage() {
  const stepsRef = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, hasPermission, addAuditLog } = useRBAC();
  const router = useRouter();
  const isAuthenticated = hasPermission('jobs:create') || hasPermission('jobs:read');

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/qer');
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
  const [selectedCase, setSelectedCase] = useState(EMERGENCY_CASES[0]);
  const [selectedWindow, setSelectedWindow] = useState(WINDOW_PRESETS[0]);
  const [showBleedMask, setShowBleedMask] = useState(true);
  const [showMidlineCaliper, setShowMidlineCaliper] = useState(true);
  const [showVentricles, setShowVentricles] = useState(true);
  const [statPagingActivated, setStatPagingActivated] = useState(false);
  const [reportSigned, setReportSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const COUNTER_TARGETS = [98.7, 12, 0.1, 5];
  const COUNTER_SUFFIXES = ['%', 's', 'mm', ''];
  const COUNTER_LABELS = ['Acute Bleed Sensitivity', 'STAT Triage Turnaround', 'Midline Shift Precision', 'Bleed Subtypes Classified'];

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
    const el = document.getElementById('qer-stats-strip');
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

  /* ── real DICOM file upload & auto-redirect ── */
  const handleFileSelect = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
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

  const handleActivateSTAT = () => {
    setStatPagingActivated(true);
    addAuditLog(
      'trauma:or_escalation',
      `study:${selectedCase.id}`,
      'allow',
      {
        bleedType: selectedCase.bleedType,
        volume: selectedCase.volume,
        midlineShift: selectedCase.midlineShift,
        escalatedBy: currentUser.name,
        role: currentUser.role,
      }
    );
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
        verifiedBy: currentUser.name,
        role: currentUser.role,
        findings: selectedCase.findings,
      }
    );
  };

  return (
    <>
      <style>{`
        .qer-page { background: ${C.bg}; color: ${C.ink}; font-family: Inter, system-ui, sans-serif; }
        .qer-page h1, .qer-page h2, .qer-page h3 { font-family: Sora, system-ui, sans-serif; line-height: 1.1; letter-spacing: -.02em; }
        .qer-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .qer-section { padding: 90px 0; position: relative; }
        .qer-alt { background: ${C.bg3}; }
        .qer-sub { color: ${C.mute}; max-width: 58ch; margin: 0 0 48px; font-size: 16px; line-height: 1.7; }
        .qer-h2 { font-size: clamp(28px, 4vw, 44px); margin-bottom: 14px; }
        .qer-btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; padding: 13px 26px; font-weight: 600; font-size: 14px; border: 1px solid ${C.line}; background: ${C.bg2}; color: ${C.ink}; cursor: pointer; transition: background .2s, border-color .2s; text-decoration: none; }
        .qer-btn:hover { border-color: ${C.teal}; background: ${C.bg3}; }
        .qer-btn:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 3px; }
        .qer-btn-p, .qer-btn-stat { background: ${C.coral}; border: 1px solid ${C.coral}; color: #0B1926; font-weight: 700; }
        .qer-btn-p:hover, .qer-btn-stat:hover { background: #F48C7E; border-color: #F48C7E; }
        .qer-tag { font-size: 12px; padding: 5px 12px; border-radius: 6px; background: ${C.bg2}; color: ${C.teal}; font-weight: 600; letter-spacing: .02em; }
        
        .qer-hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 0 80px; overflow: hidden; }
        .qer-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: center; width: 100%; }
        .qer-hero h1 { font-size: clamp(38px, 5vw, 60px); }
        .qer-hero h1 em { font-style: normal; color: ${C.teal}; }
        .qer-hero-p { color: ${C.mute}; max-width: 48ch; margin: 20px 0 32px; font-size: 16px; line-height: 1.7; }
        
        .qer-stage { position: relative; height: 520px; border-radius: 16px; background: ${C.bg2}; border: 1px solid ${C.line}; overflow: hidden; }

        .qer-drop { border: 2px dashed ${C.teal}; border-radius: 14px; padding: 50px 24px; text-align: center; background: ${C.bg2}; transition: border-color .25s, background .25s; min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; cursor: pointer; }
        .qer-drop:hover, .qer-drop.over { border-color: ${C.coral}; background: ${C.bg3}; }
        .qer-bar { width: min(440px, 100%); height: 8px; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
        .qer-bar-fill { height: 100%; background: ${C.teal}; border-radius: 9px; transition: width .15s; }

        .qer-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .qer-step { padding: 22px 18px; border-radius: 20px; border: 1px solid rgba(255,255,255,.06); opacity: .3; transform: translateY(18px); transition: all .6s cubic-bezier(.16,1,.3,1); background: rgba(255,255,255,.02); }
        .qer-step.on { opacity: 1; transform: none; border-color: ${C.teal}; background: ${C.bg2}; }
        .qer-step-num { font: 700 12px Sora; margin-bottom: 10px; }
        .qer-step h3 { font-size: 16px; margin: 0 0 6px; }
        .qer-step p { margin: 0; font-size: 12px; color: ${C.mute}; line-height: 1.5; }

        .qer-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .qer-page .feat-card { padding: 28px; border-radius: 14px; background: ${C.bg2}; border: 1px solid ${C.line}; transition: border-color .2s; }
        .qer-page .feat-card:hover { border-color: ${C.teal}; }
        .qer-page .feat-card h3 { font-size: 18px; margin-top: 12px; }
        .qer-page .feat-card p { color: ${C.mute}; font-size: 13px; margin: 8px 0 16px; line-height: 1.6; }
        .qer-page .feat-card small { display: block; margin-top: 12px; color: ${C.teal}; font-weight: 600; font-size: 13px; }

        .qer-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; text-align: center; }
        .qer-stat-n { font: 700 clamp(36px, 4.5vw, 54px) Sora; font-variant-numeric: tabular-nums; color: ${C.ink}; }
        .qer-stat-l { color: ${C.mute}; font-size: 13px; margin-top: 4px; }

        .qer-station { border-radius: 24px; border: 1px solid rgba(255,255,255,.1); background: #0A1823; overflow: hidden; }
        .qer-station-header { padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,.08); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,.25); }

        @media(max-width:960px){ .qer-hero-grid { grid-template-columns: 1fr; } .qer-steps, .qer-grid, .qer-stats { grid-template-columns: 1fr 1fr; } .qer-stage { height: 380px; } }
        @media(max-width:600px){ .qer-steps, .qer-grid { grid-template-columns: 1fr; } .qer-stats { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <div className="qer-page">
        <Navbar />

        {/* ━━━━━ HERO ━━━━━ */}
        <section className="qer-hero" id="top">
          <div className="qer-wrap">
            <div className="qer-hero-grid">
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span className="qer-tag">Level 1 STAT Trauma Protocol</span>
                  <span style={{ fontSize: 13, color: C.coral, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Siren style={{ width: 14, height: 14 }} /> Sub-15s Emergency Triage
                  </span>
                </div>
                <h1>
                  Emergency Head CT AI with <em>STAT Trauma</em> Precision
                </h1>
                <p className="qer-hero-p">
                  Instant non-contrast head CT triage for acute intracranial hemorrhage, automated midline shift quantification, mass-effect volume calculations, and automated neurosurgical OR escalation.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a href="#clinical-station" className="qer-btn qer-btn-p">
                    <Activity style={{ width: 16, height: 16 }} />
                    Launch Trauma Console
                  </a>
                  <a href="#upload" className="qer-btn">
                    <Upload style={{ width: 16, height: 16 }} />
                    Upload STAT Head CT
                  </a>
                </div>

                <div style={{ display: 'flex', gap: 32, marginTop: 40 }}>
                  <div>
                    <div style={{ font: '700 28px Sora', color: '#fff' }}>98.7%</div>
                    <span style={{ color: C.mute, fontSize: 12 }}>Acute Bleed Sensitivity</span>
                  </div>
                  <div>
                    <div style={{ font: '700 28px Sora', color: C.coral }}>&lt; 12s</div>
                    <span style={{ color: C.mute, fontSize: 12 }}>Emergency Inference Latency</span>
                  </div>
                  <div>
                    <div style={{ font: '700 28px Sora', color: C.teal }}>0.1 mm</div>
                    <span style={{ color: C.mute, fontSize: 12 }}>Midline Shift Precision</span>
                  </div>
                </div>
              </div>

              {/* Illustrative cerebral anatomy */}
              <div className="qer-stage">
                <AnatomyViewer kind="brain" />
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━ UPLOAD SECTION ━━━━━ */}
        <section className="qer-section qer-alt" id="upload">
          <div className="qer-wrap">
            <h2 className="qer-h2">Ingest Emergency Non-Contrast Head CT</h2>
            <p className="qer-sub">
              Direct DICOM C-STORE push from Siemens, GE, Philips, Canon CT scanners. Automated multi-window extraction (Brain, Subdural, Bone) in &lt;12 seconds.
            </p>

            <input
              type="file"
              ref={fileRef}
              style={{ display: 'none' }}
              accept=".dcm,.dicom,.tar,.zip"
              onChange={(e) => handleFileSelect(e.target.files)}
            />

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
              className={`qer-drop ${dragOver ? 'over' : ''}`}
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
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,120,105,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload style={{ width: 26, height: 26, color: C.coral }} />
                  </div>
                  <div>
                    <div style={{ font: '600 16px Sora', marginBottom: 4 }}>Select or drop Emergency Head CT Series</div>
                    <div style={{ color: C.mute, fontSize: 13 }}>Non-contrast axial CT (512x512 matrix, 0.625mm-5mm slice thickness)</div>
                  </div>
                  <button className="qer-btn qer-btn-p" style={{ marginTop: 6 }} type="button">
                    Browse DICOM CT Series
                  </button>
                </>
              )}

              {uploadPhase === 'uploading' && (
                <>
                  <div style={{ font: '600 16px Sora', color: C.coral }}>Ingesting STAT Axial Volume & Calvarium Windows...</div>
                  <div className="qer-bar">
                    <div className="qer-bar-fill" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <div style={{ color: C.mute, fontSize: 13 }}>{uploadPct}% Completed · STAT High Priority Tagged</div>
                </>
              )}

              {uploadPhase === 'processing' && (
                <>
                  <RefreshCw style={{ width: 36, height: 36, color: C.coral, animation: 'spin 1.2s linear infinite' }} />
                  <div style={{ font: '600 16px Sora' }}>Executing 3D ResNet Hemorrhage & Midline Caliper...</div>
                  <div style={{ color: C.mute, fontSize: 13 }}>Multi-slice volumetric inference on GPU Cloud Run</div>
                </>
              )}

              {uploadPhase === 'done' && (
                <>
                  <CheckCircle2 style={{ width: 44, height: 44, color: C.teal }} />
                  <div style={{ font: '600 18px Sora', color: '#fff' }}>STAT Triage Complete: Acute Hemorrhage Detected</div>
                  <div style={{ color: C.mute, fontSize: 13 }}>Bleed Volume: 38.4 cc · Midline Shift: 6.8 mm · High Herniation Risk</div>
                  <a href="#clinical-station" className="qer-btn qer-btn-p" style={{ marginTop: 8 }}>
                    Open Emergency Trauma Workstation
                  </a>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ━━━━━ 5-STAGE PIPELINE ━━━━━ */}
        <section className="qer-section" id="pipeline">
          <div className="qer-wrap">
            <h2 className="qer-h2">5-Stage Sub-15s Emergency Trauma Pipeline</h2>
            <p className="qer-sub">
              Designed for hyper-acute emergency medicine workflows where minutes dictate neurological outcome and survival.
            </p>

            <div className="qer-steps" ref={stepsRef}>
              {PIPELINE.map((p, idx) => (
                <div key={idx} className={`qer-step ${stepsActive[idx] ? 'on' : ''}`}>
                  <div className="qer-step-num" style={{ color: p.colour }}>STAGE 0{idx + 1}</div>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ CAPABILITIES & BENCHMARKS ━━━━━ */}
        <section className="qer-section qer-alt" id="features">
          <div className="qer-wrap">
            <h2 className="qer-h2">Trauma Center Validated Intelligence</h2>
            <p className="qer-sub">
              Trained and validated on over 140,000 non-contrast head CT examinations across major academic trauma centers and emergency departments.
            </p>

            <div className="qer-grid">
              {FEATURES.map((f, i) => (
                <div key={i} className="feat-card">
                  <span className="qer-tag">{f.tag}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <small>Benchmark: {f.stat}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ STATS COUNTERS ━━━━━ */}
        <section className="qer-section" id="qer-stats-strip">
          <div className="qer-wrap">
            <div className="qer-stats">
              {COUNTER_TARGETS.map((target, i) => (
                <div key={i}>
                  <div className="qer-stat-n">
                    {countersStarted ? counters[i] : 0}
                    {COUNTER_SUFFIXES[i]}
                  </div>
                  <div className="qer-stat-l">{COUNTER_LABELS[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ EMERGENCY TRAUMA WORKSTATION ━━━━━ */}
        <section className="qer-section qer-alt" id="clinical-station">
          <div className="qer-wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="qer-tag">STAT Trauma Diagnostic Console</span>
                <h2 className="qer-h2" style={{ margin: '8px 0 0' }}>Emergency Head CT Workstation & Caliper</h2>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {EMERGENCY_CASES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCase(c); setReportSigned(false); setStatPagingActivated(false); }}
                    className="qer-btn"
                    style={{
                      background: selectedCase.id === c.id ? 'rgba(255,120,105,.15)' : 'rgba(255,255,255,.03)',
                      borderColor: selectedCase.id === c.id ? C.coral : C.line,
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

            <div className="qer-station">
              <div className="qer-station-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Siren style={{ width: 18, height: 18, color: C.coral }} />
                  <span style={{ font: '600 14px Sora' }}>{selectedCase.label}</span>
                  <span style={{ fontSize: 12, color: C.mute }}>· {selectedCase.demographics}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: selectedCase.isStatCritical ? C.red : C.teal, fontWeight: 700 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedCase.isStatCritical ? C.red : C.teal }} />
                    {selectedCase.isStatCritical ? 'STAT EMERGENCY CODE 1' : 'STABLE / ROUTINE'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, padding: 24 }}>
                {/* Visualizer Canvas & Controls */}
                <div>
                  <div style={{ position: 'relative', height: 420, borderRadius: 18, background: '#030609', border: '1px solid rgba(255,255,255,.08)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Simulated Axial Head CT Slice */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.9, background: 'radial-gradient(ellipse at 50% 50%, #15222E 0%, #060B11 75%)' }}>
                      <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
                        {/* Cranium Calvarium (Skull bone ring) */}
                        <ellipse cx="200" cy="200" rx="135" ry="165" fill="#0C141C" stroke={selectedWindow.id === 'bone' ? '#fff' : '#6A8092'} strokeWidth={selectedWindow.id === 'bone' ? '12' : '6'} />
                        {/* Brain parenchyma outline */}
                        <ellipse cx="200" cy="200" rx="122" ry="152" fill="#182836" stroke="none" />
                        
                        {/* Lateral Ventricles (compressed by bleed) */}
                        {showVentricles && (
                          <g opacity="0.6">
                            {/* Left ventricle (normal or dilated) */}
                            <path d="M 175 160 Q 155 200 170 230 Q 185 205 175 160" fill="#060B11" stroke="#334C60" strokeWidth="1.5" />
                            {/* Right ventricle (effaced/compressed) */}
                            <path d="M 215 175 Q 225 200 220 220 Q 212 205 215 175" fill="#060B11" stroke="#334C60" strokeWidth="1.5" opacity={selectedCase.id === 'qer-01' ? '0.3' : '0.8'} />
                          </g>
                        )}

                        {/* Midline Falx Cerebri Deviation Caliper */}
                        {showMidlineCaliper && (
                          <g>
                            {/* True Anatomical Midline (Dashed white) */}
                            <line x1="200" y1="50" x2="200" y2="350" stroke="#7B8FA0" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.6" />
                            {/* Shifted Midline (Solid coral) */}
                            {selectedCase.id === 'qer-01' && (
                              <>
                                <path d="M 200 50 Q 165 200 200 350" fill="none" stroke={C.coral} strokeWidth="2.5" />
                                {/* Caliper measurement line */}
                                <line x1="200" y1="200" x2="168" y2="200" stroke="#fff" strokeWidth="2" />
                                <circle cx="200" cy="200" r="3" fill="#fff" />
                                <circle cx="168" cy="200" r="3" fill={C.coral} />
                                <text x="145" y="195" fill={C.coral} fontSize="12" fontWeight="700">6.8mm</text>
                              </>
                            )}
                            {selectedCase.id === 'qer-03' && (
                              <>
                                <path d="M 200 50 Q 218 200 200 350" fill="none" stroke={C.coral} strokeWidth="2.5" />
                                <line x1="200" y1="200" x2="217" y2="200" stroke="#fff" strokeWidth="2" />
                                <text x="222" y="195" fill={C.coral} fontSize="12" fontWeight="700">3.4mm</text>
                              </>
                            )}
                          </g>
                        )}
                      </svg>
                    </div>

                    {/* Hyperdense Hemorrhage Segmentation Overlays */}
                    {showBleedMask && selectedCase.id === 'qer-01' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '25%',
                          right: '18%',
                          width: 70,
                          height: 180,
                          borderRadius: '0 80px 80px 0',
                          border: `3px solid ${C.coral}`,
                          background: 'radial-gradient(circle, rgba(255,69,58,0.7) 0%, rgba(255,120,105,0.4) 80%)',
                          animation: 'pulse 1.8s infinite',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 10, right: -12, fontSize: 10, background: C.red, color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          SDH: 38.4 cc
                        </div>
                      </div>
                    )}

                    {showBleedMask && selectedCase.id === 'qer-02' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '40%',
                          left: '42%',
                          width: 65,
                          height: 65,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(255,69,58,0.8) 0%, rgba(255,120,105,0.3) 70%)',
                        }}
                      >
                        <div style={{ position: 'absolute', top: -18, left: -20, fontSize: 10, background: C.red, color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          SAH: Basal Cisterns
                        </div>
                      </div>
                    )}

                    {showBleedMask && selectedCase.id === 'qer-03' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '28%',
                          left: '26%',
                          width: 75,
                          height: 75,
                          borderRadius: '50%',
                          border: `2px solid ${C.red}`,
                          background: 'radial-gradient(circle, rgba(255,69,58,0.75) 0%, rgba(245,166,35,0.3) 70%)',
                        }}
                      >
                        <div style={{ position: 'absolute', top: -16, left: 0, fontSize: 10, background: C.red, color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          ICH: 22.8 cc
                        </div>
                      </div>
                    )}

                    {/* HUD Overlay Stats */}
                    <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', background: 'rgba(6,11,17,.82)', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', fontSize: 12 }}>
                      <div>Window: <b style={{ color: '#fff' }}>{selectedWindow.label}</b></div>
                      <div>Herniation: <b style={{ color: C.coral }}>{selectedCase.herniationRisk}</b></div>
                    </div>
                  </div>

                  {/* Window Presets & Layer Toggles */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {WINDOW_PRESETS.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWindow(w)}
                        className="qer-btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: 11,
                          background: selectedWindow.id === w.id ? 'rgba(255,120,105,.2)' : 'rgba(255,255,255,.03)',
                          borderColor: selectedWindow.id === w.id ? C.coral : C.line,
                          color: selectedWindow.id === w.id ? '#fff' : C.mute,
                        }}
                      >
                        {w.label.split(' ')[0]} Window
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowBleedMask(!showBleedMask)}
                      className="qer-btn"
                      style={{ padding: '6px 14px', fontSize: 12, background: showBleedMask ? 'rgba(255,69,58,.15)' : 'rgba(255,255,255,.03)', borderColor: showBleedMask ? C.red : C.line }}
                    >
                      <Layers style={{ width: 14, height: 14 }} /> Bleed Segmentation
                    </button>
                    <button
                      onClick={() => setShowMidlineCaliper(!showMidlineCaliper)}
                      className="qer-btn"
                      style={{ padding: '6px 14px', fontSize: 12, background: showMidlineCaliper ? 'rgba(255,120,105,.15)' : 'rgba(255,255,255,.03)', borderColor: showMidlineCaliper ? C.coral : C.line }}
                    >
                      <Crosshair style={{ width: 14, height: 14 }} /> Midline Caliper
                    </button>
                    <button
                      onClick={() => setShowVentricles(!showVentricles)}
                      className="qer-btn"
                      style={{ padding: '6px 14px', fontSize: 12, background: showVentricles ? 'rgba(0,220,206,.15)' : 'rgba(255,255,255,.03)', borderColor: showVentricles ? C.teal : C.line }}
                    >
                      <Eye style={{ width: 14, height: 14 }} /> Ventricle Effacement
                    </button>
                  </div>
                </div>

                {/* Quantitative Emergency Metrics & STAT Action */}
                <div>
                  {/* Critical Volumetric Dashboard */}
                  <div style={{ background: 'rgba(255,69,58,.08)', border: '1px solid rgba(255,69,58,.3)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>Emergency Caliper & Volumetrics</span>
                      <span style={{ font: '700 13px Sora', color: C.coral }}>STAT PRIORITY</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '10px 0' }}>
                      <div style={{ background: 'rgba(0,0,0,.3)', padding: '10px 14px', borderRadius: 12 }}>
                        <span style={{ fontSize: 11, color: C.mute }}>Bleed Volume</span>
                        <div style={{ font: '700 20px Sora', color: C.red, marginTop: 2 }}>{selectedCase.volume}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,.3)', padding: '10px 14px', borderRadius: 12 }}>
                        <span style={{ fontSize: 11, color: C.mute }}>Midline Falx Shift</span>
                        <div style={{ font: '700 20px Sora', color: C.coral, marginTop: 2 }}>{selectedCase.midlineShift}</div>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: C.mute, marginTop: 6, lineHeight: 1.5 }}>
                      <b>Findings:</b> {selectedCase.findings}
                    </div>
                  </div>

                  {/* Abnormalities Breakdown */}
                  <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#fff' }}>Hemorrhage & Calvarial Abnormalities</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedCase.abnormalities.map((a, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: idx < selectedCase.abnormalities.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {a.critical ? <AlertTriangle style={{ width: 13, height: 13, color: C.red }} /> : <CheckCircle2 style={{ width: 13, height: 13, color: C.teal }} />}
                            <span style={{ color: a.critical ? '#fff' : C.mute }}>{a.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: C.mute, fontSize: 11 }}>{a.location}</span>
                            <span style={{ fontWeight: 600, color: a.probability > 80 ? C.red : C.mute }}>
                              {a.probability}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* STAT Neuro-OR Activation Button */}
                  <div style={{ background: 'rgba(255,69,58,.06)', border: '1px solid rgba(255,69,58,.3)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ font: '600 13px Sora', color: '#fff' }}>Trauma Center Escalation</div>
                      {statPagingActivated && (
                        <span style={{ fontSize: 11, color: C.teal, fontWeight: 700 }}>PAGER DISPATCHED</span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: 12, color: C.mute, lineHeight: 1.5 }}>
                      {selectedCase.recommendedAction}
                    </p>
                    <button
                      onClick={handleActivateSTAT}
                      className={`qer-btn ${statPagingActivated ? 'qer-btn' : 'qer-btn-stat'}`}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Siren style={{ width: 16, height: 16 }} />
                      {statPagingActivated ? 'Neurosurgery & OR Team Notified (ACK Received)' : 'Activate STAT Neuro-OR Pager & Trauma Escalation'}
                    </button>
                  </div>

                  {/* RBAC Sign-off Console */}
                  <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ font: '600 13px Sora', color: '#fff' }}>STAT Physician Sign-Off</div>
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
                          className="qer-btn qer-btn-p"
                          style={{ padding: '6px 16px', fontSize: 12 }}
                        >
                          Sign STAT Report
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
        <section className="qer-section" id="other-suites">
          <div className="qer-wrap">
            <h2 className="qer-h2">Explore Other MiPAAS Clinical Intelligence Suites</h2>
            <p className="qer-sub">
              Cross-disciplinary deep learning solutions spanning oncology, cardiology, neurology, and acute emergency care.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <Link href="/lung-cancer" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="qer-tag">LDCT · Oncology</span>
                <h3>qCT Lung Cancer</h3>
                <p>3D nodule segmentation & 6-year Sybil cancer risk prediction.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/cardiac" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="qer-tag">Cine MRI · Cardiology</span>
                <h3>qCardiac Heart AI</h3>
                <p>ACDC U-Net biventricular volumes & 17-segment AHA wall motion.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/brain-tumor" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="qer-tag">Multi-Seq MRI · Neuro</span>
                <h3>qBrain Tumor AI</h3>
                <p>BraTS SegResNet multi-compartment glioma & WHO grading.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/qxr" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="qer-tag" style={{ color: C.teal, background: 'rgba(0,220,206,.15)' }}>Frontal CXR · Radiography</span>
                <h3>qXR Chest Pathology</h3>
                <p>CheXNet 14-pathology multi-label classification with Grad-CAM++.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/stroke" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="qer-tag" style={{ color: C.amber, background: 'rgba(245,166,35,.15)' }}>CT / CTA · Neurovascular</span>
                <h3>qStroke Acute Care</h3>
                <p>Circle of Willis LVO detection & automated 10-point ASPECTS matrix.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  View Suite <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </Link>

              <Link href="/tb" className="feat-card" style={{ textDecoration: 'none', display: 'block' }}>
                <span className="qer-tag" style={{ color: C.amber, background: 'rgba(245,166,35,.15)' }}>CXR · Global Health</span>
                <h3>qTrack TB Monitoring</h3>
                <p>WHO CAD4TB cavitary lesion segmentation & GeneXpert sputum triage.</p>
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
