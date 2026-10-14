'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRBAC } from '@/context/RBACContext';
import { CLINICAL_PERSONAS, ROLE_DEFINITIONS, type Role } from '@/types/rbac';
import { iamAuthService } from '@/services/iamAuthService';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Lock,
  Fingerprint,
  Activity,
  Stethoscope,
  Cpu,
  FileCheck2,
  AlertTriangle,
  Cloud,
  Key,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  KeyRound,
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
  const { switchPersona, currentUser, loginWithIAM } = useRBAC();

  // Authentication mode: IAM cloud service vs clinical demo credentials
  const [authMode, setAuthMode] = useState<'iam' | 'clinical'>('iam');

  // Clinical demo states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [selectedQuickLogin, setSelectedQuickLogin] = useState<string | null>(null);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  // AWS IAM Two-step and MFA states
  const [iamStep, setIamStep] = useState<1 | 2 | 3>(1);
  const [iamUserType, setIamUserType] = useState<'root' | 'iam'>('root');
  const [iamEmail, setIamEmail] = useState('root@aws-example.com');
  const [iamAccountIdOrAlias, setIamAccountIdOrAlias] = useState('aws-demo');
  const [iamUsername, setIamUsername] = useState('alice.dev');
  const [iamPassword, setIamPassword] = useState('');
  const [iamRememberDevice, setIamRememberDevice] = useState(false);
  const [iamAccountName, setIamAccountName] = useState('');
  const [iamMfaSessionToken, setIamMfaSessionToken] = useState('');
  const [iamMfaCode, setIamMfaCode] = useState('');
  const [iamIsBackupCode, setIamIsBackupCode] = useState(false);
  const [iamBackendOnline, setIamBackendOnline] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/lung-cancer';

  // Check IAM backend service health on mount
  useEffect(() => {
    iamAuthService.checkHealth().then((online) => setIamBackendOnline(online));
  }, []);

  // Fall back to clinical demo credentials when the IAM backend is unavailable
  useEffect(() => {
    if (iamBackendOnline === false) {
      setAuthMode('clinical');
    }
  }, [iamBackendOnline]);

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
    let disposed = false;
    let teardown: (() => void) | null = null;

    const initThree = async () => {
      const THREE = await import('three').catch(() => null);
      if (!THREE || disposed) return;

      const sizeOf = () => ({
        w: Math.max(el.clientWidth, 1),
        h: Math.max(el.clientHeight, 1),
      });
      let { w, h } = sizeOf();

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(w, h);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      renderer.domElement.style.opacity = '0';
      renderer.domElement.style.transition = 'opacity 1.2s ease-out';
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050a10, 0.045);

      const cam = new THREE.PerspectiveCamera(48, w / h, 0.1, 60);
      cam.position.set(0, 0.2, 9);

      const root = new THREE.Group();
      scene.add(root);

      const disposables: Array<{ dispose: () => void }> = [];
      const track = <T extends { dispose: () => void }>(obj: T): T => {
        disposables.push(obj);
        return obj;
      };

      // ── Lighting: gives the geometry real shaded depth ──
      scene.add(new THREE.AmbientLight(0x1a2c3d, 1.6));
      const tealLight = new THREE.PointLight(0x00dcce, 60, 30, 2);
      tealLight.position.set(5, 3, 6);
      const violetLight = new THREE.PointLight(0x7c5cfc, 45, 30, 2);
      violetLight.position.set(-6, -3, 5);
      const coralLight = new THREE.PointLight(0xff7869, 25, 25, 2);
      coralLight.position.set(0, 5, -5);
      scene.add(tealLight, violetLight, coralLight);

      // ── Security knot (torus knot, physically shaded) ──
      const knotGeo = track(new THREE.TorusKnotGeometry(0.78, 0.2, 220, 36, 2, 3));
      const knotMat = track(
        new THREE.MeshStandardMaterial({
          color: 0x0e273a,
          metalness: 0.9,
          roughness: 0.18,
          emissive: 0x00dcce,
          emissiveIntensity: 0.16,
        })
      );
      const shield = new THREE.Mesh(knotGeo, knotMat);
      shield.position.set(0, 1.6, 0);
      root.add(shield);

      // ── Inner core glow ──
      const glowGeo = track(new THREE.SphereGeometry(0.52, 32, 32));
      const glowMat = track(
        new THREE.MeshBasicMaterial({
          color: 0x7c5cfc,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        })
      );
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(shield.position);
      root.add(glow);

      // ── DNA helix strands as shaded instanced beads ──
      const STRAND_N = 72;
      const helixR = 2.35;
      const helixH = 6.6;
      const helixTurns = Math.PI * 5.4;
      const beadGeo = track(new THREE.SphereGeometry(0.085, 14, 14));
      const beadMatA = track(
        new THREE.MeshStandardMaterial({
          color: 0x00dcce,
          emissive: 0x00dcce,
          emissiveIntensity: 0.5,
          metalness: 0.3,
          roughness: 0.4,
        })
      );
      const beadMatB = track(
        new THREE.MeshStandardMaterial({
          color: 0x98aed9,
          emissive: 0x4b6a9b,
          emissiveIntensity: 0.4,
          metalness: 0.3,
          roughness: 0.4,
        })
      );
      const strandA = new THREE.InstancedMesh(beadGeo, beadMatA, STRAND_N);
      const strandB = new THREE.InstancedMesh(beadGeo, beadMatB, STRAND_N);
      const dummy = new THREE.Object3D();
      type Vec3 = InstanceType<typeof THREE.Vector3>;
      const posA: Vec3[] = [];
      const posB: Vec3[] = [];
      for (let i = 0; i < STRAND_N; i++) {
        const f = i / (STRAND_N - 1);
        const t = f * helixTurns;
        const y = f * helixH - helixH / 2;
        const a = new THREE.Vector3(Math.cos(t) * helixR, y, Math.sin(t) * helixR);
        const b = new THREE.Vector3(Math.cos(t + Math.PI) * helixR, y, Math.sin(t + Math.PI) * helixR);
        posA.push(a);
        posB.push(b);
        dummy.position.copy(a);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        strandA.setMatrixAt(i, dummy.matrix);
        dummy.position.copy(b);
        dummy.updateMatrix();
        strandB.setMatrixAt(i, dummy.matrix);
      }
      root.add(strandA, strandB);

      // ── Base-pair rungs ──
      const rungGeo = track(new THREE.CylinderGeometry(0.03, 0.03, 1, 8));
      const rungMat = track(
        new THREE.MeshStandardMaterial({
          color: 0xff7869,
          emissive: 0xff7869,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.55,
          roughness: 0.5,
        })
      );
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 2; i < STRAND_N; i += 4) {
        const from = posA[i];
        const dir = posB[i].clone().sub(from);
        const len = dir.length();
        const rung = new THREE.Mesh(rungGeo, rungMat);
        rung.position.copy(from).addScaledVector(dir, 0.5);
        rung.quaternion.setFromUnitVectors(up, dir.normalize());
        rung.scale.set(1, len, 1);
        root.add(rung);
      }

      // ── Orbiting particle shell ──
      const orbitN = 220;
      const orbitPos = new Float32Array(orbitN * 3);
      const orbitCol = new Float32Array(orbitN * 3);
      const tealC = new THREE.Color(0x00dcce);
      const violetC = new THREE.Color(0x7c5cfc);
      for (let i = 0; i < orbitN; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2.6 + Math.random() * 1.1;
        orbitPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        orbitPos[i * 3 + 1] = r * Math.cos(phi) * 1.3;
        orbitPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const c = tealC.clone().lerp(violetC, Math.random());
        orbitCol[i * 3] = c.r;
        orbitCol[i * 3 + 1] = c.g;
        orbitCol[i * 3 + 2] = c.b;
      }
      const orbitGeo = track(new THREE.BufferGeometry());
      orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPos, 3));
      orbitGeo.setAttribute('color', new THREE.BufferAttribute(orbitCol, 3));
      const orbitMat = track(
        new THREE.PointsMaterial({
          size: 0.05,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        })
      );
      const orbitPts = new THREE.Points(orbitGeo, orbitMat);
      root.add(orbitPts);

      // ── Frame-rate-independent animation with damped parallax ──
      let targetX = 0;
      let targetY = 0;
      let curX = 0;
      let curY = 0;

      const onMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      };
      const onMouseLeave = () => {
        targetX = 0;
        targetY = 0;
      };
      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('mouseleave', onMouseLeave);

      let rafId = 0;
      let last = performance.now();

      const loop = (now: number) => {
        rafId = requestAnimationFrame(loop);

        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        // exponential damping: identical feel at 60, 120, 144 Hz
        const damp = 1 - Math.exp(-5 * dt);
        const dampCam = 1 - Math.exp(-3 * dt);
        curX += (targetX - curX) * damp;
        curY += (targetY - curY) * damp;

        const t = now * 0.001;
        root.rotation.y += dt * 0.22;
        orbitPts.rotation.y -= dt * 0.05;

        shield.rotation.x = t * 0.35;
        shield.rotation.y = t * 0.5;
        const breath = 1 + Math.sin(t * 1.6) * 0.05;
        shield.scale.setScalar(breath);
        shield.position.y = 1.6 + Math.sin(t * 0.8) * 0.12;

        glow.position.copy(shield.position);
        glow.scale.setScalar(1 + 0.14 * Math.sin(t * 2.1));

        // parallax moves the camera, so perspective shifts with real depth
        cam.position.x += (curX * 1.1 - cam.position.x) * dampCam;
        cam.position.y += (-curY * 0.7 + 0.2 - cam.position.y) * dampCam;
        cam.lookAt(0, 0.4, 0);

        tealLight.intensity = 60 + Math.sin(t * 0.9) * 12;
        violetLight.position.x = Math.cos(t * 0.3) * 6;
        violetLight.position.z = Math.sin(t * 0.3) * 5 + 2;

        renderer.render(scene, cam);
      };
      rafId = requestAnimationFrame(loop);
      requestAnimationFrame(() => {
        renderer.domElement.style.opacity = '1';
      });

      const ro = new ResizeObserver(() => {
        ({ w, h } = sizeOf());
        renderer.setSize(w, h);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      });
      ro.observe(el);

      teardown = () => {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        el.removeEventListener('mousemove', onMouseMove);
        el.removeEventListener('mouseleave', onMouseLeave);
        if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
        strandA.dispose();
        strandB.dispose();
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
      };
    };

    void initThree();
    return () => {
      disposed = true;
      teardown?.();
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

  /* ── IAM Step 1 Handler (Identifier validation) ── */
  const handleIamStep1 = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      try {
        const res = await iamAuthService.signinStep1({
          userType: iamUserType,
          email: iamUserType === 'root' ? iamEmail.trim() : undefined,
          accountIdOrAlias: iamUserType === 'iam' ? iamAccountIdOrAlias.trim() : undefined,
          username: iamUserType === 'iam' ? iamUsername.trim() : undefined,
        });

        if (res.success) {
          setIamAccountName(res.data?.accountName || 'AWS Console');
          setIamStep(2);
        }
      } catch (err) {
        setError((err instanceof Error ? err.message : String(err)) || 'Incorrect credentials. Please verify your information.');
      } finally {
        setIsLoading(false);
      }
    },
    [iamUserType, iamEmail, iamAccountIdOrAlias, iamUsername]
  );

  /* ── IAM Step 2 Handler (Password authentication) ── */
  const handleIamStep2 = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLocked(false);
      setIsLoading(true);

      try {
        const res = await iamAuthService.signinStep2({
          userType: iamUserType,
          email: iamUserType === 'root' ? iamEmail.trim() : undefined,
          accountIdOrAlias: iamUserType === 'iam' ? iamAccountIdOrAlias.trim() : undefined,
          username: iamUserType === 'iam' ? iamUsername.trim() : undefined,
          password: iamPassword,
          rememberDevice: iamRememberDevice,
        });

        if (res.success) {
          if (res.requiresMfa) {
            setIamMfaSessionToken(res.mfaSessionToken || '');
            setIamStep(3);
          } else if (res.data?.user) {
            loginWithIAM(res.data.user);
            setLoginSuccess(true);
            setTimeout(() => {
              router.push(redirectTo);
            }, 1800);
          }
        }
      } catch (err) {
        if ((err as { error?: unknown; status?: unknown }).error === 'AccountLocked' || (err as { status?: unknown }).status === 423) {
          setIsLocked(true);
        }
        setError((err instanceof Error ? err.message : String(err)) || 'Incorrect credentials. Please verify your information and try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [iamUserType, iamEmail, iamAccountIdOrAlias, iamUsername, iamPassword, iamRememberDevice, loginWithIAM, router, redirectTo]
  );

  /* ── IAM Step 3 Handler (MFA TOTP / Backup Code) ── */
  const handleIamMfa = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      try {
        const res = await iamAuthService.verifyMfa({
          mfaSessionToken: iamMfaSessionToken,
          code: iamMfaCode.trim(),
          isBackupCode: iamIsBackupCode,
        });

        if (res.success && res.data?.user) {
          loginWithIAM(res.data.user);
          setLoginSuccess(true);
          setTimeout(() => {
            router.push(redirectTo);
          }, 1800);
        }
      } catch (err) {
        setError((err instanceof Error ? err.message : String(err)) || 'Invalid authentication code. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [iamMfaSessionToken, iamMfaCode, iamIsBackupCode, loginWithIAM, router, redirectTo]
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
                  <div style={{ marginBottom: 28 }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 14px',
                        borderRadius: 999,
                        background: `${C.teal}12`,
                        border: `1px solid ${C.teal}30`,
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.teal,
                        marginBottom: 16,
                        letterSpacing: '0.02em',
                      }}
                    >
                      <Lock style={{ width: 12, height: 12 }} />
                      Enterprise RBAC Authentication
                      {iamBackendOnline !== null && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginLeft: 4,
                            paddingLeft: 8,
                            borderLeft: `1px solid ${C.teal}40`,
                            color: iamBackendOnline ? '#00DCCE' : '#FF7869',
                            fontSize: 11,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: iamBackendOnline ? '#00DCCE' : '#FF7869',
                              display: 'inline-block',
                            }}
                          />
                          {iamBackendOnline ? 'IAM API Live' : 'IAM API Offline'}
                        </span>
                      )}
                    </div>

                    <h1
                      style={{
                        fontFamily: 'Sora, system-ui, sans-serif',
                        fontSize: 30,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        marginBottom: 8,
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
                    <p style={{ color: C.mute, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                      Choose your enterprise identity provider or clinical institutional credentials.
                    </p>
                  </div>

                  {/* ── Mode Selection Tabs ── */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      padding: 4,
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 14,
                      border: `1px solid ${C.line}`,
                      marginBottom: 24,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setAuthMode('iam'); setError(''); }}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: authMode === 'iam' ? `linear-gradient(135deg, ${C.tealDim}, ${C.teal})` : 'transparent',
                        color: authMode === 'iam' ? '#050A10' : C.mute,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.25s',
                      }}
                    >
                      <Cloud style={{ width: 15, height: 15 }} />
                      AWS IAM Cloud Sign-in
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('clinical'); setError(''); }}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: authMode === 'clinical' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: authMode === 'clinical' ? '#fff' : C.mute,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.25s',
                      }}
                    >
                      <Fingerprint style={{ width: 15, height: 15 }} />
                      Clinical Demo Passwords
                    </button>
                  </div>

                  {/* ────────────────────────────────────────────────────────── */}
                  {/* MODE A: AWS IAM CLOUD SERVICE FLOW                         */}
                  {/* ────────────────────────────────────────────────────────── */}
                  {authMode === 'iam' && (
                    <div>
                      {/* STEP 1: IDENTIFIER SELECTION */}
                      {iamStep === 1 && (
                        <form onSubmit={handleIamStep1}>
                          <div style={{ marginBottom: 18 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.mute, marginBottom: 10 }}>
                              Select IAM Identity Type
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 10,
                                  padding: '12px 14px',
                                  borderRadius: 12,
                                  border: `1.5px solid ${iamUserType === 'root' ? C.teal : C.line}`,
                                  background: iamUserType === 'root' ? `${C.teal}12` : 'rgba(255,255,255,0.02)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                              >
                                <input
                                  type="radio"
                                  name="iamUserType"
                                  checked={iamUserType === 'root'}
                                  onChange={() => setIamUserType('root')}
                                  style={{ marginTop: 2, accentColor: C.teal }}
                                />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Root User</div>
                                  <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>Account owner (full bypass)</div>
                                </div>
                              </label>

                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 10,
                                  padding: '12px 14px',
                                  borderRadius: 12,
                                  border: `1.5px solid ${iamUserType === 'iam' ? C.teal : C.line}`,
                                  background: iamUserType === 'iam' ? `${C.teal}12` : 'rgba(255,255,255,0.02)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                              >
                                <input
                                  type="radio"
                                  name="iamUserType"
                                  checked={iamUserType === 'iam'}
                                  onChange={() => setIamUserType('iam')}
                                  style={{ marginTop: 2, accentColor: C.teal }}
                                />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>IAM User</div>
                                  <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>Delegated RBAC role</div>
                                </div>
                              </label>
                            </div>
                          </div>

                          {iamUserType === 'root' ? (
                            <div style={{ marginBottom: 20 }}>
                              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.mute, marginBottom: 8 }}>
                                Root User Email Address
                              </label>
                              <input
                                type="email"
                                required
                                value={iamEmail}
                                onChange={(e) => { setIamEmail(e.target.value); setError(''); }}
                                placeholder="root@aws-example.com"
                                className="login-input"
                                style={{
                                  width: '100%',
                                  padding: '14px 18px',
                                  borderRadius: 14,
                                  border: `1px solid ${C.line}`,
                                  background: 'rgba(255,255,255,0.03)',
                                  color: '#fff',
                                  fontSize: 15,
                                  fontFamily: 'inherit',
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                              <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.mute, marginBottom: 8 }}>
                                  AWS Account ID or Account Alias
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={iamAccountIdOrAlias}
                                  onChange={(e) => { setIamAccountIdOrAlias(e.target.value); setError(''); }}
                                  placeholder="aws-demo"
                                  className="login-input"
                                  style={{
                                    width: '100%',
                                    padding: '14px 18px',
                                    borderRadius: 14,
                                    border: `1px solid ${C.line}`,
                                    background: 'rgba(255,255,255,0.03)',
                                    color: '#fff',
                                    fontSize: 15,
                                    fontFamily: 'monospace',
                                  }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.mute, marginBottom: 8 }}>
                                  IAM Username
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={iamUsername}
                                  onChange={(e) => { setIamUsername(e.target.value); setError(''); }}
                                  placeholder="alice.dev"
                                  className="login-input"
                                  style={{
                                    width: '100%',
                                    padding: '14px 18px',
                                    borderRadius: 14,
                                    border: `1px solid ${C.line}`,
                                    background: 'rgba(255,255,255,0.03)',
                                    color: '#fff',
                                    fontSize: 15,
                                    fontFamily: 'inherit',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Quick autofill helper chips */}
                          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setIamUserType('root');
                                setIamEmail('root@aws-example.com');
                                setIamPassword('SuperSecret#Root2026!');
                              }}
                              style={{
                                fontSize: 11,
                                padding: '5px 12px',
                                borderRadius: 8,
                                background: 'rgba(255, 153, 0, 0.12)',
                                border: '1px solid rgba(255, 153, 0, 0.3)',
                                color: '#FF9900',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              ⚡ Fill Root: root@aws-example.com
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIamUserType('iam');
                                setIamAccountIdOrAlias('aws-demo');
                                setIamUsername('alice.dev');
                                setIamPassword('DeveloperPass#2026!');
                              }}
                              style={{
                                fontSize: 11,
                                padding: '5px 12px',
                                borderRadius: 8,
                                background: `${C.teal}12`,
                                border: `1px solid ${C.teal}30`,
                                color: C.teal,
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              ⚡ Fill IAM: alice.dev @ aws-demo
                            </button>
                          </div>

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
                              }}
                            >
                              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                              {error}
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                              width: '100%',
                              padding: '15px 24px',
                              borderRadius: 14,
                              border: 'none',
                              background: isLoading ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, #FF9900, #EC7211)`,
                              color: '#000',
                              fontSize: 15,
                              fontWeight: 800,
                              cursor: isLoading ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 10,
                              transition: 'all 0.3s',
                              boxShadow: isLoading ? 'none' : '0 12px 36px -10px rgba(255, 153, 0, 0.4)',
                            }}
                          >
                            {isLoading ? 'Verifying with AWS IAM...' : 'Next: Enter Password'}
                            <ArrowRight style={{ width: 18, height: 18 }} />
                          </button>
                        </form>
                      )}

                      {/* STEP 2: PASSWORD ENTRY */}
                      {iamStep === 2 && (
                        <form onSubmit={handleIamStep2}>
                          {/* Active identity badge */}
                          <div
                            style={{
                              padding: '12px 16px',
                              borderRadius: 12,
                              background: 'rgba(255,255,255,0.03)',
                              border: `1px solid ${C.line}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 20,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 11, color: C.mute, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {iamUserType === 'root' ? 'Root User' : `IAM User @ ${iamAccountName}`}
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                                {iamUserType === 'root' ? iamEmail : iamUsername}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setIamStep(1); setError(''); }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: C.teal,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <ArrowLeft style={{ width: 14, height: 14 }} />
                              Edit
                            </button>
                          </div>

                          <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.mute, marginBottom: 8 }}>
                              Password
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={showPassword ? 'text' : 'password'}
                                autoFocus
                                required
                                value={iamPassword}
                                onChange={(e) => { setIamPassword(e.target.value); setError(''); }}
                                placeholder="Enter your IAM password"
                                className="login-input"
                                style={{
                                  width: '100%',
                                  padding: '14px 50px 14px 18px',
                                  borderRadius: 14,
                                  border: `1px solid ${C.line}`,
                                  background: 'rgba(255,255,255,0.03)',
                                  color: '#fff',
                                  fontSize: 15,
                                  fontFamily: 'inherit',
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
                              >
                                {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                              </button>
                            </div>
                          </div>

                          {/* Remember Device checkbox */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', fontSize: 13, color: C.mute }}>
                            <input
                              type="checkbox"
                              checked={iamRememberDevice}
                              onChange={(e) => setIamRememberDevice(e.target.checked)}
                              style={{ accentColor: C.teal }}
                            />
                            Remember this device for 30 days
                          </label>

                          {error && (
                            <div
                              style={{
                                padding: '12px 16px',
                                borderRadius: 12,
                                background: isLocked ? 'rgba(245, 166, 35, 0.12)' : 'rgba(255, 120, 105, 0.1)',
                                border: `1px solid ${isLocked ? 'rgba(245, 166, 35, 0.3)' : 'rgba(255, 120, 105, 0.25)'}`,
                                color: isLocked ? '#F5A623' : C.coral,
                                fontSize: 13,
                                marginBottom: 18,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              {isLocked ? <ShieldAlert style={{ width: 16, height: 16, flexShrink: 0 }} /> : <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />}
                              {error}
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isLoading || !iamPassword}
                            style={{
                              width: '100%',
                              padding: '15px 24px',
                              borderRadius: 14,
                              border: 'none',
                              background: isLoading || !iamPassword ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, #FF9900, #EC7211)`,
                              color: '#000',
                              fontSize: 15,
                              fontWeight: 800,
                              cursor: isLoading ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 10,
                              transition: 'all 0.3s',
                              boxShadow: isLoading ? 'none' : '0 12px 36px -10px rgba(255, 153, 0, 0.4)',
                            }}
                          >
                            {isLoading ? 'Authenticating Credentials...' : 'Sign in to AWS Console'}
                            <ArrowRight style={{ width: 18, height: 18 }} />
                          </button>
                        </form>
                      )}

                      {/* STEP 3: MFA TOTP VERIFICATION */}
                      {iamStep === 3 && (
                        <form onSubmit={handleIamMfa}>
                          <div
                            style={{
                              padding: '14px 16px',
                              borderRadius: 12,
                              background: `${C.teal}12`,
                              border: `1px solid ${C.teal}30`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              marginBottom: 20,
                            }}
                          >
                            <ShieldCheck style={{ width: 22, height: 22, color: C.teal, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Two-Factor Security Enforced</div>
                              <div style={{ fontSize: 11, color: C.mute }}>Authentication token required for this IAM account</div>
                            </div>
                          </div>

                          <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.mute, marginBottom: 8 }}>
                              {iamIsBackupCode ? 'Enter 8-Character Emergency Backup Code' : 'Enter 6-Digit Code from Google Authenticator / Authy'}
                            </label>
                            <input
                              type="text"
                              autoFocus
                              required
                              maxLength={iamIsBackupCode ? 12 : 6}
                              value={iamMfaCode}
                              onChange={(e) => {
                                const val = iamIsBackupCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '');
                                setIamMfaCode(val);
                                setError('');
                              }}
                              placeholder={iamIsBackupCode ? 'A1B2C3D4' : '123456'}
                              className="login-input"
                              style={{
                                width: '100%',
                                padding: '14px 18px',
                                borderRadius: 14,
                                border: `1px solid ${C.line}`,
                                background: 'rgba(255,255,255,0.03)',
                                color: '#fff',
                                fontSize: 20,
                                fontFamily: 'monospace',
                                letterSpacing: '0.25em',
                                textAlign: 'center',
                              }}
                            />
                          </div>

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
                              }}
                            >
                              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                              {error}
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isLoading || !iamMfaCode.trim()}
                            style={{
                              width: '100%',
                              padding: '15px 24px',
                              borderRadius: 14,
                              border: 'none',
                              background: isLoading || !iamMfaCode.trim() ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${C.tealDim}, ${C.teal})`,
                              color: '#050A10',
                              fontSize: 15,
                              fontWeight: 800,
                              cursor: isLoading ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 10,
                              transition: 'all 0.3s',
                            }}
                          >
                            {isLoading ? 'Validating Token...' : 'Verify & Complete Sign-in'}
                            <ArrowRight style={{ width: 18, height: 18 }} />
                          </button>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12 }}>
                            <button
                              type="button"
                              onClick={() => { setIamIsBackupCode(!iamIsBackupCode); setIamMfaCode(''); }}
                              style={{ background: 'none', border: 'none', color: C.teal, cursor: 'pointer', padding: 0 }}
                            >
                              {iamIsBackupCode ? 'Use authenticator app' : 'Use backup code instead'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setIamStep(1); setError(''); }}
                              style={{ background: 'none', border: 'none', color: C.mute, cursor: 'pointer', padding: 0 }}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Link to Dedicated AWS Console */}
                      <div
                        style={{
                          marginTop: 24,
                          paddingTop: 16,
                          borderTop: `1px solid ${C.line}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: C.mute }}>IAM Administration Console:</span>
                        <a
                          href="http://localhost:5173"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#FF9900',
                            textDecoration: 'none',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          Launch IAM Console (Port 5173)
                          <ExternalLink style={{ width: 13, height: 13 }} />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* ────────────────────────────────────────────────────────── */}
                  {/* MODE B: INSTITUTIONAL PASSWORDS & 1-CLICK PERSONAS         */}
                  {/* ────────────────────────────────────────────────────────── */}
                  {authMode === 'clinical' && (
                    <div>
                      <form onSubmit={handleLogin}>
                        {/* Email */}
                        <div style={{ marginBottom: 18 }}>
                          <label htmlFor="login-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.mute, marginBottom: 8 }}>
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
                          <label htmlFor="login-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.mute, marginBottom: 8 }}>
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
                          {isLoading ? 'Authenticating...' : 'Sign In Securely'}
                          <ArrowRight style={{ width: 18, height: 18 }} />
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
                          1-Click Demo Login
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
                    </div>
                  )}

                  {/* ── Bottom security notice ── */}
                  <p
                    style={{
                      textAlign: 'center',
                      fontSize: 12,
                      color: C.mute,
                      marginTop: 24,
                      lineHeight: 1.5,
                    }}
                  >
                    🔒 Protected by 256-bit TLS · HIPAA BAA compliant · AWS IAM RBAC Policy Evaluator
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
