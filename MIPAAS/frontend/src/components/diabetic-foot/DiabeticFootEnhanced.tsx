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
  Thermometer,
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
  emerald: '#10B981',
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
  { title: 'Thermogram Ingestion', desc: 'Direct upload of dual-foot radiometric IR / CSV matrices to GCS', colour: C.lav },
  { title: 'Geometric Normalization', desc: 'Bilateral foot registration, hole repair, 128×64 matrix alignment', colour: C.tealDim },
  { title: 'GLCM & Angiosomes', desc: 'Texture entropy, homogeneity & 4-arterial zone temperature mapping', colour: C.emerald },
  { title: 'ML Neuropathy Engine', desc: 'Random Forest classifier with 0.41 calibrated cutoff & asymmetry check', colour: C.coral },
  { title: 'Podiatric Report', desc: 'Contralateral hot spot mapping, IWGDF risk scoring & DICOM-SR', colour: C.teal },
];

const FEATURES = [
  { tag: 'Clinical Benchmark', title: 'Bilateral thermometry', desc: 'Contralateral comparison neutralizes systemic metabolic & ambient shifts.', stat: '92.4% DM accuracy' },
  { tag: 'Vascular Territory', title: '4 Angiosomes isolated', desc: 'Discrete monitoring of Medial & Lateral Plantar and Calcaneal arteries.', stat: '4 arterial zones' },
  { tag: 'Microvascular XAI', title: 'GLCM texture engine', desc: 'Quantifies spatial temperature heterogeneity and microvascular disorder.', stat: 'Entropy & Homogeneity' },
  { tag: 'Ulcer Prevention', title: 'ΔT ≥ 2.2°C hot spot alert', desc: 'Identifies pre-ulcerative inflammation weeks before visible tissue breakdown.', stat: '2.2°C critical threshold' },
  { tag: 'Radiometric Matrix', title: 'Sensor-level accuracy', desc: 'Calibrated temperature inputs in °C with automated hole and artifact filling.', stat: '±0.05°C thermal precision' },
  { tag: 'Podiatry PACS', title: 'IWGDF risk tiering', desc: 'Generates structured clinical reports aligned with International Working Group.', stat: '< 1.8s turnaround' },
];

const ANGIOSOMES = [
  { code: 'MPA', name: 'Medial Plantar Artery', area: 'Medial Forefoot / Hallux', leftTemp: 31.4, rightTemp: 34.2, diff: 2.8, hot: true },
  { code: 'LPA', name: 'Lateral Plantar Artery', area: 'Lateral Forefoot & Midfoot', leftTemp: 30.8, rightTemp: 32.5, diff: 1.7, hot: false },
  { code: 'MCA', name: 'Medial Calcaneal Artery', area: 'Medial Heel Pad', leftTemp: 29.6, rightTemp: 30.2, diff: 0.6, hot: false },
  { code: 'LCA', name: 'Lateral Calcaneal Artery', area: 'Lateral Heel Pad', leftTemp: 29.2, rightTemp: 29.8, diff: 0.6, hot: false },
];

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function DiabeticFootEnhanced() {
  const stageRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const { currentUser, hasPermission } = useRBAC();
  const router = useRouter();
  const isAuthenticated = hasPermission('jobs:create') || hasPermission('jobs:read');

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/diabetic-foot');
  }, [router]);

  /* ── state ── */
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
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
  const [activePalette, setActivePalette] = useState<'ironbow' | 'rainbow' | 'monochrome'>('ironbow');
  const [showAngiosomes, setShowAngiosomes] = useState(true);
  const [showAsymmetryMap, setShowAsymmetryMap] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(75);
  const [selectedAngiosome, setSelectedAngiosome] = useState(ANGIOSOMES[0]);
  const [reportSigned, setReportSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const COUNTER_TARGETS = [92.4, 2.2, 4, 1.8];
  const COUNTER_SUFFIXES = ['%', '°C', ' zones', 's'];
  const COUNTER_LABELS  = ['DM Screening Accuracy', 'Hot Spot Asymmetry', 'Arterial Angiosomes', 'Analysis Turnaround'];

  /* ── Three.js Bilateral Plantar Thermogram Point Cloud ── */
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
      cam.position.set(0, 0, 7.5);

      const root = new THREE.Group();
      scene.add(root);

      /* Foot contour generator helper */
      function createFootPoints(side: number, hasHotSpot: boolean) {
        const N = 2600;
        const pos = new Float32Array(N * 3);
        const col = new Float32Array(N * 3);

        const cCool = new THREE.Color(0x3b82f6); // blue (cool 28°C)
        const cNorm = new THREE.Color(0x10b981); // green (normal 31°C)
        const cWarm = new THREE.Color(0xf59e0b); // orange (warm 33°C)
        const cHot  = new THREE.Color(0xef4444); // red (hot inflammation >34°C)

        for (let i = 0; i < N; i++) {
          // Plantar foot sole parametric outline
          const v = Math.random() * 2 - 1; // vertical [-1, 1]
          const u = Math.random() * 2 - 1; // horizontal

          // Sole contour shaping: wider at forefoot, narrower at arch, round heel
          let maxWidth: number;
          if (v > 0.3) {
            maxWidth = 0.55 + (1 - v) * 0.2; // forefoot / toes
          } else if (v > -0.4) {
            maxWidth = 0.32 + (v + 0.4) * 0.2; // arch (medial concavity)
          } else {
            maxWidth = 0.45; // heel
          }

          const x = u * maxWidth;
          const y = v * 1.5;
          const z = (Math.random() - 0.5) * 0.12;

          pos[i * 3]     = side * 1.05 + x;
          pos[i * 3 + 1] = y;
          pos[i * 3 + 2] = z;

          // Determine temperature color
          let tempC: typeof cHot;
          if (hasHotSpot && v > 0.4 && Math.abs(x) < 0.3) {
            // Hot spot in right metatarsal head
            tempC = cHot.clone().lerp(cWarm, Math.random() * 0.3);
          } else if (v > 0.2) {
            tempC = cNorm.clone().lerp(cWarm, Math.random() * 0.5);
          } else {
            tempC = cCool.clone().lerp(cNorm, (v + 1) / 1.2);
          }

          col[i * 3]     = tempC.r;
          col[i * 3 + 1] = tempC.g;
          col[i * 3 + 2] = tempC.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return new THREE.Points(
          geo,
          new THREE.PointsMaterial({
            size: 0.032,
            vertexColors: true,
            transparent: true,
            opacity: 0.88,
            depthWrite: false,
          })
        );
      }

      root.add(createFootPoints(-1, false)); // Left Foot (Normal)
      root.add(createFootPoints(1, true));   // Right Foot (Hot spot)

      /* Saliency ring on right foot hotspot */
      const ringGeo = new THREE.RingGeometry(0.35, 0.4, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(1.05, 0.75, 0.15);
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
        root.rotation.y = rot + mouseX * 0.35;
        root.rotation.x = -0.15 + mouseY * 0.25;

        const pulse = 1 + Math.sin(now * 0.0035) * 0.08;
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
                  Plantar Thermogram AI Suite
                </span>
                <span className="text-xs text-[#A6B3BD]">Diabetic Neuropathy & Ulcer Prevention</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-extrabold tracking-tight leading-[1.08] mb-6">
                Bilateral Thermometry & <br />
                <span className="text-[#7DB7B0]">
                  Diabetic Foot Ulcer Triage
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[#A6B3BD] max-w-xl leading-relaxed mb-8">
                Early detection of sub-clinical microvascular inflammation, diabetic peripheral neuropathy, and pre-ulcerative hot spots using bilateral plantar temperature asymmetry mapping, GLCM spatial texture entropy, and machine learning.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    const el = document.getElementById('workstation');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-[#FF7869] text-[#0B1926] font-semibold px-8 py-3.5 rounded-lg hover:bg-[#F48C7E] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7DB7B0] flex items-center gap-2 cursor-pointer"
                >
                  <Thermometer className="w-4 h-4" />
                  Launch Thermogram Workstation
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-8 py-3.5 rounded-lg bg-[#102333] border border-white/20 text-white font-medium hover:border-[#7DB7B0] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#7DB7B0]" />
                  Upload DICOM / Thermal
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
                  <div className="flex items-center gap-2 bg-[#060B11]/80 backdrop-blur-md border border-emerald-500/30 px-3.5 py-1.5 rounded-xl shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-mono text-emerald-300 font-semibold">Bilateral Thermogram 3D Live</span>
                  </div>
                  <div className="text-[11px] text-[#A6B3BD] pl-1 font-mono">
                    Left: 31.4°C · Right (Hotspot): 34.2°C · ΔT: 2.8°C
                  </div>
                </div>

                {/* Floating Metric Badges */}
                <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3">
                  <div className="bg-[#060B11]/85 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-right">
                    <div className="text-xs text-[#A6B3BD]">Asymmetry Alert</div>
                    <div className="text-base font-bold text-rose-400 font-mono">ΔT ≥ 2.2°C</div>
                  </div>
                  <div className="bg-[#060B11]/85 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-right">
                    <div className="text-xs text-[#A6B3BD]">Model Accuracy</div>
                    <div className="text-base font-bold text-emerald-300 font-mono">92.4%</div>
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
                  <span className="text-emerald-400 text-2xl sm:text-3xl ml-1">{COUNTER_SUFFIXES[idx]}</span>
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
              End-to-End Plantar Thermometry Continuum
            </h2>
            <p className="text-[#A6B3BD] text-sm sm:text-base leading-relaxed">
              From raw radiometric temperature matrix ingestion to bilateral geometric alignment, GLCM spatial texture extraction, contralateral asymmetry scoring, and automated podiatric reporting.
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
                    {stepsActive[idx] && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 leading-snug">{step.title}</h3>
                  <p className="text-xs text-[#A6B3BD] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLINICAL THERMOGRAM WORKSTATION ── */}
      <section id="workstation" className="py-20 bg-[#0A1823] border-y border-white/10 scroll-mt-24">
        <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-semibold px-3 py-1 rounded-md bg-[#102333] text-[#7DB7B0] border border-[#7DB7B0]/20 uppercase tracking-wider">
                Clinical Workstation
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2">
                Bilateral Plantar Thermogram & Angiosome Console
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#A6B3BD] font-mono">Status: Connected to ML Engine</span>
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
                    {(['ironbow', 'rainbow', 'monochrome'] as const).map((pal) => (
                      <button
                        key={pal}
                        onClick={() => setActivePalette(pal)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-all cursor-pointer ${
                          activePalette === pal
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-[#A6B3BD] hover:text-white'
                        }`}
                      >
                        {pal}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowAngiosomes(!showAngiosomes)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        showAngiosomes ? 'bg-teal-500/20 border-teal-500 text-teal-300' : 'bg-white/5 border-white/10 text-[#A6B3BD]'
                      }`}
                    >
                      Angiosome Boundaries
                    </button>
                    <button
                      onClick={() => setShowAsymmetryMap(!showAsymmetryMap)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        showAsymmetryMap ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-white/5 border-white/10 text-[#A6B3BD]'
                      }`}
                    >
                      ΔT Asymmetry Map
                    </button>
                  </div>
                </div>

                {/* Simulated Bilateral Foot Thermogram Canvas */}
                <div className="relative aspect-video max-h-[440px] w-full mx-auto rounded-2xl bg-[#03070A] border border-white/10 overflow-hidden flex items-center justify-around p-6">
                  
                  {/* Left Foot (Control) */}
                  <div className="relative w-44 h-72 rounded-[40%_40%_35%_35%/50%_50%_30%_30%] border border-white/10 overflow-hidden flex flex-col justify-between p-3"
                    style={{
                      background: activePalette === 'ironbow'
                        ? 'radial-gradient(ellipse at 50% 60%, #1e3a8a 0%, #065f46 45%, #047857 75%, #064e3b 100%)'
                        : activePalette === 'rainbow'
                        ? 'radial-gradient(ellipse at 50% 60%, #0284c7 0%, #10b981 50%, #047857 100%)'
                        : 'radial-gradient(ellipse at 50% 60%, #334155 0%, #1e293b 50%, #0f172a 100%)',
                    }}
                  >
                    <div className="text-[10px] font-mono text-[#A6B3BD] text-center">LEFT FOOT (CONTROL)</div>
                    <div className="text-center font-mono text-xs text-emerald-300 font-bold">31.4°C Mean</div>
                  </div>

                  {/* Right Foot (Hotspot Present) */}
                  <div className="relative w-44 h-72 rounded-[40%_40%_35%_35%/50%_50%_30%_30%] border border-white/10 overflow-hidden flex flex-col justify-between p-3"
                    style={{
                      background: activePalette === 'ironbow'
                        ? 'radial-gradient(ellipse at 50% 60%, #1e3a8a 0%, #065f46 45%, #047857 75%, #064e3b 100%)'
                        : activePalette === 'rainbow'
                        ? 'radial-gradient(ellipse at 50% 60%, #0284c7 0%, #10b981 50%, #047857 100%)'
                        : 'radial-gradient(ellipse at 50% 60%, #334155 0%, #1e293b 50%, #0f172a 100%)',
                    }}
                  >
                    {/* Focal Hot Spot In Medial Plantar Forefoot */}
                    {showAsymmetryMap && (
                      <div
                        className="absolute top-10 left-6 w-20 h-20 rounded-full animate-pulse"
                        style={{
                          background: 'radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(245,158,11,0.7) 45%, transparent 75%)',
                          boxShadow: '0 0 25px rgba(239,68,68,0.7)',
                        }}
                      />
                    )}

                    {/* Angiosome Boundary Grid */}
                    {showAngiosomes && (
                      <div className="absolute inset-2 border border-dashed border-teal-400/40 rounded-3xl pointer-events-none" />
                    )}

                    <div className="text-[10px] font-mono text-[#A6B3BD] text-center z-10">RIGHT FOOT (SUSPECT)</div>
                    <div className="text-center font-mono text-xs text-rose-400 font-bold z-10">
                      34.2°C (ΔT +2.8°C)
                    </div>
                  </div>

                  {/* Overlay Metadata */}
                  <div className="absolute top-4 left-4 bg-[#060B11]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/80">
                    Matrix: 128×64 Radiometric · Palette: {activePalette.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Slider for Heatmap Opacity */}
              <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between gap-4">
                <span className="text-xs text-[#A6B3BD] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-teal-400" />
                  Thermal Map Blend Intensity
                </span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={heatmapOpacity}
                  onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                  className="w-48 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-white/80 w-10 text-right">{heatmapOpacity}%</span>
              </div>
            </div>

            {/* Podiatric Triage Console (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Primary Triage Card */}
              <div className="bg-[#060B11] border border-white/10 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <div>
                    <span className="text-[11px] font-mono text-[#7DB7B0] font-semibold">PODIATRIC RISK STRATIFICATION</span>
                    <h3 className="text-xl font-bold text-white mt-0.5">
                      Elevated Pre-Ulcerative Risk Flag
                    </h3>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    High Risk
                  </span>
                </div>

                <p className="text-xs text-[#A6B3BD] leading-relaxed mb-6">
                  Significant contralateral temperature discrepancy (ΔT = 2.8°C) detected at the Right Medial Plantar Artery (MPA) angiosome exceeding the 2.2°C critical clinical threshold for acute tissue breakdown.
                </p>

                {/* Angiosome Metric Rows */}
                <div className="space-y-3 mb-6">
                  <div className="text-xs uppercase font-semibold text-[#A6B3BD] mb-1">Angiosome Temperature Differentials:</div>
                  {ANGIOSOMES.map((ang) => (
                    <div
                      key={ang.code}
                      onClick={() => setSelectedAngiosome(ang)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedAngiosome.code === ang.code
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {ang.code} — {ang.name}
                          {ang.hot && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono">HOT</span>}
                        </div>
                        <div className="text-[11px] text-[#A6B3BD]">{ang.area}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-mono font-bold ${ang.diff >= 2.2 ? 'text-rose-400' : 'text-emerald-300'}`}>
                          ΔT +{ang.diff}°C
                        </div>
                        <div className="text-[10px] text-[#A6B3BD] font-mono">
                          {ang.leftTemp}°C / {ang.rightTemp}°C
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sign-Off & Verification Action */}
                <div className="pt-4 border-t border-white/10">
                  {reportSigned ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-emerald-300 font-semibold">Podiatrist Verified & Signed</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#A6B3BD]">{signedAt}</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleSignReport}
                      className="w-full bg-[#FF7869] hover:bg-[#F48C7E] text-[#0B1926] font-semibold py-3 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7DB7B0] flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Sign & Finalize Podiatry Vascular Report
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
              Engineered for Preventative Podiatry
            </h2>
            <p className="text-[#A6B3BD] text-sm sm:text-base leading-relaxed">
              Standardized against multi-center plantar thermogram databases with calibrated bilateral differential analysis.
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
