'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';
import type * as Three from 'three';

type Kind = 'lungs' | 'heart' | 'brain';
type Controls = { rotate: (direction: number) => void; toggle: () => void; reset: () => void };
type Point = [number, number, number];

const TITLES: Record<Kind, string> = {
  lungs: 'Lungs & bronchial tree',
  heart: 'Heart & great vessels',
  brain: 'Cerebral cortex & brainstem',
};

// All surfaces are procedural illustrations, not reconstructions or validated anatomy.
function buildAnatomy(
  T: typeof Three,
  kind: Kind,
  root: Three.Group,
  geometries: Set<Three.BufferGeometry>,
  materials: Set<Three.Material>,
  textures: Set<Three.Texture>,
) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = textureCanvas.height = 128;
  const context = textureCanvas.getContext('2d');
  let bump: Three.CanvasTexture | undefined;
  if (context) {
    const image = context.createImageData(128, 128);
    for (let i = 0; i < image.data.length; i += 4) {
      const noise = 115 + 28 * Math.sin(i * 12.9898) * Math.cos(i * 0.318);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = noise;
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    bump = new T.CanvasTexture(textureCanvas);
    bump.wrapS = bump.wrapT = T.RepeatWrapping;
    bump.repeat.set(3, 3);
    textures.add(bump);
  }
  const tissue = (color: string, roughness = 0.52, vertexColors = false) => {
    const material = new T.MeshPhysicalMaterial({
      color, roughness, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.48,
      bumpMap: bump, bumpScale: 0.018, vertexColors,
    });
    materials.add(material);
    return material;
  };
  const mesh = (geometry: Three.BufferGeometry, material: Three.Material, parent = root) => {
    geometries.add(geometry);
    const item = new T.Mesh(geometry, material);
    item.castShadow = item.receiveShadow = true;
    parent.add(item);
    return item;
  };
  const ellipsoid = (position: Point, scale: Point, material: Three.Material, parent = root) => {
    const item = mesh(new T.SphereGeometry(1, 64, 40), material, parent);
    item.position.set(...position);
    item.scale.set(...scale);
    return item;
  };
  const tube = (points: Point[], radius: number, material: Three.Material, parent = root, endRadius = radius) => {
    const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
    const segments = Math.max(24, points.length * 10);
    const geometry = new T.TubeGeometry(curve, segments, radius, 10, false);
    geometries.add(geometry);
    // Taper around each curve frame rather than scaling the entire vessel.
    const vertices = geometry.attributes.position;
    for (let i = 0; i <= segments; i++) {
      const center = curve.getPointAt(i / segments);
      const factor = 1 + (endRadius / radius - 1) * i / segments;
      for (let j = 0; j <= 10; j++) {
        const index = i * 11 + j;
        vertices.setXYZ(index,
          center.x + (vertices.getX(index) - center.x) * factor,
          center.y + (vertices.getY(index) - center.y) * factor,
          center.z + (vertices.getZ(index) - center.z) * factor);
      }
    }
    geometry.computeVertexNormals();
    return mesh(geometry, material, parent);
  };
  const surface = (point: (u: number, v: number) => Three.Vector3, material: Three.Material, shade?: (u: number, v: number) => number) => {
    const geometry = new T.SphereGeometry(1, 128, 88);
    geometries.add(geometry);
    const positions = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      // Match SphereGeometry's outward winding (-cos(phi), sin(phi)).
      const u = Math.PI - uv.getX(i) * Math.PI * 2;
      const v = (1 - uv.getY(i)) * Math.PI;
      const p = point(u, v);
      positions.setXYZ(i, p.x, p.y, p.z);
      const value = shade?.(u, v) ?? 1;
      colors.set([value, value * 0.99, value * 0.98], i * 3);
    }
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return mesh(geometry, material);
  };

  if (kind === 'lungs') {
    const parenchyma = tissue('#c89798', 0.58, true);
    const airway = tissue('#dbc9b6', 0.5);
    const cartilage = tissue('#bba895', 0.62);
    const fissure = tissue('#997476', 0.72);
    const breathing = new T.Group();
    root.add(breathing);
    for (const side of [-1, 1]) {
      const seam = (u: number) => 1.76 + 0.32 * Math.sin(u) + side * 0.2 * Math.cos(u);
      const horizontal = (u: number) => 1.35 + 0.12 * Math.cos(u);
      const lungPoint = (u: number, v: number) => {
        const sy = Math.cos(v), ring = Math.sin(v);
        const broad = 0.86 - 0.18 * sy;
        const groove = 0.024 * Math.exp(-Math.pow((v - seam(u)) / 0.03, 2))
          + (side === -1 ? 0.019 * Math.exp(-Math.pow((v - horizontal(u)) / 0.026, 2)) : 0);
        const x = ring * Math.cos(u) * (broad - groove) * (side === 1 ? 0.89 : 1.04);
        const z = ring * Math.sin(u) * (0.68 - groove);
        const notch = side === 1 ? 0.28 * Math.exp(-Math.pow((sy + 0.03) / 0.36, 2))
          * Math.max(0, -Math.cos(u)) * Math.max(0, Math.sin(u)) : 0;
        return new T.Vector3(side * 0.99 + x + notch,
          Math.max(-1.28, sy * (side === 1 ? 1.45 : 1.57)) - 0.1,
          z - 0.07 * sy);
      };
      const lobe = surface(lungPoint, parenchyma, (u, v) => 0.94 + 0.035 * Math.sin(43 * u + 19 * v) * Math.sin(29 * v));
      breathing.attach(lobe);
      const seamPoints: Point[] = [];
      for (let i = 0; i <= 72; i++) {
        const u = i / 72 * Math.PI * 2;
        const p = lungPoint(u, seam(u));
        seamPoints.push([p.x, p.y, p.z]);
      }
      tube(seamPoints, 0.009, fissure, breathing);
      if (side === -1) {
        const points: Point[] = [];
        for (let i = 0; i <= 36; i++) {
          const u = i / 36 * Math.PI;
          const p = lungPoint(u, horizontal(u));
          points.push([p.x, p.y, p.z]);
        }
        tube(points, 0.008, fissure, breathing);
      }
      // Exposed central bronchi enter the medial surface; distal branches are suggestive.
      const bronchus: Point[] = [[0, 0.88, 0.1], [side * 0.28, 0.55, 0.16], [side * 0.56, 0.28, 0.23]];
      tube(bronchus, 0.12, airway, breathing, 0.07);
      for (const branch of [-1, 0, 1]) {
        tube([[side * 0.48, 0.37, 0.22], [side * 0.64, 0.29 + branch * 0.34, 0.27],
          [side * 0.81, 0.2 + branch * 0.63, 0.29]], 0.055, airway, breathing, 0.021);
      }
    }
    tube([[0, 2.16, 0.05], [0, 1.52, 0.09], [0, 0.86, 0.1]], 0.14, airway);
    for (let i = 0; i < 12; i++) {
      const ring = mesh(new T.TorusGeometry(0.143, 0.018, 8, 28, Math.PI * 1.7), cartilage);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.95 + i * 0.1, 0.08);
    }
    return (seconds: number) => {
      const breath = Math.sin(seconds * Math.PI / 2.5) * 0.012;
      breathing.scale.set(1 + breath, 1 + breath * 0.65, 1 + breath);
    };
  }

  if (kind === 'heart') {
    const myocardium = tissue('#a85857', 0.48, true);
    const atrial = tissue('#b36c65', 0.55);
    const arterial = tissue('#b47870', 0.43);
    const venous = tissue('#788c9b', 0.48);
    const coronary = tissue('#d7a599', 0.5);
    const muscle = new T.Group();
    root.add(muscle);
    const left = surface((u, v) => {
      const y = Math.cos(v), r = Math.sin(v);
      const taper = 0.72 + 0.28 * (y + 1) / 2;
      return new T.Vector3(0.27 + r * Math.cos(u) * 0.88 * taper - 0.23 * y,
        y * 1.28 - 0.29, r * Math.sin(u) * 0.77 * taper);
    }, myocardium, (u, v) => 0.93 + 0.05 * Math.sin(u * 18 + v * 12) * Math.sin(v * 9));
    muscle.attach(left);
    const right = ellipsoid([-0.48, -0.12, 0.28], [0.64, 1.03, 0.59], tissue('#a85857', 0.48), muscle);
    right.rotation.z = -0.28;
    for (const side of [-1, 1]) {
      const atrium = ellipsoid([side * 0.61, 0.83, -0.09], [0.49, 0.54, 0.47], atrial, muscle);
      atrium.rotation.z = side * 0.25;
      const ear = ellipsoid([side * 0.79, 0.65, 0.35], [0.3, 0.22, 0.18], atrial, muscle);
      ear.rotation.z = side * 0.45;
    }
    // Ascending aorta, arch and descending section, with three arch branches.
    tube([[0.11, 0.7, -0.03], [0.03, 1.28, -0.06], [0.12, 1.77, -0.15],
      [0.56, 1.95, -0.26], [0.92, 1.57, -0.39], [0.94, 0.92, -0.52]], 0.21, arterial, root, 0.17);
    for (let i = 0; i < 3; i++) {
      tube([[0.18 + i * 0.23, 1.8 - i * 0.02, -0.2], [0.16 + i * 0.29, 2.09, -0.24],
        [0.1 + i * 0.35, 2.31 - i * 0.05, -0.3]], 0.073, arterial, root, 0.058);
    }
    tube([[-0.34, 0.38, 0.45], [-0.35, 1.12, 0.37], [-0.72, 1.49, 0.07], [-1.1, 1.5, -0.16]], 0.17, venous, root, 0.12);
    tube([[-0.6, 1.39, 0.14], [-0.18, 1.55, -0.31], [0.55, 1.38, -0.5]], 0.105, venous);
    tube([[-0.77, 0.74, -0.22], [-0.87, 1.44, -0.3], [-0.85, 1.93, -0.36]], 0.14, venous);
    tube([[-0.66, 0.72, -0.25], [-0.85, 0.05, -0.38], [-0.79, -0.61, -0.44]], 0.13, venous);
    const mainArtery: Point[] = [[-0.11, 0.82, 0.5], [-0.1, 0.34, 0.85], [0.13, -0.14, 0.84],
      [0.32, -0.73, 0.65], [0.45, -1.25, 0.32]];
    tube(mainArtery, 0.027, coronary, muscle, 0.012);
    for (let i = 0; i < 3; i++) {
      tube([[0.01 + i * 0.13, 0.16 - i * 0.39, 0.85 - i * 0.06],
        [0.38 + i * 0.1, 0.04 - i * 0.38, 0.72 - i * 0.04],
        [0.7, -0.12 - i * 0.36, 0.53 - i * 0.1]], 0.015, coronary, muscle, 0.006);
      tube([[-0.1, 0.39 - i * 0.29, 0.81], [-0.42, 0.3 - i * 0.29, 0.88],
        [-0.72, 0.06 - i * 0.29, 0.72]], 0.014, coronary, muscle, 0.006);
    }
    root.rotation.z = -0.13;
    return (seconds: number) => {
      const phase = seconds % 1.06 / 1.06;
      const contraction = Math.exp(-Math.pow((phase - 0.23) / 0.13, 2));
      muscle.scale.set(1 - contraction * 0.045, 1 - contraction * 0.018, 1 - contraction * 0.035);
    };
  }

  const cortex = tissue('#cfb6a2', 0.64, true);
  const hindbrain = tissue('#bfa38e', 0.63, true);
  const stem = tissue('#c4b4a0', 0.62);
  const folds = (x: number, y: number, z: number) => {
    const a = Math.sin(19 * x + 2.8 * Math.sin(4 * z) + 1.7 * Math.sin(5 * y));
    const b = Math.sin(18 * y + 2.7 * Math.sin(4 * x) - 1.8 * Math.sin(5 * z));
    const c = Math.sin(17 * z + 2.4 * Math.sin(4 * y) + 1.5 * Math.sin(6 * x));
    // Domain-warped intersecting sulci yield broad rounded gyri with narrow recesses.
    return Math.pow(Math.abs(a * b * c), 0.3);
  };
  for (const side of [-1, 1]) {
    const point = (u: number, v: number) => {
      const x = Math.sin(v) * Math.cos(u), y = Math.cos(v), z = Math.sin(v) * Math.sin(u);
      const fold = folds(x * side, y, z);
      const depth = 0.9 + 0.105 * fold;
      const lateralSulcus = 0.055 * Math.exp(-Math.pow((y + 0.21 + z * 0.14) / 0.04, 2)) * Math.abs(x);
      return new T.Vector3(side * 0.7 + x * 0.67 * (depth - lateralSulcus),
        y * 1.02 * depth + 0.3, z * 1.48 * depth + 0.12 * y);
    };
    surface(point, cortex, (u, v) => {
      const x = Math.sin(v) * Math.cos(u), y = Math.cos(v), z = Math.sin(v) * Math.sin(u);
      return 0.78 + 0.21 * folds(x * side, y, z);
    });
    const cerebellum = surface((u, v) => {
      const y = Math.cos(v), r = Math.sin(v);
      const folia = 1 - 0.032 * Math.pow(0.5 + 0.5 * Math.cos(v * 64 + Math.sin(u * 3)), 5);
      return new T.Vector3(side * 0.43 + r * Math.cos(u) * 0.5 * folia,
        y * 0.4 * folia - 0.86, r * Math.sin(u) * 0.6 * folia - 0.72);
    }, hindbrain, (u, v) => 0.88 + 0.09 * Math.sin(v * 64 + Math.sin(u * 3)));
    cerebellum.rotation.x = -0.08;
  }
  ellipsoid([0, -0.85, -0.24], [0.31, 0.3, 0.28], stem);
  tube([[0, -0.71, -0.25], [0, -1.13, -0.25], [0.02, -1.57, -0.04]], 0.18, stem, root, 0.12);
  return () => {}; // The brain rotates gently; tissue itself remains static.
}

function FallbackAnatomy({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 240 230" aria-hidden="true" className="anatomy-fallback-drawing">
      <g fill="#b8958b" stroke="#e1c4b7" strokeWidth="2" strokeLinejoin="round">
        {kind === 'lungs' ? <>
          <path d="M104 51C85 29 66 52 53 84C38 120 35 172 50 191C65 201 91 187 103 166Z" />
          <path d="M136 51C155 33 177 58 188 86C202 122 205 175 190 191C174 199 149 180 137 164L148 127L137 101Z" />
          <path d="M113 25H127V76L151 103L144 110L120 87L96 110L89 103L113 76Z" fill="#ccbca6" />
          <path d="M48 152L100 117M143 129L198 154M48 107L103 105" fill="none" stroke="#866a65" />
        </> : kind === 'heart' ? <>
          <path d="M125 73C160 55 186 90 178 136C173 162 146 195 132 207C98 195 56 161 61 118C62 83 83 62 111 77Z" fill="#ab6560" />
          <path d="M114 89V54C114 24 169 21 174 57L174 91M84 86L79 47M111 102L86 66L60 65" fill="none" stroke="#c09d8d" strokeWidth="17" />
          <path d="M120 83L117 126L134 180M118 126L155 140M117 143L85 158" fill="none" stroke="#dcbaaa" strokeWidth="3" />
        </> : <>
          <path d="M113 39C83 25 42 56 39 100C30 138 54 167 85 174L112 156Z" />
          <path d="M127 39C157 25 198 56 201 100C210 138 186 167 155 174L128 156Z" />
          <path d="M76 174Q80 201 112 190L115 220H128L131 190Q162 201 168 173" fill="#bba38d" />
          <path d="M99 54Q59 50 69 79T55 113Q89 98 89 128T62 142M95 73Q108 95 96 104M87 146Q108 133 102 151M141 54Q181 50 171 79T185 113Q151 98 151 128T178 142M145 73Q132 95 144 104M153 146Q132 133 138 151M82 177L107 182M135 182L162 177" fill="none" stroke="#806b60" strokeWidth="4" />
        </>}
      </g>
    </svg>
  );
}

export default function AnatomyViewer({ kind, className }: { kind: 'lungs' | 'heart' | 'brain'; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const orientationRef = useRef<SVGSVGElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let renderer: Three.WebGLRenderer | undefined;
    let scene: Three.Scene | undefined;
    let raf = 0;
    let running = false;
    let visible = false;
    let contextLost = false;
    let dragging = false;
    let pointerId: number | null = null;
    let previousX = 0, previousY = 0, lastTime = 0, seconds = 0;
    const geometries = new Set<Three.BufferGeometry>();
    const materials = new Set<Three.Material>();
    const textures = new Set<Three.Texture>();
    const releases: (() => void)[] = [];
    const stop = () => { cancelAnimationFrame(raf); raf = 0; lastTime = 0; };
    const teardown = () => {
      stop();
      controlsRef.current = null;
      releases.splice(0).reverse().forEach((release) => release());
      scene?.traverse((object) => {
        const light = object as Three.DirectionalLight;
        light.shadow?.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      geometries.clear(); materials.clear(); textures.clear();
      scene?.clear();
      renderer?.renderLists.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
      renderer = undefined;
    };

    const initialize = async () => {
      try {
        const T = await import('three');
        if (disposed) return;
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        running = !motion.matches;
        setPaused(!running);
        setStatus('loading');
        renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        const canvas = renderer.domElement;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;touch-action:pan-y;';
        host.appendChild(canvas);
        scene = new T.Scene();
        scene.background = new T.Color('#0c1c2a');
        scene.fog = new T.Fog('#0c1c2a', 15, 30);
        const camera = new T.PerspectiveCamera(36, 1, 0.1, 60);
        const root = new T.Group();
        scene.add(root);
        const animateTissue = buildAnatomy(T, kind, root, geometries, materials, textures);
        const baseYaw = kind === 'brain' ? -0.48 : -0.22;
        const basePitch = kind === 'brain' ? 0.23 : 0.08;
        root.rotation.y = baseYaw;
        root.rotation.x = basePitch;
        const bounds = new T.Box3().setFromObject(root);
        const center = bounds.getCenter(new T.Vector3());
        const radius = bounds.getBoundingSphere(new T.Sphere()).radius;
        const floorY = bounds.min.y - 0.28;
        const floorGeometry = new T.PlaneGeometry(200, 200);
        const floorMaterial = new T.MeshStandardMaterial({ color: '#0c1c2a', roughness: 1 });
        geometries.add(floorGeometry); materials.add(floorMaterial);
        const floor = new T.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = floorY;
        floor.receiveShadow = true;
        scene.add(floor);
        scene.add(new T.HemisphereLight('#f3e6d8', '#526779', 2.1));
        const key = new T.DirectionalLight('#fff0df', 3.2);
        key.position.set(-3.5, 6, 5);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = key.shadow.camera.bottom = -4;
        key.shadow.camera.right = key.shadow.camera.top = 4;
        key.shadow.normalBias = 0.035;
        key.shadow.bias = -0.0003;
        key.shadow.radius = 4;
        scene.add(key);
        const fill = new T.DirectionalLight('#b4cbdc', 1.1);
        fill.position.set(4, 1.5, 3);
        scene.add(fill);
        const rim = new T.DirectionalLight('#e8d4bc', 1.6);
        rim.position.set(1, 3, -4);
        scene.add(rim);

        const axisVectors = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)];
        const orientationAxes = orientationRef.current?.querySelectorAll<SVGGElement>('[data-axis]');
        const updateOrientation = () => {
          root.updateMatrixWorld();
          axisVectors.forEach((axis, index) => {
            const projected = axis.clone().applyQuaternion(root.quaternion).applyQuaternion(camera.quaternion.clone().invert());
            const x = 34 + projected.x * 21, y = 31 - projected.y * 21;
            const group = orientationAxes?.[index];
            const line = group?.querySelector('line');
            const label = group?.querySelector('text');
            line?.setAttribute('x2', String(x)); line?.setAttribute('y2', String(y));
            label?.setAttribute('x', String(x + 4)); label?.setAttribute('y', String(y - 3));
            group?.setAttribute('opacity', projected.z < -0.2 ? '0.5' : '1');
          });
        };
        const canRender = () => !disposed && !contextLost && visible && !document.hidden;
        const render = () => {
          if (!canRender() || !renderer || !scene) return;
          try {
            updateOrientation();
            renderer.render(scene, camera);
          } catch {
            contextLost = true;
            running = false;
            stop();
            setPaused(true);
            setStatus('unavailable');
          }
        };
        const frame = (now: number) => {
          raf = 0;
          if (!canRender() || !running) { lastTime = 0; return; }
          const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
          lastTime = now;
          seconds += delta;
          if (!dragging) root.rotation.y += delta * 0.075;
          animateTissue(seconds);
          render();
          if (canRender() && running) raf = requestAnimationFrame(frame);
        };
        const synchronize = () => {
          stop();
          render();
          if (canRender() && running) raf = requestAnimationFrame(frame);
        };
        const resize = () => {
          if (!renderer || disposed) return;
          const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          const halfAngle = Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect));
          const distance = radius / Math.sin(halfAngle) * 1.02;
          camera.position.set(center.x, center.y + distance * 0.07, center.z + distance);
          camera.lookAt(center);
          camera.updateProjectionMatrix();
          render();
        };
        const listen = (target: EventTarget, event: string, handler: EventListener) => {
          target.addEventListener(event, handler);
          releases.push(() => target.removeEventListener(event, handler));
        };
        const endDrag = () => {
          dragging = false;
          canvas.style.cursor = 'grab';
          if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
          pointerId = null;
        };
        listen(canvas, 'pointerdown', ((event: PointerEvent) => {
          if (!event.isPrimary || event.button !== 0 || contextLost) return;
          pointerId = event.pointerId;
          dragging = true;
          previousX = event.clientX; previousY = event.clientY;
          canvas.setPointerCapture(event.pointerId);
          canvas.style.cursor = 'grabbing';
        }) as EventListener);
        listen(canvas, 'pointermove', ((event: PointerEvent) => {
          if (!dragging || pointerId !== event.pointerId) return;
          root.rotation.y += (event.clientX - previousX) * 0.008;
          root.rotation.x = T.MathUtils.clamp(root.rotation.x + (event.clientY - previousY) * 0.006, -0.6, 0.6);
          previousX = event.clientX; previousY = event.clientY;
          render();
        }) as EventListener);
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, event, endDrag);
        listen(window, 'blur', endDrag);
        listen(document, 'visibilitychange', () => { endDrag(); synchronize(); });
        listen(motion, 'change', () => {
          if (motion.matches) { running = false; setPaused(true); synchronize(); }
        });
        listen(canvas, 'webglcontextlost', (event) => {
          event.preventDefault();
          contextLost = true;
          running = false;
          stop();
          setPaused(true); setStatus('unavailable');
        });
        listen(canvas, 'webglcontextrestored', () => {
          contextLost = false;
          resize(); setStatus('ready'); synchronize();
        });
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        releases.push(() => resizeObserver.disconnect());
        const visibilityObserver = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (!visible) endDrag();
          synchronize();
        }, { threshold: 0.01 });
        visibilityObserver.observe(host);
        releases.push(() => visibilityObserver.disconnect());
        controlsRef.current = {
          rotate: (direction) => { root.rotation.y += direction * Math.PI / 12; render(); },
          toggle: () => { running = !running; setPaused(!running); synchronize(); },
          reset: () => {
            root.rotation.x = basePitch; root.rotation.y = baseYaw;
            seconds = 0; animateTissue(0); render();
          },
        };
        resize();
        setStatus('ready');
      } catch {
        teardown();
        if (!disposed) { setPaused(true); setStatus('unavailable'); }
      }
    };
    void initialize();
    return () => { disposed = true; teardown(); };
  }, [kind]);

  const ready = status === 'ready';
  return (
    <section className={`anatomy-viewer ${className ?? ''}`} aria-label={`Interactive illustrative ${kind} anatomy`}>
      <style>{`
        .anatomy-viewer { position: relative; isolation: isolate; display: grid; grid-template-rows: 48px minmax(0, 1fr) auto; width: 100%; height: 100%; min-height: 0; overflow: hidden; background: #0c1c2a; color: #eaf2f6; font-family: Inter, system-ui, sans-serif; }
        .anatomy-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 18px; border-bottom: 1px solid #263846; z-index: 1; }
        .anatomy-heading strong { font-size: 12px; font-weight: 500; letter-spacing: .02em; }
        .anatomy-heading span { font-size: 10px; color: #a1b6c4; letter-spacing: .1em; }
        .anatomy-viewport { position: relative; min-height: 0; overflow: hidden; }
        .anatomy-canvas { position: absolute; inset: 0; }
        .anatomy-orientation { position: absolute; top: 8px; right: 8px; width: 72px; height: 65px; pointer-events: none; }
        .anatomy-orientation text { font: 10px system-ui, sans-serif; fill: #bacdd5; }
        .anatomy-orientation line { stroke: #78aaa9; stroke-width: 1.4; }
        .anatomy-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 16px; background: #0c1c2a; text-align: center; }
        .anatomy-fallback-drawing { width: min(55%, 230px); min-height: 0; flex: 0 1 220px; opacity: .85; }
        .anatomy-fallback p { font-size: 13px; margin: 0; color: #d3dfe5; }
        .anatomy-fallback small { color: #a7b9c5; font-size: 11px; max-width: 34ch; }
        .anatomy-footer { position: relative; z-index: 2; padding: 10px 12px 12px; background: #0c1c2a; border-top: 1px solid #263846; }
        .anatomy-caption { margin: 0 0 8px; text-align: center; font-size: 11px; line-height: 1.5; color: #b6c7d0; }
        .anatomy-controls { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
        .anatomy-controls button { display: inline-flex; justify-content: center; align-items: center; gap: 5px; min-height: 44px; padding: 8px 10px; border-radius: 7px; border: 1px solid #36505f; color: #d9e7ec; background: #132b39; font: 500 11px Inter, system-ui, sans-serif; cursor: pointer; }
        .anatomy-controls button:hover:not(:disabled) { background: #214550; border-color: #79aba8; }
        .anatomy-controls button:focus-visible { outline: 2px solid #ff8d7d; outline-offset: 2px; }
        .anatomy-controls button:disabled { opacity: .45; cursor: not-allowed; }
        @media(max-width: 400px) { .anatomy-heading { padding: 0 12px; } .anatomy-heading span { display: none; } .anatomy-controls button { padding: 7px; font-size: 10px; } }
      `}</style>
      <div className="anatomy-heading">
        <strong>{TITLES[kind]}</strong><span>DRAG TO ROTATE</span>
      </div>
      <div className="anatomy-viewport">
        <div ref={hostRef} className="anatomy-canvas" />
        <svg ref={orientationRef} viewBox="0 0 72 65" className="anatomy-orientation" role="img" aria-label="Anatomical orientation: S superior, L left, A anterior. Axes follow model rotation.">
          {['L', 'S', 'A'].map((axis) => <g key={axis} data-axis={axis}><line x1="34" y1="31" x2="34" y2="31" /><text x="34" y="31">{axis}</text></g>)}
          <circle cx="34" cy="31" r="2" fill="#d6e0e5" />
        </svg>
        {!ready && <div className="anatomy-fallback" role="status" aria-live="polite">
          <FallbackAnatomy kind={kind} />
          <p>{status === 'loading' ? 'Preparing 3D anatomy…' : '3D view unavailable on this device'}</p>
          {status === 'unavailable' && <small>Static illustration shown. Upload and analysis remain available.</small>}
        </div>}
      </div>
      <div className="anatomy-footer">
        <p className="anatomy-caption" title="Procedural educational illustration; not anatomically validated.">Illustrative anatomy · not patient data</p>
        <div className="anatomy-controls" role="group" aria-label="Anatomy viewer controls">
          <button type="button" disabled={!ready} onClick={() => controlsRef.current?.rotate(-1)} aria-label="Rotate left"><ArrowLeft size={13} aria-hidden="true" />Rotate left</button>
          <button type="button" disabled={!ready} onClick={() => controlsRef.current?.rotate(1)} aria-label="Rotate right"><ArrowRight size={13} aria-hidden="true" />Rotate right</button>
          <button type="button" disabled={!ready} onClick={() => controlsRef.current?.toggle()} aria-label={paused ? 'Resume animation' : 'Pause animation'}>{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}{paused ? 'Resume' : 'Pause'}</button>
          <button type="button" disabled={!ready} onClick={() => controlsRef.current?.reset()} aria-label="Reset anatomy view"><RotateCcw size={13} aria-hidden="true" />Reset</button>
        </div>
      </div>
    </section>
  );
}
