// «Категории»: ответы /api/categories и /api/series -> что видит человек. Суммы, доли, лимит периода и прошлый период
// считает сервер (fin api); страница раскладывает полосу долей, список и столбцы. Цвет закреплён за категорией (спека, «Графики»).
import { fmt } from './health.js';
import { dayLabel, money } from './ops.js';
import { prevText } from './period.js';

export const OTHER = '#a1a1a6';     // «прочее» — серый на любой теме
const COLORS = {
  'Expenses:Family:Food': '#2481cc', 'Expenses:Family:Travel': '#e8833a', 'Expenses:Family:Gifts': '#9b59b6',
  'Expenses:Family:Household': '#2a9d8f', 'Expenses:Family:Pets': '#d4a400', 'Expenses:Family:Health': '#5aa84f',
  'Expenses:Family:Restaurants': '#e05a8a', 'Expenses:Family:Clothes': '#5e60ce', 'Expenses:Family:Rent': '#8d6e63',
  'Expenses:Family:CashSpent': '#607d8b', 'Expenses:Family:Outings': '#00a6c8', 'Expenses:Family:Delivery': '#c0392b',
  'Expenses:Family:Pharmacy': '#7cb342', 'Expenses:Family:Education': '#ad1457', 'Expenses:Family:FX': '#a1887f',
  'Expenses:Family:Entertainment': '#f4511e', 'Expenses:Family:Beauty': '#ec407a', 'Expenses:Family:Transport': '#827717',
  'Expenses:Family:Car': '#455a64', 'Expenses:Family:Home': '#6d4c41', 'Expenses:Family:Electronics': '#3949ab',
  'Expenses:Family:Sport': '#43a047', 'Expenses:Family:Subscriptions': '#8e24aa', 'Expenses:Family:Utilities': '#795548',
  'Expenses:Angelina:PR': '#c2185b', 'Expenses:Family:Other': OTHER,
};
const SPARE = ['#1e88e5', '#fb8c00', '#8e24aa', '#00acc1', '#7cb342', '#e53935', '#5e35b1', '#c0ca33', '#6d4c41'];
const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const NAMES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь',
  'декабрь'];
const SHADES = [100, 80, 66, 54, 44, 36, 28, 20];
const STRIP = 5;                    // полоса долей: 5 самых больших и «ещё N» (правка 2; было кольцо: 7 и «прочее»)

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

function cmpHead(prev, from) {
  // столбец узкий: «к 11.11», «к 1–11.10», через месяц — «к 1.07–12.08», у года — «к 2025» (долг 12.11)
  const y = prev.from.slice(0, 4);
  if (from.endsWith('-01-01') && prev.from === `${y}-01-01` && prev.to.startsWith(y) && !from.startsWith(y)) return `к ${y}`;
  if (prev.from === prev.to) return `к ${short(prev.from)}`;
  if (prev.from.slice(0, 7) === prev.to.slice(0, 7)) return `к ${Number(prev.from.slice(8))}–${short(prev.to)}`;
  return `к ${short(prev.from)}–${short(prev.to)}`;
}

function limitText(l, name) {
  // свой лимит (и общий с тем же именем: «транспорт» с машиной) — «лимит N»; общий под другим именем — чей он
  // (Алексей 12.11: «хозяйство» на «Категориях» и «дом и хозяйство» на «Здоровье» — одна сумма, разные имена)
  if (!l) return '';
  return mine(l, name) ? `лимит ${fmt(l.limit)}` : `в лимите «${l.name}»`;
}

const mine = (l, name) => !!l && (l.own || l.name === name);

// полоска к своему лимиту — как на «Здоровье» (правка 2): сверх — до потраченного, лимит — метка (limitAt).
// Цвет — категории: «в плане / выше плана» у недели, квартала, года не считается
function barOf(l, color) {
  if (!(l.limit > 0)) return { fill: l.spent > 0 ? 1 : 0, limitAt: null, color };
  const share = l.spent / l.limit;
  return share > 1 ? { fill: l.limit / l.spent, limitAt: l.limit / l.spent, color } : { fill: Math.max(0, share), limitAt: null, color };
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
    limit: sub ? '' : limitText(c.limit, c.name), exact: !!c.exact,
    bar: !sub && mine(c.limit, c.name) ? barOf(c.limit, colorOf(c.key)) : null,
    of: !sub && mine(c.limit, c.name) ? `из ${fmt(c.limit.limit)}` : '',
  }));
  // полоса долей (правка 2): 5 самых больших и «ещё N»; минусовые (возвраты больше трат) — только в списке
  const plus = body.cats.map((c, i) => ({ ...c, color: rows[i].color })).filter((c) => c.rsd > 0);
  const many = plus.length > STRIP + 1;
  const parts = many ? plus.slice(0, STRIP) : plus;
  const others = many ? plus.slice(STRIP) : [];
  const rest = others.reduce((s, c) => s + c.rsd, 0);
  const whole = parts.reduce((s, c) => s + c.rsd, 0) + rest || 1;
  const part = (name, rsd, color) => ({ name, color, share: rsd / whole, pct: `${Math.round((rsd / whole) * 100)} %` });
  const strip = parts.map((c) => part(c.name, c.rsd, c.color));
  if (rest > 0) strip.push(part(`ещё ${others.length}`, rest, OTHER));
  const prev = body.prev;
  const out = {
    total: fmt(body.total), rows, strip,
    aria: `Траты: ${[...parts.map((c) => `${c.name} ${fmt(c.rsd)}`), rest > 0 ? `прочее ${fmt(rest)}` : null].filter(Boolean).join(', ')}`,
    cmp: prev ? { label: `к ${prevText(prev, body.from)}`, value: signed(body.total - prev.total),
      tone: tone(body.total - prev.total), sub: `было ${fmt(prev.total)}` } : null,
    cmpHead: prev ? cmpHead(prev, body.from) : '',
    rowClass: prev ? 'cat-row' : 'cat-row no-cmp',     // без сравнения (до начала учёта) — без колонки «к …»
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
    note: `${s.scope === 'scale' ? 'в лимитах' : 'все траты'}, тыс. RSD${norm ? ' · черта — норма' : ''}`,
    aria: `Траты по месяцам, тысяч RSD: ${pts.map((p, i) => `${NAMES[Number(p.from.slice(5, 7)) - 1]} ${bars[i].v}`
      + (p.partial ? ' на сегодня' : '')).join(', ')}`,
  };
}
