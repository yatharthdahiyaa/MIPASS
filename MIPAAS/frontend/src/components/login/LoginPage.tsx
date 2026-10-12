'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRBAC } from '@/context/RBACContext';
import { CLINICAL_PERSONAS, ROLE_DEFINITIONS, type Role } from '@/types/rbac';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  Fingerprint,
  Activity,
  Stethoscope,
  Cpu,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';

/* ── colour tokens ── */
const C = {
  bg: '#050A10',
  bg2: '#0A1823',
  bg3: '#0E273A',
  ink: '#EAF2F6',
  mute: '#7B8FA0',
  teal: '#00DCCE',
  tealDim: '#008280',
  coral: '#FF7869',
  lav: '#98AED9',
  violet: '#7C5CFC',
  gold: '#F5A623',
  line: 'rgba(255,255,255,.08)',
} as const;

/* ── demo credentials map ── */
const DEMO_CREDENTIALS: Record<string, { password: string; personaId: string }> = {
  'elena.vance@mipaas.health': { password: 'Rad!0l0gist#2026', personaId: 'rad-01' },
  'marcus.chen@mipaas.health': { password: 'T3chCT$can#2026', personaId: 'tech-01' },
  'sarah.lin@mipaas.research': { password: 'R3s34rch!AI#2026', personaId: 'res-01' },
  'arthur.davis@mipaas.health': { password: 'Adm!nS3cur3#2026', personaId: 'admin-01' },
  'a.pendelton@mipaas.health': { password: 'Aud!tC0mply#2026', personaId: 'aud-01' },
};

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  radiologist: <Stethoscope style={{ width: 16, height: 16 }} />,
  technician: <Activity style={{ width: 16, height: 16 }} />,
  researcher: <Cpu style={{ width: 16, height: 16 }} />,
  admin: <ShieldCheck style={{ width: 16, height: 16 }} />,
  auditor: <FileCheck2 style={{ width: 16, height: 16 }} />,
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { switchPersona, currentUser } = useRBAC();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [selectedQuickLogin, setSelectedQuickLogin] = useState<string | null>(null);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  const redirectTo = searchParams.get('redirect') || '/lung-cancer';

  // Generate floating particles on mount
  useEffect(() => {
    const pts = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 8,
    }));
    setParticles(pts);
  }, []);

  /* ── Three.js DNA helix + shield ── */
  useEffect(() => {
    const el = canvasRef.current;
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
      el.appendChild(renderer.domElement);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';

      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 100);
      cam.position.set(0, 0, 8.5);

      const root = new THREE.Group();
      scene.add(root);

      // ── Shield shape (torus knot representing security) ──
      const shieldGeo = new THREE.TorusKnotGeometry(0.72, 0.18, 140, 18, 2, 3);
      const shieldMat = new THREE.MeshBasicMaterial({
        color: 0x00dcce,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      });
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.set(0, 1.5, 0);
      root.add(shield);

      // ── Inner glow sphere ──
      const glowGeo = new THREE.SphereGeometry(0.5, 32, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x7c5cfc,
        transparent: true,
        opacity: 0.14,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(0, 1.5, 0);
      root.add(glow);

      // ── DNA-like helix around shield ──
      const helixPoints1: InstanceType<typeof THREE.Vector3>[] = [];
      const helixPoints2: InstanceType<typeof THREE.Vector3>[] = [];
      for (let i = 0; i < 220; i++) {
        const t = (i / 220) * Math.PI * 6;
        const y = (i / 220) * 6.4 - 3.2;
        helixPoints1.push(new THREE.Vector3(Math.cos(t) * 2.3, y, Math.sin(t) * 2.3));
        helixPoints2.push(new THREE.Vector3(Math.cos(t + Math.PI) * 2.3, y, Math.sin(t + Math.PI) * 2.3));
      }
      const helixGeo1 = new THREE.BufferGeometry().setFromPoints(helixPoints1);
      const helixGeo2 = new THREE.BufferGeometry().setFromPoints(helixPoints2);
      const helixMat1 = new THREE.LineBasicMaterial({ color: 0x00dcce, transparent: true, opacity: 0.3 });
      const helixMat2 = new THREE.LineBasicMaterial({ color: 0x98aed9, transparent: true, opacity: 0.2 });
      root.add(new THREE.Line(helixGeo1, helixMat1));
      root.add(new THREE.Line(helixGeo2, helixMat2));

      // ── Cross-links between helices ──
      for (let i = 0; i < 220; i += 12) {
        const crossGeo = new THREE.BufferGeometry().setFromPoints([helixPoints1[i], helixPoints2[i]]);
        const crossMat = new THREE.LineBasicMaterial({ color: 0xff7869, transparent: true, opacity: 0.12 });
        root.add(new THREE.Line(crossGeo, crossMat));
      }

      // ── Orbiting particles (hardware accelerated rotation) ──
      const orbitN = 160;
      const orbitPos = new Float32Array(orbitN * 3);
      const orbitCol = new Float32Array(orbitN * 3);
      const tealC = new THREE.Color(0x00dcce);
      const violetC = new THREE.Color(0x7c5cfc);
      for (let i = 0; i < orbitN; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 2.4 + Math.random() * 0.9;
        orbitPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        orbitPos[i * 3 + 1] = r * Math.cos(phi) * 1.3;
        orbitPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const c = tealC.clone().lerp(violetC, Math.random());
        orbitCol[i * 3]     = c.r;
        orbitCol[i * 3 + 1] = c.g;
        orbitCol[i * 3 + 2] = c.b;
      }
      const orbitGeo = new THREE.BufferGeometry();
      orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPos, 3));
      orbitGeo.setAttribute('color', new THREE.BufferAttribute(orbitCol, 3));
      const orbitPts = new THREE.Points(
        orbitGeo,
        new THREE.PointsMaterial({
          size: 0.045,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      root.add(orbitPts);

      // ── Smooth Animation Loop with Damped Mouse Parallax ──
      let targetMouseX = 0, targetMouseY = 0;
      let curMouseX = 0, curMouseY = 0;
      let autoRotY = 0;

      const onMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      };
      const onMouseLeave = () => {
        targetMouseX = 0;
        targetMouseY = 0;
      };
      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('mouseleave', onMouseLeave);

      let lastTime = performance.now();

      function loop(now: number) {
        if (cleanup) return;
        requestAnimationFrame(loop);

        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        // Buttery-smooth lerp damping (0.05 easing factor)
        curMouseX += (targetMouseX - curMouseX) * 0.05;
        curMouseY += (targetMouseY - curMouseY) * 0.05;

        // Continuous smooth rotation
        autoRotY += dt * 0.25;
        root.rotation.y = autoRotY + curMouseX * 0.35;
        root.rotation.x = Math.sin(now * 0.0006) * 0.08 - curMouseY * 0.2;

        // Torus knot fluid rotation & subtle breathing scale
        shield.rotation.y += dt * 0.32;
        shield.rotation.z += dt * 0.16;
        const breath = 1 + Math.sin(now * 0.0016) * 0.045;
        shield.scale.set(breath, breath, breath);

        // Core glow pulse
        glow.scale.setScalar(1 + 0.12 * Math.sin(now * 0.002));
        glow.material.opacity = 0.14 + 0.06 * Math.sin(now * 0.003);

        // Orbit particles rotation
        orbitPts.rotation.y += dt * 0.18;
        orbitPts.rotation.x = Math.sin(now * 0.0008) * 0.08;

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
        el.removeEventListener('mousemove', onMouseMove);
        el.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
      };
    };

    const disposePromise = loadThree();
    return () => {
      cleanup = true;
      disposePromise.then((dispose) => dispose?.());
    };
  }, []);

  /* ── login handler ── */
  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const cred = DEMO_CREDENTIALS[email.toLowerCase().trim()];
      if (!cred) {
        setError('No account found. Use one of the demo credentials below.');
        setIsLoading(false);
        return;
      }

      if (cred.password !== password) {
        setError('Invalid password. Check the demo credentials table.');
        setIsLoading(false);
        return;
      }

      // Authenticate
      switchPersona(cred.personaId);
      setLoginSuccess(true);

      // Redirect after success animation
      setTimeout(() => {
        router.push(redirectTo);
      }, 1800);
    },
    [email, password, switchPersona, router, redirectTo]
  );

  /* ── quick login ── */
  const handleQuickLogin = useCallback(
    async (personaId: string) => {
      setSelectedQuickLogin(personaId);
      setIsLoading(true);
      setError('');

      const persona = CLINICAL_PERSONAS[personaId];
      if (persona) {
        setEmail(persona.email);
        const cred = DEMO_CREDENTIALS[persona.email];
        if (cred) setPassword(cred.password);
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      switchPersona(personaId);
      setLoginSuccess(true);

      setTimeout(() => {
        router.push(redirectTo);
      }, 1800);
    },
    [switchPersona, router, redirectTo]
  );

  return (
    <>
      <style>{`
        @keyframes login-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(2deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
          75% { transform: translateY(-15px) rotate(1deg); }
        }
        @keyframes login-particle {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          20% { opacity: 0.6; transform: translateY(-20vh) scale(1); }
          100% { opacity: 0; transform: translateY(-100vh) scale(0.5); }
        }
        @keyframes login-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 220, 206, 0.3); }
          50% { box-shadow: 0 0 0 20px rgba(0, 220, 206, 0); }
        }
        @keyframes login-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes login-slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-success-ring {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes login-glow-orbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes login-scanline {
          0% { top: -5%; }
          100% { top: 105%; }
        }
        @keyframes login-card-entrance {
          from { opacity: 0; transform: perspective(1200px) rotateY(-8deg) translateX(40px) scale(0.95); }
          to { opacity: 1; transform: perspective(1200px) rotateY(0deg) translateX(0) scale(1); }
        }
        @keyframes login-bg-entrance {
          from { opacity: 0; transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
        .login-input:focus {
          border-color: ${C.teal} !important;
          box-shadow: 0 0 0 3px rgba(0, 220, 206, 0.15), 0 4px 20px rgba(0, 220, 206, 0.1) !important;
          outline: none;
        }
        .login-input::placeholder { color: rgba(127, 143, 160, 0.6); }
        .quick-login-card { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .quick-login-card:hover {
          transform: translateY(-4px) scale(1.02) !important;
          box-shadow: 0 12px 40px -10px rgba(0, 220, 206, 0.3) !important;
        }
        .quick-login-card:active { transform: translateY(-1px) scale(0.98) !important; }
        @media (max-width: 960px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-3d-col { display: none !important; }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: C.bg,
          color: C.ink,
          fontFamily: 'Inter, system-ui, sans-serif',
          overflow: 'auto',
          zIndex: 100,
        }}
      >
        {/* ── Animated particle background ── */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'fixed',
              left: `${p.x}%`,
              bottom: '-5%',
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: p.id % 3 === 0 ? C.teal : p.id % 3 === 1 ? C.violet : C.coral,
              animation: `login-particle ${8 + p.delay}s linear infinite`,
              animationDelay: `${p.delay}s`,
              pointerEvents: 'none',
              opacity: 0,
            }}
          />
        ))}

        {/* ── Ambient gradient orbs ── */}
        <div
          style={{
            position: 'fixed',
            width: 700,
            height: 700,
            top: '-15%',
            left: '-10%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,220,206,0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
            animation: 'login-bg-entrance 2s ease-out',
          }}
        />
        <div
          style={{
            position: 'fixed',
            width: 600,
            height: 600,
            bottom: '-20%',
            right: '-10%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,92,252,0.1) 0%, transparent 70%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
            animation: 'login-bg-entrance 2.5s ease-out',
          }}
        />
        <div
          style={{
            position: 'fixed',
            width: 400,
            height: 400,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,120,105,0.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Top bar ── */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            backdropFilter: 'blur(16px) saturate(1.4)',
            background: 'rgba(5,10,16,0.7)',
            borderBottom: `1px solid ${C.line}`,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: '0 32px',
          }}
        >
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: C.ink,
              fontFamily: 'Sora, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                background: `linear-gradient(135deg, ${C.teal}, ${C.lav})`,
                display: 'inline-block',
              }}
            />
            MiPAAS
          </a>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock style={{ width: 14, height: 14, color: C.teal }} />
            <span style={{ fontSize: 13, color: C.mute }}>Secure Authentication Portal</span>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div
          className="login-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            minHeight: '100vh',
            paddingTop: 64,
          }}
        >
          {/* ── LEFT: 3D Visual Column ── */}
          <div
            className="login-3d-col"
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              animation: 'login-bg-entrance 1.5s ease-out',
            }}
          >
            {/* 3D Canvas */}
            <div
              ref={canvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
              }}
            />

            {/* Overlay Content — Fully Transparent Floating 3D Showcase */}
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                textAlign: 'center',
                padding: '24px 20px',
                margin: '0 auto',
                maxWidth: 460,
                width: '100%',
                background: 'transparent',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                border: 'none',
                boxShadow: 'none',
                animation: 'login-slide-up 1s ease-out 0.4s both',
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 22,
                  background: 'rgba(6, 11, 17, 0.45)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: `1.5px solid ${C.teal}80`,
                  boxShadow: `0 0 30px ${C.teal}35`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 22px',
                  animation: 'login-pulse 3s ease-in-out infinite',
                }}
              >
                <Fingerprint style={{ width: 38, height: 38, color: C.teal }} />
              </div>

              <h2
                style={{
                  fontFamily: 'Sora, system-ui, sans-serif',
                  fontSize: 28,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  marginBottom: 14,
                }}
              >
                <span style={{ textShadow: '0 2px 16px rgba(6, 11, 17, 0.95), 0 0 32px rgba(6, 11, 17, 0.9)' }}>
                  Enterprise-Grade
                </span>
                <br />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #00dcce, #a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    color: '#00dcce',
                    display: 'inline-block',
                  }}
                >
                  HIPAA Security
                </span>
              </h2>

              <p
                style={{
                  color: C.ink,
                  opacity: 0.88,
                  fontSize: 15,
                  lineHeight: 1.7,
                  maxWidth: '36ch',
                  margin: '0 auto',
                  textShadow: '0 2px 10px rgba(6, 11, 17, 0.95)',
                }}
              >
                Zero-trust authentication with role-based access control, end-to-end encryption, and SOC 2 Type II compliance.
              </p>

              {/* Security badges */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  marginTop: 26,
                }}
              >
                {['HIPAA', 'SOC 2', 'GDPR', 'FDA 510(k)'].map((badge) => (
                  <span
                    key={badge}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: 'rgba(6, 11, 17, 0.55)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(0, 220, 206, 0.28)',
                      color: C.ink,
                      letterSpacing: '0.04em',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Login Form Column ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '48px 48px',
              position: 'relative',
              animation: 'login-card-entrance 0.8s ease-out',
            }}
          >
            <div style={{ maxWidth: 460, width: '100%', margin: '0 auto' }}>
              {/* ── Success state ── */}
              {loginSuccess ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    animation: 'login-slide-up 0.5s ease-out',
                  }}
                >
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${C.teal}20, ${C.teal}08)`,
                      border: `2px solid ${C.teal}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 24px',
                      animation: 'login-success-ring 0.6s ease-out',
                    }}
                  >
                    <ShieldCheck style={{ width: 40, height: 40, color: C.teal }} />
                  </div>
                  <h2
                    style={{
                      fontFamily: 'Sora, system-ui, sans-serif',
                      fontSize: 26,
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    Authentication Verified
                  </h2>
                  <p style={{ color: C.mute, fontSize: 15, marginBottom: 4 }}>
                    Welcome back, <strong style={{ color: '#fff' }}>{currentUser.name}</strong>
                  </p>
                  <p style={{ color: C.mute, fontSize: 13 }}>
                    {ROLE_DEFINITIONS[currentUser.role].title} · Redirecting to platform...
                  </p>

                  {/* Loading bar */}
                  <div
                    style={{
                      width: '60%',
                      height: 3,
                      borderRadius: 4,
                      background: C.line,
                      margin: '28px auto 0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: `linear-gradient(90deg, ${C.teal}, ${C.violet})`,
                        borderRadius: 4,
                        animation: 'login-shimmer 1.5s linear infinite',
                        backgroundSize: '200% 100%',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Form Header ── */}
                  <div style={{ marginBottom: 36 }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 14px',
                        borderRadius: 999,
                        background: `${C.teal}12`,
                        border: `1px solid ${C.teal}30`,
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.teal,
                        marginBottom: 20,
                        letterSpacing: '0.02em',
                      }}
                    >
                      <Lock style={{ width: 12, height: 12 }} />
                      RBAC-Protected Access
                    </div>
                    <h1
                      style={{
                        fontFamily: 'Sora, system-ui, sans-serif',
                        fontSize: 32,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        marginBottom: 10,
                      }}
                    >
                      Sign in to{' '}
                      <span
                        style={{
                          background: `linear-gradient(135deg, ${C.teal}, ${C.violet})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        MiPAAS
                      </span>
                    </h1>
                    <p style={{ color: C.mute, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                      Authenticate with your institutional credentials to access the clinical imaging platform.
                    </p>
                  </div>

                  {/* ── Login Form ── */}
                  <form onSubmit={handleLogin}>
                    {/* Email */}
                    <div style={{ marginBottom: 18 }}>
                      <label
                        htmlFor="login-email"
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.mute,
                          marginBottom: 8,
                          letterSpacing: '0.02em',
                        }}
                      >
                        Institutional Email
                      </label>
                      <input
                        id="login-email"
                        type="email"
                        className="login-input"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        placeholder="name@mipaas.health"
                        required
                        autoComplete="email"
                        style={{
                          width: '100%',
                          padding: '14px 18px',
                          borderRadius: 14,
                          border: `1px solid ${C.line}`,
                          background: 'rgba(255,255,255,0.03)',
                          color: '#fff',
                          fontSize: 15,
                          fontFamily: 'inherit',
                          transition: 'all 0.25s',
                        }}
                      />
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: 24 }}>
                      <label
                        htmlFor="login-password"
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.mute,
                          marginBottom: 8,
                          letterSpacing: '0.02em',
                        }}
                      >
                        Password
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          className="login-input"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setError(''); }}
                          placeholder="Enter your password"
                          required
                          autoComplete="current-password"
                          style={{
                            width: '100%',
                            padding: '14px 50px 14px 18px',
                            borderRadius: 14,
                            border: `1px solid ${C.line}`,
                            background: 'rgba(255,255,255,0.03)',
                            color: '#fff',
                            fontSize: 15,
                            fontFamily: 'inherit',
                            transition: 'all 0.25s',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: 14,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: C.mute,
                            cursor: 'pointer',
                            padding: 4,
                          }}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                        </button>
                      </div>
                    </div>

                    {/* Error */}
                    {error && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: 12,
                          background: 'rgba(255, 120, 105, 0.1)',
                          border: '1px solid rgba(255, 120, 105, 0.25)',
                          color: C.coral,
                          fontSize: 13,
                          marginBottom: 18,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          animation: 'login-slide-up 0.3s ease-out',
                        }}
                        role="alert"
                      >
                        <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                        {error}
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        padding: '15px 24px',
                        borderRadius: 14,
                        border: 'none',
                        background: isLoading
                          ? 'rgba(255,255,255,0.08)'
                          : `linear-gradient(135deg, ${C.coral}, #ff5040)`,
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: 'Sora, system-ui, sans-serif',
                        cursor: isLoading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        transition: 'all 0.3s',
                        boxShadow: isLoading ? 'none' : `0 12px 36px -10px ${C.coral}`,
                      }}
                    >
                      {isLoading ? (
                        <>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              border: '2px solid rgba(255,255,255,0.2)',
                              borderTopColor: '#fff',
                              borderRadius: '50%',
                              animation: 'login-glow-orbit 0.8s linear infinite',
                            }}
                          />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          Sign In Securely
                          <ArrowRight style={{ width: 18, height: 18 }} />
                        </>
                      )}
                    </button>
                  </form>

                  {/* ── Divider ── */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      margin: '28px 0',
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: C.line }} />
                    <span style={{ fontSize: 12, color: C.mute, fontWeight: 500 }}>
                      Quick Demo Login
                    </span>
                    <div style={{ flex: 1, height: 1, background: C.line }} />
                  </div>

                  {/* ── Quick login cards ── */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 10,
                    }}
                  >
                    {Object.entries(CLINICAL_PERSONAS).slice(0, 4).map(([id, persona]) => {
                      const roleDef = ROLE_DEFINITIONS[persona.role];
                      const isSelected = selectedQuickLogin === id;
                      return (
                        <button
                          key={id}
                          className="quick-login-card"
                          disabled={isLoading}
                          onClick={() => handleQuickLogin(id)}
                          style={{
                            padding: '14px 16px',
                            borderRadius: 16,
                            border: `1px solid ${isSelected ? roleDef.borderColor : C.line}`,
                            background: isSelected
                              ? roleDef.badgeBg
                              : 'rgba(255,255,255,0.02)',
                            color: '#fff',
                            cursor: isLoading ? 'wait' : 'pointer',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            opacity: isLoading && !isSelected ? 0.4 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: roleDef.badgeBg,
                                border: `1px solid ${roleDef.borderColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: roleDef.badgeColor,
                                flexShrink: 0,
                              }}
                            >
                              {ROLE_ICONS[persona.role]}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                                {persona.name.split(',')[0].split(' ').slice(0, 2).join(' ')}
                              </div>
                              <div style={{ fontSize: 11, color: roleDef.badgeColor }}>
                                {roleDef.title}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Credentials hint ── */}
                  <div
                    style={{
                      marginTop: 24,
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${C.line}`,
                      fontSize: 12,
                      color: C.mute,
                      lineHeight: 1.6,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#fff', marginBottom: 6, fontSize: 13 }}>
                      🔐 Demo Credentials
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                      <div><strong>Radiologist:</strong> elena.vance@...</div>
                      <div>Rad!0l0gist#2026</div>
                      <div><strong>Technician:</strong> marcus.chen@...</div>
                      <div>T3chCT$can#2026</div>
                    </div>
                  </div>

                  {/* ── Bottom security notice ── */}
                  <p
                    style={{
                      textAlign: 'center',
                      fontSize: 12,
                      color: C.mute,
                      marginTop: 20,
                      lineHeight: 1.5,
                    }}
                  >
                    🔒 Protected by 256-bit TLS · HIPAA BAA compliant · Audit logged
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
