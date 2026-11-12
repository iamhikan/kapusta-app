// «Здоровье»: ответ /api/health -> что видит человек. Только строки и доли; цифры считает сервер (fin api), страница
// их не пересчитывает и не фильтрует: что видит зритель, решает сервер.
import { tileOf } from './tiles.js';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь',
  'Ноябрь', 'Декабрь'];
const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const SYMBOL = { EUR: '€', RUB: '₽' };
const FOR_MONTH = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь',
  'ноябрь', 'декабрь'];
const ZONE = { ok: 'good', fast: 'fast', savings: 'warn', over: 'bad' };   // fast — выше плана на сегодня (решение 46)
// решение 50: «тратим быстрее плана» шлёт сервер; прежний сервер (и снимок до p14a) — «быстрее плана»
const OLD_WORD = { 'быстрее плана': 'тратим быстрее плана' };
// решение 49: легенда цветов полосок — одной строкой у «Лимиты»; цвета — те же, что у limitColor
const LEGEND = [{ text: 'в плане', color: 'var(--bar-green)' },
  { text: 'выше плана', color: 'linear-gradient(90deg, var(--bar-yellow), var(--bar-orange))' },
  { text: 'сверх лимита', color: 'var(--bad)' }];
const LEGEND_CLOSED = [{ text: 'в лимите', color: 'var(--bar-green)' }, { text: 'сверх лимита', color: 'var(--bad)' }];
export const TOP = 6;   // лимитов сразу; остальные — по «Все N»
// группы остатков (решение 48), порядок показа; прежний сервер без group — одна группа без заголовка
const GROUPS = [['cash', 'Наличные'], ['cards', 'Карты и счета'], ['business', 'Бизнес'], ['debts', 'Долги']];

export function fmt(n) {
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + s;
}

export function amountLines(obj) {
  // динары первыми, остальные валюты — по алфавиту: «150 000 RSD», «1 000 €»
  const order = Object.keys(obj).sort((a, b) => (a !== 'RSD') - (b !== 'RSD') || a.localeCompare(b));
  return order.map((cur) => `${fmt(obj[cur])} ${SYMBOL[cur] || cur}`);
}

export const amounts = (obj) => amountLines(obj).join(' · ');

function balanceGroups(balances) {
  // решения 47, 48: строка — плитка, имя, суммы в две строки; группы по типу, у прежнего сервера — одна без заголовка
  const row = (b) => ({ name: upper(b.name), lines: amountLines(b.amounts || {}), tile: tileOf(b.account, b.name),
    ops: { account: b.account } });
  if (!balances.some((b) => b.group)) return balances.length ? [{ title: '', rows: balances.map(row) }] : [];
  return GROUPS.map(([key, title]) => ({ title, rows: balances.filter((b) => (b.group || 'cards') === key).map(row) }))
    .filter((g) => g.rows.length);
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
  // полоска: до плана на сегодня — зелёная, выше — от жёлтого к оранжевому у лимита, сверх — красная
  if (share > 1) return 'var(--bad)';
  if (share <= plan) return 'var(--bar-green)';
  const warm = Math.round(((share - plan) / (1 - plan)) * 100);
  return `color-mix(in oklch, var(--bar-orange) ${warm}%, var(--bar-yellow))`;
}

function limitState(share, plan, closed) {
  // те же пороги, что у цвета полоски, — словами для диктора (фаза 12); итог месяца — без плана на сегодня
  if (share > 1) return 'сверх лимита';
  if (closed) return 'в лимите';
  return share <= plan ? 'в плане' : 'выше плана';
}

function reserveNote(limits) {
  // резерв сжимается на перерасход других лимитов (fin budget): из чего он и чей перерасход покрыл (решения 28, 51)
  const res = limits.find((l) => l.eaten);
  if (!res) return '';
  const over = limits.filter((l) => l.over > 0 && l !== res);
  // частично — только когда резерв кончился: суммы с сервера округлены по одной и могут разойтись на 1 (critique 12.11)
  const partial = res.spent >= res.limit && over.reduce((s, l) => s + l.over, 0) > res.eaten;
  return `Резерв: свои ${fmt(res.spent - res.eaten)} + перерасход других ${fmt(res.eaten)} — покрыл `
    + `${over.map((l) => `«${l.name}»`).join(', ')}${partial ? ' частично' : ''}.`;
}

function curveNote(h) {
  if (h.closed) {
    if (!h.curve.length) {   // кривая отрезана в снимке (решение 32) — по итогу
      return h.spent > h.norm ? { text: `итог ${fmt(h.spent)} · сверх нормы на ${fmt(h.spent - h.norm)}`, tone: 'bad' }
        : { text: `итог ${fmt(h.spent)} · в пределах нормы`, tone: 'good' };
    }
    const crossed = h.curve.find(([, total]) => total > h.norm);
    if (!crossed) return { text: `итог ${fmt(h.spent)} · в пределах нормы`, tone: 'good' };
    return { text: `итог ${fmt(h.spent)} · норма кончилась ${crossed[0]} ${OF_MONTH[Number(h.month.slice(5)) - 1]}`,
      tone: 'bad' };
  }
  if (h.spent > h.norm) return { text: `сверх нормы на ${fmt(h.spent - h.norm)}`, tone: 'bad' };
  if (h.forecast > h.norm) return { text: `прогноз ${fmt(h.forecast)} · выше нормы на ${fmt(h.forecast - h.norm)}`, tone: 'warn' };
  return { text: `прогноз ${fmt(h.forecast)} · в пределах нормы`, tone: 'good' };
}

function scaleOf(h) {
  // решение 49: под полоской — доля нормы; план на сегодня — подписью у черты. Норма — уже в «из N» у крупного числа
  // доля — у «Потрачено» коротко («Потрачено · 50 %»): рядом плашка, «из N» — строкой ниже
  const pct = `${Math.round((h.spent / h.norm) * 100)} %`;
  const plan = h.closed || !h.norm ? '' : `план на сегодня ${fmt(h.plan_today)}`;
  return { pct, plan, aria: [`${pct} нормы`, plan].filter(Boolean).join(', ') };
}

export function view(h) {
  const [y, m] = h.month.split('-').map(Number);
  const plan = h.closed ? 1 : h.day / h.days;
  const over = h.left < 0;
  const overCount = h.limits.filter((l) => l.spent > l.limit).length;

  // решение 26: крупно — потрачено; осталось (или сверх нормы) — первым в строке чисел
  const left = over ? { label: 'Сверх нормы', value: fmt(-h.left), tone: 'bad' }
    : { label: 'Осталось из нормы', value: fmt(h.left), tone: '' };
  const first = h.closed
    ? { label: 'Регулярные', value: fmt(h.regular), tone: '' }   // решение 44: «Вне лимитов» нет
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
    zone: { word: OLD_WORD[h.zone.word] || h.zone.word, tone: ZONE[h.zone.status] },
    big: { label: 'Потрачено', value: fmt(h.spent), of: `из ${fmt(h.norm)}`, tone: over ? 'bad' : '' },
    bar: { fill: h.norm > 0 ? Math.max(0, Math.min(1, h.spent / h.norm)) : 1,
      plan: h.closed || !h.norm ? null : h.plan_today / h.norm },
    scale: scaleOf(h),
    stats: [left, first, second],
    curve: { note: curveNote(h), chart: h.curve.length > 0 },
    plan,
    limits: h.limits.map((l) => {
      const share = l.limit ? l.spent / l.limit : 0;
      const row = { name: l.name, ops: { limit: l.name }, spent: fmt(l.spent), limit: fmt(l.limit), over: l.over ? `+${fmt(l.over)}` : '',
        fill: Math.max(0, Math.min(1, share)), color: limitColor(share, plan), state: limitState(share, plan, h.closed) };
      // резерв: операции перерасхода других лимитов, в шапке — чей перерасход и сколько покрыто (решение 51)
      if (l.eaten) row.note = `перерасход ${h.limits.filter((x) => x.over > 0 && x !== l).map((x) => `«${x.name}»`).join(', ')}`
        + ` · резерв покрыл ${fmt(l.eaten)}`;
      return row;
    }),
    limitsShown: Math.min(TOP, h.limits.length),
    legend: h.closed ? LEGEND_CLOSED : LEGEND,
    reserve: reserveNote(h.limits),
    // решение 40: скрытые лимиты (show: hot) — отдельной кнопкой; дошли до порога — уже в общем списке (сервер)
    hidden: h.hidden && h.hidden.length ? { label: `Скрытые лимиты · ${h.hidden.length}`,
      rows: h.hidden.map((l) => ({ name: l.name, spent: fmt(l.spent), limit: fmt(l.limit), ops: { limit: l.name },
        fill: l.limit ? Math.max(0, Math.min(1, l.spent / l.limit)) : 0, hint: `в градуснике — от ${l.hot} % лимита` })) }
      : null,
    budgetLabel: `Весь бюджет на ${FOR_MONTH[m - 1]}`,
    // решение 38: строка остатка открывает операции этого счёта за месяц; счета — в фильтр «Операций»
    groups: balanceGroups(h.balances),
    // решение 60: «сейчас» — у текущего месяца; у закрытого дата — в заголовке «Остатки на 31.10»
    balTotal: h.balances_total == null ? '' : `наличные и карты${h.closed ? '' : ' сейчас'} ≈ ${fmt(h.balances_total)} RSD`,
    accounts: h.balances.map((b) => [b.name, b.account]),
    empty: h.empty.length ? `Пустые счета: ${h.empty.join(', ')}.` : '',
    balTitle: h.closed ? `Остатки на ${when(h.date)}` : 'Остатки',
    fresh: h.closed ? `месяц закрыт · последняя запись ${when(h.fresh.last)}`
      : `последняя запись ${when(h.fresh.last)} · обновлено в ${h.fresh.now.slice(11, 16)}`,
    canNext: h.closed,
  };
}
