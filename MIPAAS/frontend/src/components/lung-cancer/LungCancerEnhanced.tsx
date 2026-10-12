'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRBAC } from '@/context/RBACContext';
import { ROLE_DEFINITIONS } from '@/types/rbac';
import {
  ShieldCheck,
  Stethoscope,
  Activity,
  Cpu,
  FileCheck2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
} from 'lucide-react';

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
  { title: 'Upload',         desc: 'Signed-URL direct to GCS bucket',                       colour: C.lav },
  { title: 'Preprocessing',  desc: 'HU window [−1000, 400], 1 mm³ isotropic resampling',     colour: C.tealDim },
  { title: 'AI Inference',    desc: 'Sybil transformer + 3D ResNet on GPU Cloud Run',         colour: C.teal },
  { title: 'Explainability',  desc: 'Grad-CAM++, Occlusion Sensitivity, Integrated Gradients',colour: C.coral },
  { title: 'Results',         desc: 'PDF report with DICOM-SR and heatmap viewer overlay',    colour: C.teal },
];

const FEATURES = [
  { tag: 'MONAI Compatible', title: '3D ResNet analysis',     desc: 'Volumetric CNN over the full scan.',              stat: '200 K+ training scans' },
  { tag: 'Primary XAI',      title: 'Grad-CAM++',             desc: 'Pixel-level attribution of the prediction.',      stat: 'Voxel-level maps' },
  { tag: 'NLST Validated',   title: 'Sybil risk prediction',  desc: 'Six-year cancer risk from a single CT.',          stat: 'AUC 0.94 at 6 years' },
  { tag: 'DeepSHAP',         title: 'Lesion segmentation',    desc: 'Outlines suspicious nodules for measurement.',    stat: 'Dice 0.87' },
  { tag: 'Validation XAI',   title: 'Occlusion sensitivity',  desc: 'Tests which regions change the score.',           stat: '8×8×8 sliding patch' },
  { tag: 'Captum Engine',    title: 'Integrated gradients',   desc: 'Traces the score back to input voxels.',          stat: '200 steps' },
];



type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function LungCancerEnhanced() {
  /* ── refs ── */
  const stageRef     = useRef<HTMLDivElement>(null);
  const stepsRef     = useRef<HTMLDivElement>(null);
  const gridRef      = useRef<HTMLDivElement>(null);
  const dropRef      = useRef<HTMLDivElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);

  /* ── RBAC context ── */
  const {
    currentUser,
    hasPermission,
    hasRole,
    addAuditLog,
    setRBACModalOpen,
    auditLogs,
  } = useRBAC();

  /* ── router for login redirect ── */
  const router = useRouter();

  const isAuthenticated = hasPermission('jobs:create') || hasPermission('jobs:read');

  const redirectToLogin = useCallback(() => {
    router.push('/login?redirect=/lung-cancer');
  }, [router]);

  /* ── state ── */
  const [stepsActive, setStepsActive] = useState<boolean[]>(PIPELINE.map(() => false));
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct]     = useState(0);
  const [uploadErr, setUploadErr]     = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [dragOver, setDragOver]       = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counters, setCounters]       = useState([0, 0, 0, 0]);

  /* ── clinical sign-off states ── */
  const [reportSigned, setReportSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signNotification, setSignNotification] = useState<string | null>(null);

  const COUNTER_TARGETS = [98.2, 94, 6, 2.8];
  const COUNTER_SUFFIXES = ['%', '%', '-year', 's'];
  const COUNTER_LABELS  = ['AUC score', 'Sensitivity', 'Risk window', 'Inference latency'];

  /* ── Three.js 3D lung visualisation ── */
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
      const cam   = new THREE.PerspectiveCamera(45, W() / H(), 0.1, 100);
      cam.position.set(0, 0, 7);

      const root = new THREE.Group();
      scene.add(root);

      /* point cloud lobe */
      function lobe(side: number) {
        const N = 5200;
        const pos = new Float32Array(N * 3);
        const col = new Float32Array(N * 3);
        const a = new THREE.Color(0x00dcce);
        const b = new THREE.Color(0x98aed9);
        for (let i = 0; i < N; i++) {
          let x: number, y: number, z: number;
          do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1);
          const t = (y + 1) / 2;
          const wx = 0.75 - 0.25 * (1 - t) * (1 - t) + (y > 0 ? 0 : 0.15);
          pos[i * 3]     = side * (0.95 + x * wx * (1 - 0.25 * (1 - t)));
          pos[i * 3 + 1] = y * 1.6;
          pos[i * 3 + 2] = z * 0.7 * (1 - 0.3 * (1 - t));
          const m = a.clone().lerp(b, Math.random());
          col[i * 3] = m.r; col[i * 3 + 1] = m.g; col[i * 3 + 2] = m.b;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
        return new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.028, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
      }
      root.add(lobe(-1), lobe(1));

      /* trachea & bronchi */
      const wireMat = new THREE.MeshBasicMaterial({ color: 0x98aed9, wireframe: true, transparent: true, opacity: 0.35 });
      const trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 10, 6), wireMat);
      trachea.position.y = 1.7;
      root.add(trachea);
      [-1, 1].forEach((k) => {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 8, 5), wireMat);
        br.position.set(k * 0.35, 0.75, 0);
        br.rotation.z = k * 0.55;
        root.add(br);
      });

      /* nodule */
      const nodule = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), new THREE.MeshBasicMaterial({ color: 0xff7869 }));
      nodule.position.set(1.05, 0.85, 0.15);
      root.add(nodule);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), new THREE.MeshBasicMaterial({ color: 0xff7869, transparent: true, opacity: 0.25 }));
      halo.position.copy(nodule.position);
      root.add(halo);

      /* scan plane */
      const planeGeo = new THREE.PlaneGeometry(3.6, 1.6);
      const scanPlane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: 0x00dcce, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
      scanPlane.rotation.x = Math.PI / 2;
      root.add(scanPlane);
      const scanEdge = new THREE.LineSegments(new THREE.EdgesGeometry(planeGeo), new THREE.LineBasicMaterial({ color: 0x00dcce }));
      scanEdge.rotation.x = Math.PI / 2;
      root.add(scanEdge);

      /* interaction */
      let drag = false, px = 0, ry = 0;
      const vy = 0.004;
      el.addEventListener('pointerdown', (e) => { drag = true; px = e.clientX; el.style.cursor = 'grabbing'; });
      window.addEventListener('pointerup', () => { drag = false; el.style.cursor = 'grab'; });
      window.addEventListener('pointermove', (e) => { if (drag) { ry += (e.clientX - px) * 0.01; px = e.clientX; } });

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
        root.rotation.x = Math.sin(t / 3000) * 0.08;
        const k = (Math.sin(t / 1800) + 1) / 2;
        scanPlane.position.y = scanEdge.position.y = -1.6 + k * 3.6;
        halo.scale.setScalar(1 + 0.35 * Math.sin(t / 300));
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
      disposePromise.then((dispose) => dispose?.());
    };
  }, []);

  /* ── pipeline step reveal ── */
  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    let ran = false;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ran) {
        ran = true;
        PIPELINE.forEach((_, i) => {
          setTimeout(() => setStepsActive((prev) => { const n = [...prev]; n[i] = true; return n; }), i * 420);
        });
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── 3D tilt on feature cards ── */
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

  /* ── counter intersection trigger ── */
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

  /* ── file upload logic ── */
  const VALID = /\.(dcm|dicom|nii|nii\.gz|zip)$/i;
  const MAX_SIZE = 2 * 1024 ** 3;
  const fmt = (b: number) => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : (b / 1e3).toFixed(0) + ' KB';

  const startUpload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploadErr('');

    const file = files[0];
    const name = file.name.toLowerCase();

    // STRICT DICOM VALIDATION: ONLY DICOM IMAGES REDIRECT TO DOCTOR
    if (!name.endsWith('.dcm') && !name.endsWith('.dicom')) {
      setUploadErr(
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
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadErr(err.message || 'Error processing DICOM image');
      setUploadPhase('idle');
    }
  }, [router]);

  const resetUpload = () => {
    setUploadPhase('idle');
    setUploadPct(0);
    setUploadFiles([]);
    setUploadErr('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRunAnalysis = () => {
    document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' });
    // re-trigger steps
    setStepsActive(PIPELINE.map(() => false));
    setTimeout(() => {
      PIPELINE.forEach((_, i) => {
        setTimeout(() => setStepsActive((prev) => { const n = [...prev]; n[i] = true; return n; }), i * 420);
      });
    }, 400);
  };



  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── global page styles ── */}
      <style>{`
        .lc-page { background: ${C.bg}; color: ${C.ink}; font-family: Inter, system-ui, sans-serif; }
        .lc-page h1, .lc-page h2, .lc-page h3 { font-family: Sora, system-ui, sans-serif; line-height: 1.1; letter-spacing: -.02em; }
        .lc-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .lc-section { padding: 100px 0; position: relative; }
        .lc-alt { background: ${C.bg3}; }
        .lc-sub { color: ${C.mute}; max-width: 54ch; margin: 0 0 52px; font-size: 17px; line-height: 1.7; }
        .lc-h2 { font-size: clamp(28px, 4vw, 44px); margin-bottom: 14px; }
        .lc-btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 14px 28px; font-weight: 600; font-size: 15px; border: 1px solid ${C.line}; background: rgba(255,255,255,.05); color: ${C.ink}; cursor: pointer; transition: transform .2s, box-shadow .3s; text-decoration: none; }
        .lc-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px -8px rgba(0,220,206,.25); }
        .lc-btn-p { background: linear-gradient(135deg, ${C.coral}, #ff5040); border: 0; color: #fff; box-shadow: 0 12px 36px -10px ${C.coral}; }
        .lc-btn-p:hover { box-shadow: 0 16px 44px -8px ${C.coral}; }
        .lc-tag { font-size: 12px; padding: 5px 12px; border-radius: 99px; background: rgba(124,92,252,.15); color: ${C.violet}; font-weight: 500; letter-spacing: .02em; }
        .lc-line { height: 1px; background: ${C.line}; }

        /* ── ambient orbs ── */
        .orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(100px); opacity: .12; }

        /* ── header ── */
        .lc-header { position: fixed; top: 0; left: 0; right: 0; z-index: 50; backdrop-filter: blur(16px) saturate(1.4); background: rgba(6,11,17,.72); border-bottom: 1px solid ${C.line}; }
        .lc-header-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
        .lc-brand { font: 700 20px Sora; display: flex; gap: 10px; align-items: center; }
        .lc-brand-icon { width: 24px; height: 24px; border-radius: 8px; background: linear-gradient(135deg, ${C.teal}, ${C.lav}); }
        .lc-nav { display: flex; gap: 28px; color: ${C.mute}; font-size: 14px; }
        .lc-nav a:hover { color: #fff; }
        @media(max-width:900px){ .lc-nav { display: none; } }

        /* ── hero ── */
        .lc-hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 0 80px; overflow: hidden; }
        .lc-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; width: 100%; }
        .lc-hero h1 { font-size: clamp(40px, 5.5vw, 64px); }
        .lc-hero h1 em { font-style: normal; background: linear-gradient(135deg, ${C.teal}, ${C.violet}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .lc-hero-p { color: ${C.mute}; max-width: 46ch; margin: 22px 0 36px; font-size: 17px; line-height: 1.7; }
        .lc-acts { display: flex; gap: 14px; flex-wrap: wrap; }
        .lc-strip { display: flex; gap: 36px; margin-top: 44px; }
        .lc-strip-n { font: 700 30px Sora; font-variant-numeric: tabular-nums; }
        .lc-strip span { color: ${C.mute}; font-size: 13px; display: block; margin-top: 2px; }

        /* ── 3D stage ── */
        .lc-stage { position: relative; height: 520px; border-radius: 28px; background: radial-gradient(circle at 50% 45%, rgba(0,220,206,.1), transparent 65%); border: 1px solid rgba(255,255,255,.06); cursor: grab; touch-action: pan-y; overflow: hidden; }
        .lc-stage canvas { display: block; width: 100%; height: 100%; }
        .lc-chip { position: absolute; padding: 11px 16px; border-radius: 16px; background: rgba(6,11,17,.72); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.1); font-size: 13px; pointer-events: none; }
        .lc-chip b { display: block; font: 600 14px Sora; margin-bottom: 2px; }
        .lc-chip-teal b { color: ${C.teal}; }
        .lc-chip-coral b { color: ${C.coral}; }
        .lc-hint { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; font-size: 12px; color: ${C.mute}; pointer-events: none; }

        /* ── upload ── */
        .lc-drop { border: 2px dashed rgba(0,220,206,.3); border-radius: 24px; padding: 56px 24px; text-align: center; background: rgba(255,255,255,.015); transition: all .25s; min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; }
        .lc-drop:hover, .lc-drop.over { border-color: ${C.teal}; background: rgba(0,220,206,.04); transform: scale(1.005); }
        .lc-drop.over { border-color: ${C.coral}; background: rgba(255,120,105,.05); }
        .lc-bar { width: min(440px, 100%); height: 8px; background: rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; }
        .lc-bar-fill { height: 100%; background: linear-gradient(90deg, ${C.teal}, ${C.violet}); border-radius: 9px; transition: width .15s; }
        .lc-spin { width: 56px; height: 56px; border-radius: 50%; border: 3px solid rgba(255,255,255,.1); border-top-color: ${C.teal}; animation: lc-sp 1s linear infinite; }
        @keyframes lc-sp { to { transform: rotate(360deg); } }
        .lc-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; margin-top: 10px; }
        .lc-meta > div { background: rgba(255,255,255,.04); border-radius: 14px; padding: 14px; font-size: 13px; color: ${C.mute}; text-align: left; border: 1px solid rgba(255,255,255,.05); }
        .lc-meta b { display: block; color: #fff; font-size: 14px; margin-top: 2px; }

        /* ── pipeline steps ── */
        .lc-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .lc-step { padding: 24px 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,.06); opacity: .3; transform: translateY(18px); transition: all .6s cubic-bezier(.16,1,.3,1); background: rgba(255,255,255,.02); }
        .lc-step.on { opacity: 1; transform: none; border-color: rgba(0,220,206,.4); background: rgba(0,220,206,.04); box-shadow: 0 0 30px -10px rgba(0,220,206,.2); }
        .lc-step-num { font: 700 13px Sora; margin-bottom: 12px; }
        .lc-step h3 { font-size: 18px; margin: 0 0 8px; }
        .lc-step p { margin: 0; font-size: 13px; color: ${C.mute}; line-height: 1.5; }

        /* ── feature cards ── */
        .lc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; perspective: 1000px; }
        .feat-card { padding: 30px; border-radius: 22px; background: linear-gradient(160deg, rgba(255,255,255,.06), rgba(255,255,255,.015)); border: 1px solid rgba(255,255,255,.07); transition: transform .2s, box-shadow .35s; will-change: transform; }
        .feat-card:hover { box-shadow: 0 30px 70px -25px rgba(0,220,206,.3), 0 0 0 1px rgba(0,220,206,.15); }
        .feat-card h3 { font-size: 19px; margin-top: 14px; }
        .feat-card p { color: ${C.mute}; font-size: 14px; margin: 10px 0 18px; line-height: 1.6; }
        .feat-card small { display: block; margin-top: 14px; color: ${C.teal}; font-weight: 600; font-size: 13px; }

        /* ── stats ── */
        .lc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; text-align: center; }
        .lc-stat-n { font: 700 clamp(38px, 5vw, 58px) Sora; font-variant-numeric: tabular-nums; background: linear-gradient(135deg, #fff, ${C.teal}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .lc-stat-l { color: ${C.mute}; font-size: 14px; margin-top: 4px; }

        /* ── model registry ── */
        .lc-tabs { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }
        .lc-tab { font: inherit; color: ${C.mute}; background: none; border: 1px solid rgba(255,255,255,.08); border-radius: 99px; padding: 11px 22px; cursor: pointer; font-size: 14px; transition: all .25s; }
        .lc-tab:hover { color: #fff; border-color: rgba(255,255,255,.18); }
        .lc-tab[data-active="true"] { color: #fff; background: rgba(0,220,206,.1); border-color: ${C.teal}; box-shadow: 0 0 20px -8px rgba(0,220,206,.3); }
        .lc-spec { border: 1px solid rgba(255,255,255,.08); border-radius: 24px; padding: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; background: rgba(255,255,255,.02); }
        .lc-spec dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 10px 24px; font-size: 14px; }
        .lc-spec dt { color: ${C.mute}; }
        .lc-spec dd { margin: 0; color: ${C.ink}; }

        /* ── CTA ── */
        .lc-cta-bg { background: linear-gradient(180deg, ${C.bg}, ${C.bg3}); text-align: center; }
        .lc-cta-h { font-size: clamp(30px, 5vw, 52px); max-width: 22ch; margin: 0 auto 36px; }
        .lc-badges { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-top: 44px; color: ${C.mute}; font-size: 14px; }
        .lc-badges span { border: 1px solid rgba(255,255,255,.1); border-radius: 99px; padding: 10px 20px; background: rgba(255,255,255,.03); }

        /* ── footer ── */
        .lc-footer { background: #030609; border-top: 1px solid ${C.line}; padding: 56px 0; color: ${C.mute}; font-size: 14px; }
        .lc-footer .lc-wrap { display: flex; justify-content: space-between; gap: 32px; flex-wrap: wrap; align-items: center; }
        .lc-footer form { display: flex; gap: 8px; }
        .lc-footer input { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 99px; padding: 11px 18px; color: #fff; font: inherit; font-size: 14px; }
        .lc-footer input:focus { outline: none; border-color: ${C.teal}; }

        /* ── responsive ── */
        @media(max-width:960px){ .lc-hero-grid, .lc-spec { grid-template-columns: 1fr; } .lc-steps, .lc-grid, .lc-stats { grid-template-columns: 1fr 1fr; } .lc-stage { height: 380px; } .lc-meta { grid-template-columns: 1fr 1fr; } }
        @media(max-width:600px){ .lc-steps, .lc-grid { grid-template-columns: 1fr; } .lc-stats { grid-template-columns: 1fr 1fr; } .lc-strip { gap: 20px; } }
        @media(prefers-reduced-motion: reduce){ *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; } }
      `}</style>

      <div className="lc-page">
        {/* ━━━━━ HEADER ━━━━━ */}
        <header className="lc-header">
          <div className="lc-wrap lc-header-inner">
            <a className="lc-brand" href="/">
              <span className="lc-brand-icon" />
              MiPAAS
            </a>
            <nav className="lc-nav">
              <a href="#upload">Upload</a>
              <a href="#pipeline">Pipeline</a>
              <a href="#features">Capabilities</a>
              <a href="#clinical-station">Workstation</a>
              <a href="#stats">Performance</a>
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
                    <span>{currentUser.name.split(',')[0].split(' ').slice(0, 2).join(' ')}</span>
                  </div>
                  <button
                    onClick={() => setRBACModalOpen(true)}
                    className="lc-btn"
                    style={{ padding: '8px 16px', fontSize: 13 }}
                    title="Open RBAC security & permission matrix"
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
        <section className="lc-hero" id="top">
          {/* ambient orbs */}
          <div className="orb" style={{ width: 600, height: 600, top: -200, left: -200, background: C.tealDim }} />
          <div className="orb" style={{ width: 500, height: 500, bottom: -150, right: -150, background: C.violet }} />
          <div className="orb" style={{ width: 400, height: 400, top: '40%', left: '50%', background: C.coral, opacity: .06 }} />

          <div className="lc-wrap lc-hero-grid">
            <div>
              <h1>
                Lung cancer{'\u00A0'}screening,{' '}
                <em>explained</em> by{'\u00A0'}AI
              </h1>
              <p className="lc-hero-p">
                Upload a low-dose CT and get a 1–6{'\u00A0'}year risk estimate from the
                Sybil ensemble, with <strong style={{ color: C.teal }}>Grad-CAM++</strong> heatmaps
                showing exactly where the model looked.
              </p>
              <div className="lc-acts">
                <button
                  className="lc-btn lc-btn-p"
                  onClick={() => {
                    if (isAuthenticated) {
                      document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      redirectToLogin();
                    }
                  }}
                >
                  Upload a CT scan
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
                <a className="lc-btn" href="#pipeline">See how it works</a>
              </div>
              <div className="lc-strip">
                <div>
                  <div className="lc-strip-n" style={{ color: C.teal }}>98.2%</div>
                  <span>AUC score</span>
                </div>
                <div>
                  <div className="lc-strip-n">1–6 yr</div>
                  <span>Risk window</span>
                </div>
                <div>
                  <div className="lc-strip-n" style={{ color: C.coral }}>2.8s</div>
                  <span>Analysis time</span>
                </div>
              </div>
            </div>

            {/* Three.js 3D viewport */}
            <div ref={stageRef} className="lc-stage" aria-label="Interactive 3D lung model — drag to rotate" role="img">
              <div className="lc-chip lc-chip-coral" style={{ top: 18, right: 18 }}>
                <b>Nodule detected</b>
                Right upper lobe · 8 mm
              </div>
              <div className="lc-chip lc-chip-teal" style={{ bottom: 44, left: 18 }}>
                <b>6-year risk 12.4%</b>
                Moderate
              </div>
              <div className="lc-hint">Drag to rotate</div>
            </div>
          </div>
        </section>

        {/* ━━━━━ UPLOAD ━━━━━ */}
        <section id="upload" className="lc-section lc-alt">
          <div className="orb" style={{ width: 500, height: 500, top: -100, right: -100, background: C.teal }} />
          <div className="lc-wrap">
            <h2 className="lc-h2">Upload your CT scan</h2>
            <p className="lc-sub">
              DICOM, NIfTI, or a zipped series from any major scanner. Nothing leaves your session until you run the analysis.
            </p>

            {/* RBAC Upload Permission Banner */}
            {!hasPermission('jobs:create') ? (
              <div
                style={{
                  padding: '20px 24px',
                  borderRadius: 20,
                  marginBottom: 28,
                  border: '1px solid rgba(255, 120, 105, 0.25)',
                  background: 'rgba(255, 120, 105, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16,
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'rgba(255, 120, 105, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Lock style={{ width: 20, height: 20, color: C.coral }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                      Authentication Required
                    </div>
                    <div style={{ fontSize: 13, color: '#CCD6DD', marginTop: 2 }}>
                      Sign in with your institutional credentials to upload clinical DICOM scans. Access is restricted to licensed <b>Imaging Technologists</b> and <b>Radiologists</b>.
                    </div>
                  </div>
                </div>

                <button
                  onClick={redirectToLogin}
                  className="lc-btn lc-btn-p"
                  style={{ padding: '10px 22px', fontSize: 13 }}
                >
                  <Lock style={{ width: 14, height: 14 }} />
                  Sign In to Upload
                </button>
              </div>
            ) : (
              <div
                style={{
                  padding: '12px 20px',
                  borderRadius: 16,
                  marginBottom: 24,
                  border: '1px solid rgba(0, 220, 206, 0.2)',
                  background: 'rgba(0, 220, 206, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  fontSize: 13,
                  color: C.mute,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Unlock style={{ width: 15, height: 15, color: C.teal }} />
                  <span>
                    Authenticated as <strong style={{ color: '#fff' }}>{currentUser.name}</strong> ({ROLE_DEFINITIONS[currentUser.role].title})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: C.teal }}>✓ jobs:create granted</span>
                  <span>·</span>
                  <span style={{ color: C.teal }}>✓ Direct-to-GCS Signed URL</span>
                </div>
              </div>
            )}

            <div
              ref={dropRef}
              className={`lc-drop ${dragOver ? 'over' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Upload CT scan files"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                startUpload([...e.dataTransfer.files]);
              }}
              onClick={() => uploadPhase === 'idle' && fileRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && uploadPhase === 'idle') {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
            >
              {uploadPhase === 'idle' && (
                <>
                  <h3 style={{ margin: 0, fontSize: 20 }}>Drop DICOM files here</h3>
                  <button className="lc-btn" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                    Browse files
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="lc-tag">.dcm</span>
                    <span className="lc-tag">.nii.gz</span>
                    <span className="lc-tag">.zip</span>
                  </div>
                  {uploadErr && <div style={{ color: C.coral, fontSize: 14 }} role="alert">{uploadErr}</div>}
                </>
              )}

              {uploadPhase === 'uploading' && (
                <>
                  <h3 style={{ margin: 0, fontSize: 20 }}>
                    Uploading {uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''}
                  </h3>
                  <div className="lc-bar">
                    <div className="lc-bar-fill" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, color: C.mute }}>
                    {uploadPct}% · {fmt(uploadFiles.reduce((a, f) => a + f.size, 0))}
                  </div>
                </>
              )}

              {uploadPhase === 'processing' && (
                <>
                  <div className="lc-spin" />
                  <h3 style={{ margin: 0, fontSize: 20 }}>Preprocessing</h3>
                  <div style={{ color: C.mute, fontSize: 14 }}>Parsing slices · Building 3D volume</div>
                </>
              )}

              {uploadPhase === 'done' && (
                <>
                  <h3 style={{ margin: 0, fontSize: 20, color: C.teal }}>✓ Scan ready</h3>
                  <div style={{ color: C.mute, fontSize: 14 }}>
                    {uploadFiles[0]?.name}{uploadFiles.length > 1 ? ` +${uploadFiles.length - 1} more` : ''}
                  </div>
                  <div className="lc-acts">
                    <button className="lc-btn" onClick={(e) => { e.stopPropagation(); resetUpload(); }}>Replace</button>
                    <button className="lc-btn lc-btn-p" onClick={(e) => { e.stopPropagation(); handleRunAnalysis(); }}>Run analysis →</button>
                  </div>
                  <div className="lc-meta">
                    <div>Modality<b>CT</b></div>
                    <div>Slice thickness<b>1.0 mm</b></div>
                    <div>Matrix<b>512 × 512</b></div>
                    <div>Protocol<b>LDCT screening</b></div>
                  </div>
                </>
              )}
            </div>

            <input ref={fileRef} type="file" accept=".dcm,.dicom,.nii,.nii.gz,.zip" multiple hidden onChange={(e) => e.target.files && startUpload([...e.target.files])} />
            <p style={{ fontSize: 13, color: C.mute, textAlign: 'center', marginTop: 18 }}>
              🔒 HIPAA-compliant · End-to-end encrypted · Data deleted after analysis
            </p>
          </div>
        </section>

        {/* ━━━━━ PIPELINE ━━━━━ */}
        <section id="pipeline" className="lc-section">
          <div className="lc-wrap">
            <h2 className="lc-h2">Analysis pipeline</h2>
            <p className="lc-sub">Five stages, from upload to a report your radiologist can open in the viewer.</p>
            <div className="lc-steps" ref={stepsRef}>
              {PIPELINE.map((s, i) => (
                <div key={i} className={`lc-step ${stepsActive[i] ? 'on' : ''}`}>
                  <div className="lc-step-num" style={{ color: s.colour }}>{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━ FEATURES ━━━━━ */}
        <section id="features" className="lc-section lc-alt">
          <div className="orb" style={{ width: 450, height: 450, bottom: -120, left: '20%', background: C.violet }} />
          <div className="lc-wrap">
            <h2 className="lc-h2">Full AI and explainability stack</h2>
            <p className="lc-sub">Every prediction ships with the evidence behind it.</p>
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
            <h2 className="lc-h2">Clinical-grade accuracy</h2>
            <p className="lc-sub">Measured on held-out screening data.</p>
            <div className="lc-stats">
              {counters.map((v, i) => (
                <div key={i}>
                  <div className="lc-stat-n">
                    {i === 2 ? `${v}` : v.toFixed(COUNTER_TARGETS[i] % 1 ? 1 : 0)}{COUNTER_SUFFIXES[i]}
                  </div>
                  <div className="lc-stat-l">{COUNTER_LABELS[i]}</div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 52, textAlign: 'center', color: C.mute, fontSize: 14, maxWidth: '50ch', marginLeft: 'auto', marginRight: 'auto' }}>
              Validated on NLST (26,722 patients). Published in <em>Journal of Clinical Oncology</em>.
            </p>
          </div>
        </section>



        {/* ━━━━━ CLINICAL WORKSTATION & RBAC SIGN-OFF ━━━━━ */}
        <section id="clinical-station" className="lc-section lc-alt">
          <div className="orb" style={{ width: 500, height: 500, top: -100, right: -100, background: C.violet, opacity: 0.12 }} />
          <div className="lc-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', color: C.teal }}>
                  Clinical Workstation & Governance
                </span>
                <h2 className="lc-h2" style={{ margin: '6px 0 0' }}>Interactive Diagnostic Sign-Off</h2>
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
                    <span>{currentUser.name.split(',')[0].split(' ').slice(0, 2).join(' ')} · {ROLE_DEFINITIONS[currentUser.role].title}</span>
                  </div>
                ) : (
                  <button
                    onClick={redirectToLogin}
                    className="lc-btn"
                    style={{ padding: '8px 16px', fontSize: 12 }}
                  >
                    <Lock style={{ width: 12, height: 12 }} />
                    Sign In to Access
                  </button>
                )}
              </div>
            </div>
            <p className="lc-sub" style={{ marginBottom: 36 }}>
              Test how real-time RBAC policy enforces clinical validation safety, HIPAA PHI de-identification, and tamper-evident audit trails.
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
              {/* Header Bar */}
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
                      background: 'rgba(0, 220, 206, 0.12)',
                      border: '1px solid rgba(0, 220, 206, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText style={{ width: 18, height: 18, color: C.teal }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                      Study #LDCT-2026-904A · Axial CT Chest
                    </div>
                    <div style={{ fontSize: 12, color: C.mute }}>
                      Protocol: NLST Low-Dose CT · 1.0 mm isotropic · Series UID: 1.2.840.113619.2.4
                    </div>
                  </div>
                </div>

                {/* Right: Active Role Capability Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border: `1px solid ${ROLE_DEFINITIONS[currentUser.role].borderColor}`,
                      background: ROLE_DEFINITIONS[currentUser.role].badgeBg,
                      color: ROLE_DEFINITIONS[currentUser.role].badgeColor,
                    }}
                  >
                    {hasPermission('reports:sign') ? (
                      <>
                        <CheckCircle2 style={{ width: 14, height: 14 }} />
                        <span>Sign-Off Permitted (reports:sign)</span>
                      </>
                    ) : (
                      <>
                        <Lock style={{ width: 14, height: 14 }} />
                        <span>Sign-Off Restricted</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid: Case Details & Attributions vs Sign-Off Action */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 28,
                  marginTop: 24,
                }}
              >
                {/* Column 1: Diagnostic Findings & HIPAA PHI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* PHI Security Box */}
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: 16,
                      background: hasPermission('phi:read') ? 'rgba(255,255,255,0.03)' : 'rgba(255, 120, 105, 0.06)',
                      border: hasPermission('phi:read') ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255, 120, 105, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: hasPermission('phi:read') ? C.mute : C.coral }}>
                        {hasPermission('phi:read') ? 'Patient Protected Health Information (PHI)' : 'HIPAA De-Identified Mode Active'}
                      </span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: C.mute }}>
                        {hasPermission('phi:read') ? 'PHI Unmasked' : 'PHI Redacted'}
                      </span>
                    </div>

                    {hasPermission('phi:read') ? (
                      <div style={{ fontSize: 13, color: '#EAF2F6', lineHeight: 1.6 }}>
                        <div><b>Patient Name:</b> Eleanor Vance (67F)</div>
                        <div><b>MRN / Identifier:</b> NY-MSH-904128</div>
                        <div><b>Acquisition:</b> Mount Sinai Hospital, Scanner #04</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#EAF2F6', lineHeight: 1.6 }}>
                        <div><b>Patient Name:</b> <span style={{ color: C.coral, fontFamily: 'monospace' }}>[ANONYMIZED — COHORT_04_NLST]</span></div>
                        <div><b>MRN / Identifier:</b> <span style={{ color: C.coral, fontFamily: 'monospace' }}>[PHI-MASKED-FOR-RESEARCH]</span></div>
                        <div><b>Access Note:</b> Researcher role restricts access to identifiable patient records.</div>
                      </div>
                    )}
                  </div>

                  {/* AI Prediction Breakdown */}
                  <div
                    style={{
                      padding: '18px 20px',
                      borderRadius: 16,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: C.teal, marginBottom: 8 }}>
                      Sybil 3D Transformer Assessment
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: C.coral }}>12.4%</span>
                      <span style={{ fontSize: 13, color: C.mute }}>6-Year Risk · Lung-RADS 4A</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#CCD6DD', lineHeight: 1.6 }}>
                      <div>• <b>Primary Finding:</b> 8.2 mm part-solid nodule in Right Upper Lobe.</div>
                      <div>• <b>XAI Verification:</b> Grad-CAM++ voxel peak focuses on the subpleural margins with 0.94 sensitivity.</div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Sign-Off Controls & Audit Record */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      padding: '20px',
                      borderRadius: 16,
                      background: reportSigned ? 'rgba(0, 220, 206, 0.08)' : 'rgba(255,255,255,0.03)',
                      border: reportSigned ? '1px solid rgba(0, 220, 206, 0.35)' : '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      flex: 1,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: reportSigned ? C.teal : '#fff' }}>
                          Diagnostic Validation Status
                        </span>
                        {reportSigned && (
                          <span style={{ fontSize: 11, color: C.teal, fontWeight: 600 }}>
                            Digitally Sealed
                          </span>
                        )}
                      </div>

                      {reportSigned ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.teal }}>
                            <CheckCircle2 style={{ width: 24, height: 24, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                                Clinical Sign-Off Complete
                              </div>
                              <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>
                                Signed by <b>{currentUser.name}</b> ({ROLE_DEFINITIONS[currentUser.role].title}) at {signedAt}.
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: C.mute, marginTop: 14, fontFamily: 'monospace', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                            SHA-256 HMAC: e49a37bc...09f2 · Audit Record Stored
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 14 }}>
                          <p style={{ fontSize: 13, color: '#CCD6DD', margin: '0 0 16px', lineHeight: 1.6 }}>
                            {hasPermission('reports:sign') ? (
                              <>
                                As a licensed <b>{ROLE_DEFINITIONS[currentUser.role].title}</b> ({currentUser.name}), you have authorization to validate AI risk predictions and issue a signed clinical diagnostic report.
                              </>
                            ) : (
                              <>
                                Your active persona is <b>{currentUser.name}</b> ({ROLE_DEFINITIONS[currentUser.role].title}). Institutional policy restricts final diagnostic sign-offs to licensed <b>Thoracic Radiologists</b>.
                              </>
                            )}
                          </p>

                          {signNotification && (
                            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255, 120, 105, 0.15)', color: C.coral, fontSize: 12, marginBottom: 12 }}>
                              {signNotification}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div style={{ marginTop: 16 }}>
                      {reportSigned ? (
                        <button
                          onClick={() => {
                            setReportSigned(false);
                            setSignedAt(null);
                            addAuditLog('report:signature_revoked', 'study:LDCT-2026-904A', 'allow', { user: currentUser.name });
                          }}
                          className="lc-btn"
                          style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                        >
                          Revoke Signature for Re-Evaluation
                        </button>
                      ) : hasPermission('reports:sign') ? (
                        <button
                          onClick={() => {
                            setReportSigned(true);
                            const now = new Date().toLocaleTimeString();
                            setSignedAt(now);
                            setSignNotification(null);
                            addAuditLog('report:signed', 'study:LDCT-2026-904A', 'allow', {
                              signed_by: currentUser.name,
                              role: currentUser.role,
                              timestamp: now,
                              nodule_status: 'confirmed',
                            });
                          }}
                          className="lc-btn lc-btn-p"
                          style={{ width: '100%', justifyContent: 'center', fontSize: 14 }}
                        >
                          <CheckCircle2 style={{ width: 16, height: 16 }} />
                          <span>Digitally Sign & Validate Report</span>
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <button
                            disabled
                            className="lc-btn"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              fontSize: 13,
                              opacity: 0.5,
                              cursor: 'not-allowed',
                              background: 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <Lock style={{ width: 14, height: 14 }} />
                            <span>Sign-Off Restricted by Role</span>
                          </button>
                          <button
                            onClick={redirectToLogin}
                            className="lc-btn"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              fontSize: 12,
                              borderColor: 'rgba(124, 92, 252, 0.4)',
                              color: '#98AED9',
                            }}
                          >
                            <Lock style={{ width: 12, height: 12 }} />
                            Sign In as Radiologist to Sign &rarr;
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Real-time Mini Audit Trail */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      fontSize: 11,
                      fontFamily: 'monospace',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: C.mute, marginBottom: 6 }}>
                      <span>Audit Stream</span>
                      <button
                        onClick={() => setRBACModalOpen(true)}
                        style={{ background: 'none', border: 'none', color: C.teal, cursor: 'pointer', padding: 0 }}
                      >
                        View Full HIPAA Log &rarr;
                      </button>
                    </div>
                    <div style={{ color: '#CCD6DD', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {auditLogs.slice(0, 2).map((log) => (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: log.decision === 'allow' ? '#00DCCE' : '#FF7869' }}>
                            [{log.decision.toUpperCase()}]
                          </span>
                          <span style={{ color: '#fff' }}>{log.action}</span>
                          <span style={{ color: C.mute }}>by {log.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━ CTA ━━━━━ */}
        <section id="cta" className="lc-section lc-cta-bg">
          <div className="orb" style={{ width: 500, height: 500, top: '10%', left: '50%', transform: 'translateX(-50%)', background: C.violet, opacity: .08 }} />
          <div className="lc-wrap">
            <h2 className="lc-cta-h">Ready to upgrade your lung screening program?</h2>
            <div className="lc-acts" style={{ justifyContent: 'center' }}>
              <button
                className="lc-btn lc-btn-p"
                onClick={() => {
                  if (isAuthenticated) {
                    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    redirectToLogin();
                  }
                }}
              >
                Upload a scan →
              </button>
              <a className="lc-btn" href="#cta">Request a demo</a>
            </div>
            <div className="lc-badges">
              <span>🏥 HIPAA compliant</span>
              <span>🔒 SOC 2 Type II</span>
              <span>🇪🇺 GDPR ready</span>
              <span>📋 FDA 510(k) pathway</span>
            </div>
          </div>
        </section>

        {/* ━━━━━ FOOTER ━━━━━ */}
        <footer className="lc-footer">
          <div className="lc-wrap">
            <div>
              <div className="lc-brand" style={{ marginBottom: 10 }}>
                <span className="lc-brand-icon" />
                MiPAAS
              </div>
              <p style={{ margin: 0 }}>AI-assisted imaging, built for clinicians.</p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              form.innerHTML = '<span style="color:#00DCCE">Subscribed. Thank you.</span>';
            }}>
              <input type="email" required placeholder="Work email" aria-label="Work email" />
              <button className="lc-btn lc-btn-p" type="submit" style={{ padding: '10px 20px' }}>Subscribe</button>
            </form>
          </div>
        </footer>
      </div>
    </>
  );
}
