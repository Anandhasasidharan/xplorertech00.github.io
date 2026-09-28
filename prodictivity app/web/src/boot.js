// boot ritual — the deck negotiates with the sprawl
export function boot(lines) {
  const veil = document.getElementById('boot');
  const box = document.getElementById('bootLines');
  box.innerHTML = '';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;
  const paint = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    box.appendChild(d);
  };
  (function next() {
    if (i >= lines.length) { setTimeout(() => veil.classList.add('hidden'), 300); return; }
    paint(lines[i++]);
    setTimeout(next, reduced ? 0 : 150);
  })();
  setTimeout(() => veil.classList.add('hidden'), 2600); // failsafe
}
