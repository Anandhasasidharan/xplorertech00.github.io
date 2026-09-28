// event editor dialog — construct / icepick a calendar run
import { COLOR_HEX, colorOf, uid } from './store.js';
import { el } from './views.js';

export function openDialog(root, { task = null, preset = {}, onSave, onDelete }) {
  root.innerHTML = '';
  const veil = el('div', 'dlg-veil');
  const box = el('div', 'dlg');
  const editing = !!task;
  const head = el('div', 'dlg-head');
  head.innerHTML = `<span>// ${editing ? 'icepick run' : 'construct run'}</span>`;
  const x = el('button', 'hk-btn small', '[ X ]'); x.onclick = close;
  head.appendChild(x); box.appendChild(head);

  const t = task ? { ...task } : {
    id: uid(), title: '', type: 'once', color: 'peacock', completions: {},
    date: preset.date || '', timeStart: preset.timeStart || '', timeEnd: preset.timeEnd || '',
  };
  // infer kind
  let kind = 'timed';
  if (t.type === 'range') kind = 'range';
  else if (t.type === 'daily') kind = 'daily';
  else if (!t.timeStart) kind = 'allday';

  const form = el('form');
  form.innerHTML = `
    <label>run title<input id="dTitle" maxlength="80" required placeholder="e.g. midnight data-heist"></label>
    <label>kind
      <select id="dKind">
        <option value="timed">timed hit — one date, start→end</option>
        <option value="allday">all-day — occupies the date</option>
        <option value="range">long con — spans dates</option>
        <option value="daily">loop — repeats daily, optional bounds</option>
      </select>
    </label>
    <div class="row">
      <label>date / start<input type="date" id="dDate"></label>
      <label>end (con / loop)<input type="date" id="dEnd"></label>
    </div>
    <div class="row" id="dTimeRow">
      <label>start<input type="time" id="dT0"></label>
      <label>end<input type="time" id="dT1"></label>
    </div>
    <label>alarm (optional)<input type="time" id="dRem"></label>
    <label>neon tag<div class="swatches" id="dSw"></div></label>`;
  form.querySelector('#dTitle').value = t.title || '';
  form.querySelector('#dKind').value = kind;
  form.querySelector('#dDate').value = t.date || t.startDate || preset.date || '';
  form.querySelector('#dEnd').value = t.endDate || '';
  form.querySelector('#dT0').value = t.timeStart || preset.timeStart || '';
  form.querySelector('#dT1').value = t.timeEnd || preset.timeEnd || '';
  form.querySelector('#dRem').value = t.remindTime || '';

  const sw = form.querySelector('#dSw');
  let color = colorOf(t);
  Object.entries(COLOR_HEX).forEach(([name, hex]) => {
    const b = el('button', 'sw' + (name === color ? ' on' : ''));
    b.type = 'button'; b.title = name; b.style.background = hex; b.style.color = hex;
    b.onclick = () => { color = name; sw.querySelectorAll('.sw').forEach((s2) => s2.classList.remove('on')); b.classList.add('on'); };
    sw.appendChild(b);
  });

  const syncKind = () => {
    const k = form.querySelector('#dKind').value;
    form.querySelector('#dTimeRow').style.display = k === 'timed' ? '' : 'none';
  };
  form.querySelector('#dKind').onchange = syncKind; syncKind();

  const acts = el('div', 'dlg-actions');
  const saveB = el('button', 'hk-btn primary', '[ COMMIT ]'); saveB.type = 'submit';
  const cancel = el('button', 'hk-btn', '[ WALK AWAY ]'); cancel.type = 'button'; cancel.onclick = close;
  acts.append(saveB, cancel);
  if (editing) {
    const del = el('button', 'hk-btn danger', '[ FLATLINE ]'); del.type = 'button';
    del.onclick = () => { if (confirm(`flatline "${t.title}"?`)) { close(); onDelete(t.id); } };
    acts.appendChild(del);
  }
  form.appendChild(acts);

  form.onsubmit = (e) => {
    e.preventDefault();
    const title = form.querySelector('#dTitle').value.trim();
    if (!title) return;
    const k = form.querySelector('#dKind').value;
    const date = form.querySelector('#dDate').value || null;
    const end = form.querySelector('#dEnd').value || null;
    const t0 = form.querySelector('#dT0').value || null;
    const t1 = form.querySelector('#dT1').value || null;
    const rem = form.querySelector('#dRem').value || null;
    if (!date && (k === 'timed' || k === 'allday' || k === 'range')) { alert('this kind needs a date.'); return; }
    if (k === 'range' && (!date || !end)) { alert('a long con needs start + end.'); return; }
    if (date && end && end < date) { alert('end < start. rejected by the street.'); return; }
    const out = { id: t.id, title, color, completions: t.completions || {} };
    if (t.source) out.source = t.source;
    if (t.gcalUid) out.gcalUid = t.gcalUid;
    if (rem) out.remindTime = rem;
    if (k === 'timed') { out.type = 'once'; out.date = date; if (t0) out.timeStart = t0; if (t1) out.timeEnd = t1; }
    if (k === 'allday') { out.type = 'once'; out.date = date; }
    if (k === 'range') { out.type = 'range'; out.startDate = date; out.endDate = end; }
    if (k === 'daily') { out.type = 'daily'; if (date) out.startDate = date; if (end) out.endDate = end; }
    close(); onSave(out);
  };

  function close() { root.innerHTML = ''; document.removeEventListener('keydown', esc2); }
  function esc2(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', esc2);
  veil.onclick = (e) => { if (e.target === veil) close(); };
  box.appendChild(form); veil.appendChild(box); root.appendChild(veil);
  setTimeout(() => form.querySelector('#dTitle').focus(), 30);
}
