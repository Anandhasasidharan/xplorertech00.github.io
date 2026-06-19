(async () => {
  'use strict';

  const module = await import('https://esm.sh/@chenglou/pretext@0.0.6');
  const { prepareWithSegments, layoutNextLineRange, materializeLineRange } = module;

  const canvas = document.getElementById('pretext-hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', () => { resize(); redraw(); });

  const CORPUS = [
    "Cybersecurity is not a product. It is a process — a continuous negotiation between threat and trust,",
    "exploit and patch, chaos and control. In the age of AI and quantum computing, the attack surface",
    "expands faster than our defenses. We build interpretable SLMs for blue-team operations because",
    "black-box models cannot be trusted with security-critical decisions. Every alert, every log, every",
    "anomaly must be traceable — from model output to raw packet capture. Robotics teaches us that",
    "embodied intelligence demands real-time constraints. The same principles apply to autonomous agents",
    "operating in adversarial environments. Offense informs defense. Red team exercises reveal gaps",
    "that compliance checklists miss. But the future belongs to those who can reason about security",
    "at the speed of machine learning — not faster, not slower, but with precision and transparency.",
    "This is SHADOW PROTOCOL: where AI meets hacking meets hardware. One byte at a time, we map",
    "the boundary between what can be broken and what must be protected. The adversary is always learning.",
    "So are we. Welcome to the edge of the network. Mind the packet loss. Trust no input. Verify all output."
  ].join(' ');

  const FONT = '14px "JetBrains Mono", "Share Tech Mono", monospace';
  const LINE_H = 22;
  const COL_X = 16;
  const COL_W_RATIO = 0.92;

  const orb = { x: 0, y: 0, r: 72, vx: 0.35, vy: 0.2 };

  let prepared = null;

  function initText() {
    prepared = prepareWithSegments(CORPUS, FONT);
  }

  function drawWireframeOrb(cx, cy, r, t) {
    const rings = [];
    for (let ring = 0; ring < 3; ring++) {
      const offset = (ring * Math.PI) / 3 + t * 0.4;
      for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2;
        let x, y;
        if (ring === 0) {
          x = Math.cos(angle) * r;
          y = Math.sin(angle) * Math.cos(offset) * r;
        } else if (ring === 1) {
          x = Math.cos(angle) * Math.cos(offset + 0.8) * r;
          y = Math.sin(angle) * r;
        } else {
          const a = angle + t * 0.3;
          x = Math.cos(a) * Math.cos(offset + 1.6) * r;
          y = Math.sin(a) * Math.cos(offset + 1.6) * r;
        }
        rings.push({ x: cx + x, y: cy + y });
      }
    }

    ctx.save();
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      ctx.strokeStyle = pass === 0 ? 'rgba(0, 240, 255, 0.12)' : 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = pass === 0 ? 3 : 1.2;
      for (let ring = 0; ring < 3; ring++) {
        const start = ring * 48;
        for (let i = 0; i < 48; i++) {
          const p = rings[start + i];
          const next = rings[start + (i + 1) % 48];
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(next.x, next.y);
        }
      }
      ctx.stroke();
    }

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.15, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.15, cy + r * 0.15);
    ctx.moveTo(cx + r * 0.15, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.15, cy + r * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlow(ctx, t) {
    if (!prepared) return;
    const colW = W * COL_W_RATIO;

    ctx.textBaseline = 'alphabetic';

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = 24;
    let lineIdx = 0;

    while (y < H - 20) {
      const dy = y - orb.y;
      const inBand = Math.abs(dy) < orb.r * 1.05;

      let x = COL_X;
      let w = colW;

      if (inBand) {
        const half = Math.sqrt(Math.max(0, (orb.r * 1.05) ** 2 - dy ** 2));
        const leftW = Math.max(0, (orb.x - half) - COL_X);
        const rightW = Math.max(0, (COL_X + colW) - (orb.x + half));
        if (leftW >= rightW) { x = COL_X; w = leftW - 10; }
        else { x = orb.x + half + 10; w = rightW - 10; }
        if (w < 40) { y += LINE_H; continue; }
      }

      const range = layoutNextLineRange(prepared, cursor, w);
      if (!range) break;
      const line = materializeLineRange(prepared, range);

      const wave = Math.sin(t * 1.2 + lineIdx * 0.6) * 3;
      ctx.fillStyle = `hsl(40, 100%, ${55 + Math.sin(t + lineIdx * 0.4) * 10}%)`;
      ctx.font = FONT;
      ctx.fillText(line.text, x + wave, y);
      cursor = range.end;
      y += LINE_H;
      lineIdx++;
    }
  }

  function drawScanlines() {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(W/2, H/2, H*0.4, W/2, H/2, H*0.9);
    gradient.addColorStop(0, 'rgba(10, 10, 15, 0)');
    gradient.addColorStop(1, 'rgba(10, 10, 15, 0.85)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }

  let time = 0;

  function redraw() {
    time = performance.now() * 0.001;

    orb.x += orb.vx;
    orb.y += orb.vy;
    if (orb.x - orb.r < COL_X + 60) { orb.vx = Math.abs(orb.vx); }
    if (orb.x + orb.r > W - 20) { orb.vx = -Math.abs(orb.vx); }
    if (orb.y - orb.r < 30) { orb.vy = Math.abs(orb.vy); }
    if (orb.y + orb.r > H - 30) { orb.vy = -Math.abs(orb.vy); }

    ctx.fillStyle = '#111119';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y2 = 0; y2 < H; y2 += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y2);
      ctx.lineTo(W, y2);
      ctx.stroke();
    }

    drawWireframeOrb(orb.x, orb.y, orb.r, time);
    drawFlow(ctx, time);
    drawScanlines();
    drawVignette();

    requestAnimationFrame(redraw);
  }

  let mouseDown = false;
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (Math.hypot(mx - orb.x, my - orb.y) < orb.r + 20) mouseDown = true;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    const rect = canvas.getBoundingClientRect();
    orb.x = e.clientX - rect.left;
    orb.y = e.clientY - rect.top;
    orb.vx *= 0.5;
    orb.vy *= 0.5;
  });
  canvas.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('mouseleave', () => { mouseDown = false; });
  canvas.addEventListener('touchstart', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (Math.hypot(e.touches[0].clientX - rect.left - orb.x, e.touches[0].clientY - rect.top - orb.y) < orb.r + 30) mouseDown = true;
  });
  canvas.addEventListener('touchmove', (e) => {
    if (!mouseDown) return;
    const rect = canvas.getBoundingClientRect();
    orb.x = e.touches[0].clientX - rect.left;
    orb.y = e.touches[0].clientY - rect.top;
    orb.vx *= 0.5;
    orb.vy *= 0.5;
  });
  canvas.addEventListener('touchend', () => { mouseDown = false; });

  initText();
  orb.x = W * 0.5;
  orb.y = H * 0.5;
  resize();
  redraw();
})();
