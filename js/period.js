// Периоды «Категорий» и операций категории (спека, «Периоды»): неделя с понедельника, месяц, квартал, год, свой.
// Даты — строки ГГГГ-ММ-ДД, счёт — в UTC: часовой пояс телефона дни не сдвигает.

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь',
  'Ноябрь', 'Декабрь'];
const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const ROMAN = ['I', 'II', 'III', 'IV'];
const LENGTH = { month: 1, quarter: 3, year: 12 };
export const KINDS = [['week', 'Неделя'], ['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год'], ['custom', 'Свой']];

const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (s, n) => { const dt = parse(s); dt.setUTCDate(dt.getUTCDate() + n); return iso(dt); };
const ymd = (s) => s.split('-').map(Number);
const monthStart = (y, m) => iso(new Date(Date.UTC(y, m - 1, 1)));       // m может выйти за 1–12
const monthEnd = (y, m) => iso(new Date(Date.UTC(y, m, 0)));

export function periodOf(kind, anchor, to = null) {
  const [y, m] = ymd(anchor);
  if (kind === 'week') {
    const from = addDays(anchor, -((parse(anchor).getUTCDay() + 6) % 7));
    return { kind, from, to: addDays(from, 6) };
  }
  if (kind === 'month') return { kind, from: monthStart(y, m), to: monthEnd(y, m) };
  if (kind === 'quarter') {
    const q = Math.floor((m - 1) / 3) * 3 + 1;
    return { kind, from: monthStart(y, q), to: monthEnd(y, q + 2) };
  }
  if (kind === 'year') return { kind, from: `${y}-01-01`, to: `${y}-12-31` };
  return { kind: 'custom', from: anchor, to: to || anchor };
}

export function shiftPeriod(p, dir) {
  if (p.kind in LENGTH) {
    const [y, m] = ymd(p.from);
    return periodOf(p.kind, monthStart(y, m + dir * LENGTH[p.kind]));
  }
  const days = Math.round((parse(p.to) - parse(p.from)) / 864e5) + 1;
  return { kind: p.kind, from: addDays(p.from, dir * days), to: addDays(p.to, dir * days) };
}

export const canNext = (p, today) => shiftPeriod(p, 1).from <= today;
export const periodEnd = (p, today) => (p.to < today ? p.to : today);

export function rangeText(from, to) {
  // «1–11 ноября», «11 ноября», «1 октября — 11 ноября», через год — с годами
  const [y1, m1, d1] = ymd(from);
  const [y2, m2, d2] = ymd(to);
  if (from === to) return `${d1} ${OF_MONTH[m1 - 1]}`;
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${OF_MONTH[m1 - 1]}`;
  if (y1 === y2) return `${d1} ${OF_MONTH[m1 - 1]} — ${d2} ${OF_MONTH[m2 - 1]}`;
  return `${d1} ${OF_MONTH[m1 - 1]} ${y1} — ${d2} ${OF_MONTH[m2 - 1]} ${y2}`;
}

export function periodTitle(p) {
  const [y, m] = ymd(p.from);
  if (p.kind === 'month') return `${MONTHS[m - 1]} ${y}`;
  if (p.kind === 'quarter') return `${ROMAN[Math.floor((m - 1) / 3)]} квартал ${y}`;
  if (p.kind === 'year') return `${y} год`;
  const text = rangeText(p.from, p.to);
  return p.from.slice(0, 4) === p.to.slice(0, 4) ? `${text} ${y}` : text;
}

// Название периода в середине фразы («За ноябрь 2026 трат нет»): месяц — строчной буквой, остальное — как в названии
export function periodInText(p) {
  const title = periodTitle(p);
  return p.kind === 'month' ? title.toLowerCase() : title;
}

// Прошлый период словами: год — если он не год текущего периода («к 1 января — 12 ноября 2025»); у периода через
// Новый год годы и так есть
export function prevText(prev, from) {
  const text = rangeText(prev.from, prev.to);
  const y = prev.from.slice(0, 4);
  return y === prev.to.slice(0, 4) && y !== from.slice(0, 4) ? `${text} ${y}` : text;
}

export function periodSub(p, today, prev) {
  const days = rangeText(p.from, periodEnd(p, today));
  return prev ? `${days}, к ${prevText(prev, p.from)}` : days;
}

export function barsRange(p) {
  // столбцы по месяцам: у года — его 12 месяцев, иначе 7 месяцев по месяц конца периода
  const [y, m] = ymd(p.to);
  if (p.kind === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` };
  return { from: monthStart(y, m - 6), to: monthEnd(y, m) };
}

export function isPeriod(p) {
  return !!p && KINDS.some(([k]) => k === p.kind) && /^\d{4}-\d\d-\d\d$/.test(p.from) && /^\d{4}-\d\d-\d\d$/.test(p.to)
    && p.from <= p.to;
}
