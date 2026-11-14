import React, { useRef, useState } from 'react';
import { Icon } from './ui';

/** Radiograph viewer: zoom (wheel/buttons), pan (drag), brightness/contrast, invert, AI map toggle. */
export default function Viewer({ preview, heatmap }: { preview: string | null; heatmap: string | null }) {
  const [mode, setMode] = useState<'image' | 'map'>('image');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const src = mode === 'map' && heatmap ? heatmap : preview;
  const clampZoom = (z: number) => Math.min(8, Math.max(1, z));
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
    setInvert(false);
  };

  function onWheel(e: React.WheelEvent) {
    const next = clampZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  }

  function onKey(e: React.KeyboardEvent) {
    const step = 40;
    if (e.key === '+' || e.key === '=') setZoom((z) => clampZoom(z * 1.2));
    else if (e.key === '-') setZoom((z) => clampZoom(z / 1.2));
    else if (e.key === '0') reset();
    else if (e.key === 'ArrowLeft') setPan((p) => ({ ...p, x: p.x + step }));
    else if (e.key === 'ArrowRight') setPan((p) => ({ ...p, x: p.x - step }));
    else if (e.key === 'ArrowUp') setPan((p) => ({ ...p, y: p.y + step }));
    else if (e.key === 'ArrowDown') setPan((p) => ({ ...p, y: p.y - step }));
    else if (e.key.toLowerCase() === 'h' && heatmap) setMode((m) => (m === 'map' ? 'image' : 'map'));
    else return;
    e.preventDefault();
  }

  return (
    <div className="viewer">
      <div
        className="viewer-stage"
        tabIndex={0}
        role="img"
        aria-label={mode === 'map' ? 'AI attention map. Use plus and minus to zoom, arrows to pan, H to toggle.' : 'Chest radiograph. Use plus and minus to zoom, arrows to pan, H to toggle the AI map.'}
        onWheel={onWheel}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
        }}
        onPointerUp={() => (drag.current = null)}
        onDoubleClick={reset}
      >
        {src ? (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              filter: `brightness(${brightness}%) contrast(${contrast}%)${invert && mode === 'image' ? ' invert(1)' : ''}`,
            }}
          />
        ) : (
          <span className="muted">No image</span>
        )}
        {mode === 'map' && <span className="overlay-note">Grad-CAM: warmer = more influence on the top finding</span>}
      </div>
      <div className="viewer-tools">
        <div className="seg" role="group" aria-label="Image layer">
          <button aria-pressed={mode === 'image'} onClick={() => setMode('image')}>
            Radiograph
          </button>
          <button aria-pressed={mode === 'map'} onClick={() => setMode('map')} disabled={!heatmap} title="Toggle with H">
            AI map
          </button>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="btn btn-quiet icon-btn" onClick={() => setZoom((z) => clampZoom(z / 1.25))} aria-label="Zoom out">
            <Icon name="zoomOut" />
          </button>
          <span className="tnum muted" style={{ width: 44, textAlign: 'center', fontSize: 12 }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn btn-quiet icon-btn" onClick={() => setZoom((z) => clampZoom(z * 1.25))} aria-label="Zoom in">
            <Icon name="zoomIn" />
          </button>
        </div>
        <label className="slider">
          Brightness
          <input type="range" min={40} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
        </label>
        <label className="slider">
          Contrast
          <input type="range" min={40} max={250} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
        </label>
        <label className="slider" style={{ gap: 6 }}>
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} style={{ width: 'auto' }} disabled={mode === 'map'} />
          Invert
        </label>
        <button className="btn btn-quiet btn-sm" onClick={reset} title="Reset view (0 or double-click)">
          <Icon name="reset" /> Reset
        </button>
      </div>
    </div>
  );
}
