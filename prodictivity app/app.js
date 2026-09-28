// > LIFE_OS v1.1 — local-only hacker calendar + tasks + todos + reminders
const LS_KEY = 'lifeos.v1';
const $ = (id) => document.getElementById(id);

let state = { tasks: [], todos: [], fired: {} };
let remindersOn = false;
let viewYear, viewMonth; // month 0-11
let selectedDate = toISO(new Date());

function toISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDaysISO(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function asciiBar(pct) {
  const total = 25, filled = Math.round(pct / 4);
  return '█'.repeat(filled) + '░'.repeat(total - filled) + ` ${pct}%`;
}

// google-calendar-inspired palette (names match gcal)
const COLOR_HEX = {
  green: '#39d353', amber: '#ffb000', cyan: '#00d4ff', red: '#ff4444',
  tomato: '#d50000', flamingo: '#e67c73', tangerine: '#f4511e', banana: '#f6bf26',
  sage: '#33b679', basil: '#0b8043', peacock: '#039be5', blueberry: '#3f51b5',
  lavender: '#7986cb', grape: '#8e24aa', graphite: '#616161',
};
function colorOf(t) { return COLOR_HEX[t.color] ? t.color : 'green'; }

// ---- storage ----
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const j = JSON.parse(raw); if (Array.isArray(j.tasks)) state = j; }
  } catch { /* corrupted -> reset */ state = { tasks: [], todos: [], fired: {} }; }
  if (!Array.isArray(state.todos)) state.todos = [];
  if (!state.fired || typeof state.fired !== 'object') state.fired = [];
  if (Array.isArray(state.fired)) state.fired = {}; // migrate legacy shape
}
function normalizeState(j) {
  if (!j || typeof j !== 'object') return { tasks: [], todos: [], fired: {}, updatedAt: 0 };
  return {
    tasks: Array.isArray(j.tasks) ? j.tasks : [],
    todos: Array.isArray(j.todos) ? j.todos : [],
    fired: (j.fired && typeof j.fired === 'object' && !Array.isArray(j.fired)) ? j.fired : {},
    updatedAt: j.updatedAt || 0,
  };
}
function save() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  clearTimeout(save._t);
  save._t = setTimeout(() => {
    // best-effort push to local server.py so state.json stays fresh
    // (reminders.ps1 reads that file when the tab is closed)
    fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {});
  }, 300);
}
async function pullServer() {
  // if server.py has NEWER state (e.g. edited elsewhere), adopt it
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (!r.ok) return;
    const j = normalizeState(await r.json());
    // adopt server state only if newer — and never let an empty server
    // list clobber local tasks (e.g. fresh state.json after cleanup)
    if ((j.updatedAt || 0) > (state.updatedAt || 0) &&
        (j.tasks.length > 0 || state.tasks.length === 0)) {
      state = j;
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    }
  } catch { /* opened via file:// or server down — localStorage only */ }
}

// ---- task logic ----
function tasksForDate(iso) {
  return state.tasks.filter(t => {
    if (t.type === 'once') return t.date === iso;
    if (t.type === 'range') return t.startDate && t.endDate && iso >= t.startDate && iso <= t.endDate;
    if (t.type === 'daily') {
      if (t.startDate && iso < t.startDate) return false;
      if (t.endDate && iso > t.endDate) return false;
      return true;
    }
    return false;
  });
}
function isDone(task, iso) { return !!(task.completions && task.completions[iso]); }
function toggleDone(id, iso) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.completions = t.completions || {};
  if (t.completions[iso]) delete t.completions[iso]; // uncross allowed
  else t.completions[iso] = true;
  save(); render();
}
function rangeDays(t) {
  if (t.type === 'once') return 1;
  if (t.type === 'range' && t.startDate && t.endDate) {
    const a = parseISO(t.startDate), b = parseISO(t.endDate);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }
  return null; // daily-forever = infinite
}
function doneCount(t) { return t.completions ? Object.keys(t.completions).length : 0; }

// ---- render ----
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEPT','OCT','NOV','DEC'];

function render() {
  $('monthLabel').textContent = `${MONTHS[viewMonth]} ${viewYear}`;
  $('calMeta').textContent = `--year=${viewYear} --month=${String(viewMonth + 1).padStart(2, '0')}`;
  renderGrid(); renderDetail(); renderProcs(); renderTodos(); renderFooter();
}

function renderGrid() {
  const grid = $('grid'); grid.innerHTML = '';
  const first = new Date(viewYear, viewMonth, 1);
  let offset = (first.getDay() + 6) % 7; // Monday=0
  for (let i = 0; i < offset; i++) { const e = document.createElement('div'); e.className = 'cell empty'; grid.appendChild(e); }
  const days = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayISO = toISO(new Date());
  for (let d = 1; d <= days; d++) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const list = tasksForDate(iso);
    const done = list.filter(t => isDone(t, iso)).length;
    const cell = document.createElement('div');
    cell.className = 'cell' + (iso === todayISO ? ' today' : '') + (iso === selectedDate ? ' selected' : '') + (list.length && done === list.length ? ' all-done' : '');
    const dn = document.createElement('div'); dn.className = 'dnum'; dn.textContent = String(d).padStart(2, '0');
    cell.appendChild(dn);
    const box = document.createElement('div'); box.className = 'items';
    list.slice(0, 3).forEach(t => {
      const el = document.createElement('div');
      el.className = 'item c-' + colorOf(t) + (isDone(t, iso) ? ' done' : '');
      el.textContent = (isDone(t, iso) ? '[x] ' : '[ ] ') + (t.remindTime ? '⏰' : '') + t.title;
      box.appendChild(el);
    });
    if (list.length > 3) { const m = document.createElement('div'); m.className = 'more'; m.textContent = `+${list.length - 3} more`; box.appendChild(m); }
    cell.appendChild(box);
    cell.onclick = () => { selectedDate = iso; render(); };
    grid.appendChild(cell);
  }
}

function renderDetail() {
  $('detailDate').textContent = selectedDate;
  const list = $('detailList'); list.innerHTML = '';
  const tasks = tasksForDate(selectedDate);
  if (!tasks.length) { list.innerHTML = '<div class="empty-msg">-- no processes scheduled. [ + NEW TASK ] to inject one. --</div>'; }
  tasks.forEach(t => {
    const done = isDone(t, selectedDate);
    const row = document.createElement('div');
    row.className = 'task-row' + (done ? ' done' : '');
    row.innerHTML = `<span class="box">${done ? '[x]' : '[ ]'}</span><span class="tname c-${colorOf(t)}"></span><span class="tag ${done ? 'ok' : ''}">${done ? '[OK]' : t.type.toUpperCase()}</span>`;
    row.querySelector('.tname').textContent = t.title;
    if (t.remindTime) { const b = document.createElement('span'); b.className = 'bell'; b.textContent = `⏰${t.remindTime}`; row.querySelector('.tname').after(b); }
    row.onclick = () => toggleDone(t.id, selectedDate);
    row.title = 'click to cross/uncross';
    list.appendChild(row);
  });
  // status bar: selected day
  const done = tasks.filter(t => isDone(t, selectedDate)).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  $('statusBar').textContent = tasks.length ? `${asciiBar(pct)}  ${done}/${tasks.length} crossed` : '-- no tasks --';
}

function renderProcs() {
  const box = $('taskList'); box.innerHTML = '';
  $('taskCount').textContent = `--count=${state.tasks.length}`;
  if (!state.tasks.length) { box.innerHTML = '<div class="empty-msg">-- null. create your first task. --</div>'; return; }
  [...state.tasks].sort((a, b) => (a.title || '').localeCompare(b.title || '')).forEach(t => {
    const total = rangeDays(t);
    const done = doneCount(t);
    const pct = total ? Math.round(done / total * 100) : done; // daily-forever shows raw count
    const label = t.type === 'daily' && !total
      ? `DAILY∞ done:${done} streak`
      : `${done}/${total} ${asciiBar(total ? Math.min(100, pct) : 0)}`;
    let span = t.type === 'once' ? t.date : t.type === 'range' ? `${t.startDate}→${t.endDate}` : (t.startDate || t.endDate) ? `${t.startDate || '-∞'}→${t.endDate || '+∞'}` : 'forever ∞';
    const el = document.createElement('div');
    el.className = 'proc';
    el.style.borderLeft = `4px solid ${COLOR_HEX[colorOf(t)]}`;
    el.innerHTML = `<div class="prow"><span>[${t.type.toUpperCase()}] </span><button class="del" title="delete">[ DEL ]</button></div><div class="prow"><strong></strong><span></span></div><div class="pbar"></div>`;
    el.querySelector('strong').textContent = t.title;
    el.querySelector('.prow span:last-child, .prow span').textContent = ''; // noop keep structure
    el.children[1].querySelector('span').textContent = span + (t.remindTime ? `  ⏰${t.remindTime}` : '');
    el.querySelector('.pbar').textContent = label;
    el.querySelector('.del').onclick = () => { if (confirm(`kill "${t.title}"?`)) { state.tasks = state.tasks.filter(x => x.id !== t.id); save(); render(); } };
    box.appendChild(el);
  });
}

function renderFooter() {
  const total = state.tasks.reduce((n, t) => n + doneCount(t), 0);
  const openTodos = state.todos.filter(t => !t.done).length;
  $('footerStatus').textContent = `localVault: OK | tasks: ${state.tasks.length} | crossings: ${total} | todos: ${openTodos} open | ${selectedDate}${remindersOn ? ' | reminders: ON' : ''}`;
}

// ---- todos (dateless quick inbox) ----
function renderTodos() {
  const box = $('todoList'); if (!box) return; box.innerHTML = '';
  const open = state.todos.filter(t => !t.done).length;
  $('todoCount').textContent = `--count=${state.todos.length} open=${open}`;
  if (!state.todos.length) { box.innerHTML = '<div class="empty-msg">-- inbox zero. type above + ENTER. --</div>'; return; }
  state.todos.forEach(t => {
    const row = document.createElement('div');
    row.className = 'todo-row' + (t.done ? ' done' : '');
    row.innerHTML = `<span class="box">${t.done ? '[x]' : '[ ]'}</span><span class="tname"></span><button class="tdel">[ DEL ]</button>`;
    row.querySelector('.tname').textContent = t.title;
    if (t.remindAt) { const b = document.createElement('span'); b.className = 'bell'; b.textContent = '⏰' + fmtRemindAt(t.remindAt); row.querySelector('.tname').after(b); }
    row.querySelector('.box').parentElement.title = 'click to cross/uncross';
    row.onclick = (e) => { if (e.target.classList.contains('tdel')) return; t.done = !t.done; save(); render(); };
    row.querySelector('.tdel').onclick = () => { state.todos = state.todos.filter(x => x.id !== t.id); save(); render(); };
    box.appendChild(row);
  });
}
function addTodo(title, remindAt) {
  title = (title || '').trim(); if (!title) return;
  const todo = { id: uid(), title, done: false, createdAt: Date.now() };
  if (remindAt) todo.remindAt = remindAt; // ISO "YYYY-MM-DDTHH:MM"
  state.todos.unshift(todo);
  save(); render();
}
function fmtRemindAt(s) {
  // "2026-09-21T09:30" -> "21/09 09:30"
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : (s || '');
}

// ---- reminders ----
function toast(title, sub) {
  const box = $('toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<strong></strong><div class="tsub"></div>`;
  el.querySelector('strong').textContent = '⏰ ' + title;
  el.querySelector('.tsub').textContent = sub || '';
  el.onclick = () => el.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), 12000);
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.12;
    o.start(); o.stop(ctx.currentTime + 0.25);
    setTimeout(() => { const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination); o2.frequency.value = 660; g2.gain.value = 0.12; o2.start(); o2.stop(ctx.currentTime + 0.25); }, 300);
  } catch { /* audio blocked — toast still shows */ }
}
function fireKey(key, title, sub) {
  if (state.fired[key]) return false;
  state.fired[key] = true; save();
  toast(title, sub);
  beep();
  if (remindersOn && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('⏰ ' + title, { body: sub + ' · LIFE_OS' }); } catch { /* ignore */ }
  }
  return true;
}
function fireReminder(task, dateISO) {
  const label = `${task.title} — due today${task.remindTime ? ' @' + task.remindTime : ''}`;
  fireKey(task.id + '@' + dateISO, label, `${task.type.toUpperCase()} · ${dateISO} · click day to cross it off`);
}
function fireTodo(t) {
  fireKey('todo@' + t.id, `${t.title} — todo due!`, `TODO · ${fmtRemindAt(t.remindAt)} · cross it off in the inbox`);
}
function nowHM() { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); }
function nowLocalISO() {
  // local "YYYY-MM-DDTHH:MM" comparable with todo.remindAt strings
  const n = new Date(), p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`;
}
function checkReminders() {
  if (!remindersOn) return;
  const today = toISO(new Date()), hm = nowHM(), now = nowLocalISO();
  tasksForDate(today).forEach(t => {
    if (!t.remindTime || isDone(t, today)) return;
    if (t.remindTime <= hm) fireReminder(t, today);
  });
  state.todos.forEach(t => {
    if (t.done || !t.remindAt) return;
    if (t.remindAt <= now) fireTodo(t);
  });
}
async function enableReminders() {
  if (!('Notification' in window)) { remindersOn = true; $('remindBtn').textContent = '[ REMINDERS:ON* ]'; toast('reminders ON (in-tab only)', 'this browser has no Notification API — toasts will show while tab is open'); checkReminders(); render(); return; }
  if (Notification.permission === 'granted') { remindersOn = true; }
  else if (Notification.permission !== 'denied') {
    try { remindersOn = (await Notification.requestPermission()) === 'granted' ? true : true; }
    catch { remindersOn = true; }
  } else { remindersOn = true; toast('notifications blocked', 'browser denied Notification — in-tab toasts will still fire'); }
  $('remindBtn').textContent = remindersOn ? '[ REMINDERS:ON ]' : '[ REMINDERS:OFF ]';
  checkReminders(); render();
}

// ---- google calendar sync (read-only, ICS -> local tasks) ----
const GCAL_KEY = 'lifeos.gcalUrl';
async function gcalSync() {
  let url = '';
  try { url = localStorage.getItem(GCAL_KEY) || ''; } catch { /* ignore */ }
  const first = !url;
  const hint = 'Paste your Google Calendar ICS URL.\nGoogle Calendar web > gear > Settings > your calendar > "Secret address in iCal format" (or the public address).\nIt stays on your machine — fetched directly from Google by your local server.';
  url = prompt(first ? hint : `Syncing from saved URL:\n${url}\n\nOK = sync now, or paste a new URL:`, url || '');
  if (url === null) return; // cancelled
  url = (url || '').trim();
  if (!url) return;
  $('gcalBtn').textContent = '[ SYNCING... ]';
  try {
    const r = await fetch('/api/gcal-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ icsUrl: url }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'sync failed');
    try { localStorage.setItem(GCAL_KEY, url); } catch { /* ignore */ }
    await pullServer(); render();
    toast(`gcal sync: +${j.added} new, ~${j.updated} updated`, `${j.events} events read · imported events carry their start time as reminder`);
  } catch (e) {
    alert('GCAL SYNC failed: ' + e.message + '\n(Tip: open the app via http://127.0.0.1:8765 — file:// mode cannot reach Google.)');
  }
  $('gcalBtn').textContent = '[ GCAL SYNC ]';
}

// ---- modal ----
function openModal() {
  $('modal').classList.remove('hidden');
  $('fTitle').value = '';
  $('fType').value = 'daily';
  $('fStart').value = selectedDate; $('fEnd').value = ''; $('fRemind').value = '';
  $('fTitle').focus();
}
function closeModal() { $('modal').classList.add('hidden'); }

function onSubmit(e) {
  e.preventDefault();
  const title = $('fTitle').value.trim();
  if (!title) return;
  const type = $('fType').value;
  const start = $('fStart').value || null;
  const end = $('fEnd').value || null;
  const color = COLOR_HEX[$('fColor').value] ? $('fColor').value : 'basil';
  const remindTime = $('fRemind').value || null;
  if (type === 'once' && !start) { alert('once needs a date (= start field)'); return; }
  if (type === 'range' && (!start || !end)) { alert('range needs start + end'); return; }
  if (start && end && end < start) { alert('end < start. rejected.'); return; }
  const t = { id: uid(), title, type, color, completions: {} };
  if (remindTime) t.remindTime = remindTime;
  if (type === 'once') t.date = start || selectedDate;
  if (type === 'range') { t.startDate = start; t.endDate = end; }
  if (type === 'daily') { if (start) t.startDate = start; if (end) t.endDate = end; } // empty = forever
  state.tasks.push(t); save(); closeModal(); render();
}

// ---- boot ----
function boot() {
  const lines = ['> lifelog --init...', '[OK] calendar module loaded', '[OK] tasks restored from localVault', `> render --month=${viewYear}-${String(viewMonth + 1).padStart(2, '0')} _`];
  const el = $('bootLines'); el.innerHTML = '';
  let i = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function next() {
    if (i >= lines.length) { setTimeout(() => $('boot').classList.add('hidden'), 250); return; }
    const div = document.createElement('div');
    div.textContent = lines[i]; el.appendChild(div); i++;
    setTimeout(next, reduced ? 0 : 160);
  }
  next();
  setTimeout(() => $('boot').classList.add('hidden'), 2500); // failsafe
}

// ---- events ----
function bind() {
  $('prevBtn').onclick = () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); };
  $('nextBtn').onclick = () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); };
  $('todayBtn').onclick = () => { const n = new Date(); viewYear = n.getFullYear(); viewMonth = n.getMonth(); selectedDate = toISO(n); render(); };
  $('newTaskBtn').onclick = openModal;
  $('todoBtn').onclick = () => { $('todoPane').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('todoInput').focus(); };
  $('todoForm').onsubmit = (e) => { e.preventDefault(); addTodo($('todoInput').value, $('todoWhen').value || null); $('todoInput').value = ''; $('todoWhen').value = ''; $('todoInput').focus(); };
  $('clearDoneBtn').onclick = () => { state.todos = state.todos.filter(t => !t.done); save(); render(); };
  $('remindBtn').onclick = enableReminders;
  $('closeModal').onclick = closeModal;
  $('cancelModal').onclick = closeModal;
  $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  $('taskForm').onsubmit = onSubmit;
  $('crtBtn').onclick = (e) => { document.body.classList.toggle('no-crt'); e.target.textContent = document.body.classList.contains('no-crt') ? '[ CRT:OFF ]' : '[ CRT:ON ]'; };
  document.querySelectorAll('[data-t-theme]').forEach(b => b.onclick = () => document.documentElement.setAttribute('data-terminal-theme', b.dataset.tTheme));
  $('exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lifeos-backup.json'; a.click();
  };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const j = JSON.parse(r.result); if (!Array.isArray(j.tasks)) throw 0; state = j; if (!Array.isArray(state.todos)) state.todos = []; if (!state.fired || typeof state.fired !== 'object' || Array.isArray(state.fired)) state.fired = {}; save(); render(); } catch { alert('import failed: bad file'); } };
    r.readAsText(f); e.target.value = '';
  };
  $('wipeBtn').onclick = () => { if (confirm('WIPE all tasks + todos? this cannot be undone. export first.')) { state = { tasks: [], todos: [], fired: {} }; save(); render(); } };
  $('gcalBtn').onclick = gcalSync;
  setInterval(checkReminders, 20000);
}

// ---- init ----
(function init() {
  load();
  // seed demo on first run so the grid isn't empty
  if (!localStorage.getItem('lifeos.seeded')) {
    if (!state.tasks.length) {
      const y = new Date().getFullYear(), m = String(new Date().getMonth() + 1).padStart(2, '0');
      state.tasks = [
        { id: uid(), title: 'gym.exe', type: 'daily', color: 'basil', completions: {} },
        { id: uid(), title: 'read_logs (20min)', type: 'daily', startDate: `${y}-${m}-01`, color: 'peacock', completions: {} },
        { id: uid(), title: 'ship_project', type: 'range', startDate: `${y}-${m}-03`, endDate: `${y}-${m}-12`, color: 'banana', completions: {} },
        { id: uid(), title: 'birthday.exe', type: 'once', date: `${y}-${m}-15`, color: 'tomato', completions: {} },
      ];
      save();
    }
    localStorage.setItem('lifeos.seeded', '1');
  }
  const now = new Date(); viewYear = now.getFullYear(); viewMonth = now.getMonth();
  bind(); render(); boot();
  pullServer().then(() => render()); // adopt newer server state if any
})();
