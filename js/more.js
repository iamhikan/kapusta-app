// Экраны этапа 7 (DOM) внутри трёх вкладок (решение 13): «История цены» (из позиции чека и «По товарам»), «По товарам»
// (подкатегории продуктов), «Бюджет» (под лимитами «Здоровья»), «По дням» (под столбцами «Категорий»), «Скрытые лимиты»
// (решение 40). Данные — только из /api/price, /api/basket, /api/budget, /api/days и «Здоровья» в памяти.
import { h, icon, tap, ICONS } from './dom.js';
import { basketView, PRICE_BOX, pricePath, priceView } from './shop.js';
import { budgetView } from './budget.js';
import { daysView } from './days.js';
import { failBody, newOps, TITLE } from './screens.js';
import { limitRow } from './limitrow.js';

const PATHS = {
  price: (e) => pricePath(e.q),
  basket: (e) => `/api/basket?month=${e.month}&cat=food`,   // из «Продуктов» — только продукты (решение 57)
  budget: (e) => `/api/budget?month=${e.month}`,
  days: (e) => `/api/days?${new URLSearchParams({ month: e.month, scope: e.scope || 'all' })}`,
};

export const isMore = (kind) => kind in PATHS || kind === 'hidden';

export async function loadMore(entry, nav) {
  if (entry.kind === 'hidden') return nav.render();
  const mine = (entry.seq = (entry.seq || 0) + 1);
  entry.data = null;
  entry.error = null;
  nav.render();
  const r = await nav.get(PATHS[entry.kind](entry));
  if (mine !== entry.seq) return;
  if (r.error === 'stale' || r.error === 'stranger') return nav.problem(r.error);
  if (r.error) [entry.error, entry.fail] = [r.detail || r.error, r.error];
  else entry.data = r.data;
  // позиции нет (или чек к секрету — зритель Ангелина): 404 цены; другой отказ — словами fin (М2: было — регэксп по «HTTP 404»)
  entry.missing = entry.kind === 'price' && r.error === 'refused' && r.status === 404;
  nav.render();
}

const open = (nav, entry) => { tap(); nav.push(entry); };
const head = (title, sub) => h('header', { class: 'month solo' }, h('div', { class: 'month-title' }, h('h1', TITLE, title),
  sub ? h('p', { class: 'muted small' }, sub) : null));
const busy = () => h('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': 'Загрузка' },
  h('section', { class: 'card', style: { height: '200px' } }), h('section', { class: 'card', style: { height: '160px' } }));

function priceChart(c) {
  const B = PRICE_BOX;
  return h('svg:svg', { viewBox: `0 0 ${B.width} ${B.height}`, width: '100%', role: 'img', 'aria-label': c.aria, class: 'chart' },
    ...c.grid.map((g) => [h('svg:line', { x1: B.left, x2: B.right, y1: g.y, y2: g.y, class: 'grid' }),
      h('svg:text', { x: B.left - 6, y: g.y + 3.5, 'text-anchor': 'end', class: 'tick' }, g.label)]),
    c.points.length > 1 ? h('svg:polyline', { points: c.line, class: 'price-line' }) : null,
    ...c.points.map((p) => h('svg:circle', { cx: p.x, cy: p.y, r: 4, class: 'price-dot' })),
    h('svg:text', { x: B.left, y: B.height - 4, class: 'tick' }, c.from),
    h('svg:text', { x: B.right, y: B.height - 4, 'text-anchor': 'end', class: 'tick' }, c.to));
}

function priceBody(entry, nav) {
  const v = priceView(entry.data, nav.today());
  const store = (s) => {
    const kids = [h('span', { class: 'grow' }, h('span', {}, s.store, s.mine ? h('span', { class: 'mark' }, 'этот') : null),
      h('span', { class: 'muted small ellipsis' }, s.sub)),
    h('span', { class: 'op-amount' }, h('span', {}, s.price), s.per ? h('span', { class: 'muted small' }, s.per) : null)];
    return s.open ? h('button', { type: 'button', class: 'line op', 'data-focus': `store:${s.store}`,
      on: { click: () => open(nav, { kind: 'price', q: s.open }) } }, ...kids, icon(ICONS.right, 16))
      : h('div', { class: 'line' }, ...kids);
  };
  return [head(v.title, v.sub),
    v.big ? h('section', { class: 'card pad stack' },
      h('div', { class: 'big' }, h('span', { class: 'big-num' }, v.big.value),
        h('span', { class: 'muted' }, v.big.unit || 'RSD')),
      h('div', { class: `small ${v.big.tone || 'muted'}` }, v.big.meta),
      priceChart(v.chart)) : null,
    v.stores.length ? [h('div', { class: 'section-head' }, h('h2', {}, v.storesTitle)),
      h('section', { class: 'card list' }, ...v.stores.map(store)),
      h('p', { class: 'note-text muted small' }, [v.cheapest, 'Цена за кг или л — по весу или упаковке в названии.']
        .filter(Boolean).join(' '))] : null];
}

function basketBody(entry, nav) {
  const v = basketView(entry.data);
  if (v.empty) return [head(v.title, v.sub), h('div', { class: 'empty' }, h('h2', {}, v.empty))];
  return [head(v.title, v.sub),
    h('div', { class: 'chips wrap' }, ...v.shares.map((s) => h('span', { class: 'chip-static' }, s))),
    h('div', { class: 'section-head' }, h('h2', {}, 'Больше всего')),
    h('section', { class: 'card list' }, ...v.rows.map((r) => h('button', { type: 'button', class: 'line op',
      'data-focus': `goods:${r.name}`, on: { click: () => open(nav, { kind: 'price', q: r.open }) } },
    h('span', { class: 'grow' }, h('span', { class: 'ellipsis' }, r.name), r.qty ? h('span', { class: 'muted small' }, r.qty) : null),
    h('span', { class: 'nowrap' }, r.sum), icon(ICONS.right, 16)))),
    v.note ? h('p', { class: 'note-text muted small' }, v.note) : null];
}

function budgetBody(entry, nav) {
  const v = budgetView(entry.data);
  if (v.empty) {   // месяц без курса (решение 81): ни долей дохода, ни «Денег на месяц», ни лимитов
    return [head(v.title, v.sub), h('div', { class: 'empty' }, h('h2', {}, v.empty.title), h('p', { class: 'muted small' }, v.empty.text))];
  }
  const row = (name, sum, note, cls = '') => h('div', { class: `line ${cls}` },
    h('span', { class: 'grow' }, h('span', {}, name), note ? h('span', { class: 'muted small' }, note) : null),
    h('span', { class: 'nowrap' }, sum));
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  return [head(v.title, v.sub),
    v.income ? h('section', { class: 'card pad stack' },
      h('div', { class: 'row' }, h('span', { class: 'muted' }, v.income.label),
        h('span', {}, h('b', { class: 'stat' }, v.income.value), v.income.set ? h('span', { class: 'muted small' }, ` · ${v.income.set}`) : null)),
      h('div', { class: 'alloc', role: 'img', 'aria-label': v.alloc.map((a) => `${a.name} ${a.sum}`).join(', ') },
        ...v.alloc.map((a) => h('span', { style: { width: pct(a.share), background: a.color } }))),
      h('div', { class: 'list' }, ...v.alloc.map((a) => h('div', { class: 'line flush' },
        h('span', { class: 'legend-item' }, h('span', { class: 'swatch-box', style: { background: a.color } }), a.name),
        h('span', { class: 'nowrap' }, a.sum))))) : null,
    v.plan ? planCard(v.plan) : null,
    ...v.groups.map((g) => [h('div', { class: 'section-head' }, h('h2', {}, g.name), h('span', { class: 'muted small' }, g.sum)),
      h('section', { class: 'card list' }, ...g.rows.map((r) => row(r.name, r.sum, r.note))),
      g.sub ? h('p', { class: 'note-text muted small' }, g.sub) : null]),
    v.savings || v.norm ? h('section', { class: 'card list' }, v.savings ? row(v.savings.name, v.savings.sum, v.savings.note) : null,
      v.norm ? row(v.norm.name, v.norm.sum, '', 'strong') : null) : null,
    h('div', { class: 'section-head' }, h('h2', {}, v.limits.title), h('span', { class: 'muted small' }, v.limits.sub)),
    h('section', { class: 'card list' }, ...v.limits.rows.map((r) => h('button', { type: 'button', class: 'line op',
      'data-focus': `limit:${r.name}`, on: { click: () => open(nav, newOps(entry.month, { title: r.name.charAt(0).toUpperCase()
        + r.name.slice(1), params: { limit: r.key } })) } },
    h('span', { class: 'grow' }, h('span', {}, r.name), r.note ? h('span', { class: 'muted small' }, r.note) : null),
    h('span', { class: 'nowrap' }, r.sum), icon(ICONS.right, 16)))),
    v.free ? h('p', { class: `note-text small ${v.free.tone || 'muted'}` }, v.free.text) : null];
}

function daysBody(entry, nav) {
  const v = daysView(entry.data, entry.mode);
  const opt = (value, label) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(entry.mode === value),
    'data-focus': `mode:${value}`, class: `seg${entry.mode === value ? ' on' : ''}`, on: { click: () => {
      if (entry.mode === value) return;
      tap(); entry.mode = value; nav.render();
    } } }, label);
  const cell = (c) => {
    if (c.blank) return h('span', { class: 'day-cell blank', 'aria-hidden': 'true' });
    if (c.future) return h('span', { class: 'day-cell future', 'aria-label': `${c.d}: ещё не прошёл` }, h('span', {}, c.d));
    const cls = v.mode === 'plan' ? `tone-${c.tone}` : `heat-${c.level}`;
    return h('button', { type: 'button', class: `day-cell ${cls}`, 'aria-label': c.aria, 'data-focus': `day:${c.date}`, on: { click: () => open(nav,
      newOps(c.date.slice(0, 7), { title: c.aria.split(':')[0], period: { kind: 'custom', from: c.date, to: c.date },
        params: v.scale ? { scale: true } : {} })) } }, h('span', {}, c.d), h('span', { class: 'day-k' }, c.k));
  };
  return [head(v.title, v.sub),
    v.canPlan ? h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Как красить дни' },
      opt('sum', 'По сумме'), opt('plan', 'К плану на день')) : null,
    h('section', { class: 'card pad stack' },
      h('div', { class: 'cal muted small', 'aria-hidden': 'true' }, ...['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => h('span', {}, d))),
      h('div', { class: 'cal' }, ...v.cells.map(cell)),
      h('div', { class: 'legend muted small' }, ...v.legend.map((l) => h('span', { class: 'legend-item' },
        h('span', { class: `swatch-box ${l.tone ? `tone-${l.tone}` : `heat-${l.level}`}` }), l.text)))),
    h('p', { class: 'note-text muted small' }, v.note)];
}

function hiddenBody(entry, nav) {
  const v = nav.healthView(entry.month);
  if (!v || !v.hidden) return [head('Скрытые лимиты', ''), h('div', { class: 'empty' }, h('h2', {}, 'Скрытых лимитов нет'))];
  return [head('Скрытые лимиты', `${v.title} · в градуснике — только у порога`),
    h('section', { class: 'card list' }, ...v.hidden.rows.map((l) => limitRow(l, { open: () => open(nav,
      newOps(entry.month, { title: l.name.charAt(0).toUpperCase() + l.name.slice(1), params: l.ops })) }))),
    h('p', { class: 'note-text muted small' }, 'Лимит дошёл до порога — он в общем списке «Здоровья» и в градуснике.')];
}

const OK = 'M5 12.5l4.5 4.5L19 7.5';
const WARN = ['M12 7v6', 'M12 17h.01'];

// «Деньги на …» (правка 5, ui-ux-pro-max 13.11): вывод — первой строкой с плашкой (слово и значок, не только цвет),
// ниже «есть / нужно» числами и полоса; разбивка сумм — под «Из чего суммы» (details: раскрыть может и диктор)
export function planCard(p) {
  const v = p.verdict;
  return h('section', { class: 'card pad stack plan' },
    h('div', { class: 'plan-head' }, h('span', { class: 'title' }, p.title),
      h('span', { class: `pill ${v.tone}` }, icon(v.tone === 'good' ? OK : WARN, 14), v.word)),
    h('div', { class: 'stack-0' }, h('b', { class: 'plan-verdict' }, v.text), h('span', { class: `small ${v.tone === 'good' ? 'muted' : v.tone}` }, v.value)),
    h('div', { class: 'plan-cols' },
      h('div', { class: 'stack-0' }, h('span', { class: 'muted small' }, p.have.label), h('b', { class: 'stat' }, p.have.value)),
      h('div', { class: 'stack-0' }, h('span', { class: 'muted small' }, p.need.label), h('b', { class: 'stat' }, p.need.value))),
    h('span', { class: 'bar', 'aria-hidden': 'true' }, h('span', { class: 'fill plan-fill', style: { width: `${(p.fill * 100).toFixed(1)}%` } })),
    h('span', { class: 'muted small' }, p.ratio),
    h('details', { class: 'plan-more' }, h('summary', {}, 'Из чего суммы', icon(ICONS.down, 16)),
      h('div', { class: 'stack-s' }, h('span', { class: 'small' }, `${p.have.label}: ${p.have.sub}`),
        h('span', { class: 'small' }, `${p.need.label}: ${p.parts.join(', ')}`))),
    p.salary ? h('span', { class: 'muted small' }, p.salary) : null);
}

const BODIES = { price: priceBody, basket: basketBody, budget: budgetBody, days: daysBody, hidden: hiddenBody };
export function moreScreen(entry, nav) {
  let body;
  if (entry.missing) {
    body = h('div', { class: 'empty' }, h('h2', {}, 'Истории цены нет'), h('p', { class: 'muted small' }, 'Такой позиции нет в архиве покупок.'));
  } else if (entry.kind !== 'hidden' && entry.error && !entry.data) {
    body = failBody(entry.kind, entry, nav, () => loadMore(entry, nav));
  } else if (entry.kind !== 'hidden' && !entry.data) {
    body = busy();
  } else {
    body = BODIES[entry.kind](entry, nav);
  }
  return h('div', { class: 'screen with-tabs' }, body);
}
