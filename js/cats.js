// «Категории»: ответы /api/categories и /api/series -> что видит человек. Суммы, доли, лимит периода и прошлый период
// считает сервер (fin api); страница раскладывает кольцо, список и столбцы. Цвет закреплён за категорией (спека, «Графики»).
import { fmt } from './health.js';
import { dayLabel, money } from './ops.js';
import { rangeText } from './period.js';

export const OTHER = '#a1a1a6';     // «прочее» — серый на любой теме
const COLORS = {
  'Expenses:Family:Food': '#2481cc', 'Expenses:Family:Travel': '#e8833a', 'Expenses:Family:Gifts': '#9b59b6',
  'Expenses:Family:Household': '#2a9d8f', 'Expenses:Family:Pets': '#d4a400', 'Expenses:Family:Health': '#5aa84f',
  'Expenses:Family:Restaurants': '#e05a8a', 'Expenses:Family:Clothes': '#5e60ce', 'Expenses:Family:Rent': '#8d6e63',
  'Expenses:Family:CashSpent': '#607d8b', 'Expenses:Family:Outings': '#00a6c8', 'Expenses:Family:Delivery': '#c0392b',
  'Expenses:Family:Pharmacy': '#7cb342', 'Expenses:Family:Education': '#ad1457', 'Expenses:Family:FX': '#a1887f',
  'Expenses:Family:Entertainment': '#f4511e', 'Expenses:Family:Beauty': '#ec407a', 'Expenses:Family:Transport': '#00897b',
  'Expenses:Family:Car': '#455a64', 'Expenses:Family:Home': '#6d4c41', 'Expenses:Family:Electronics': '#3949ab',
  'Expenses:Family:Sport': '#43a047', 'Expenses:Family:Subscriptions': '#8e24aa', 'Expenses:Family:Utilities': '#795548',
  'Expenses:Angelina:PR': '#c2185b', 'Expenses:Family:Other': OTHER,
};
const SPARE = ['#1e88e5', '#fb8c00', '#8e24aa', '#00acc1', '#7cb342', '#e53935', '#5e35b1', '#c0ca33', '#6d4c41'];
const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const NAMES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь',
  'декабрь'];
const SHADES = [100, 80, 66, 54, 44, 36, 28, 20];
const DONUT = 7;
export const R = 56;                // радиус кольца в SVG 150×150

export function colorOf(key) {
  if (COLORS[key]) return COLORS[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return SPARE[hash % SPARE.length];
}

const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const signed = (n) => (Math.round(n) > 0 ? `+${fmt(n)}` : fmt(n));
const tone = (n) => (Math.round(n) > 0 ? 'warn' : Math.round(n) < 0 ? 'good' : '');   // больше трат — оранжевый
const short = (iso) => `${iso.slice(8)}.${iso.slice(5, 7)}`.replace(/^0/, '');

function limitText(l) {
  // свой лимит — в строке; общий (рестораны в «еда вне дома») — в шапке подкатегорий: в строку не помещается
  return l && l.own ? `лимит ${fmt(l.limit)}` : '';
}

function head(body) {
  const l = body.limit;
  const over = l && l.spent > l.limit;
  const fill = !l ? null : l.limit > 0 ? Math.min(1, l.spent / l.limit) : 1;
  return {
    title: upper(body.name || ''), sum: fmt(body.total), fill, tone: over ? 'bad' : '',
    note: !l ? '' : l.own ? (over ? `сверх лимита ${fmt(l.spent - l.limit)}` : `из лимита ${fmt(l.limit)}`)
      : `лимит «${l.name}»: ${fmt(l.spent)} из ${fmt(l.limit)}`,
  };
}

export function catsView(body) {
  const sub = !!body.cat;
  const base = sub ? colorOf(body.cat) : null;
  const rows = body.cats.map((c, i) => ({
    key: c.key, name: c.name, sum: fmt(c.rsd), share: `${Math.round(c.share * 100)} %`,
    delta: c.prev == null ? '' : signed(c.rsd - c.prev), deltaTone: c.prev == null ? '' : tone(c.rsd - c.prev),
    color: sub ? `color-mix(in srgb, ${base} ${SHADES[Math.min(i, SHADES.length - 1)]}%, var(--track))` : colorOf(c.key),
    limit: sub ? '' : limitText(c.limit), exact: !!c.exact,
  }));
  // кольцо: 7 самых больших и «прочее»; минусовые (возвраты больше трат) — только в списке
  const plus = body.cats.map((c, i) => ({ ...c, color: rows[i].color })).filter((c) => c.rsd > 0);
  const parts = plus.slice(0, DONUT);
  const rest = plus.slice(DONUT).reduce((s, c) => s + c.rsd, 0);
  if (rest > 0) parts.push({ name: 'прочее', rsd: rest, color: OTHER });
  const whole = parts.reduce((s, c) => s + c.rsd, 0) || 1;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const segments = parts.map((c) => {
    const len = (c.rsd / whole) * C;
    const dash = Math.max(0, len - (parts.length > 1 ? 2 : 0));
    const seg = { name: c.name, color: c.color, dash: `${dash.toFixed(2)} ${(C - dash).toFixed(2)}`, offset: (-acc).toFixed(2) };
    acc += len;
    return seg;
  });
  const prev = body.prev;
  const out = {
    total: fmt(body.total), rows, segments,
    aria: `Траты: ${parts.map((c) => `${c.name} ${fmt(c.rsd)}`).join(', ')}`,
    cmp: prev ? { label: `к ${rangeText(prev.from, prev.to)}`, value: signed(body.total - prev.total),
      tone: tone(body.total - prev.total), sub: `было ${fmt(prev.total)}` } : null,
    cmpHead: prev ? `к ${prev.from === prev.to ? short(prev.from) : `${Number(prev.from.slice(8))}–${short(prev.to)}`}` : '',
    empty: !body.cats.length,
  };
  if (sub) {
    out.head = head(body);
    out.top = (body.top || []).map((o) => ({ ref: o.ref, where: o.where,
      sub: [dayLabel(o.date), (o.cats || []).join(', ')].filter(Boolean).join(' · '), amount: money(o.rsd) }));
  }
  return out;
}

export const BARS = { width: 330, height: 160, top: 18, bottom: 138 };

export function barsView(s) {
  const pts = s.points;
  const max = Math.max(1, ...pts.map((p) => p.rsd), ...pts.map((p) => p.norm || 0)) * 1.08;
  const step = BARS.width / Math.max(pts.length, 1);
  const w = Math.min(30, step * 0.66);
  const y = (v) => +(BARS.bottom - (Math.max(0, v) / max) * (BARS.bottom - BARS.top)).toFixed(1);
  const bars = pts.map((p, i) => {
    const m = Number(p.from.slice(5, 7)) - 1;
    const x = +(i * step + (step - w) / 2).toFixed(1);
    return { m: SHORT[m], v: String(Math.round(p.rsd / 1000)), x, w: +w.toFixed(1), cx: +(x + w / 2).toFixed(1),
      y: y(p.rsd), h: +(BARS.bottom - y(p.rsd)).toFixed(1), partial: p.partial, normY: p.norm == null ? null : y(p.norm) };
  });
  const norm = pts.some((p) => p.norm != null);
  return {
    bars,
    note: `${s.scope === 'scale' ? 'шкала градусника' : 'все траты'}, тыс. RSD${norm ? ' · черта — норма' : ''}`,
    aria: `Траты по месяцам, тысяч RSD: ${pts.map((p, i) => `${NAMES[Number(p.from.slice(5, 7)) - 1]} ${bars[i].v}`
      + (p.partial ? ' на сегодня' : '')).join(', ')}`,
  };
}
