import { useEffect, useRef, useState } from 'react';
import type { FlowLayout } from './flowLayout';
import { drawOverlay } from './flowLayout';
import { COMPUTE_SHADER, VERT_SHADER, FRAG_SHADER, PARTICLE_STRIDE_FLOATS } from './webgpuShaders';

interface WebGPUParticleFlowProps {
  layout: FlowLayout;
  onError?: () => void;
}

const MAX_PARTICLES = 800;

export function WebGPUParticleFlow({ layout, onError }: WebGPUParticleFlowProps) {
  const gpuCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const gpuCanvas = gpuCanvasRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!gpuCanvas || !overlay || !container) return;

    let device: GPUDevice | null = null;
    let context: GPUCanvasContext | null = null;
    let computePipeline: GPUComputePipeline | null = null;
    let renderPipeline: GPURenderPipeline | null = null;
    let particleBuffer: GPUBuffer | null = null;
    let uniformBuffer: GPUBuffer | null = null;
    let bindGroup: GPUBindGroup | null = null;
    let raf = 0;
    let disposed = false;
    let lastTime = performance.now();
    let currentCount = 0;
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

    const writeParticles = () => {
      if (!particleBuffer || !device) return;
      const count = layout.edges.reduce((s, e) => s + e.count, 0);
      const floats = new Float32Array(count * PARTICLE_STRIDE_FLOATS);
      let idx = 0;
      for (const edge of layout.edges) {
        const [r, g, b] = hexToRgb(edge.color);
        for (let k = 0; k < edge.count; k++) {
          const seed = Math.random();
          const phase = Math.random();
          const jitter = 0.9 + Math.random() * 0.2;
          floats[idx++] = edge.from.x; floats[idx++] = edge.from.y;
          floats[idx++] = edge.from.x; floats[idx++] = edge.from.y;
          floats[idx++] = edge.to.x; floats[idx++] = edge.to.y;
          floats[idx++] = r; floats[idx++] = g; floats[idx++] = b;
          floats[idx++] = edge.speed * jitter;
          floats[idx++] = 5 + seed * 7;
          floats[idx++] = phase;
          floats[idx++] = seed;
          idx += 3;
        }
      }
      currentCount = count;
      device.queue.writeBuffer(particleBuffer, 0, floats.buffer);
    };

    const resize = () => {
      if (!container || !gpuCanvas || !overlay) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      cssW = rect.width;
      cssH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      gpuCanvas.width = Math.round(cssW * dpr);
      gpuCanvas.height = Math.round(cssH * dpr);
      overlay.width = gpuCanvas.width;
      overlay.height = gpuCanvas.height;
      const ctx = overlay.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawOverlay(ctx, { ...layout, width: cssW, height: cssH });
      }
    };

    const loop = () => {
      if (disposed || !device || !context) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const uniforms = new Float32Array([cssW, cssH, dt, now / 1000]);
      device.queue.writeBuffer(uniformBuffer!, 0, uniforms.buffer);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(computePipeline!);
      pass.setBindGroup(0, bindGroup!);
      pass.dispatchWorkgroups(Math.ceil(Math.max(1, currentCount) / 64));
      pass.end();

      const view = context.getCurrentTexture().createView();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{ view, loadOp: 'clear', clearValue: { r: 0.07, g: 0.07, b: 0.086, a: 1 }, storeOp: 'store' }],
      });
      renderPass.setPipeline(renderPipeline!);
      renderPass.setBindGroup(0, bindGroup!);
      renderPass.draw(6, currentCount);
      renderPass.end();

      device.queue.submit([encoder.finish()]);
    };

    const init = async () => {
      try {
        if (!navigator.gpu) throw new Error('WebGPU not supported');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('No GPU adapter');
        device = await adapter.requestDevice();
        if (disposed) { device.destroy(); return; }

        context = gpuCanvas.getContext('webgpu') as unknown as GPUCanvasContext | null;
        if (!context) throw new Error('No WebGPU canvas context');
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'opaque' });

        computePipeline = device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code: COMPUTE_SHADER }), entryPoint: 'main' } });
        renderPipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: device.createShaderModule({ code: VERT_SHADER }), entryPoint: 'vs_main' },
          fragment: {
            module: device.createShaderModule({ code: FRAG_SHADER }), entryPoint: 'fs_main',
            targets: [{ format, blend: {
              color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            } }],
          },
          primitive: { topology: 'triangle-list' },
        });

        particleBuffer = device.createBuffer({
          size: MAX_PARTICLES * PARTICLE_STRIDE_FLOATS * 4,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        uniformBuffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        bindGroup = device.createBindGroup({
          layout: computePipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: particleBuffer } },
            { binding: 1, resource: { buffer: uniformBuffer } },
          ],
        });

        writeParticles();
        resize();
        setActive(true);
        lastTime = performance.now();
        loop();
      } catch (err) {
        console.warn('WebGPU init failed, falling back:', err);
        device?.destroy();
        onError?.();
      }
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    init();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      device?.destroy();
    };
  }, [layout, onError]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: layout.height }}>
      <canvas ref={gpuCanvasRef} className="absolute inset-0 w-full h-full rounded-lg" />
      <canvas ref={overlayRef} className="absolute inset-0 w-full h-full rounded-lg pointer-events-none" />
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center text-[#6b685e] text-sm bg-[#121216] rounded-lg">
          Initializing WebGPU...
        </div>
      )}
    </div>
  );
}
