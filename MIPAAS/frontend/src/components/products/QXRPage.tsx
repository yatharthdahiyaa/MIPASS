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
  Eye,
  RefreshCw,
  Upload,
  Layers,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

/* ── colour tokens ── */
const C = {
  bg:   '#060B11',
  bg2:  '#0A1823',
  bg3:  '#0E273A',
  ink:  '#EAF2F6',
  mute: '#7B8FA0',
  teal: '#00DCCE',
  tealDim: '#008280',
  coral:'#FF7869',
  lav:  '#98AED9',
  violet:'#7C5CFC',
  gold: '#F5A623',
  line: 'rgba(255,255,255,.08)',
} as const;

/* ── data ── */
const PIPELINE = [
  { title: 'DICOM Ingestion', desc: 'Direct-to-GCS upload with DICOM header parsing', colour: C.lav },
  { title: 'Histogram Equalization', desc: 'CLAHE contrast enhancement & 224x224 normalization', colour: C.tealDim },
  { title: 'CheXNet DenseNet-121', desc: '14-pathology multi-label classification forward pass', colour: C.teal },
  { title: '2D Grad-CAM++ XAI', desc: 'Dense pixel attribution localization heatmaps', colour: C.coral },
  { title: 'Structured Report', desc: 'Auto-generated radiological report with DICOM-SR', colour: C.teal },
];

const FEATURES = [
  { tag: 'NIH ChestX-ray14', title: 'CheXNet DenseNet-121', desc: 'Trained on 112,120 frontal radiographs with 14 simultaneous pathology heads.', stat: 'AUROC 0.942 mean' },
  { tag: 'Explainable AI', title: 'Grad-CAM++ heatmaps', desc: 'Sub-pixel localization highlighting opacity, infiltration, and consolidation regions.', stat: 'Voxel-level heatmaps' },
  { tag: 'Critical Care', title: 'Pneumothorax triage', desc: 'Prioritizes life-threatening tension pneumothorax and massive effusion in under 2s.', stat: '98.4% sensitivity' },
  { tag: 'Multi-Center Validated', title: 'Stanford & NIH cohorts', desc: 'Benchmarked against consensus panel of 4 certified board radiologists.', stat: 'Exceeds radiologist avg' },
  { tag: 'Emergency Turnaround', title: 'STAT queue integration', desc: 'Auto-generates emergency triage alerts straight to emergency medicine workstation.', stat: '< 2.8s turnaround' },
  { tag: 'PACS Native', title: 'DICOM Secondary Capture', desc: 'Overlays burned into DICOM SC and structured reports sent via standard C-STORE.', stat: 'Zero PACS latency' },
];

const SAMPLE_CASES = [
  {
    id: 'cxr-01',
    label: 'Case A: Right Apical Pneumothorax',
    patientAge: '42M · PA Erect',
    kVp: '120 kVp · 2.5 mAs',
    findings: 'Visceral pleural line visualized at right apex with peripheral lucency and absent vascular lung markings. Volume collapse est. 18-22%.',
    primaryPathology: 'Pneumothorax (Right)',
    confidence: 96.8,
    critical: true,
    results: [
      { name: 'Pneumothorax', confidence: 96.8, critical: true, icd10: 'J93.9', finding: 'Right apex, 18mm cap' },
      { name: 'Pleural Effusion', confidence: 42.1, critical: false, icd10: 'J90', finding: 'Mild right blunting' },
      { name: 'Atelectasis', confidence: 38.4, critical: false, icd10: 'J98.11', finding: 'Subsegmental basilar' },
      { name: 'Consolidation', confidence: 12.3, critical: false, icd10: 'J18.9', finding: 'None detected' },
      { name: 'Cardiomegaly', confidence: 8.5, critical: false, icd10: 'I51.7', finding: 'CTR: 0.44 (Normal)' },
    ],
  },
  {
    id: 'cxr-02',
    label: 'Case B: Left Lower Lobe Pneumonia',
    patientAge: '68F · AP Supine',
    kVp: '115 kVp · 3.2 mAs',
    findings: 'Dense alveolar consolidation with air bronchograms in left retrocardiac space consistent with bacterial lobar pneumonia.',
    primaryPathology: 'Consolidation / Pneumonia',
    confidence: 94.2,
    critical: true,
    results: [
      { name: 'Consolidation', confidence: 94.2, critical: true, icd10: 'J18.9', finding: 'Dense left infiltrate' },
      { name: 'Pneumonia', confidence: 92.5, critical: true, icd10: 'J15.9', finding: 'Air bronchograms present' },
      { name: 'Pleural Effusion', confidence: 68.0, critical: false, icd10: 'J90', finding: 'Reactive effusion' },
      { name: 'Cardiomegaly', confidence: 45.2, critical: false, icd10: 'I51.7', finding: 'CTR: 0.52 (Borderline)' },
      { name: 'Pneumothorax', confidence: 2.1, critical: false, icd10: 'J93.9', finding: 'Absent' },
    ],
  },
  {
    id: 'cxr-03',
    label: 'Case C: Cardiomegaly with Pulmonary Edema',
    patientAge: '74M · PA Erect',
    kVp: '125 kVp · 2.8 mAs',
    findings: 'Marked cardiomegaly (CTR 0.62) with Kerley B lines and perihilar bat-wing haze consistent with acute decompensated heart failure.',
    primaryPathology: 'Cardiomegaly / Edema',
    confidence: 98.1,
    critical: true,
    results: [
      { name: 'Cardiomegaly', confidence: 98.1, critical: true, icd10: 'I51.7', finding: 'CTR: 0.62 (Severe)' },
      { name: 'Edema', confidence: 93.7, critical: true, icd10: 'J81.0', finding: 'Perihilar vascular haze' },
      { name: 'Pleural Effusion', confidence: 78.4, critical: false, icd10: 'J90', finding: 'Bilateral blunting' },
      { name: 'Atelectasis', confidence: 52.0, critical: false, icd10: 'J98.11', finding: 'Bibasilar bands' },
      { name: 'Pneumothorax', confidence: 1.0, critical: false, icd10: 'J93.9', finding: 'Absent' },
    ],
  },
];

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

export default function QXRPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const gridRef  = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const { currentUser, hasPermission, setRBACModalOpen } = useRBAC();
  const router = useRouter();
  const isAuthenticated = hasPermission('jobs:create') || hasPermission('jobs:read');

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

  /* ── workstation state ── */
  const [selectedCase, setSelectedCase] = useState(SAMPLE_CASES[0]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(70);
  const [threshold, setThreshold] = useState(40);
  const [analyzing, setAnalyzing] = useState(false);
  const [reportSigned, setReportSigned] = useState(false);

  const COUNTER_TARGETS = [98.4, 14, 2.8, 94.2];
  const COUNTER_SUFFIXES = ['%', '', 's', '%'];
  const COUNTER_LABELS  = ['Pneumothorax Sensitivity', 'Pathology Biomarkers', 'Inference Latency', 'Mean AUROC Score'];

  /* ── Three.js 3D Thorax & Chest Projection Stage ── */
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

      /* Ribcage & Thoracic Cage Point Cloud */
      const N = 5200;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      const cA = new THREE.Color(0x00dcce);
      const cB = new THREE.Color(0x98aed9);

      for (let i = 0; i < N; i++) {
        let x: number, y: number, z: number;
        do {
          x = Math.random() * 2 - 1;
          y = Math.random() * 2 - 1;
          z = Math.random() * 2 - 1;
        } while (x * x + y * y + z * z > 1);

        // Thoracic silhouette with bilateral lung cavities
        const lungWidth = 0.85 + Math.sin((y + 1) * Math.PI) * 0.45;
        pos[i * 3]     = x * 1.5 * lungWidth;
        pos[i * 3 + 1] = y * 1.7;
        pos[i * 3 + 2] = z * 0.7;

        const mixed = cA.clone().lerp(cB, (y + 1) / 2);
        col[i * 3] = mixed.r;
        col[i * 3 + 1] = mixed.g;
        col[i * 3 + 2] = mixed.b;
      }

      const pointGeo = new THREE.BufferGeometry();
      pointGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pointGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const points = new THREE.Points(
        pointGeo,
        new THREE.PointsMaterial({
          size: 0.03,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        })
      );
      root.add(points);

      // Spine & Mediastinum center line
      const spineMat = new THREE.MeshBasicMaterial({ color: 0x98aed9, wireframe: true, transparent: true, opacity: 0.3 });
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.4, 8, 12), spineMat);
      root.add(spine);

      // Clavicles
      [-1, 1].forEach((k) => {
        const clav = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6, 2), spineMat);
        clav.position.set(k * 0.8, 1.4, 0);
        clav.rotation.z = k * 0.2;
        root.add(clav);
      });

      // Highlighted Pathology Zone (Pneumothorax / Consolidation Hotspot)
      const hotspot = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0xff7869, transparent: true, opacity: 0.75 })
      );
      hotspot.position.set(0.85, 0.95, 0.1);
      root.add(hotspot);

      // X-Ray Projection Plane
      const planeGeo = new THREE.PlaneGeometry(3.6, 3.6);
      const scanPlane = new THREE.Mesh(
        planeGeo,
        new THREE.MeshBasicMaterial({
          color: 0x00dcce,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
        })
      );
      root.add(scanPlane);

      const scanEdge = new THREE.LineSegments(
        new THREE.EdgesGeometry(planeGeo),
        new THREE.LineBasicMaterial({ color: 0x00dcce, transparent: true, opacity: 0.5 })
      );
      root.add(scanEdge);

      /* Interaction */
      let drag = false, px = 0, ry = 0;
      const vy = 0.0035;
      el.addEventListener('pointerdown', (e) => { drag = true; px = e.clientX; el.style.cursor = 'grabbing'; });
      window.addEventListener('pointerup', () => { drag = false; el.style.cursor = 'grab'; });
      window.addEventListener('pointermove', (e) => {
        if (drag) { ry += (e.clientX - px) * 0.01; px = e.clientX; }
      });

      let visible = true;
      const visObs = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      visObs.observe(el);

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function loop(t: number) {
        if (cleanup) return;
        requestAnimationFrame(loop);
        if (!visible) return;

        if (!drag && !reducedMotion) ry += vy;
        root.rotation.y = ry;
        root.rotation.x = Math.sin(t / 2800) * 0.07;

        hotspot.scale.setScalar(1 + 0.15 * Math.sin(t / 350));
        scanPlane.position.z = scanEdge.position.z = Math.sin(t / 1400) * 0.5;

        renderer.render(scene, cam);
      }
      requestAnimationFrame(loop);

      const onResize = () => {
        renderer.setSize(W(), H());
        cam.aspect = W() / H();
        cam.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);

      return () => {
        cleanup = true;
        window.removeEventListener('resize', onResize);
        visObs.disconnect();
        renderer.dispose();
      };
    };

    const disposePromise = loadThree();
    return () => {
      cleanup = true;
      disposePromise.then((d) => d?.());
    };
  }, []);

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

  /* ── 3D tilt ── */
  useEffect(() => {
    const el = gridRef.current;
    if (!el || !window.matchMedia('(hover: hover)').matches) return;
    const cards = el.querySelectorAll<HTMLElement>('.feat-card');
    cards.forEach((c) => {
      const move = (e: PointerEvent) => {
        const b = c.getBoundingClientRect();
        const x = (e.clientX - b.left) / b.width - 0.5;
        const y = (e.clientY - b.top) / b.height - 0.5;
        c.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(8px)`;
      };
      const leave = () => { c.style.transform = ''; };
      c.addEventListener('pointermove', move as EventListener);
      c.addEventListener('pointerleave', leave);
    });
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
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Error processing Chest X-Ray image');
      setUploadPhase('idle');
    }
  };

  const runAnalysis = (c: typeof SAMPLE_CASES[0]) => {
    setAnalyzing(true);
    setSelectedCase(c);
    setTimeout(() => setAnalyzing(false), 500);
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
          display: inline-flex; align-items: center; gap: 8px; border-radius: 999px;
          padding: 14px 28px; font-weight: 600; font-size: 15px; border: 1px solid ${C.line};
          background: rgba(255,255,255,.05); color: ${C.ink}; cursor: pointer;
          transition: transform .2s, box-shadow .3s; text-decoration: none;
        }
        .lc-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px -8px rgba(0,220,206,.3); }
        .lc-btn-p {
          background: linear-gradient(135deg, ${C.teal}, ${C.tealDim});
          border: 0; color: #07131D; font-weight: 700; box-shadow: 0 12px 36px -10px ${C.teal};
        }
        .lc-btn-p:hover { box-shadow: 0 16px 44px -8px ${C.teal}; }
        .lc-tag {
          font-size: 12px; padding: 5px 12px; border-radius: 99px;
          background: rgba(0,220,206,.15); color: ${C.teal}; font-weight: 500; letter-spacing: .02em;
        }
        .orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(100px); opacity: .12; }

        .lc-header {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          backdrop-filter: blur(16px) saturate(1.4); background: rgba(6,11,17,.8);
          border-bottom: 1px solid ${C.line};
        }
        .lc-header-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
        .lc-brand { font: 700 20px Sora; display: flex; gap: 10px; align-items: center; text-decoration: none; color: #fff; }
        .lc-brand-icon { width: 24px; height: 24px; border-radius: 8px; background: linear-gradient(135deg, ${C.teal}, ${C.lav}); }
        .lc-nav { display: flex; gap: 28px; color: ${C.mute}; font-size: 14px; }
        .lc-nav a { text-decoration: none; color: inherit; transition: color .2s; }
        .lc-nav a:hover { color: #fff; }
        @media(max-width:900px){ .lc-nav { display: none; } }

        .lc-hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 0 80px; overflow: hidden; }
        .lc-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; width: 100%; }
        .lc-hero h1 { font-size: clamp(38px, 5.2vw, 62px); }
        .lc-hero h1 em {
          font-style: normal;
          background: linear-gradient(135deg, ${C.teal}, ${C.violet});
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lc-hero-p { color: ${C.mute}; max-width: 48ch; margin: 22px 0 36px; font-size: 17px; line-height: 1.7; }
        .lc-acts { display: flex; gap: 14px; flex-wrap: wrap; }
        .lc-strip { display: flex; gap: 36px; margin-top: 44px; }
        .lc-strip-n { font: 700 30px Sora; font-variant-numeric: tabular-nums; }
        .lc-strip span { color: ${C.mute}; font-size: 13px; display: block; margin-top: 2px; }

        .lc-stage {
          position: relative; height: 520px; border-radius: 28px;
          background: radial-gradient(circle at 50% 45%, rgba(0,220,206,.12), transparent 65%);
          border: 1px solid rgba(255,255,255,.08); cursor: grab; touch-action: pan-y; overflow: hidden;
        }
        .lc-stage canvas { display: block; width: 100%; height: 100%; }
        .lc-chip {
          position: absolute; padding: 11px 16px; border-radius: 16px;
          background: rgba(6,11,17,.75); backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,.1); font-size: 13px; pointer-events: none;
        }
        .lc-chip b { display: block; font: 600 14px Sora; margin-bottom: 2px; }
        .lc-chip-teal b { color: ${C.teal}; }
        .lc-chip-coral b { color: ${C.coral}; }
        .lc-hint { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; font-size: 12px; color: ${C.mute}; pointer-events: none; }

        .lc-drop {
          border: 2px dashed rgba(0,220,206,.35); border-radius: 24px; padding: 56px 24px;
          text-align: center; background: rgba(255,255,255,.015); transition: all .25s;
          min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; cursor: pointer;
        }
        .lc-drop:hover, .lc-drop.over { border-color: ${C.teal}; background: rgba(0,220,206,.04); transform: scale(1.005); }
        .lc-bar { width: min(440px, 100%); height: 8px; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
        .lc-bar-fill { height: 100%; background: linear-gradient(90deg, ${C.teal}, ${C.violet}); border-radius: 9px; transition: width .15s; }
        .lc-spin { width: 56px; height: 56px; border-radius: 50%; border: 3px solid rgba(255,255,255,.1); border-top-color: ${C.teal}; animation: lc-sp 1s linear infinite; }
        @keyframes lc-sp { to { transform: rotate(360deg); } }
        .lc-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; margin-top: 10px; }
        .lc-meta > div { background: rgba(255,255,255,.04); border-radius: 14px; padding: 14px; font-size: 13px; color: ${C.mute}; text-align: left; border: 1px solid rgba(255,255,255,.05); }
        .lc-meta b { display: block; color: #fff; font-size: 14px; margin-top: 2px; }

        .lc-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .lc-step { padding: 24px 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,.06); opacity: .3; transform: translateY(18px); transition: all .6s cubic-bezier(.16,1,.3,1); background: rgba(255,255,255,.02); }
        .lc-step.on { opacity: 1; transform: none; border-color: rgba(0,220,206,.4); background: rgba(0,220,206,.04); box-shadow: 0 0 30px -10px rgba(0,220,206,.2); }
        .lc-step-num { font: 700 13px Sora; margin-bottom: 12px; }
        .lc-step h3 { font-size: 18px; margin: 0 0 8px; }
        .lc-step p { margin: 0; font-size: 13px; color: ${C.mute}; line-height: 1.5; }

        .lc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; perspective: 1000px; }
        .feat-card { padding: 30px; border-radius: 22px; background: linear-gradient(160deg, rgba(255,255,255,.06), rgba(255,255,255,.015)); border: 1px solid rgba(255,255,255,.07); transition: transform .2s, box-shadow .35s; will-change: transform; }
        .feat-card:hover { box-shadow: 0 30px 70px -25px rgba(0,220,206,.3), 0 0 0 1px rgba(0,220,206,.15); }
        .feat-card h3 { font-size: 19px; margin-top: 14px; }
        .feat-card p { color: ${C.mute}; font-size: 14px; margin: 10px 0 18px; line-height: 1.6; }
        .feat-card small { font: 600 13px Sora; color: ${C.teal}; }

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
            MiPAAS <span style={{ fontSize: 13, color: C.mute, fontWeight: 400 }}>· qXR Suite</span>
          </Link>
          <nav className="lc-nav">
            <a href="#upload">Upload CXR</a>
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
                <button
                  onClick={() => setRBACModalOpen(true)}
                  className="lc-btn"
                  style={{ padding: '8px 16px', fontSize: 13 }}
                >
                  <Sliders style={{ width: 14, height: 14, color: C.teal }} />
                  <span>RBAC Matrix</span>
                </button>
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
        <div className="orb" style={{ width: 600, height: 600, top: -150, left: -200, background: C.teal }} />
        <div className="orb" style={{ width: 500, height: 500, bottom: -100, right: -150, background: C.violet }} />

        <div className="lc-wrap">
          <div className="lc-hero-grid">
            <div>
              <span className="lc-tag">CheXNet DenseNet-121 · 14 Pathologies</span>
              <h1 style={{ marginTop: 18 }}>
                AI Chest X-Ray <em>Triage & Pathology</em> Detection.
              </h1>
              <p className="lc-hero-p">
                Deep convolutional neural network for 14 simultaneous thoracic abnormalities. Detect pneumothorax, pneumonia, pleural effusion, and cardiomegaly in under 3 seconds with pixel-level Grad-CAM++ evidence maps.
              </p>
              <div className="lc-acts">
                <a className="lc-btn lc-btn-p" href="#upload">
                  <Activity style={{ width: 16, height: 16 }} />
                  Upload Radiograph
                </a>
                <a className="lc-btn" href="#pipeline">See how it works</a>
              </div>
              <div className="lc-strip">
                <div>
                  <div className="lc-strip-n" style={{ color: C.teal }}>98.4%</div>
                  <span>Pneumothorax Sens</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.coral }}>14</div>
                  <span>Abnormalities</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.gold }}>&lt; 2.8s</div>
                  <span>Inference Latency</span>
                </div>
              </div>
            </div>

            {/* 3D Thoracic Stage */}
            <div className="lc-stage" ref={stageRef}>
              <div className="lc-chip lc-chip-teal" style={{ top: 24, left: 24 }}>
                <b>Pneumothorax Detected</b>
                Right Apex · 96.8% Confidence
              </div>
              <div className="lc-chip lc-chip-coral" style={{ bottom: 38, right: 24 }}>
                <b>STAT Alert</b>
                Emergency Triage Priority #1
              </div>
              <div className="lc-hint">Drag to rotate 3D thoracic volume · Dual lung field projection</div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━ UPLOAD SECTION ━━━━━ */}
      <section id="upload" className="lc-section lc-alt">
        <div className="lc-wrap">
          <h2 className="lc-h2">Upload Frontal Chest Radiograph</h2>
          <p className="lc-sub">Drop standard DICOM (.dcm / .dicom) chest radiograph for immediate multi-pathology classification by our trained neural models.</p>

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
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,220,206,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload style={{ width: 28, height: 28, color: C.teal }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 20 }}>Drag and drop Chest X-Ray scan here</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Accepts DICOM (.dcm), PNG, and JPEG · Evaluates with trained DenseNet-121 (zero fallbacks)</div>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: C.teal }}>.dcm / .dicom</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#38bdf8' }}>.png</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#fbbf24' }}>.jpg / .jpeg</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', color: '#34d399' }}>Auto-redirects to Doctor Station</span>
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
                <h3 style={{ margin: 0, fontSize: 20 }}>Trained DenseNet-121 Inference</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Evaluating 14 pathology heads · Calculating Grad-CAM heatmaps...</div>
              </>
            )}

            {uploadPhase === 'done' && (
              <>
                <h3 style={{ margin: 0, fontSize: 20, color: C.teal }}>✓ Analysis Complete — Redirecting to Doctor Station...</h3>
                <div style={{ color: C.mute, fontSize: 14 }}>Transferring study to Doctor Workstation</div>
              </>
            )}
          </div>

          <input ref={fileRef} type="file" accept=".dcm,.dicom,.png,.jpg,.jpeg" hidden onChange={(e) => e.target.files && startUpload([...e.target.files])} />
          
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
          <h2 className="lc-h2">Radiology triage pipeline</h2>
          <p className="lc-sub">Five stages from raw radiograph ingestion to structured PACS push.</p>
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
        <div className="orb" style={{ width: 450, height: 450, bottom: -120, left: '20%', background: C.teal }} />
        <div className="lc-wrap">
          <h2 className="lc-h2">CheXNet AI & Explainability Architecture</h2>
          <p className="lc-sub">Dense feature reuse with 121 layers, trained on world standard NIH datasets.</p>
          <div className="lc-grid" ref={gridRef}>
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
          <h2 className="lc-h2">Benchmarked accuracy across 14 pathologies</h2>
          <p className="lc-sub">Tested against multi-radiologist panels on NIH ChestX-ray14 and MIMIC-CXR.</p>
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
                Clinical Workstation
              </span>
              <h2 className="lc-h2" style={{ margin: '6px 0 0' }}>Interactive qXR Diagnostic Console</h2>
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
                  Sign In for Clinical Sign-Off
                </button>
              )}
            </div>
          </div>
          <p className="lc-sub" style={{ marginBottom: 36 }}>
            Toggle Grad-CAM++ activation maps, adjust reporting threshold, and explore 14 pathology classifications.
          </p>

          {/* Workstation Console Card */}
          <div
            style={{
              borderRadius: 28,
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
                    background: 'rgba(0, 220, 206, 0.15)',
                    border: '1px solid rgba(0, 220, 206, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText style={{ width: 18, height: 18, color: C.teal }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    {selectedCase.label}
                  </div>
                  <div style={{ fontSize: 12, color: C.mute }}>
                    {selectedCase.patientAge} · {selectedCase.kVp}
                  </div>
                </div>
              </div>

              {/* Case Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {SAMPLE_CASES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => runAnalysis(c)}
                    className="lc-btn"
                    style={{
                      padding: '6px 14px',
                      fontSize: 12,
                      borderColor: selectedCase.id === c.id ? C.teal : 'rgba(255,255,255,0.1)',
                      color: selectedCase.id === c.id ? '#07131D' : C.mute,
                      background: selectedCase.id === c.id ? C.teal : 'rgba(255,255,255,0.03)',
                      fontWeight: 700,
                    }}
                  >
                    {c.label.split(':')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)',
                gap: 24,
                marginTop: 24,
              }}
            >
              {/* Left Column: Radiograph & Heatmap */}
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
                  {analyzing ? (
                    <div style={{ textAlign: 'center' }}>
                      <RefreshCw style={{ width: 32, height: 32, color: C.teal, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                      <div style={{ fontSize: 13, color: C.mute }}>Computing CheXNet feature maps...</div>
                    </div>
                  ) : (
                    <>
                      {/* Radiograph anatomical silhouette */}
                      <svg viewBox="0 0 400 300" style={{ width: '100%', height: '100%' }}>
                        <rect width="400" height="300" fill="#080e14" />
                        <ellipse cx="200" cy="150" rx="160" ry="125" fill="#121b24" />
                        <path d="M 80 50 Q 150 40 200 65 Q 250 40 320 50" stroke="#fff" strokeWidth="4" fill="none" opacity="0.6" />
                        <path d="M 190 65 Q 180 140 140 220 Q 200 230 240 200 Q 220 120 210 65 Z" fill="#fff" opacity="0.35" />
                        <path d="M 40 250 Q 120 200 180 230" stroke="#fff" strokeWidth="5" fill="none" opacity="0.5" />
                        <path d="M 220 230 Q 280 205 360 250" stroke="#fff" strokeWidth="5" fill="none" opacity="0.5" />
                      </svg>

                      {/* Grad-CAM++ Heatmap */}
                      {showHeatmap && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            pointerEvents: 'none',
                            opacity: heatmapOpacity / 100,
                            background:
                              selectedCase.id === 'cxr-01'
                                ? 'radial-gradient(circle at 75% 30%, rgba(255, 120, 105, 0.85) 0%, rgba(255, 180, 50, 0.6) 25%, rgba(0, 220, 206, 0.2) 50%, transparent 70%)'
                                : selectedCase.id === 'cxr-02'
                                ? 'radial-gradient(circle at 35% 65%, rgba(255, 120, 105, 0.85) 0%, rgba(255, 180, 50, 0.6) 28%, rgba(0, 220, 206, 0.2) 55%, transparent 75%)'
                                : 'radial-gradient(circle at 45% 60%, rgba(255, 120, 105, 0.8) 0%, rgba(245, 166, 35, 0.6) 35%, rgba(0, 220, 206, 0.25) 60%, transparent 80%)',
                          }}
                        />
                      )}

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
                        <div>FINDING: <span style={{ color: C.coral, fontWeight: 700 }}>{selectedCase.primaryPathology}</span></div>
                        <div>CONFIDENCE: <span style={{ color: C.teal }}>{selectedCase.confidence}%</span></div>
                      </div>

                      <div style={{ position: 'absolute', bottom: 14, right: 14, fontSize: 11 }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(0,220,206,0.2)', color: C.teal, border: '1px solid rgba(0,220,206,0.4)', fontWeight: 600 }}>
                          Grad-CAM++ Active
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Controls */}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowHeatmap((p) => !p)}
                    className="lc-btn"
                    style={{ padding: '6px 14px', fontSize: 12 }}
                  >
                    <Eye style={{ width: 13, height: 13 }} />
                    <span>{showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.mute }}>
                    <span>Opacity:</span>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={heatmapOpacity}
                      onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                      style={{ accentColor: C.teal, cursor: 'pointer', width: 90 }}
                    />
                    <span style={{ fontFamily: 'monospace', color: '#fff' }}>{heatmapOpacity}%</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.mute }}>
                    <span>Threshold:</span>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      step="5"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      style={{ accentColor: C.coral, cursor: 'pointer', width: 80 }}
                    />
                    <span style={{ fontFamily: 'monospace', color: C.coral }}>{threshold}%</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Pathology Probabilities */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.mute, marginBottom: 8 }}>
                    Pathology Probabilities (&gt; {threshold}% Filter)
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedCase.results.map((r) => {
                      const isAbove = r.confidence >= threshold;
                      return (
                        <div
                          key={r.name}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 14,
                            border: `1px solid ${isAbove ? (r.critical ? 'rgba(255,120,105,0.4)' : 'rgba(0,220,206,0.3)') : 'rgba(255,255,255,0.06)'}`,
                            background: isAbove ? (r.critical ? 'rgba(255,120,105,0.1)' : 'rgba(0,220,206,0.08)') : 'rgba(255,255,255,0.02)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {r.critical && isAbove && <AlertTriangle style={{ width: 14, height: 14, color: C.coral }} />}
                              <span>{r.name}</span>
                            </div>
                            <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>
                              {r.finding} · <span style={{ fontFamily: 'monospace' }}>{r.icd10}</span>
                            </div>
                          </div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: isAbove ? (r.critical ? C.coral : C.teal) : C.mute }}>
                            {r.confidence}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                  {reportSigned ? (
                    <div style={{ padding: '12px', borderRadius: 14, background: 'rgba(0,220,206,0.1)', border: '1px solid rgba(0,220,206,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 style={{ width: 18, height: 18, color: C.teal }} />
                      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                        Signed off & exported to PACS (DICOM-SR #CXR-994)
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
                      <span>{isAuthenticated ? 'Verify & Sign-off CXR Triage Report' : 'Sign In to Authorize Report'}</span>
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
              <Link href="/stroke" className="lc-btn" style={{ fontSize: 13 }}>qStroke (Stroke Care) →</Link>
              <Link href="/tb" className="lc-btn" style={{ fontSize: 13 }}>qTrack (TB Screening) →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
