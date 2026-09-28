// in-tab alarm engine — same fired{} keys as reminders.ps1, so the two
// never double-fire each other.
import { state, save, isDone, activeOn } from './store.js';
import { todayISO, nowHM } from './dates.js';

let enabled = false;
let toastFn = () => {};
export const isOn = () => enabled;

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [[880, 0], [660, 0.3]].forEach(([f, dt]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; g.gain.value = 0.1;
      o.start(ctx.currentTime + dt); o.stop(ctx.currentTime + dt + 0.25);
    });
  } catch { /* silent streets */ }
}

export function fireKey(key, title, sub) {
  if (state.fired[key]) return false;
  state.fired[key] = true; save();
  toastFn(title, sub); beep();
  if (enabled && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body: sub }); } catch { /* ignore */ }
  }
  return true;
}

function nowLocal() {
  const n = new Date(), p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`;
}

export function check() {
  if (!enabled) return;
  const today = todayISO(), hm = nowHM(), now = nowLocal();
  state.tasks.forEach((t) => {
    if (!t.remindTime || !activeOn(t, today) || isDone(t, today)) return;
    if (t.remindTime <= hm) fireKey(t.id + '@' + today, `${t.title} — run is live`, `${t.type} · ${today}${t.remindTime ? ' @' + t.remindTime : ''}`);
  });
  state.todos.forEach((t) => {
    if (t.done || !t.remindAt || t.remindAt > now) return;
    fireKey('todo@' + t.id, `${t.title} — drop is hot`, `dead-drop · ${t.remindAt}`);
  });
}

export function init(fn) { toastFn = fn; }
export async function enable(btn) {
  if (!('Notification' in window)) { enabled = true; }
  else if (Notification.permission === 'granted') { enabled = true; }
  else if (Notification.permission !== 'denied') {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
    enabled = true;
  } else { enabled = true; toastFn('alarms: browser says no', 'in-tab static will still crackle'); }
  if (btn) btn.textContent = enabled ? '[ ALARM:ON ]' : '[ ALARM:OFF ]';
  check();
}
setInterval(check, 20000);
