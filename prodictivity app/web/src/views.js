// GCal engine: month / week / day / agenda + mini navigator
import { iso, parseISO, addDays, mondayOf, p2, MONTHS, MONTHS_FULL, DOW, todayISO, mins, hm, nowLocalMinute, fmtDayLong } from './dates.js';
import { state, activeOn, isDone, isTimed, timedOn, alldayOn, layoutDay, colorOf } from './store.js';

const HOUR_PX = 48;
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- mini month (sidebar) ----------
export function renderMini(mount, cursor, selected, onPick) {
  mount.innerHTML = '';
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const head = el('div', 'mini-title');
  const prev = el('button'); prev.textContent = '<'; prev.onclick = () => onPick('nav', -1);
  const next = el('button'); next.textContent = '>'; next.onclick = () => onPick('nav', 1);
  const t = el('span'); t.textContent = `${MONTHS[m]} ${y}`;
  head.append(prev, t, next); mount.appendChild(head);
  const g = el('div', 'mini-grid');
  ['M','T','W','T','F','S','S'].forEach((d) => g.appendChild(el('span', 'mdow', d)));
  const first = mondayOf(new Date(y, m, 1));
  const today = todayISO();
  for (let i = 0; i < 42; i++) {
    const d = addDays(first, i), s = iso(d);
    const c = el('span', 'mday' + (d.getMonth() === m ? '' : ' dim') + (s === today ? ' today' : '') + (s === selected ? ' sel' : ''));
    c.textContent = d.getDate();
    if (state.tasks.some((t) => activeOn(t, s)) || state.todos.some((td) => !td.done && td.remindAt && td.remindAt.startsWith(s))) c.classList.add('has');
    c.title = s; c.onclick = () => onPick('day', 0, s);
    g.appendChild(c);
  }
  mount.appendChild(g);
}

// ---------- month ----------
function evChip(t, dateISO, H) {
  const d = el('div', `m-ev c-${colorOf(t)}${isDone(t, dateISO) ? ' done' : ''}`);
  const hmTxt = isTimed(t) ? t.timeStart : '';
  d.dataset.hm = hmTxt;
  if (hmTxt) d.classList.add('timed');
  d.textContent = `${isDone(t, dateISO) ? '[x] ' : ''}${esc(t.title)}`;
  if (t.remindTime) d.textContent += ' ⏰';
  d.title = `${t.title}${hmTxt ? ' @' + hmTxt : ''} — click to open`;
  d.onclick = (e) => { e.stopPropagation(); H.onEvent(t.id, dateISO); };
  return d;
}

export function renderMonth(mount, year, month, selected, H) {
  mount.innerHTML = '';
  const head = el('div', 'view-head', `// month-grid — ${MONTHS_FULL[month]} ${year} — click a date to jack in, click a block to edit`);
  mount.appendChild(head);
  const g = el('div', 'm-grid');
  DOW.forEach((d) => g.appendChild(el('div', 'm-dow', d)));
  const first = mondayOf(new Date(year, month, 1));
  const today = todayISO();
  for (let i = 0; i < 42; i++) {
    const d = addDays(first, i), s = iso(d);
    const cell = el('div', 'm-cell' + (d.getMonth() === month ? '' : ' out') + (s === today ? ' today' : '') + (s === selected ? ' sel' : ''));
    cell.appendChild(el('span', 'm-num', d.getDate()));
    const occ = [...timedOn(s), ...alldayOn(s)];
    occ.slice(0, 3).forEach((t) => cell.appendChild(evChip(t, s, H)));
    if (occ.length > 3) {
      const more = el('div', 'm-more', `+${occ.length - 3} more`);
      more.onclick = (e) => { e.stopPropagation(); H.onMore(s); };
      cell.appendChild(more);
    }
    cell.onclick = () => H.onDay(s);
    g.appendChild(cell);
  }
  mount.appendChild(g);
}

// ---------- time grid (week + day share) ----------
function timeGrid(days, selected, H) {
  const wrap = el('div');
  // header
  const hg = el('div', 't-head'); hg.style.gridTemplateColumns = `52px repeat(${days.length}, 1fr)`;
  hg.appendChild(el('div'));
  const today = todayISO();
  days.forEach((d) => {
    const s = iso(d);
    const c = el('div', 'h-cell' + (s === today ? ' today' : ''));
    c.innerHTML = `<span>${DOW[(d.getDay() + 6) % 7]} </span><span class="dn">${d.getDate()}</span>`;
    c.title = s; c.onclick = () => H.onDayHead && H.onDayHead(s);
    hg.appendChild(c);
  });
  wrap.appendChild(hg);
  // all-day row
  const ad = el('div', 'w-allday'); ad.style.gridTemplateColumns = `52px repeat(${days.length}, 1fr)`;
  ad.appendChild(el('div', 'ad-cell gutter', 'all-day'));
  days.forEach((d) => {
    const s = iso(d);
    const cell = el('div', 'ad-cell');
    alldayOn(s).slice(0, 2).forEach((t) => {
      const chip = el('div', `m-ev c-${colorOf(t)}${isDone(t, s) ? ' done' : ''}`, `${isDone(t, s) ? '[x] ' : ''}${esc(t.title)}`);
      chip.title = t.title; chip.onclick = (e) => { e.stopPropagation(); H.onEvent(t.id, s); };
      cell.appendChild(chip);
    });
    cell.onclick = () => H.onCreate(s, null, null);
    ad.appendChild(cell);
  });
  wrap.appendChild(ad);
  // body
  const body = el('div', 't-grid'); body.style.gridTemplateColumns = `52px repeat(${days.length}, 1fr)`;
  const gut = el('div', 't-gutter');
  for (let h = 0; h < 24; h++) gut.appendChild(el('div', 't-hour', `${p2(h)}:00`));
  body.appendChild(gut);
  const nowMin = nowLocalMinute();
  days.forEach((d) => {
    const s = iso(d);
    const col = el('div', 't-col'); col.dataset.date = s;
    for (let h = 0; h < 24; h++) col.appendChild(el('div', 'slot'));
    // events
    for (const { ev, col: c, n } of layoutDay(timedOn(s))) {
      const sMin = mins(ev.timeStart), eMin = ev.timeEnd ? mins(ev.timeEnd) : sMin + 60;
      const b = el('div', `t-ev c-${colorOf(ev)}${isDone(ev, s) ? ' done' : ''}`);
      b.style.top = `${(sMin / 60) * HOUR_PX + 1}px`;
      b.style.height = `${Math.max(20, ((eMin - sMin) / 60) * HOUR_PX - 2)}px`;
      b.style.left = `calc(${3 + (c * 100) / n}% )`; b.style.right = '3px';
      if (n > 1) b.style.width = `calc(${100 / n}% - 5px)`;
      b.innerHTML = `<span class="et">${esc(ev.timeStart)}${ev.timeEnd ? '-' + esc(ev.timeEnd) : ''}</span> ${esc(ev.title)}${ev.remindTime ? ' ⏰' : ''}`;
      b.title = `${ev.title} — click to edit`;
      b.onclick = (e) => { e.stopPropagation(); H.onEvent(ev.id, s); };
      col.appendChild(b);
    }
    if (s === today) {
      const nl = el('div', 'now-line'); nl.style.top = `${(nowMin / 60) * HOUR_PX}px`;
      col.appendChild(nl);
    }
    col.onmousedown = (e) => {
      if (e.button !== 0 || e.target.closest('.t-ev')) return;
      const rect = col.getBoundingClientRect();
      const y0 = e.clientY - rect.top;
      const ghost = el('div', 'drag-ghost'); col.appendChild(ghost);
      const paint = (yy) => {
        const a = Math.max(0, Math.min(y0, yy)), b2 = Math.min(24 * HOUR_PX, Math.max(y0, yy));
        ghost.style.top = `${a}px`; ghost.style.height = `${Math.max(12, b2 - a)}px`;
      };
      paint(y0);
      const mv = (me) => paint(me.clientY - rect.top);
      const up = (ue) => {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        ghost.remove();
        const y1 = ue.clientY - rect.top;
        const snap = (y) => Math.round((Math.max(0, Math.min(y, 24 * HOUR_PX - 1)) / HOUR_PX) * 4) / 4;
        let h0 = snap(Math.min(y0, y1)), h1 = snap(Math.max(y0, y1));
        if (h1 - h0 < 0.25) { h1 = Math.min(24, h0 + 1); } // plain click = 1h block
        H.onCreate(s, hm(h0 * 60), h1 >= 24 ? null : hm(h1 * 60));
      };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    };
    body.appendChild(col);
  });
  wrap.appendChild(body);
  return wrap;
}

export function renderWeek(mount, monday, selected, H) {
  mount.innerHTML = '';
  const days = [...Array(7)].map((_, i) => addDays(monday, i));
  mount.appendChild(el('div', 'view-head', `// week-grid — drag empty chrome to carve a run, click blocks to edit`));
  mount.appendChild(timeGrid(days, selected, H));
}

export function renderDay(mount, date, selected, H) {
  mount.innerHTML = '';
  mount.appendChild(el('div', 'view-head', `// day-grid — ${fmtDayLong(iso(date))}`));
  mount.appendChild(timeGrid([date], selected, H));
}

// ---------- agenda ("runs") ----------
export function renderAgenda(mount, fromDate, H) {
  mount.innerHTML = '';
  mount.appendChild(el('div', 'view-head', `// upcoming runs — next 14 days, timed + all-day + dead-drops`));
  const today = todayISO();
  let any = false;
  for (let i = 0; i < 14; i++) {
    const d = addDays(fromDate, i), s = iso(d);
    const items = [...timedOn(s).map((t) => ({ t, k: t.timeStart })), ...alldayOn(s).map((t) => ({ t, k: '99' }))];
    const todos = state.todos.filter((td) => !td.done && td.remindAt && td.remindAt.startsWith(s));
    if (!items.length && !todos.length) continue;
    any = true;
    const day = el('div', 'ag-day');
    day.appendChild(el('div', `ag-date${s === today ? ' today' : ''}`, fmtDayLong(s)));
    items.sort((a, b) => (a.k < b.k ? -1 : 1)).forEach(({ t }) => {
      const row = el('div', 'ag-item');
      const when = isTimed(t) ? `${t.timeStart}${t.timeEnd ? '–' + t.timeEnd : ''}` : 'all-day';
      row.innerHTML = `<span class="ag-hm">${esc(when)}</span><span class="ag-t${isDone(t, s) ? ' done' : ''}"></span>`;
      row.querySelector('.ag-t').textContent = `${isDone(t, s) ? '[x] ' : '[ ] '}${t.title}${t.remindTime ? ' ⏰' : ''}`;
      row.onclick = () => H.onEvent(t.id, s);
      day.appendChild(row);
    });
    todos.forEach((td) => {
      const row = el('div', 'ag-item');
      row.innerHTML = `<span class="ag-hm">drop</span><span class="ag-t"></span>`;
      row.querySelector('.ag-t').textContent = `[ ] ${td.title} ⏰${td.remindAt.slice(11)}`;
      row.onclick = () => H.onTodo && H.onTodo();
      day.appendChild(row);
    });
    mount.appendChild(day);
  }
  if (!any) mount.appendChild(el('div', 'ag-empty', '// static on all frequencies. jack in something.'));
}
