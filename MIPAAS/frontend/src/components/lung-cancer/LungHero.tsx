'use client';

import { useEffect, useRef } from 'react';

export default function LungHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Particle effect — floating medical particles */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const particles: {
      x: number;
      y: number;
      r: number;
      dx: number;
      dy: number;
      opacity: number;
      color: string;
    }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    const colors = ['#00DCCE', '#008280', '#98AED9', '#FF7869'];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();

        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.offsetWidth) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.offsetHeight) p.dy *= -1;
      });
      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section className="relative bg-[#0A1823] overflow-hidden">
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Radial glow accents */}
      <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-[#008280] opacity-[0.07] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] right-[-150px] w-[500px] h-[500px] rounded-full bg-[#FF7869] opacity-[0.05] blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left copy */}
          <div className="flex flex-col space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 w-fit rounded-full border border-[#008280]/40 bg-[#008280]/10 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00DCCE] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00DCCE]" />
              </span>
              <span className="text-xs font-medium text-[#00DCCE] tracking-wide uppercase">
                Sybil Ensemble · NLST Validated
              </span>
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-[56px] xl:text-[64px] leading-[1.08] tracking-tight"
              style={{ fontFamily: "'Josefin Sans', sans-serif", fontWeight: 700 }}
            >
              <span className="text-white">Lung Cancer</span>
              <br />
              <span className="bg-gradient-to-r from-[#00DCCE] via-[#98AED9] to-[#00DCCE] bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]">
                Screening AI
              </span>
            </h1>

            <p className="text-base lg:text-lg text-gray-400 leading-relaxed max-w-lg">
              Predict lung cancer risk over <strong className="text-white">1-6 years</strong> from
              low-dose CT scans using MIT&apos;s Sybil ensemble and 3D ResNet architectures — with
              full <strong className="text-[#00DCCE]">Grad-CAM++</strong> explainability.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#upload"
                className="group relative bg-gradient-to-r from-[#FF7869] to-[#ff5c4a] text-white rounded-full px-8 py-4 text-sm font-semibold tracking-wide transition-all duration-300 cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-[#FF7869]/20 hover:shadow-[#FF7869]/40 hover:scale-[1.02]"
              >
                <span>Upload CT Scan</span>
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
              <a
                href="#pipeline"
                className="rounded-full border border-white/15 bg-white/5 px-7 py-4 text-sm font-medium text-white hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm"
              >
                How It Works
              </a>
            </div>

            {/* Quick stats row */}
            <div className="flex items-center gap-8 pt-4">
              {[
                { value: '98.2%', label: 'AUC Score' },
                { value: '1-6yr', label: 'Risk Window' },
                { value: '<3s', label: 'Analysis Time' },
              ].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span
                    className="text-2xl lg:text-3xl font-bold text-white"
                    style={{ fontFamily: "'Josefin Sans', sans-serif" }}
                  >
                    {s.value}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — animated CT scan showcase */}
          <div className="relative flex items-center justify-center">
            {/* Orbiting ring */}
            <div className="absolute w-[420px] h-[420px] lg:w-[500px] lg:h-[500px] rounded-full border border-[#008280]/20 animate-[spin_25s_linear_infinite]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#00DCCE] shadow-[0_0_12px_#00DCCE]" />
            </div>
            <div className="absolute w-[340px] h-[340px] lg:w-[400px] lg:h-[400px] rounded-full border border-[#98AED9]/10 animate-[spin_18s_linear_infinite_reverse]">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-[#FF7869] shadow-[0_0_10px_#FF7869]" />
            </div>

            {/* Central CT preview card */}
            <div className="relative w-[320px] h-[320px] lg:w-[380px] lg:h-[380px] rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0E273A] to-[#0A1823] shadow-2xl">
              {/* Simulated CT scan with CSS */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-[220px] h-[220px] lg:w-[260px] lg:h-[260px]">
                  {/* Ribcage-like ellipses */}
                  <div className="absolute inset-0 rounded-full border-2 border-[#1a3a52] opacity-60" />
                  <div className="absolute inset-[15%] rounded-[45%] border border-[#1e4060] opacity-50" />
                  <div className="absolute inset-[30%] rounded-[40%] border border-[#234a6e] opacity-40" />
                  {/* Central "spine" */}
                  <div className="absolute left-1/2 top-[15%] -translate-x-1/2 w-[3px] h-[70%] bg-gradient-to-b from-[#1a3a52] via-[#234a6e] to-[#1a3a52] opacity-50 rounded-full" />
                  {/* Lung shapes */}
                  <div className="absolute top-[20%] left-[12%] w-[30%] h-[50%] rounded-[50%_50%_50%_40%] bg-gradient-to-br from-[#0f2d42] to-[#0A1823] border border-[#1e4060]/60" />
                  <div className="absolute top-[20%] right-[12%] w-[30%] h-[50%] rounded-[50%_50%_40%_50%] bg-gradient-to-bl from-[#0f2d42] to-[#0A1823] border border-[#1e4060]/60" />
                  {/* Nodule highlight */}
                  <div className="absolute top-[38%] right-[28%] w-4 h-4 rounded-full bg-[#FF7869]/30 border border-[#FF7869]/60 animate-pulse shadow-[0_0_15px_rgba(255,120,105,0.4)]" />
                  {/* Scanning line */}
                  <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00DCCE] to-transparent opacity-60 animate-[scanLine_3s_ease-in-out_infinite]" />
                </div>
              </div>

              {/* Corner accents */}
              <div className="absolute top-4 left-4 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00DCCE] animate-pulse" />
                <span className="text-[10px] text-[#00DCCE] font-mono">LDCT SCAN</span>
              </div>
              <div className="absolute bottom-4 right-4 text-[10px] text-gray-500 font-mono">
                512×512 · 1.0mm
              </div>
            </div>

            {/* Floating glass badges */}
            <div className="absolute -top-2 -right-2 lg:top-2 lg:-right-6 backdrop-blur-md bg-white/[0.07] border border-white/10 rounded-xl px-4 py-3 shadow-xl animate-[float_6s_ease-in-out_infinite]">
              <div className="text-sm font-bold text-white">Nodule Detected</div>
              <div className="text-[11px] text-[#FF7869]">Right upper lobe · 8mm</div>
            </div>
            <div className="absolute -bottom-4 -left-4 lg:bottom-0 lg:-left-8 backdrop-blur-md bg-white/[0.07] border border-white/10 rounded-xl px-4 py-3 shadow-xl animate-[float_5s_ease-in-out_infinite_0.5s]">
              <div className="text-sm font-bold text-white">6yr Risk</div>
              <div className="text-[11px] text-[#00DCCE]">12.4% — Moderate</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
