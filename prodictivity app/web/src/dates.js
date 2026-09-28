// date helpers — weeks start Monday (street samurai discipline)
export const p2 = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const todayISO = () => iso(new Date());
export function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function addDaysISO(s, n) { return iso(addDays(parseISO(s), n)); }
export function mondayOf(d) { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0,0,0,0); return x; }
export const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEPT','OCT','NOV','DEC'];
export const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const DOW = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
export const mins = (hm) => { const [h, m] = (hm || '00:00').split(':').map(Number); return h * 60 + m; };
export const hm = (m) => `${p2(Math.floor(m / 60))}:${p2(Math.round(m % 60))}`;
export const nowHM = () => { const n = new Date(); return `${p2(n.getHours())}:${p2(n.getMinutes())}`; };
export function nowLocalMinute() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
export function fmtDayLong(s) {
  const d = parseISO(s);
  return `${DOW[(d.getDay() + 6) % 7]} ${MONTHS_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
