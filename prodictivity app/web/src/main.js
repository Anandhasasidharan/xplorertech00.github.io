import './styles.css';
import { iso, parseISO, addDays, mondayOf, MONTHS, MONTHS_FULL, todayISO, fmtDayLong } from './dates.js';
import { state, load, save, pullServer, seedIfFresh, toggleDone, doneCount } from './store.js';
import { renderMini, renderMonth, renderWeek, renderDay, renderAgenda } from './views.js';
import { openDialog } from './dialog.js';
import { renderTodos, bindTodos, fmtWhen } from './todos.js';
import * as alarms from './reminders.js';
import { boot } from './boot.js';
import { startRain, setRain, isRain } from './rain.js';

const $ = (id) => document.getElementById(id);
const ui = { view: 'week', cursor: new Date(), mini: new Date(), selected: todayISO() };

// ---------- toasts ----------
alarms.init((title, sub) => {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  const s = document.createElement('strong'); s.textContent = '⏰ ' + title;
  const d = document.createElement('div'); d.className = 'tsub'; d.textContent = sub || '';
  t.append(s, d); t.onclick = () => t.remove();
  box.appendChild(t);
  setTimeout(() => t.remove(), 14000);
});
const toast = (title, sub) => {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  const s = document.createElement('strong'); s.textContent = title;
  const d = document.createElement('div'); d.className = 'tsub'; d.textContent = sub || '';
  t.append(s, d); t.onclick = () => t.remove();
  box.appendChild(t);
  setTimeout(() => t.remove(), 9000);
};

// ---------- status ----------
function status() {
  const done = state.tasks.reduce((n, t) => n + doneCount(t), 0);
  const open = state.todos.filter((t) => !t.done).length;
  $('statusText').textContent =
    `vault: LOCAL-ONLY · ${state.tasks.length} runs / ${done} crossed · ${open} drops live · ${ui.selected}${alarms.isOn() ? ' · ALARM:ON' : ''} · the street finds its own uses for things`;
}

// ---------- range label ----------
function label() {
  const c = ui.cursor;
  if (ui.view === 'month') return `${MONTHS[c.getMonth()]} ${c.getFullYear()}`;
  if (ui.view === 'week') {
    const m = mondayOf(c), e = addDays(m, 6);
    return `${MONTHS[m.getMonth()]} ${m.getDate()} — ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  if (ui.view === 'day') return fmtDayLong(iso(c)).toUpperCase();
  return 'NEXT 14 // UPCOMING RUNS';
}

// ---------- handlers shared by all views ----------
const H = {
  onDay: (s) => { ui.selected = s; ui.cursor = parseISO(s); render(); },
  onMore: (s) => { ui.selected = s; ui.cursor = parseISO(s); ui.view = 'day'; render(); },
  onDayHead: (s) => { ui.selected = s; ui.cursor = parseISO(s); ui.view = 'day'; render(); },
  onTodo: () => { document.getElementById('todoInput').focus(); window.scrollTo({ top: 0 }); },
  onEvent: (id, dateISO) => {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    openDialog($('dlgRoot'), {
      task: t,
      onSave: (out) => { const i = state.tasks.findIndex((x) => x.id === out.id); if (i >= 0) state.tasks[i] = out; save(); render(); },
      onDelete: (delId) => { state.tasks = state.tasks.filter((x) => x.id !== delId); save(); render(); },
    });
  },
  onCreate: (dateISO, t0, t1) => {
    openDialog($('dlgRoot'), {
      preset: { date: dateISO, timeStart: t0 || '', timeEnd: t1 || '' },
      onSave: (out) => { state.tasks.push(out); save(); render(); },
      onDelete: () => {},
    });
  },
};

function render() {
  document.querySelectorAll('.hk-btn.view').forEach((b) => b.classList.toggle('on', b.dataset.view === ui.view));
  $('rangeLabel').textContent = label();
  const v = $('view');
  if (ui.view === 'month') renderMonth(v, ui.cursor.getFullYear(), ui.cursor.getMonth(), ui.selected, H);
  else if (ui.view === 'week') renderWeek(v, mondayOf(ui.cursor), ui.selected, H);
  else if (ui.view === 'day') renderDay(v, ui.cursor, ui.selected, H);
  else renderAgenda(v, ui.cursor, H);
  renderMini($('miniCal'), ui.mini, ui.selected, (kind, n, s) => {
    if (kind === 'nav') ui.mini = new Date(ui.mini.getFullYear(), ui.mini.getMonth() + n, 1);
    else { ui.selected = s; ui.cursor = parseISO(s); }
    render();
  });
  renderTodos();
  status();
}

function step(dir) {
  const d = { month: () => ui.cursor = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth() + dir, 1),
    week: () => ui.cursor = addDays(ui.cursor, dir * 7),
    day: () => ui.cursor = addDays(ui.cursor, dir),
    agenda: () => ui.cursor = addDays(ui.cursor, dir * 14) }[ui.view];
  d(); render();
}

// ---------- wire up ----------
function bind() {
  $('prevBtn').onclick = () => step(-1);
  $('nextBtn').onclick = () => step(1);
  $('todayBtn').onclick = () => { ui.cursor = new Date(); ui.mini = new Date(); ui.selected = todayISO(); render(); };
  $('newBtn').onclick = () => H.onCreate(ui.selected, '', '');
  document.querySelectorAll('.hk-btn.view').forEach((b) => b.onclick = () => { ui.view = b.dataset.view; render(); });
  $('remindBtn').onclick = async (e) => { await alarms.enable(e.target); status(); };
  $('rainBtn').onclick = (e) => { setRain(!isRain()); e.target.textContent = isRain() ? '[ RAIN:ON ]' : '[ RAIN:OFF ]'; };
  $('exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'sprawl-os-backup.json'; a.click();
  };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (!Array.isArray(j.tasks)) throw new Error('bad file');
        state.tasks = j.tasks; state.todos = Array.isArray(j.todos) ? j.todos : [];
        state.fired = (j.fired && typeof j.fired === 'object') ? j.fired : {};
        save(); render();
      } catch { alert('import failed: bad file'); }
    };
    r.readAsText(f); e.target.value = '';
  };
  $('wipeBtn').onclick = () => {
    if (confirm('FLATLINE everything? Export first — the dead remember nothing.')) {
      state.tasks = []; state.todos = []; state.fired = {}; save(); render();
    }
  };
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    const k = e.key.toLowerCase();
    if (k === 'm') ui.view = 'month';
    else if (k === 'w') ui.view = 'week';
    else if (k === 'd') ui.view = 'day';
    else if (k === 'a') ui.view = 'agenda';
    else if (k === 't') { ui.cursor = new Date(); ui.selected = todayISO(); }
    else if (k === 'n') { H.onCreate(ui.selected, '', ''); return; }
    else if (e.key === 'ArrowLeft') { step(-1); return; }
    else if (e.key === 'ArrowRight') { step(1); return; }
    else return;
    render();
  });
  bindTodos(() => render());
}

// ---------- init ----------
load();
seedIfFresh();
bind();
render();
startRain();
boot([
  '> sprawl_os --jack-in ...',
  '<span class="dim">-- negotiating with the night-city grid ...</span>',
  '<span class="mag">[OK]</span> icebreaker v2.0 loaded',
  '<span class="mag">[OK]</span> vault decrypted :: local-only, nothing leaves the deck',
  `<span class="cy">[OK]</span> ${state.tasks.length} runs / ${state.todos.filter((t) => !t.done).length} dead-drops restored`,
  '> render --consensual-hallucination _',
]);
pullServer().then((fresh) => { if (fresh) { render(); toast('vault synced', 'local server had fresher runs'); } });
