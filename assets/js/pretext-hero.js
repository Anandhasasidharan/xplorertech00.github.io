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
  window.addEventListener('resize', () => { resize(); });

  // ── Editorial content ───────────────────────────────
  const HEADLINE = 'SHADOW PROTOCOL';

  const BODY = [
    "Cybersecurity is not a product — it is a process, a continuous negotiation between threat and trust, exploit and patch, chaos and control. In the age of AI and quantum computing, the attack surface expands faster than our defenses.",
    "We build interpretable Small Language Models for blue-team operations because black-box models cannot be trusted with security-critical decisions. Every alert, every log, every anomaly must be traceable — from model output to raw packet capture.",
    "Robotics teaches us that embodied intelligence demands real-time constraints. The same principles apply to autonomous agents operating in adversarial environments. Offense informs defense. Red team exercises reveal gaps that compliance checklists miss.",
    "The future belongs to those who can reason about security at the speed of machine learning — with precision and transparency. This is SHADOW PROTOCOL: where AI meets hacking meets hardware. One byte at a time, we map the boundary between what can be broken and what must be protected."
  ].join(' ');

  const PULL_QUOTE = '"Trust no input. Verify all output."';

  const FONT_BODY = '15px "Iowan Old Style", "Palatino Linotype", "Georgia", serif';
  const FONT_PULL = 'italic 18px "Iowan Old Style", "Georgia", serif';
  const LINE_H = 24;

  // ── Orbs ────────────────────────────────────────────
  const orbs = [
    { x: 0, y: 0, r: 60, vx: 0.2, vy: 0.15, pinned: false },
    { x: 0, y: 0, r: 40, vx: -0.18, vy: 0.22, pinned: false },
    { x: 0, y: 0, r: 30, vx: 0.25, vy: -0.12, pinned: false },
  ];

  let prepared = null;
  let preparedPQ = null;
  let paused = false;

  function initText() {
    prepared = prepareWithSegments(BODY, FONT_BODY);
    preparedPQ = prepareWithSegments(PULL_QUOTE, FONT_PULL);
  }

  // ── Draw editorial layout ───────────────────────────
  function drawHeadline(yStart) {
    ctx.save();
    ctx.font = 'bold 52px "Iowan Old Style", "Georgia", serif';
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(HEADLINE);
    const x = (W - m.width) / 2;
    ctx.fillText(HEADLINE, x, yStart + 52);
    ctx.restore();
    return yStart + 70;
  }

  function drawDropCap(x, y, size) {
    ctx.save();
    ctx.font = `bold ${size}px "Iowan Old Style", "Georgia", serif`;
    ctx.fillStyle = '#c4a35a';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('C', x, y);
    ctx.restore();
  }

  function lineObstructed(y, orb) {
    return Math.abs(y - orb.y) < orb.r * 1.1;
  }

  function getLineWidth(y, xStart, maxW) {
    let minX = xStart;
    let maxX = xStart + maxW;

    for (const orb of orbs) {
      if (!lineObstructed(y, orb)) continue;
      const dy = y - orb.y;
      const half = Math.sqrt(Math.max(0, (orb.r * 1.1) ** 2 - dy * dy));
      const obsLeft = orb.x - half;
      const obsRight = orb.x + half;

      if (obsLeft > minX && obsLeft < maxX) maxX = Math.min(maxX, obsLeft - 8);
      if (obsRight < maxX && obsRight > minX) minX = Math.max(minX, obsRight + 8);
    }
    return { x: minX, w: Math.max(30, maxX - minX) };
  }

  function drawBody(firstLineY) {
    if (!prepared) return;

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = firstLineY;
    const COL_X = 60;
    const COL_W = W - 120;
    let isFirstPara = true;
    let dropCapPlaced = false;
    let pullQuotePlaced = false;

    ctx.textBaseline = 'alphabetic';
    let lineIdx = 0;

    while (y < H - 40) {
      const { x, w } = getLineWidth(y, COL_X, COL_W);
      if (w < 40) { y += LINE_H; continue; }

      const range = layoutNextLineRange(prepared, cursor, w);
      if (!range) break;

      const line = materializeLineRange(prepared, range);
      const text = line.text;

      if (isFirstPara && !dropCapPlaced && lineIdx === 0) {
        dropCapPlaced = true;
        ctx.save();
        ctx.font = FONT_BODY;
        ctx.fillStyle = '#e8e4dc';
        ctx.fillText(text.slice(1), x + 36, y);
        ctx.restore();
        drawDropCap(x, y, 52);
      } else {
        ctx.save();
        ctx.font = FONT_BODY;
        ctx.fillStyle = '#e8e4dc';
        ctx.fillText(text, x, y);
        ctx.restore();
      }

      cursor = range.end;
      y += LINE_H;
      lineIdx++;

      // Insert pull quote
      if (!pullQuotePlaced && lineIdx > 6 && y < H * 0.6) {
        if (preparedPQ) {
          const pqW = COL_W * 0.6;
          const pqX = W - COL_X - pqW;
          const pqRange = layoutNextLineRange(preparedPQ, { segmentIndex: 0, graphemeIndex: 0 }, pqW);
          if (pqRange) {
            const pq = materializeLineRange(preparedPQ, pqRange);
            ctx.save();
            ctx.fillStyle = '#c4a35a';
            ctx.font = FONT_PULL;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(pq.text, pqX, y);
            ctx.restore();

            ctx.save();
            ctx.strokeStyle = '#6b5a3d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pqX - 12, y - 30);
            ctx.lineTo(pqX - 12, y + 6);
            ctx.stroke();
            ctx.restore();

            y += LINE_H + 8;
            pullQuotePlaced = true;
          }
        }
      }
    }
  }

  function drawOrbs(t) {
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      ctx.save();

      const gradient = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      gradient.addColorStop(0, 'rgba(196, 163, 90, 0.08)');
      gradient.addColorStop(0.5, 'rgba(196, 163, 90, 0.04)');
      gradient.addColorStop(1, 'rgba(196, 163, 90, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(196, 163, 90, ${0.15 + Math.sin(t + i) * 0.05})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ── Background ───────────────────────────────────────
  function drawBackground() {
    const gradient = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, H * 0.8);
    gradient.addColorStop(0, '#0f0f14');
    gradient.addColorStop(1, '#0a0a0c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Animation ────────────────────────────────────────
  let time = 0;

  function redraw() {
    time = performance.now() * 0.001;

    for (const o of orbs) {
      if (o.pinned) continue;
      o.x += o.vx;
      o.y += o.vy;
      if (o.x - o.r < 40 || o.x + o.r > W - 40) o.vx *= -1;
      if (o.y - o.r < 80 || o.y + o.r > H - 40) o.vy *= -1;
    }

    drawBackground();

    // Subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(196, 163, 90, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    const headlineY = 40;
    drawHeadline(headlineY);

    drawBody(headlineY + 40);
    drawOrbs(time);

    if (!paused) requestAnimationFrame(redraw);
  }

  // ── Interaction ──────────────────────────────────────
  let dragging = null;
  let dragOffX = 0, dragOffY = 0;

  function getPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const ex = e.touches ? e.touches[0].clientX : e.clientX;
    const ey = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: ex - rect.left, y: ey - rect.top };
  }

  function hitTest(px, py) {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (Math.hypot(px - o.x, py - o.y) < o.r + 15) return i;
    }
    return -1;
  }

  function togglePause() {
    paused = !paused;
    if (!paused) redraw();
  }

  canvas.addEventListener('mousedown', (e) => {
    const p = getPointer(e);
    const idx = hitTest(p.x, p.y);
    if (idx >= 0) {
      dragging = idx;
      dragOffX = p.x - orbs[idx].x;
      dragOffY = p.y - orbs[idx].y;
      orbs[idx].pinned = true;
    } else {
      togglePause();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (dragging === null) return;
    const p = getPointer(e);
    orbs[dragging].x = p.x - dragOffX;
    orbs[dragging].y = p.y - dragOffY;
  });

  canvas.addEventListener('mouseup', () => {
    if (dragging !== null) orbs[dragging].pinned = false;
    dragging = null;
  });
  canvas.addEventListener('mouseleave', () => {
    if (dragging !== null) orbs[dragging].pinned = false;
    dragging = null;
  });

  canvas.addEventListener('touchstart', (e) => {
    const p = getPointer(e);
    const idx = hitTest(p.x, p.y);
    if (idx >= 0) {
      dragging = idx;
      dragOffX = p.x - orbs[idx].x;
      dragOffY = p.y - orbs[idx].y;
      orbs[idx].pinned = true;
    }
  });
  canvas.addEventListener('touchmove', (e) => {
    if (dragging === null) return;
    const p = getPointer(e);
    orbs[dragging].x = p.x - dragOffX;
    orbs[dragging].y = p.y - dragOffY;
  });
  canvas.addEventListener('touchend', () => {
    if (dragging !== null) orbs[dragging].pinned = false;
    dragging = null;
  });

  // ── Start ────────────────────────────────────────────
  initText();
  resize();
  orbs[0].x = W * 0.3;
  orbs[0].y = H * 0.45;
  orbs[1].x = W * 0.7;
  orbs[1].y = H * 0.55;
  orbs[2].x = W * 0.5;
  orbs[2].y = H * 0.7;
  redraw();
})();
