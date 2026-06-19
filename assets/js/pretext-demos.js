(async () => {
  'use strict';

  const module = await import('https://esm.sh/@chenglou/pretext@0.0.6');
  const { prepareWithSegments, layoutNextLineRange, materializeLineRange, layout } = module;

  function resizeCanvas(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Demo 1: Kinetic Wave ───────────────────────────── */
  const waveCanvas = document.getElementById('demo-wave');
  if (waveCanvas) {
    (() => {
      const canvas = waveCanvas;
      resizeCanvas(canvas, 430, 280);
      const ctx = canvas.getContext('2d');
      const W = 430, H = 280;

      const LINES = [
        "protocol_activate();",
        "target_acquisition();",
        "exploit_chain.prepare();",
        "payload.deliver();",
        "persistence.establish();",
        "exfil_data.stream();",
        "cleanup.sweep();",
        "mission.complete();",
      ];

      const prepared = prepareWithSegments(LINES.join('\n'), '14px "JetBrains Mono", monospace');

      let t = 0;
      function draw() {
        t += 0.02;
        ctx.fillStyle = '#111119';
        ctx.fillRect(0, 0, W, H);

        ctx.font = '14px "JetBrains Mono", monospace';
        for (let i = 0; i < LINES.length; i++) {
          const phase = t + i * 0.8;
          const y = 40 + i * 30 + Math.sin(phase) * 10;
          const alpha = 0.5 + 0.5 * Math.sin(phase * 0.7);
          ctx.fillStyle = `rgba(0, 255, 65, ${0.4 + alpha * 0.5})`;
          ctx.fillText(LINES[i], 30 + Math.sin(phase * 0.4) * 8, y);
        }
        requestAnimationFrame(draw);
      }
      draw();
    })();
  }

  /* ── Demo 2: Shrink-Wrap Bubble ─────────────────────── */
  const shrinkCanvas = document.getElementById('demo-shrink');
  if (shrinkCanvas) {
    (() => {
      const canvas = shrinkCanvas;
      resizeCanvas(canvas, 430, 280);
      const ctx = canvas.getContext('2d');
      const W = 430, H = 280;

      const TEXT = "Blue-team defense with full transparency. Every alert traced, every output verified. Building interpretable SLMs for security-critical operations. Trust no input. Verify all output.";
      const FONT = '13px "JetBrains Mono", monospace';
      const LINE_H = 20;
      const prepared = prepareWithSegments(TEXT, FONT);

      let mouseX = W / 2, mouseY = H / 2;
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouseX = e.clientX - r.left;
        mouseY = e.clientY - r.top;
      });

      function draw() {
        ctx.fillStyle = '#111119';
        ctx.fillRect(0, 0, W, H);

        const cx = mouseX, cy = mouseY;

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#ffb800';
        ctx.font = FONT;
        ctx.textBaseline = 'alphabetic';

        let cursor = { segmentIndex: 0, graphemeIndex: 0 };
        let y = 20;

        while (y < H - 20) {
          const dy = y - cy;
          const inBand = Math.abs(dy) < 60;
          let x = 20, w = W - 40;

          if (inBand) {
            const half = Math.sqrt(Math.max(0, 3600 - dy * dy));
            const leftW = Math.max(0, cx - half - 20);
            const rightW = Math.max(0, W - 20 - (cx + half));
            if (leftW >= rightW) { x = 20; w = leftW - 8; }
            else { x = cx + half + 8; w = rightW - 8; }
            if (w < 30) { y += LINE_H; continue; }
          }

          const range = layoutNextLineRange(prepared, cursor, w);
          if (!range) break;
          ctx.fillText(materializeLineRange(prepared, range).text, x, y);
          cursor = range.end;
          y += LINE_H;
        }

        requestAnimationFrame(draw);
      }
      draw();
    })();
  }

  /* ── Demo 3: Orb Flow (mini) ────────────────────────── */
  const orbCanvas = document.getElementById('demo-orb');
  if (orbCanvas) {
    (() => {
      const canvas = orbCanvas;
      resizeCanvas(canvas, 430, 280);
      const ctx = canvas.getContext('2d');
      const W = 430, H = 280;

      const CORPUS = [
        "Security is not a product. It is a process — a continuous negotiation between threat and trust.",
        "In the age of AI and quantum computing, we build interpretable SLMs for blue-team operations.",
        "Every alert must be traceable from model output to raw packet capture. Robotics teaches us",
        "that embodied intelligence demands real-time constraints and autonomous decision-making."
      ].join(' ');

      const prepared = prepareWithSegments(CORPUS, '11px "JetBrains Mono", monospace');
      const orb = { x: 200, y: 140, r: 40, vx: 0.3, vy: 0.2 };
      let t = 0;

      function draw() {
        t += 0.016;
        orb.x += orb.vx; orb.y += orb.vy;
        if (orb.x - orb.r < 10 || orb.x + orb.r > W - 10) orb.vx *= -1;
        if (orb.y - orb.r < 10 || orb.y + orb.r > H - 10) orb.vy *= -1;

        ctx.fillStyle = '#111119';
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
        for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffb800';
        ctx.font = '11px "JetBrains Mono", monospace';
        let cursor = { segmentIndex: 0, graphemeIndex: 0 };
        let y = 14;
        while (y < H - 10) {
          const dy = y - orb.y;
          const inBand = Math.abs(dy) < orb.r + 4;
          let x = 8, w = W - 16;
          if (inBand) {
            const half = Math.sqrt(Math.max(0, (orb.r + 4) ** 2 - dy ** 2));
            const lw = Math.max(0, orb.x - half - 8);
            const rw = Math.max(0, W - 8 - orb.x - half);
            if (lw >= rw) { w = lw - 6; }
            else { x = orb.x + half + 6; w = rw - 6; }
            if (w < 30) { y += 16; continue; }
          }
          const range = layoutNextLineRange(prepared, cursor, w);
          if (!range) break;
          ctx.fillText(materializeLineRange(prepared, range).text, x, y);
          cursor = range.end;
          y += 16;
        }
        requestAnimationFrame(draw);
      }
      draw();
    })();
  }
})();
