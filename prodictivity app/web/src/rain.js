// neon rain over the sprawl — cheap canvas, respects reduced motion
let on = true;
export const isRain = () => on;
export function setRain(v) { on = v; document.body.classList.toggle('no-rain', !v); }

export function startRain() {
  const cv = document.getElementById('rain');
  const ctx = cv.getContext('2d');
  const GLYPHS = 'アイチバ01:;<>*+-=ﾁﾊﾋﾌ0123456789$#';
  let drops = [];
  const size = () => {
    cv.width = innerWidth; cv.height = innerHeight;
    const n = Math.floor(innerWidth / 22);
    drops = Array.from({ length: n }, () => ({ y: Math.random() * innerHeight, s: 12 + Math.random() * 22 }));
  };
  size(); addEventListener('resize', size);
  ctx.font = '13px monospace';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { on = false; document.body.classList.add('no-rain'); return; }
  (function tick() {
    requestAnimationFrame(tick);
    if (!on) { ctx.clearRect(0, 0, cv.width, cv.height); return; }
    ctx.fillStyle = 'rgba(4,6,10,0.14)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    drops.forEach((d, i) => {
      const g = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      ctx.fillStyle = Math.random() < 0.06 ? '#ff2a6d' : 'rgba(57,255,106,0.55)';
      ctx.fillText(g, i * 22, d.y);
      d.y += d.s / 6;
      if (d.y > cv.height) { d.y = -20; d.s = 12 + Math.random() * 22; }
    });
  })();
}
