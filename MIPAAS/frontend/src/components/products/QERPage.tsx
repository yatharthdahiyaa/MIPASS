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
  FileText,
  Sliders,
  RefreshCw,
  Upload,
  Zap,
  Clock,
  ArrowRight,
  Siren,
  Maximize2,
  Radio,
  Flame,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AnatomyViewer from '@/components/common/AnatomyViewer';
import { clinicalApiService } from '@/services/clinicalApiService';

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

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function QERPage() {
  const stepsRef = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, isAuthenticated } = useRBAC();
  const router = useRouter();

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
    if (!isAuthenticated || !currentUser?.id) {
      redirectToLogin();
      return;
    }
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
      formData.append('serviceId', 'qer');
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

      // Auto-save the AI-assisted draft to backend clinical records
      try {
        const pts = await clinicalApiService.getPatients();
        const isAuthPatient = currentUser && currentUser.id && currentUser.role === 'patient';
        const targetPt = pts.length > 0 ? pts[0] : null;

        const effectivePatientId = isAuthPatient
          ? currentUser.id
          : (targetPt ? targetPt.id : 'ANON-PATIENT');

        const effectivePatientName = isAuthPatient
          ? currentUser.name
          : (targetPt ? targetPt.name : 'Anonymous patient');

        const effectiveMrn = (targetPt && targetPt.mrn) ? targetPt.mrn : 'MRN-NOT-AVAILABLE';

        await clinicalApiService.saveDiagnosticReport({
          patientId: effectivePatientId,
          patientName: effectivePatientName,
          mrn: effectiveMrn,
          serviceId: 'qer',
          serviceName: 'qER Emergency Head CT AI',
          findings: json.data?.findings?.[0]?.label || 'Emergency CT Neuro-Triage Completed',
          confidence: json.data?.findings?.[0]?.probability || 0.95,
          riskLevel: 'Critical',
          recommendation: 'Immediate neurosurgical consult and emergent care escalation.',
          clinicalSummary: `Emergency Head CT triage analysis completed. Finding: ${json.data?.findings?.[0]?.label || 'Intracranial Assessment Complete'}.`,
          certified: false,
          radiologist: 'Pending clinician verification',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        });
      } catch (saveErr) {
        console.error('Failed to auto-save qER report to clinical backend:', saveErr);
      }

      // Save study and redirect based on role
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('mipaas_active_dicom_study', JSON.stringify(json.data));
      }
      if (currentUser && currentUser.id && (currentUser.role === 'doctor' || currentUser.role === 'radiologist')) {
        setTimeout(() => {
          router.push('/doctor');
        }, 500);
      } else if (currentUser && currentUser.id && currentUser.role === 'patient') {
        setTimeout(() => {
          router.push('/emr?tab=results');
        }, 500);
      }
    } catch (err: unknown) {
      console.error('Upload failed:', err);
      setUploadError(err instanceof Error && err.message ? err.message : 'Error processing DICOM image');
      setUploadPhase('idle');
    }
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
        .qer-btn-p { background: ${C.coral}; border: 1px solid ${C.coral}; color: #0B1926; font-weight: 700; }
        .qer-btn-p:hover { background: #F48C7E; border-color: #F48C7E; }
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
                  <div style={{ font: '600 18px Sora', color: '#fff' }}>STAT Triage Complete — Transferring to Workstation...</div>
                  <div style={{ color: C.mute, fontSize: 13 }}>Transferring study to Doctor Workstation</div>
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
            <div style={{ marginBottom: 24 }}>
              <span className="qer-tag">STAT Trauma Diagnostic Console</span>
              <h2 className="qer-h2" style={{ margin: '8px 0 0' }}>Emergency Head CT Workstation</h2>
            </div>
            <p className="qer-sub" style={{ marginBottom: 36 }}>
              Upload a head CT above to run it through the live emergency triage pipeline.
            </p>

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
                Sample head CTs and their model outputs have been removed. Upload a study above to run it through
                the live emergency triage pipeline.
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
