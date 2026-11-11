// Mini App «Капуста»: вкладки «Здоровье» и «Операции», карточка операции. Тема — themeParams Telegram (CSS-переменные
// --tg-theme-*), отступы — safeAreaInset. «Назад» — системная BackButton. Данные — только в памяти страницы.
import { apiBase, get, screen } from './api.js';
import { fmt, shiftMonth, view } from './health.js';
import { BOX, curve } from './chart.js';
import { h, icon, tap, ICONS, tg } from './dom.js';
import { cardScreen, loadCard, loadOps, newOps, opsScreen } from './screens.js';

const root = document.getElementById('app');
const cache = new Map();
let month = null;
let curveOpen = false;   // решение 14: свёрнута у обоих
let allLimits = false;
let seq = 0;             // листают быстро — рисуем только ответ на последний запрос
let stack = [{ kind: 'health' }];   // экраны: низ — вкладка, сверху — операции лимита, карточка
let opsTab = null;                  // вкладка «Операции» помнит фильтры и прокрутку

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function theme() {
  document.documentElement.dataset.scheme = (tg && tg.colorScheme) || 'light';
  try {
    tg.setHeaderColor('secondary_bg_color');
    tg.setBackgroundColor('secondary_bg_color');
  } catch { /* старый клиент — цвета по умолчанию */ }
}

function show(...nodes) {
  root.replaceChildren(...nodes);
}

const nav = {
  today,
  get: (path) => get(path, { base: apiBase(location.search), initData: tg.initData }),
  render: () => render(),
  problem: (kind, detail) => problem(kind, detail),
  push(entry) {
    stack[stack.length - 1].scroll = window.scrollY;
    stack.push(entry);
    open(entry);
    window.scrollTo(0, 0);
  },
  limitOf(ctx, m) {
    // лимит месяца — из «Здоровья» того же месяца, если оно уже загружено
    if (!ctx.params.limit) return null;
    const hh = cache.get(m);
    const l = hh && hh.limits.find((x) => x.name === ctx.params.limit);
    return l ? l.limit : null;
  },
};

function open(entry) {
  if (entry.kind === 'card') { render(); loadCard(entry, nav); } else if (entry.kind === 'ops') loadOps(entry, nav);
  else render();
}

function back() {
  if (stack.length < 2) return;
  const top = stack[stack.length - 1];
  if (top.sheet) { top.sheet = false; top.draft = null; return render(); }
  stack.pop();
  render();
  window.scrollTo(0, stack[stack.length - 1].scroll || 0);
}

function backButton() {
  const top = stack[stack.length - 1];
  try {
    if (stack.length > 1 || top.sheet) tg.BackButton.show(); else tg.BackButton.hide();
  } catch { /* вне Telegram — без кнопки */ }
}

function switchTab(tab) {
  tap();
  if (tab === 'health') {
    stack = [{ kind: 'health' }];
    load(month);
  } else {
    if (!opsTab) opsTab = newOps(today().slice(0, 7));
    stack = [opsTab];
    if (!opsTab.pages.length) loadOps(opsTab, nav); else render();
  }
  window.scrollTo(0, stack[0].scroll || 0);
}

function tabs() {
  const current = stack[0].kind;
  const tab = (kind, label, d) => h('button', { type: 'button', class: `tab${current === kind ? ' on' : ''}`,
    'aria-current': current === kind ? 'page' : null, on: { click: () => switchTab(kind) } }, icon(d, 24), label);
  return h('nav', { class: 'tabs', 'aria-label': 'Разделы' }, tab('health', 'Здоровье', ICONS.health),
    tab('ops', 'Операции', ICONS.list));
}

function skeleton() {
  const bar = (w, ht) => h('span', { class: 'skel', style: { width: w, height: ht } });
  show(h('div', { class: 'screen with-tabs', 'aria-busy': 'true', 'aria-label': 'Загрузка' },
    h('div', { class: 'month-skel' }, bar('150px', '22px'), bar('190px', '13px')),
    h('section', { class: 'card pad stack' }, bar('120px', '13px'), bar('190px', '38px'), bar('100%', '10px'),
      bar('70%', '13px')),
    h('section', { class: 'card', style: { height: '56px' } }),
    h('section', { class: 'card pad stack' }, ...[90, 120, 140, 80].map((w) => bar(`${w}px`, '13px')))), tabs());
}

function problem(kind, detail) {
  const s = screen(kind);
  const pic = s.icon === 'logo' ? h('div', { class: 'logo' }, 'К')
    : icon(s.icon === 'lock' ? ['M7 11V7a5 5 0 0 1 10 0v4', 'M5 11h14v10H5z'] : ['M12 9v4', 'M12 17h.01',
      'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'], 56);
  const act = s.link ? h('a', { class: 'button', href: s.link }, s.linkText)
    : s.retry ? h('button', { class: 'button', type: 'button', on: { click: () => { tap(); load(month); } } }, 'Повторить')
      : h('button', { class: 'button', type: 'button', on: { click: () => tg && tg.close() } }, 'Закрыть');
  show(h('div', { class: 'problem' }, h('div', { class: 'problem-icon' }, pic), h('h1', {}, s.title),
    h('p', {}, s.text), act, detail ? h('p', { class: 'small detail' }, detail) : null));
}

function monthNav(v) {
  const arrow = (dir, label, enabled, d) => h('button', { class: 'arrow', type: 'button', 'aria-label': label,
    disabled: !enabled, on: { click: () => { tap(); load(shiftMonth(month, dir)); } } }, icon(d));
  return h('header', { class: 'month' },
    arrow(-1, 'Прошлый месяц', true, ICONS.left),
    h('div', { class: 'month-title' }, h('h1', {}, v.title), h('p', { class: 'muted small' }, v.sub)),
    arrow(1, 'Следующий месяц', v.canNext, ICONS.right));
}

function summary(v) {
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  return h('section', { class: 'card pad stack' },
    h('div', { class: 'row' }, h('span', { class: 'muted small' }, v.big.label),
      h('span', { class: `chip ${v.zone.tone}` }, v.zone.word)),
    h('div', { class: 'big' }, h('span', { class: `big-num ${v.big.tone}` }, v.big.value),
      h('span', { class: 'muted' }, `${v.big.of} RSD`)),
    h('div', { class: 'bar', role: 'img', 'aria-label': v.scale.filter(Boolean).join(', ') },
      h('span', { class: `fill ${v.zone.tone}`, style: { width: pct(v.bar.fill) } }),
      v.bar.plan == null ? null : h('span', { class: 'plan-mark', style: { left: pct(Math.min(1, v.bar.plan)) } })),
    // норма — уже в «из N» у крупного числа: под шкалой — доля нормы и черта плана
    h('div', { class: 'scale muted small' }, h('span', {}, v.scale[0]),
      h('span', {}, v.scale[1] ? `черта — ${v.scale[1]}` : '')),
    h('div', { class: 'sep' }),
    h('div', { class: 'stats' }, ...v.stats.map((s) => h('div', {}, h('div', { class: 'muted small' }, s.label),
      h('div', { class: `stat ${s.tone}` }, s.value)))));
}

function chart(c) {
  const line = (a) => h('svg:line', a);
  const text = (a, t) => h('svg:text', a, t);
  const { left, right } = BOX;
  return h('svg:svg', { viewBox: `0 0 ${BOX.width} ${BOX.height}`, width: '100%', role: 'img', 'aria-label': c.aria,
    class: 'chart' },
    ...c.grid.map((g) => [line({ x1: left, x2: right, y1: g.y, y2: g.y, class: 'grid' }),
      text({ x: left - 6, y: g.y + 3.5, 'text-anchor': 'end', class: 'tick' }, g.label)]),
    ...c.days.map((d) => text({ x: d.x, y: BOX.height - 6, 'text-anchor': 'middle', class: 'tick' }, d.label)),
    line({ x1: left, x2: right, y1: c.normY, y2: c.normY, class: 'norm' }),
    text({ x: left + 4, y: c.normY - 5, class: 'tick' }, c.normLabel),
    line({ x1: c.plan.from.x, y1: c.plan.from.y, x2: c.plan.to.x, y2: c.plan.to.y, class: 'plan' }),
    h('svg:polygon', { points: c.area, class: 'area' }),
    h('svg:polyline', { points: c.line, class: 'spent' }),
    c.forecast && line({ x1: c.end.x, y1: c.end.y, x2: c.forecast.x, y2: c.forecast.y, class: 'forecast' }),
    h('svg:circle', { cx: c.end.x, cy: c.end.y, r: 5, class: 'dot' }));
}

function pace(v, data) {
  const head = h('button', { class: 'curve-head', type: 'button', 'aria-expanded': String(curveOpen),
    'aria-label': `Темп месяца: ${v.curve.note.text}. ${curveOpen ? 'Свернуть' : 'Показать'} кривую`,
    on: { click: () => { tap(); curveOpen = !curveOpen; render(); } } },
  h('span', { class: 'grow' }, h('span', { class: 'title' }, 'Темп месяца'),
    h('span', { class: `note ${v.curve.note.tone}` }, v.curve.note.text)),
  icon(curveOpen ? ICONS.up : ICONS.down, 18));
  if (!curveOpen) return h('section', { class: 'card' }, head);
  const legend = (cls, word) => h('span', { class: 'legend-item' }, h('span', { class: `swatch ${cls}` }), word);
  return h('section', { class: 'card' }, head, h('div', { class: 'curve-body' }, chart(curve(data)),
    h('div', { class: 'legend muted small' }, legend('spent', 'траты'), legend('plan', 'план'),
      data.closed ? null : legend('forecast', 'прогноз'))));
}

function opsOf(title, params, data) {
  // строка лимита или «вне лимитов» -> операции этих трат за месяц (решения 3 и 25)
  tap();
  nav.push(newOps(data.month, { title: upper(title), params }));
}

function limits(v, data) {
  if (!v.limits.length) return [];
  const shown = allLimits ? v.limits : v.limits.slice(0, v.limitsShown);
  // раскрыть — последней строкой под уже открытыми лимитами, там же и свернуть (Алексей 11.11.2026)
  const more = v.limits.length > v.limitsShown
    ? h('button', { class: 'more', type: 'button', 'aria-expanded': String(allLimits),
      on: { click: () => { tap(); allLimits = !allLimits; render(); } } },
    allLimits ? 'Свернуть' : `Показать все ${v.limits.length}`, icon(allLimits ? ICONS.up : ICONS.down, 16))
    : null;
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  return [
    h('div', { class: 'section-head' }, h('h2', {}, 'Лимиты')),
    h('section', { class: 'card list' }, ...shown.map((l) => h('button', { type: 'button', class: 'limit',
      'aria-label': `Операции: ${l.name}`, on: { click: () => opsOf(l.name, l.ops, data) } },
    h('span', { class: 'limit-body' },
      h('span', { class: 'row' },
        h('span', { class: 'limit-name' }, h('span', { class: 'ellipsis' }, l.name),
          l.over ? h('span', { class: 'badge' }, l.over) : null),
        h('span', { class: 'nowrap' }, h('b', { class: l.over ? 'bad' : '' }, l.spent),
          h('span', { class: 'muted small' }, ` / ${l.limit}`))),
      h('span', { class: 'bar thin' }, h('span', { class: 'fill', style: { width: pct(l.fill), background: l.color } }),
        data.closed ? null : h('span', { class: 'plan-mark soft', style: { left: pct(v.plan) } }))),
    icon(ICONS.right, 16))), more),
    v.reserve ? h('p', { class: 'note-text muted small' }, v.reserve) : null,
    h('p', { class: 'note-text muted small' }, data.closed
      ? 'Итог месяца: без плана на сегодня и без прогноза. «+N» — сверх лимита.'
      : 'Черта — план на сегодня. Зелёный — в плане, от жёлтого к оранжевому — выше плана, красный и «+N» — сверх лимита.'),
  ];
}

function outside(v, data) {
  if (!v.outside.length) return [];
  const row = (name, value, params, cls = '') => h('button', { type: 'button', class: `line op ${cls}`,
    'aria-label': `Операции: ${name}`, on: { click: () => opsOf(name, params, data) } },
  h('span', { class: 'grow' }, name), h('span', { class: 'nowrap' }, value), icon(ICONS.right, 16));
  const total = data.outside.reduce((s, o) => s + o.rsd, 0);
  return [h('div', { class: 'section-head' }, h('h2', {}, 'Вне лимитов')),
    h('section', { class: 'card list' }, row('Все вне лимитов', fmt(total),
      v.outsideAll, 'strong'), ...v.outside.map((o) => row(o.name, o.value, o.ops)))];
}

function balances(v) {
  return [h('div', { class: 'section-head' }, h('h2', {}, v.balTitle)),
    h('section', { class: 'card list' }, ...v.balances.map((b) => h('div', { class: 'line' },
      h('span', {}, b.name), h('span', { class: b.later ? 'muted small' : 'nowrap' }, b.value)))),
    v.empty ? h('p', { class: 'note-text muted small' }, v.empty) : null];
}

function healthScreen(data) {
  const v = view(data);
  return h('div', { class: 'screen with-tabs' }, monthNav(v), summary(v), pace(v, data), ...limits(v, data),
    ...outside(v, data), ...balances(v), h('p', { class: 'fresh muted small' }, v.fresh));
}

function render() {
  // поиск отвечает, пока человек печатает: перерисовка не должна убирать фокус (и клавиатуру) из поля
  const typing = document.activeElement && document.activeElement.id === 'ops-q';
  draw();
  const q = typing && document.getElementById('ops-q');
  if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

function draw() {
  const top = stack[stack.length - 1];
  backButton();
  if (top.kind === 'health') {
    if (!cache.has(month)) return skeleton();
    return show(healthScreen(cache.get(month)), tabs());
  }
  if (top.kind === 'ops') return show(opsScreen(top, nav), tabs());
  return show(cardScreen(top, nav));
}

async function load(next) {
  const base = apiBase(location.search);
  if (!base) return problem('stale');
  const mine = ++seq;
  month = next;
  if (cache.has(month)) return render();
  skeleton();
  const r = await get(`/api/health${month ? `?month=${month}` : ''}`, { base, initData: tg.initData });
  if (mine !== seq) return;
  if (r.error) return problem(r.error, r.detail);
  month = r.data.month;
  cache.set(month, r.data);
  if (stack[stack.length - 1].kind === 'health') render();
}

if (!tg || !tg.initData) {
  problem('outside');
} else {
  tg.ready();
  tg.expand();
  theme();
  tg.onEvent('themeChanged', theme);
  try { tg.BackButton.onClick(back); } catch { /* старый клиент */ }
  load(null);
}
