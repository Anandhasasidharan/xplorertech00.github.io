import { useEffect, useRef } from 'react';
import type { FlowLayout } from './flowLayout';
import { drawOverlay } from './flowLayout';

interface CanvasParticleFlowProps {
  layout: FlowLayout;
}

interface CpuParticle {
  fromX: number; fromY: number;
  toX: number; toY: number;
  r: number; g: number; b: number;
  speed: number; size: number;
  phase: number; seed: number;
}

export function CanvasParticleFlow({ layout }: CanvasParticleFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    let lastTime = performance.now();
    let cssW = layout.width;
    let cssH = layout.height;
    let dpr = 1;

    const hexToRgb = (hex: string): [number, number, number] => {
      const h = hex.replace('#', '');
      return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
      ];
    };

    const ease = (t: number): number => t * t * (3 - 2 * t);

    const particles: CpuParticle[] = [];
    for (const edge of layout.edges) {
      const [r, g, b] = hexToRgb(edge.color);
      for (let k = 0; k < Math.min(edge.count, 60); k++) {
        const seed = Math.random();
        particles.push({
          fromX: edge.from.x, fromY: edge.from.y,
          toX: edge.to.x, toY: edge.to.y,
          r, g, b,
          speed: edge.speed * (0.9 + Math.random() * 0.2),
          size: 5 + seed * 7,
          phase: Math.random(),
          seed,
        });
      }
    }

    const resize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      cssW = rect.width;
      cssH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const loop = () => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      ctx.clearRect(0, 0, cssW, cssH);
      ctx.globalCompositeOperation = 'lighter';

      for (const p of particles) {
        p.phase = (p.phase + p.speed * dt) % 1;
        const t = ease(p.phase);
        const dx = p.toX - p.fromX;
        const dy = p.toY - p.fromY;
        const len = Math.max(0.0001, Math.hypot(dx, dy));
        const nx = -dy / len;
        const ny = dx / len;
        const amp = 4 + p.seed * 12;
        const off = Math.sin(p.phase * Math.PI * 2 + p.seed * Math.PI * 2) * amp;
        const x = p.fromX + dx * t + nx * off;
        const y = p.fromY + dy * t + ny * off;

        const alpha = Math.sin(p.phase * Math.PI) * 0.9;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r * 255},${p.g * 255},${p.b * 255},${alpha * 0.12})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r * 255},${p.g * 255},${p.b * 255},${alpha})`;
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      drawOverlay(ctx, { ...layout, width: cssW, height: cssH });
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();
    lastTime = performance.now();
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [layout]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: layout.height }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-lg" />
    </div>
  );
}
