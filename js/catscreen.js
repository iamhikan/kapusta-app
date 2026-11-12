// Экран «Категории» (DOM): период, кольцо 7 + «прочее», список, «В лимитах / Все траты», столбцы по месяцам;
// тап — подкатегории, затем операции категории за период. Данные — только из /api/categories и /api/series, в памяти.
import { h, icon, tap, ICONS } from './dom.js';
import { barsView, BARS, catsView, R } from './cats.js';
import { barsRange, canNext, KINDS, periodEnd, periodOf, periodSub, periodTitle, shiftPeriod } from './period.js';
import { DIALOG, newOps, offlineBody, stepKey, TITLE } from './screens.js';

const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function newCats(period, cat = null, title = '', scope = 'all') {
  return { kind: 'cats', period, cat, title, scope, data: null, bars: null, error: null, sheet: false, scroll: 0 };
}

export async function loadCats(entry, nav) {
  const mine = (entry.seq = (entry.seq || 0) + 1);
  entry.data = null;
  entry.error = null;
  nav.render();
  const p = entry.period;
  const q = new URLSearchParams({ from: p.from, to: p.to, scope: entry.scope, compare: 'prev' });
  if (entry.cat) q.set('cat', entry.cat);
  const range = barsRange(p);
  const [r, s] = await Promise.all([nav.get(`/api/categories?${q}`), entry.cat ? null
    : nav.get(`/api/series?${new URLSearchParams({ ...range, by: 'month', scope: entry.scope })}`)]);
  if (mine !== entry.seq) return;
  if (r.error === 'stale' || r.error === 'stranger') return nav.problem(r.error);
  if (r.error) entry.error = r.detail || r.error;
  else entry.data = r.data;
  // подкатегории по ссылке «Открыть в Капусте» (решение 74): имени строки нет — имя категории из ответа
  if (entry.cat && !entry.title && entry.data && entry.data.name) entry.title = entry.data.name;
  entry.bars = s && s.data ? s.data : null;
  nav.render();
}

function move(entry, nav, p) {
  tap();
  entry.period = p;
  if (!entry.cat) nav.savePeriod(p);
  loadCats(entry, nav);
}

function periodHead(entry, nav, sub) {
  const today = nav.today();
  const arrow = (dir, label, d, enabled = true) => h('button', { class: 'arrow', type: 'button', 'aria-label': label,
    disabled: !enabled, ...stepKey(dir), on: { click: () => move(entry, nav, shiftPeriod(entry.period, dir)) } }, icon(d));
  return h('header', { class: 'month' }, arrow(-1, 'Прошлый период', ICONS.left),
    h('div', { class: 'month-title' }, h('h1', TITLE, entry.cat ? upper(entry.title) : periodTitle(entry.period)),
      h('p', { class: 'muted small' }, entry.cat ? `${periodTitle(entry.period)} · ${sub}` : sub)),
    arrow(1, 'Следующий период', ICONS.right, canNext(entry.period, today)));
}

function chips(entry, nav) {
  const today = nav.today();
  const anchor = entry.period.from <= today && today <= entry.period.to ? today : periodEnd(entry.period, today);
  return h('div', { class: 'chips periods' }, ...KINDS.map(([kind, label]) => h('button', { type: 'button',
    class: `chip-btn${entry.period.kind === kind ? ' on' : ''}`, 'aria-pressed': String(entry.period.kind === kind),
    'data-focus': `period:${kind}`, on: { click: () => {
      if (kind === 'custom') {
        tap(); entry.sheet = true; entry.draft = { from: entry.period.from, to: periodEnd(entry.period, today) };
        nav.focus('sheet');
        return nav.render();
      }
      move(entry, nav, periodOf(kind, anchor));
    } } }, label)));
}

function scopeSwitch(entry, nav) {
  const opt = (value, label) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(entry.scope === value),
    'data-focus': `scope:${value}`, class: `seg${entry.scope === value ? ' on' : ''}`, on: { click: () => {
      if (entry.scope === value) return;
      tap(); entry.scope = value; loadCats(entry, nav);
    } } }, label);
  return h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Что считать' },
    opt('scale', 'В лимитах'), opt('all', 'Все траты'));   // решение 51: было «Шкала градусника»
}

function donut(v) {
  return h('div', { class: 'donut-row' },
    h('svg:svg', { width: 150, height: 150, viewBox: '0 0 150 150', role: 'img', 'aria-label': v.aria, class: 'chart donut' },
      h('svg:g', { transform: 'rotate(-90 75 75)' }, h('svg:circle', { cx: 75, cy: 75, r: R, class: 'donut-track' }),
        ...v.segments.map((s) => h('svg:circle', { cx: 75, cy: 75, r: R, fill: 'none', stroke: s.color,
          'stroke-width': 22, 'stroke-dasharray': s.dash, 'stroke-dashoffset': s.offset }))),
      h('svg:text', { x: 75, y: 72, 'text-anchor': 'middle', class: 'donut-total' }, v.total),
      h('svg:text', { x: 75, y: 90, 'text-anchor': 'middle', class: 'tick' }, 'RSD')),
    v.cmp ? h('div', { class: 'cmp' }, h('span', { class: 'muted small' }, v.cmp.label),
      h('span', { class: `cmp-value ${v.cmp.tone}` }, v.cmp.value), h('span', { class: 'muted small' }, v.cmp.sub)) : null);
}

function list(entry, nav, v) {
  const open = (r) => {
    tap();
    if (entry.cat) {
      // подкатегория -> операции за период (решение 23: сумма строк = строка подкатегории)
      return nav.push(newOps(entry.period.from.slice(0, 7), { title: upper(r.name), period: entry.period,
        params: { cat: r.key, exact: r.exact, scale: entry.scope === 'scale' } }));
    }
    nav.push(newCats({ ...entry.period }, r.key, r.name, entry.scope));
  };
  return h('section', { class: 'card list cats' },
    h('div', { class: 'cat-row cat-head muted small' }, h('span', {}, entry.cat ? 'подкатегория' : 'категория'),
      h('span', {}, 'сумма'), h('span', {}, 'доля'), h('span', {}, v.cmpHead)),
    ...v.rows.map((r) => h('button', { type: 'button', class: 'cat-row', 'aria-label': [`${r.name}${r.limit ? `, ${r.limit}` : ''}: `
      + `${r.sum} RSD`, `доля ${r.share}`, r.delta ? `${v.cmpHead} ${r.delta}` : ''].filter(Boolean).join(', '),
      'data-focus': `cat:${r.key}`, on: { click: () => open(r) } },
    h('span', { class: 'cat-name' }, h('span', { class: 'dot', style: { background: r.color } }),
      h('span', { class: 'grow' }, h('span', { class: 'ellipsis' }, r.name),
        r.limit ? h('span', { class: 'muted small limit-of' }, r.limit) : null)),   // «лимит «дом и хозяйство»» переносится
    h('span', { class: 'num' }, r.sum), h('span', { class: 'num muted small' }, r.share),
    h('span', { class: `num small ${r.deltaTone}` }, r.delta))));
}

function bars(entry) {
  if (!entry.bars || !entry.bars.points.length) return null;
  const v = barsView(entry.bars);
  return h('section', { class: 'card pad stack' },
    h('div', { class: 'stack-s' }, h('span', { class: 'title' }, 'По месяцам'), h('span', { class: 'muted small' }, v.note)),
    h('svg:svg', { viewBox: `0 0 ${BARS.width} ${BARS.height}`, width: '100%', role: 'img', 'aria-label': v.aria, class: 'chart' },
      ...v.bars.map((b) => [
        h('svg:rect', { x: b.x, y: b.y, width: b.w, height: Math.max(0, b.h), rx: 4, class: `bar-col${b.partial ? ' partial' : ''}` }),
        b.normY == null ? null : h('svg:line', { x1: b.x - 3, x2: b.x + b.w + 3, y1: b.normY, y2: b.normY, class: 'norm-mark' }),
        h('svg:text', { x: b.cx, y: b.y - 4, 'text-anchor': 'middle', class: 'bar-value' }, b.v),
        h('svg:text', { x: b.cx, y: BARS.height - 6, 'text-anchor': 'middle', class: 'tick' }, b.m)])),
    v.bars.some((b) => b.partial) ? h('p', { class: 'muted small' }, 'Текущий месяц — по сегодня, светлее.') : null);
}

const FOOD = 'Expenses:Family:Food';
// месяц для «По дням» и «По товарам»: месяц периода, у недели, квартала, года — месяц его конца (по сегодня)
const monthOf = (entry, today) => periodEnd(entry.period, today).slice(0, 7);

function extra(entry, nav) {
  // этап 7 (решение 13): «По дням» — под столбцами; «По товарам» — в подкатегориях продуктов
  const today = nav.today();
  const row = (label, sub, next) => h('button', { type: 'button', class: 'line op', 'data-focus': next.kind,
    on: { click: () => { tap(); nav.push(next); } } },
    h('span', { class: 'grow' }, h('span', {}, label), h('span', { class: 'muted small' }, sub)), icon(ICONS.right, 16));
  if (entry.cat === FOOD) {
    return h('section', { class: 'card list' }, row('По товарам', 'что в корзине по чекам — и как менялась цена',
      { kind: 'basket', month: monthOf(entry, today) }));
  }
  if (entry.cat) return null;
  return h('section', { class: 'card list' }, row('По дням', 'траты каждого дня — по сумме и к плану на день',   // critique 12.11: без «тепловой карты»
    { kind: 'days', month: monthOf(entry, today), scope: entry.scope, mode: 'sum' }));
}

function subHead(entry, nav, v) {
  const hd = v.head;
  return h('section', { class: 'card pad stack' },
    h('div', { class: 'big' }, h('span', { class: `big-num ${hd.tone}` }, hd.sum),
      h('span', { class: `muted ${hd.tone}` }, hd.note || 'RSD')),
    hd.fill == null ? null : h('span', { class: 'bar thin' },
      h('span', { class: `fill ${hd.tone}`, style: { width: `${(hd.fill * 100).toFixed(1)}%` } })),
    h('button', { type: 'button', class: 'link', 'data-focus': 'cat-ops', on: { click: () => { tap(); nav.push(newOps(entry.period.from.slice(0, 7),
      { title: upper(entry.title), period: entry.period, limitValue: entry.data.limit && entry.data.limit.own ? entry.data.limit.limit : null,
        params: { cat: entry.cat, scale: entry.scope === 'scale' } })); } } }, `Все операции «${entry.title}»`));
}

function top(nav, v) {
  if (!v.top.length) return [];
  return [h('div', { class: 'section-head' }, h('h2', {}, 'Самые дорогие')),
    h('section', { class: 'card list' }, ...v.top.map((o) => h('button', { type: 'button', class: 'op', 'data-focus': `op:${o.ref}`,
      on: { click: () => { tap(); nav.push({ kind: 'card', ref: o.ref }); } } },
    h('span', { class: 'grow' }, h('span', { class: 'ellipsis' }, o.where), h('span', { class: 'op-sub muted small' }, o.sub)),
    h('span', { class: 'op-amount' }, o.amount))))];
}

function sheet(entry, nav) {
  const d = entry.draft;
  const close = () => { entry.sheet = false; nav.focus('period:custom'); nav.render(); };
  const field = (key, label) => h('label', { class: 'toggle' }, h('span', {}, label),
    h('input', { type: 'date', value: d[key], max: nav.today(), class: 'date', 'data-focus': `sheet:${key}`, on: { change: (e) => { d[key] = e.target.value; } } }));
  return h('div', { class: 'sheet-back', on: { click: (e) => { if (e.target === e.currentTarget) close(); } } },
    h('div', { class: 'sheet', ...DIALOG, 'aria-label': 'Свой период' }, h('h2', {}, 'Свой период'),
      field('from', 'С'), field('to', 'По'),
      h('button', { type: 'button', class: 'button', 'data-focus': 'sheet:show', on: { click: () => {
        if (!d.from || !d.to) return;
        const [from, to] = d.from <= d.to ? [d.from, d.to] : [d.to, d.from];
        entry.sheet = false;
        nav.focus('period:custom');
        move(entry, nav, periodOf('custom', from, to));
      } } }, 'Показать')));
}

export function catsScreen(entry, nav) {
  const today = nav.today();
  const data = entry.data;
  const v = data ? catsView(data) : null;
  const sub = periodSub(entry.period, today, data && data.prev);
  let body;
  if (entry.error && !data) {
    body = offlineBody('cats', entry, nav, () => loadCats(entry, nav));
  } else if (!data) {
    body = h('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': 'Загрузка' },
      h('section', { class: 'card', style: { height: '190px' } }), h('section', { class: 'card', style: { height: '320px' } }));
  } else if (v.empty) {
    // холст 6.3: пустой период — «трат нет» и переход к прошлому периоду
    const prev = shiftPeriod(entry.period, -1);
    body = h('div', { class: 'empty' }, h('h2', {}, `За ${periodTitle(entry.period)} ${entry.cat ? `трат «${entry.title}»` : 'трат'} нет`),
      h('button', { type: 'button', class: 'button', 'data-focus': 'month:prev', on: { click: () => move(entry, nav, prev) } },
        `‹ ${periodTitle(prev)}`));
  } else if (entry.cat) {
    body = [subHead(entry, nav, v), extra(entry, nav), list(entry, nav, v), ...top(nav, v)];
  } else {
    body = [h('section', { class: 'card pad' }, donut(v)), list(entry, nav, v), bars(entry), extra(entry, nav)];
  }
  return h('div', { class: 'screen with-tabs' },
    entry.cat ? null : chips(entry, nav), periodHead(entry, nav, sub), entry.cat ? null : scopeSwitch(entry, nav),
    body, entry.sheet ? sheet(entry, nav) : null);
}
