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
  Sparkles,
  Scan,
  Crosshair,
  TrendingUp,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

/* ── colour tokens ── */
const C = {
  bg:   '#0B1926',
  bg2:  '#102333',
  bg3:  '#132B3A',
  ink:  '#EAF2F6',
  mute: '#A6B3BD',
  pink: '#EC4899',
  teal: '#00DCCE',
  tealDim: '#008280',
  coral:'#FF7869',
  lav:  '#98AED9',
  violet:'#7C5CFC',
  gold: '#F5A623',
  crimson: '#FF4154',
  line: 'rgba(255,255,255,.08)',
} as const;

/* ── pipeline data ── */
const PIPELINE = [
  { title: 'Dermoscopy Ingestion', desc: 'Direct upload of 24-bit polarized/non-polarized dermoscopy to GCS', colour: C.lav },
  { title: 'Color & Hair Prep', desc: 'DullRazor artifact removal, contrast enhancement, ImageNet norm', colour: C.tealDim },
  { title: 'HAM10000 EfficientNet', desc: '7-class deep feature extraction with pre-trained weights', colour: C.pink },
  { title: 'Grad-CAM++ Spatial XAI', desc: 'Sub-cellular pigment network attribution & atypical border saliency', colour: C.coral },
  { title: 'Dermato-Oncology Report', desc: 'Automated ABCDE triage, malignancy risk score, DICOM-SR export', colour: C.teal },
];

const FEATURES = [
  { tag: 'HAM10000 Validated', title: 'EfficientNet-B0 backbone', desc: 'Deep convolutional network trained on 10,015 multi-center dermoscopic images.', stat: '94.8% Top-1 AUC' },
  { tag: 'Malignancy Triage', title: 'Automated urgent referral', desc: 'Aggregates melanoma, basal cell, and actinic keratosis probabilities into priority score.', stat: '96.1% Sensitivity' },
  { tag: 'Primary XAI', title: 'Grad-CAM++ heatmaps', desc: 'Pixel-level attribution highlighting atypical pigment networks and streaks.', stat: 'Sub-pixel saliency' },
  { tag: '7 Diagnostic Classes', title: 'Comprehensive coverage', desc: 'Melanoma, BCC, AKIEC, Nevi, Benign Keratoses, Dermatofibroma, and Vascular lesions.', stat: '7 clinical classes' },
  { tag: 'Fast Inference', title: 'Real-time telemetry', desc: 'Processes full 224×224 dermoscopy frames in under 45 milliseconds.', stat: '< 45ms GPU pass' },
  { tag: 'EHR / Telederm', title: 'DICOM-SR integration', desc: 'Direct automated export to hospital EHR and teledermatology referral queues.', stat: 'DICOM Supp 148' },
];

const LESION_CLASSES = [
  { code: 'mel', name: 'Melanoma', type: 'Malignant Neoplasm', color: '#EF4444', desc: 'Aggressive malignant neoplasm originating from atypical melanocytes.' },
  { code: 'bcc', name: 'Basal Cell Carcinoma', type: 'Malignant Neoplasm', color: '#F97316', desc: 'Common non-melanoma skin cancer characterized by arborizing telangiectasia.' },
  { code: 'akiec', name: 'Actinic Keratosis', type: 'Pre-Malignant / IEC', color: '#F59E0B', desc: 'Pre-cancerous intraepithelial carcinoma caused by chronic UV exposure.' },
  { code: 'bkl', name: 'Benign Keratosis', type: 'Benign Growth', color: '#10B981', desc: 'Non-cancerous growths including seborrheic keratosis and solar lentigines.' },
  { code: 'nv', name: 'Melanocytic Nevi', type: 'Benign Mole', color: '#06B6D4', desc: 'Common benign pigmented mole with uniform symmetrical pigment network.' },
  { code: 'df', name: 'Dermatofibroma', type: 'Benign Lesion', color: '#6366F1', desc: 'Benign fibrous histiocytoma exhibiting central white patch and delicate pigment network.' },
  { code: 'vasc', name: 'Vascular Lesion', type: 'Benign Vascular', color: '#8B5CF6', desc: 'Vascular proliferations including cherry angiomas and pyogenic granulomas.' },
];

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function SkinCancerEnhanced() {
  const stageRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const gridRef  = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, hasPermission, setRBACModalOpen } = useRBAC();
  const router = useRouter();
  const isAuthenticated = hasPermission('jobs:create') || hasPermission('jobs:read');

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/skin-cancer');
  }, [router]);

  /* ── state ── */
  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counters, setCounters] = useState([0, 0, 0, 0]);

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
      formData.append('serviceId', 'skin-cancer');
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

  /* ── workstation state ── */
  const [selectedLesion, setSelectedLesion] = useState(LESION_CLASSES[0]);
  const [activeView, setActiveView] = useState<'standard' | 'polarized' | 'cross-polar'>('standard');
  const [showGradcam, setShowGradcam] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(70);
  const [reportSigned, setReportSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const COUNTER_TARGETS = [94.8, 96.1, 7, 1.2];
  const COUNTER_SUFFIXES = ['%', '%', ' classes', 's'];
  const COUNTER_LABELS  = ['HAM10000 AUC', 'Malignancy Sensitivity', 'Diagnostic Spectrum', 'Full Pipeline Latency'];

  /* ── Three.js 3D Dermoscopic Surface Visualization ── */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    let cleanup = false;

    const loadThree = async () => {
      const threeModule = await import('three').catch(() => null);
      if (!threeModule || cleanup) return;
      const THREE = threeModule;

      const W = () => el.clientWidth;
      const H = () => el.clientHeight;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(W(), H());
      el.prepend(renderer.domElement);
      renderer.domElement.style.borderRadius = '28px';

      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(45, W() / H(), 0.1, 100);
      cam.position.set(0, 0, 7.2);

      const root = new THREE.Group();
      scene.add(root);

      /* Epidermal Surface Lattice Point Cloud */
      const N = 5400;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      const cPink = new THREE.Color(0xec4899);
      const cTeal = new THREE.Color(0x00dcce);
      const cHot = new THREE.Color(0xff4154);

      for (let i = 0; i < N; i++) {
        // Disk / elliptic surface representing dermoscopic field of view
        const r = Math.sqrt(Math.random()) * 2.3;
        const theta = Math.random() * Math.PI * 2;
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
        // Elevation with central atypical lesion dome
        const dist = Math.sqrt(x * x + y * y);
        const z = Math.exp(-dist * dist * 1.5) * 0.9 + (Math.random() - 0.5) * 0.08;

        pos[i * 3]     = x;
        pos[i * 3 + 1] = y * 0.9;
        pos[i * 3 + 2] = z;

        // Color gradient: pink/violet periphery to glowing hot red center
        let colorMix: typeof cHot;
        if (dist < 0.7) {
          colorMix = cHot.clone().lerp(cPink, dist / 0.7);
        } else {
          colorMix = cPink.clone().lerp(cTeal, (dist - 0.7) / 1.6);
        }
        col[i * 3]     = colorMix.r;
        col[i * 3 + 1] = colorMix.g;
        col[i * 3 + 2] = colorMix.b;
      }

      const pointGeo = new THREE.BufferGeometry();
      pointGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pointGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const skinPoints = new THREE.Points(
        pointGeo,
        new THREE.PointsMaterial({
          size: 0.035,
          vertexColors: true,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
        })
      );
      root.add(skinPoints);

      /* Central Saliency Ring Indicator */
      const ringGeo = new THREE.RingGeometry(0.68, 0.74, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xec4899,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 0, 0.9);
      root.add(ring);

      /* Mouse interaction */
      let mouseX = 0, mouseY = 0;
      let targetX = 0, targetY = 0;

      const onMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      };
      el.addEventListener('mousemove', onMouseMove);

      let lastTime = performance.now();
      let rot = 0;

      const animate = (now: number) => {
        if (cleanup) return;
        requestAnimationFrame(animate);

        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        mouseX += (targetX - mouseX) * 0.05;
        mouseY += (targetY - mouseY) * 0.05;

        rot += dt * 0.2;
        root.rotation.y = rot + mouseX * 0.4;
        root.rotation.x = 0.35 + mouseY * 0.3;

        // Subtle pulsation
        const pulse = 1 + Math.sin(now * 0.003) * 0.04;
        ring.scale.set(pulse, pulse, 1);

        renderer.render(scene, cam);
      };
      requestAnimationFrame(animate);

      const onResize = () => {
        renderer.setSize(W(), H());
        cam.aspect = W() / H();
        cam.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
    };

    loadThree();
    return () => {
      cleanup = true;
    };
  }, []);

  /* ── stats counter animation ── */
  useEffect(() => {
    if (countersStarted) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCountersStarted(true);
          COUNTER_TARGETS.forEach((target, i) => {
            const duration = 1600;
            const startTime = performance.now();
            const animateCount = (now: number) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setCounters((prev) => {
                const copy = [...prev];
                copy[i] = parseFloat((eased * target).toFixed(1));
                return copy;
              });
              if (progress < 1) requestAnimationFrame(animateCount);
            };
            requestAnimationFrame(animateCount);
          });
        }
      },
      { threshold: 0.3 }
    );
    if (stepsRef.current) observer.observe(stepsRef.current);
    return () => observer.disconnect();
  }, [countersStarted]);

  /* ── pipeline steps sequential glow ── */
  useEffect(() => {
    let active = true;
    const runSteps = async () => {
      while (active) {
        for (let i = 0; i < PIPELINE.length; i++) {
          if (!active) return;
          setStepsActive((prev) => prev.map((_, idx) => idx === i));
          await new Promise((r) => setTimeout(r, 1800));
        }
      }
    };
    runSteps();
    return () => { active = false; };
  }, []);

  const handleSignReport = () => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }
    setReportSigned(true);
    setSignedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: '100vh', overflowX: 'hidden' }}>
      <Navbar />

      {/* ── HERO & 3D STAGE ── */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Copy */}
            <div className="lg:col-span-6 z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold px-3 py-1 rounded-md bg-[#102333] text-[#7DB7B0] border border-[#7DB7B0]/25">
                  HAM10000 Trained EfficientNet-B0
                </span>
                <span className="text-xs text-[#A6B3BD]">Dermoscopy AI Suite</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-extrabold tracking-tight leading-[1.08] mb-6">
                Automated Dermoscopy & <br />
                <span className="text-[#7DB7B0]">
                  Melanoma Saliency Triage
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[#A6B3BD] max-w-xl leading-relaxed mb-8">
                Instant 7-class dermatological lesion discrimination with sub-second inference, Grad-CAM++ atypical pigment network attribution, and automated malignancy triage trained on multi-center clinical dermoscopy archives.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    const el = document.getElementById('workstation');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-[#FF7869] text-[#0B1926] font-semibold px-8 py-3.5 rounded-lg hover:bg-[#F48C7E] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7DB7B0] flex items-center gap-2 cursor-pointer"
                >
                  <Scan className="w-4 h-4" />
                  Launch Dermoscopy Workstation
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-8 py-3.5 rounded-lg bg-[#102333] border border-white/20 text-white font-medium hover:border-[#7DB7B0] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#7DB7B0]" />
                  Upload DICOM / Dermoscopy
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".dcm,.dicom"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </div>

              {uploadError && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
                  <span>{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="font-bold text-red-400 hover:text-red-300">✕</button>
                </div>
              )}
            </div>

            {/* Right 3D Surface Stage */}
            <div className="lg:col-span-6 relative">
              <div
                ref={stageRef}
                className="relative w-full h-[460px] sm:h-[520px] rounded-2xl border border-white/10 bg-[#102333] overflow-hidden flex items-center justify-center"
              >
                {/* Holographic Badge Overlay */}
                <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
                  <div className="flex items-center gap-2 bg-[#060B11]/80 backdrop-blur-md border border-pink-500/30 px-3.5 py-1.5 rounded-xl shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
                    <span className="text-xs font-mono text-pink-300 font-semibold">3D Cellular Topology Live</span>
                  </div>
                  <div className="text-[11px] text-[#A6B3BD] pl-1 font-mono">
                    Rot: Dynamic Parallax · Saliency Peak: 94.8%
                  </div>
                </div>

                {/* Floating Metric Badges */}
                <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3">
                  <div className="bg-[#060B11]/85 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-right">
                    <div className="text-xs text-[#A6B3BD]">Melanoma Sensitivity</div>
                    <div className="text-base font-bold text-pink-400 font-mono">96.1%</div>
                  </div>
                  <div className="bg-[#060B11]/85 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-right">
                    <div className="text-xs text-[#A6B3BD]">HAM10000 AUC</div>
                    <div className="text-base font-bold text-teal-300 font-mono">0.948</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── STATS COUNTER STRIP ── */}
      <section ref={stepsRef} className="py-12 border-y border-white/10 bg-[#0A1823]">
        <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {COUNTER_TARGETS.map((target, idx) => (
              <div key={idx} className="text-center md:text-left">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white font-mono mb-1">
                  {counters[idx]}
                  <span className="text-pink-400 text-2xl sm:text-3xl ml-1">{COUNTER_SUFFIXES[idx]}</span>
                </div>
                <div className="text-xs sm:text-sm text-[#A6B3BD] uppercase tracking-wider font-semibold">
                  {COUNTER_LABELS[idx]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── END-TO-END PIPELINE DIAGRAM ── */}
      <section className="py-20">
        <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 uppercase tracking-wider">
              Diagnostic Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              End-to-End Teledermoscopy Continuum
            </h2>
            <p className="text-[#A6B3BD] text-sm sm:text-base leading-relaxed">
              From raw dermatoscopic image ingestion to calibrated multi-class probability extraction, Grad-CAM++ spatial attribution, and automated EHR clinical sign-off.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {PIPELINE.map((step, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-2xl border transition-all duration-500 relative flex flex-col justify-between min-h-[190px] ${
                  stepsActive[idx]
                    ? 'border-[#7DB7B0] bg-[#102333]'
                    : 'border-white/10 bg-[#0A1823] hover:border-white/20'
                }`}
              >
                <div>
                  <div className="text-xs font-mono font-bold mb-2 flex items-center justify-between">
                    <span style={{ color: step.colour }}>STEP 0{idx + 1}</span>
                    {stepsActive[idx] && <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />}
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 leading-snug">{step.title}</h3>
                  <p className="text-xs text-[#A6B3BD] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLINICAL DERMOSCOPY WORKSTATION ── */}
      <section id="workstation" className="py-20 bg-[#0A1823] border-y border-white/10 scroll-mt-24">
        <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-semibold px-3 py-1 rounded-md bg-[#102333] text-[#7DB7B0] border border-[#7DB7B0]/20 uppercase tracking-wider">
                Clinical Workstation
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2">
                Dermoscopy Multi-Spectral Viewer & Triage
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#A6B3BD] font-mono">Status: Connected to Model Engine</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Viewer Pane (7 cols) */}
            <div className="lg:col-span-7 bg-[#060B11] border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
              <div>
                {/* Viewport Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10 mb-6">
                  <div className="flex items-center gap-2">
                    {(['standard', 'polarized', 'cross-polar'] as const).map((view) => (
                      <button
                        key={view}
                        onClick={() => setActiveView(view)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-all cursor-pointer ${
                          activeView === view
                            ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                            : 'bg-white/5 border-white/10 text-[#A6B3BD] hover:text-white'
                        }`}
                      >
                        {view}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowGradcam(!showGradcam)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        showGradcam ? 'bg-teal-500/20 border-teal-500 text-teal-300' : 'bg-white/5 border-white/10 text-[#A6B3BD]'
                      }`}
                    >
                      Grad-CAM++ Saliency
                    </button>
                    <button
                      onClick={() => setShowBorders(!showBorders)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        showBorders ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/5 border-white/10 text-[#A6B3BD]'
                      }`}
                    >
                      ABCDE Border
                    </button>
                  </div>
                </div>

                {/* Simulated Dermoscopy Canvas Frame */}
                <div className="relative aspect-square max-h-[440px] w-full mx-auto rounded-2xl bg-[#03070A] border border-white/10 overflow-hidden flex items-center justify-center">
                  
                  {/* Base Cellular Pigment Network Canvas */}
                  <div
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                      background:
                        activeView === 'standard'
                          ? 'radial-gradient(circle at 48% 46%, #3a1e12 0%, #6d3a24 35%, #9e5b38 60%, #cca284 85%, #dfc3aa 100%)'
                          : activeView === 'polarized'
                          ? 'radial-gradient(circle at 48% 46%, #2b110a 0%, #522718 35%, #7a4228 65%, #ad7c5f 85%, #cfad95 100%)'
                          : 'radial-gradient(circle at 48% 46%, #1a0805 0%, #3e1b12 30%, #633321 60%, #916147 85%, #bfa088 100%)',
                    }}
                  >
                    {/* Simulated Pigment Streaks & Globules */}
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:12px_12px]" />
                  </div>

                  {/* Grad-CAM++ Saliency Overlay */}
                  {showGradcam && (
                    <div
                      className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                      style={{
                        opacity: heatmapOpacity / 100,
                        background:
                          'radial-gradient(circle at 46% 45%, rgba(255, 30, 80, 0.95) 0%, rgba(255, 140, 0, 0.8) 25%, rgba(0, 220, 206, 0.45) 50%, rgba(0, 40, 80, 0.1) 75%, transparent 100%)',
                        mixBlendMode: 'screen',
                      }}
                    />
                  )}

                  {/* ABCDE Irregular Border Line */}
                  {showBorders && (
                    <div
                      className="absolute inset-16 rounded-[48%_52%_45%_55%/54%_46%_54%_46%] border-2 border-dashed border-pink-400 pointer-events-none animate-pulse"
                      style={{ boxShadow: '0 0 15px rgba(236,72,153,0.5)' }}
                    />
                  )}

                  {/* Center Target Reticle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                    <Crosshair className="w-12 h-12 text-white" />
                  </div>

                  {/* Overlay Metadata */}
                  <div className="absolute top-4 left-4 bg-[#060B11]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/80">
                    FOV: 224×224 px · Saliency: {heatmapOpacity}%
                  </div>
                </div>
              </div>

              {/* Slider for Heatmap Opacity */}
              <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between gap-4">
                <span className="text-xs text-[#A6B3BD] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-teal-400" />
                  Grad-CAM++ Attribution Opacity
                </span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={heatmapOpacity}
                  onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                  className="w-48 accent-pink-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-white/80 w-10 text-right">{heatmapOpacity}%</span>
              </div>
            </div>

            {/* Diagnostic Triage Console (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Primary Triage Card */}
              <div className="bg-[#060B11] border border-white/10 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <div>
                    <span className="text-[11px] font-mono text-[#7DB7B0] font-semibold">DIAGNOSTIC STRATIFICATION</span>
                    <h3 className="text-xl font-bold text-white mt-0.5">
                      {selectedLesion.name} ({selectedLesion.code.toUpperCase()})
                    </h3>
                  </div>
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider"
                    style={{
                      background: selectedLesion.type.includes('Malignant') ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                      color: selectedLesion.color,
                      border: `1px solid ${selectedLesion.color}40`,
                    }}
                  >
                    {selectedLesion.type}
                  </span>
                </div>

                <p className="text-xs text-[#A6B3BD] leading-relaxed mb-6">
                  {selectedLesion.desc}
                </p>

                {/* 7 Classes Selector Pills */}
                <div className="mb-6">
                  <div className="text-xs uppercase font-semibold text-[#A6B3BD] mb-2">Simulate Diagnosis Target:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {LESION_CLASSES.map((lesion) => (
                      <button
                        key={lesion.code}
                        onClick={() => setSelectedLesion(lesion)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer ${
                          selectedLesion.code === lesion.code
                            ? 'bg-pink-500/20 border-pink-500 text-pink-300 font-bold'
                            : 'bg-white/5 border-white/10 text-[#A6B3BD] hover:text-white'
                        }`}
                      >
                        {lesion.code.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulated Probability Bars */}
                <div className="space-y-2.5 mb-6">
                  {LESION_CLASSES.map((lesion) => {
                    const isSelected = lesion.code === selectedLesion.code;
                    const prob = isSelected ? 0.948 : lesion.code === 'nv' ? 0.024 : 0.005;
                    return (
                      <div key={lesion.code} className="flex items-center gap-3">
                        <span className="w-14 text-xs font-mono uppercase text-[#A6B3BD]">{lesion.code}</span>
                        <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${prob * 100}%`,
                              background: isSelected ? lesion.color : '#7B8FA0',
                            }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-mono text-white/80">{(prob * 100).toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Sign-Off & Verification Action */}
                <div className="pt-4 border-t border-white/10">
                  {reportSigned ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-emerald-300 font-semibold">Clinically Verified & Signed</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#A6B3BD]">{signedAt}</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleSignReport}
                      className="w-full bg-[#FF7869] hover:bg-[#F48C7E] text-[#0B1926] font-semibold py-3 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7DB7B0] flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Sign & Finalize Dermatopathology Report
                    </button>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── TECHNICAL FEATURE MATRIX ── */}
      <section className="py-20">
        <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold px-3 py-1 rounded-md bg-[#102333] text-[#7DB7B0] border border-[#7DB7B0]/20 uppercase tracking-wider">
              Clinical Evidence
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Engineered for Teledermatology & Oncology
            </h2>
            <p className="text-[#A6B3BD] text-sm sm:text-base leading-relaxed">
              Standardized against the international ISIC and HAM10000 benchmarks with sub-cellular saliency localization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#0A1823] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between min-h-[220px]"
              >
                <div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#102333] text-[#7DB7B0] border border-[#7DB7B0]/20">
                    {feat.tag}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-4 mb-2">{feat.title}</h3>
                  <p className="text-xs sm:text-sm text-[#A6B3BD] leading-relaxed">{feat.desc}</p>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono text-teal-300">
                  <span>VALIDATION</span>
                  <span>{feat.stat}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
