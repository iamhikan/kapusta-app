// «Здоровье»: ответ /api/health -> что видит человек. Только строки и доли; цифры считает сервер (fin api), страница
// их не пересчитывает и не фильтрует: что видит зритель, решает сервер.

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь',
  'Ноябрь', 'Декабрь'];
const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const SYMBOL = { EUR: '€', RUB: '₽' };
const ZONE = { ok: 'good', savings: 'warn', over: 'bad' };
export const TOP = 6;   // лимитов сразу; остальные — по «Все N»

export function fmt(n) {
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + s;
}

export function amounts(obj) {
  const order = Object.keys(obj).sort((a, b) => (a !== 'RSD') - (b !== 'RSD') || a.localeCompare(b));
  return order.map((cur) => `${fmt(obj[cur])} ${SYMBOL[cur] || cur}`).join(' · ');
}

export function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function when(stamp) {
  // «2026-11-11 08:11» (время записи ботом) или «2026-11-11» -> «11.11 в 08:11» / «11.11»
  const [day, time] = String(stamp).split(/[ T]/);
  const [, m, d] = day.split('-');
  return `${d}.${m}` + (time ? ` в ${time.slice(0, 5)}` : '');
}

function limitColor(share, plan) {
  if (share > 1) return 'var(--bad)';
  if (share <= plan) return 'var(--good)';
  const warm = Math.round(((share - plan) / (1 - plan)) * 100);
  return `color-mix(in oklch, var(--warn) ${warm}%, var(--good))`;  // через жёлтый, без серой середины
}

function curveNote(h) {
  if (h.closed) {
    const crossed = h.curve.find(([, total]) => total > h.norm);
    if (!crossed) return { text: `итог ${fmt(h.spent)} · в пределах нормы`, tone: 'good' };
    return { text: `итог ${fmt(h.spent)} · норма кончилась ${crossed[0]} ${OF_MONTH[Number(h.month.slice(5)) - 1]}`,
      tone: 'bad' };
  }
  if (h.spent > h.norm) return { text: `сверх нормы на ${fmt(h.spent - h.norm)}`, tone: 'bad' };
  if (h.forecast > h.norm) return { text: `прогноз ${fmt(h.forecast)} · выше нормы на ${fmt(h.forecast - h.norm)}`, tone: 'warn' };
  return { text: `прогноз ${fmt(h.forecast)} · в пределах нормы`, tone: 'good' };
}

export function view(h) {
  const [y, m] = h.month.split('-').map(Number);
  const plan = h.closed ? 1 : h.day / h.days;
  const over = h.left < 0;
  const overCount = h.limits.filter((l) => l.spent > l.limit).length;

  const first = h.closed
    ? { label: 'Вне лимитов', value: fmt(h.outside.reduce((s, o) => s + o.rsd, 0)), tone: '' }
    : { label: 'Можно в день', value: h.per_day == null ? 'норма исчерпана' : `~${fmt(h.per_day)}`,
      tone: h.per_day == null ? 'bad' : '' };
  // «Весь доход» сервер шлёт только Алексею (решение 11); без него — сколько лимитов сверх
  const second = h.available
    ? (h.available.left >= 0
      ? { label: 'Весь доход, осталось', value: fmt(h.available.left), tone: '' }
      : { label: 'Сверх дохода', value: fmt(-h.available.left), tone: 'bad' })
    : { label: 'Лимитов сверх', value: `${overCount} из ${h.limits.length}`, tone: overCount ? 'bad' : 'good' };

  return {
    title: `${MONTHS[m - 1]} ${y}`,
    sub: h.closed ? 'итог месяца' : `на ${h.day} ${OF_MONTH[m - 1]}, день ${h.day} из ${h.days}`,
    zone: { word: h.zone.word, tone: ZONE[h.zone.status] },
    big: over ? { label: 'Сверх нормы', value: fmt(-h.left), tone: 'bad' }
      : { label: 'Осталось из нормы', value: fmt(h.left), tone: '' },
    bar: { fill: h.norm > 0 ? Math.max(0, Math.min(1, h.spent / h.norm)) : 1,
      plan: h.closed || !h.norm ? null : h.plan_today / h.norm },
    scale: [`потрачено ${fmt(h.spent)}`,
      h.closed ? `${Math.round((h.spent / h.norm) * 100)} % нормы` : `план на сегодня ${fmt(h.plan_today)}`,
      `норма ${fmt(h.norm)}`],
    stats: [first, second],
    curve: { note: curveNote(h) },
    plan,
    limits: h.limits.map((l) => {
      const share = l.limit ? l.spent / l.limit : 0;
      return { name: l.name, spent: fmt(l.spent), limit: fmt(l.limit), over: l.over ? `+${fmt(l.over)}` : '',
        fill: Math.max(0, Math.min(1, share)), color: limitColor(share, plan) };
    }),
    limitsShown: Math.min(TOP, h.limits.length),
    outside: h.outside.map((o) => ({ name: o.name, value: fmt(o.rsd) })),
    balances: h.balances.map((b) => ({ name: upper(b.name), value: b.later ? 'остаток — позже' : amounts(b.amounts),
      later: !!b.later })),
    empty: h.empty.length ? `Пустые счета: ${h.empty.join(', ')}.` : '',
    balTitle: h.closed ? `Остатки на ${when(h.date)}` : 'Остатки',
    fresh: h.closed ? `месяц закрыт · последняя запись ${when(h.fresh.last)}`
      : `последняя запись ${when(h.fresh.last)} · обновлено в ${h.fresh.now.slice(11, 16)}`,
    canNext: h.closed,
  };
}
