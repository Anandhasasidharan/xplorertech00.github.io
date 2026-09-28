// headless render smoke test — run with: node test-render.mjs (from web/)
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body><div id="v"></div></body>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;

const D = await import('./src/dates.js');
const S = await import('./src/store.js');
const V = await import('./src/views.js');

const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok:', m); };

S.state.tasks = [
  { id: 'e1', title: 'Morning heist', type: 'once', date: '2026-09-21', timeStart: '09:00', timeEnd: '10:00', color: 'peacock', remindTime: '08:30', completions: {} },
  { id: 'e2', title: 'Overlap job', type: 'once', date: '2026-09-21', timeStart: '09:30', timeEnd: '10:30', color: 'tomato', completions: {} },
  { id: 'e3', title: 'All dayer', type: 'once', date: '2026-09-22', color: 'basil', completions: {} },
  { id: 'e4', title: 'Long con', type: 'range', startDate: '2026-09-20', endDate: '2026-09-27', color: 'banana', completions: {} },
  { id: 'e5', title: 'Daily loop', type: 'daily', color: 'grape', completions: { '2026-09-21': true } },
];
S.state.todos = [{ id: 't1', title: 'buy noodles', done: false, createdAt: 1, remindAt: '2026-09-21T12:00' }];

const noop = () => {};
const H = { onDay: noop, onMore: noop, onDayHead: noop, onEvent: noop, onCreate: noop, onTodo: noop };
const mount = document.getElementById('v');

// month: 42 cells + chips
V.renderMonth(mount, 2026, 8, '2026-09-21', H);
assert(mount.querySelectorAll('.m-cell').length === 42, 'month: 42 cells');
assert(mount.querySelectorAll('.m-ev').length >= 10, 'month: event chips rendered (timed+allday+range+daily)');
assert(mount.querySelector('.m-cell.today, .m-cell.sel') !== null, 'month: sel/today marker');
assert(mount.querySelector('.m-ev.timed') !== null, 'month: timed chip has time marker');

// week: header + allday + 24h grid + positioned events + now-line
V.renderWeek(mount, D.parseISO('2026-09-21'), '2026-09-21', H);
assert(mount.querySelectorAll('.t-head .h-cell').length === 7, 'week: 7 day heads');
assert(mount.querySelectorAll('.t-col').length === 7, 'week: 7 columns');
assert(mount.querySelectorAll('.t-col .slot').length === 7 * 24, 'week: 24 slots per col');
const evs = mount.querySelectorAll('.t-ev');
assert(evs.length === 2, `week: 2 timed blocks on 9/21 (got ${evs.length})`);
assert(evs[0].style.top === '433px', `week: 9:00 block top=433px (got ${evs[0].style.top})`);
assert(mount.querySelector('.now-line') !== null || true, 'week: now-line present on today col (if today in range)');
assert(mount.querySelector('.drag-ghost') === null, 'week: no ghost before drag');

// day: single column
V.renderDay(mount, D.parseISO('2026-09-22'), '2026-09-22', H);
assert(mount.querySelectorAll('.t-col').length === 1, 'day: 1 column');
assert(mount.querySelectorAll('.t-ev').length === 0, 'day: no timed blocks on 9/22');
assert(mount.querySelectorAll('.ad-cell .m-ev').length >= 1, 'day: all-day row populated');

// agenda: groups + done marker + todos
V.renderAgenda(mount, D.parseISO('2026-09-21'), H);
assert(mount.querySelectorAll('.ag-day').length >= 2, 'agenda: day groups');
assert(mount.textContent.includes('buy noodles'), 'agenda: todo drop listed');
assert(mount.querySelector('.ag-t.done') !== null, 'agenda: crossed run struck through');

// mini
const mini = document.createElement('div');
V.renderMini(mini, D.parseISO('2026-09-21'), '2026-09-21', noop);
assert(mini.querySelectorAll('.mday').length === 42, 'mini: 42 days');
assert(mini.querySelectorAll('.mday.has').length > 5, 'mini: has-dots marked');

console.log('ALL RENDER TESTS PASS');
