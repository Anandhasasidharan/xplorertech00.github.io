// SPRAWL_OS store — same vault format as LIFE_OS v1 (backwards compatible).
// reminders.ps1 keeps working: tasks[].remindTime, todos[].remindAt, fired{} keys.
import { todayISO } from './dates.js';

export const LS_KEY = 'lifeos.v1';
export const GCAL_KEY = 'lifeos.gcalUrl';
export const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const COLOR_HEX = {
  green: '#39ff6a', amber: '#ffb000', cyan: '#05d9e8', red: '#ff2a6d',
  tomato: '#d50000', flamingo: '#e67c73', tangerine: '#f4511e', banana: '#f6bf26',
  sage: '#33b679', basil: '#0b8043', peacock: '#039be5', blueberry: '#3f51b5',
  lavender: '#7986cb', grape: '#8e24aa', graphite: '#616161',
};
export const colorOf = (t) => (COLOR_HEX[t.color] ? t.color : 'peacock');

export const state = { tasks: [], todos: [], fired: {}, updatedAt: 0 };

export function normalizeState(j) {
  if (!j || typeof j !== 'object') return { tasks: [], todos: [], fired: {}, updatedAt: 0 };
  return {
    tasks: Array.isArray(j.tasks) ? j.tasks : [],
    todos: Array.isArray(j.todos) ? j.todos : [],
    fired: (j.fired && typeof j.fired === 'object' && !Array.isArray(j.fired)) ? j.fired : {},
    updatedAt: j.updatedAt || 0,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) Object.assign(state, normalizeState(JSON.parse(raw)));
  } catch { Object.assign(state, { tasks: [], todos: [], fired: {}, updatedAt: 0 }); }
}

let pushT = null;
export function save() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  clearTimeout(pushT);
  pushT = setTimeout(() => {
    fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {});
  }, 300);
}

export async function pullServer() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (!r.ok) return false;
    const j = normalizeState(await r.json());
    if ((j.updatedAt || 0) > (state.updatedAt || 0) && (j.tasks.length > 0 || state.tasks.length === 0)) {
      Object.assign(state, j);
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
      return true;
    }
  } catch { /* file:// or server down — local vault only */ }
  return false;
}

// ---- gcal-style occurrence logic ----
export function activeOn(t, dISO) {
  if (t.type === 'once') return t.date === dISO;
  if (t.type === 'range') return !!(t.startDate && t.endDate && dISO >= t.startDate && dISO <= t.endDate);
  if (t.type === 'daily') {
    if (t.startDate && dISO < t.startDate) return false;
    if (t.endDate && dISO > t.endDate) return false;
    return true;
  }
  return false;
}
export const isDone = (t, dISO) => !!(t.completions && t.completions[dISO]);
export function toggleDone(id, dISO) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.completions = t.completions || {};
  if (t.completions[dISO]) delete t.completions[dISO];
  else t.completions[dISO] = true;
  save();
}
export const isTimed = (t) => t.type === 'once' && !!t.timeStart;
export function timedOn(dateISO) {
  // once-tasks with a start time, sorted — the day-grid population
  return state.tasks
    .filter((t) => t.type === 'once' && t.date === dateISO && t.timeStart)
    .sort((a, b) => (a.timeStart < b.timeStart ? -1 : 1));
}
export function alldayOn(dateISO) {
  return state.tasks.filter((t) => activeOn(t, dateISO) && !isTimed(t));
}
export function doneCount(t) { return t.completions ? Object.keys(t.completions).length : 0; }

// GCal overlap layout: cluster overlapping timed events into columns
export function layoutDay(events) {
  const evs = events.map((e) => ({ ...e, s: mins2(e.timeStart), e: e.timeEnd ? mins2(e.timeEnd) : mins2(e.timeStart) + 60 }));
  evs.sort((a, b) => a.s - b.s || a.e - b.e);
  const clusters = [];
  for (const ev of evs) {
    let placed = false;
    for (const c of clusters) {
      if (ev.s < c.end) { c.items.push(ev); c.end = Math.max(c.end, ev.e); placed = true; break; }
    }
    if (!placed) clusters.push({ end: ev.e, items: [ev] });
  }
  const out = [];
  for (const c of clusters) {
    const cols = [];
    for (const ev of c.items) {
      let i = 0;
      while (cols[i] !== undefined && ev.s < cols[i]) i++;
      ev.col = i; cols[i] = ev.e;
    }
    const n = cols.length;
    for (const ev of c.items) out.push({ ev, col: ev.col, n });
  }
  return out;
}
function mins2(h) { const [H, M] = (h || '00:00').split(':').map(Number); return H * 60 + M; }

export function seedIfFresh() {
  if (localStorage.getItem('lifeos.seeded')) return;
  if (!state.tasks.length) {
    const [y, m] = todayISO().split('-');
    state.tasks = [
      { id: uid(), title: 'gym.exe', type: 'daily', color: 'basil', completions: {} },
      { id: uid(), title: 'night-market run', type: 'once', date: todayISO(), timeStart: '09:00', timeEnd: '10:00', color: 'peacock', remindTime: '08:30', completions: {} },
      { id: uid(), title: 'icebreaker build', type: 'range', startDate: `${y}-${m}-03`, endDate: `${y}-${m}-12`, color: 'banana', completions: {} },
    ];
    save();
  }
  try { localStorage.setItem('lifeos.seeded', '1'); } catch { /* ignore */ }
}
