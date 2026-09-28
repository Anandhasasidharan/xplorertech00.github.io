// dead-drops: dateless todo inbox with optional alarm datetimes
import { state, save, uid } from './store.js';
import { el } from './views.js';

export function fmtWhen(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : (s || '');
}

let changed = () => {};
export function renderTodos() {
  const box = document.getElementById('todoList'); if (!box) return;
  box.innerHTML = '';
  const open = state.todos.filter((t) => !t.done).length;
  document.getElementById('todoCount').textContent = `--${state.todos.length} stashed / ${open} live`;
  if (!state.todos.length) { box.innerHTML = '<div class="empty-msg">// clean. the street provides nothing.</div>'; return; }
  state.todos.forEach((t) => {
    const row = el('div', 'todo-row' + (t.done ? ' done' : ''));
    row.innerHTML = `<span class="box">${t.done ? '[x]' : '[ ]'}</span><span class="tname"></span><button class="tdel">[X]</button>`;
    row.querySelector('.tname').textContent = t.title;
    if (t.remindAt) {
      const b = el('span', 'bell', `⏰${fmtWhen(t.remindAt)}`);
      row.querySelector('.tname').after(b);
    }
    row.title = 'click to cross/uncross';
    row.onclick = (e) => { if (e.target.classList.contains('tdel')) return; t.done = !t.done; save(); renderTodos(); changed(); };
    row.querySelector('.tdel').onclick = () => { state.todos = state.todos.filter((x) => x.id !== t.id); save(); renderTodos(); changed(); };
    box.appendChild(row);
  });
}

export function bindTodos(onChange) {
  changed = onChange;
  document.getElementById('todoForm').onsubmit = (e) => {
    e.preventDefault();
    const inp = document.getElementById('todoInput'), when = document.getElementById('todoWhen');
    const title = inp.value.trim(); if (!title) return;
    const td = { id: uid(), title, done: false, createdAt: Date.now() };
    if (when.value) td.remindAt = when.value;
    state.todos.unshift(td); save();
    inp.value = ''; when.value = ''; inp.focus();
    renderTodos(); onChange();
  };
  document.getElementById('clearDoneBtn').onclick = () => {
    state.todos = state.todos.filter((t) => !t.done); save(); renderTodos(); changed();
  };
}
