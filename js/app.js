// Mini App «Капуста»: вкладки «Здоровье», «Операции» и «Категории», карточка операции. Тема — themeParams Telegram (CSS-переменные
// --tg-theme-*), отступы — safeAreaInset. «Назад» — системная BackButton. Данные — только в памяти страницы.
import { apiBase, get, post, screen } from './api.js';
import { fmt, shiftMonth, view } from './health.js';
import { BOX, curve } from './chart.js';
import { h, icon, tap, ICONS, tg } from './dom.js';
import { tile } from './tiles.js';
import { limitRow } from './limitrow.js';
import { cardScreen, loadCard, loadOps, newOps, opsScreen } from './screens.js';
import { catsScreen, loadCats, newCats } from './catscreen.js';
import { isPeriod, periodOf } from './period.js';
import { restore, save, snapView } from './snapshot.js';
import { isMore, loadMore, moreScreen } from './more.js';
import { body as jobBody, flush, path as jobPath, queue } from './recat.js';

const root = document.getElementById('app');
const cache = new Map();
let month = null;
let curveOpen = false;   // решение 14: свёрнута у обоих
let allLimits = false;
let seq = 0;             // листают быстро — рисуем только ответ на последний запрос
let stack = [{ kind: 'health' }];   // экраны: низ — вкладка, сверху — операции лимита, карточка
let opsTab = null;                  // вкладка «Операции» помнит фильтры и прокрутку
let catsTab = null;                 // вкладка «Категории» — период и «В лимитах / Все траты»
const STORE = 'kapusta.period';     // localStorage — только период «Категорий» (спека, «Безопасность»)
const cloud = tg && tg.CloudStorage;   // снимок «Здоровья» (этап 5): у каждого человека своё хранилище Telegram
let snap = null;                       // показанный снимок: Мак молчит
let hasSnap = false;                   // снимок есть в CloudStorage — ссылка на него с «Операций» и «Категорий»
let retrying = false;                  // «Повторить» на снимке: снимок остаётся на экране, пока ждём Мак
let pending = [];                      // смены категории в очереди CloudStorage: Мак молчал (решение 18)
let flushing = false;
let accounts = [];                     // счета зрителя из остатков «Здоровья» — в фильтр «Операций» (решение 38)
let balanceRows = new Map();           // строки остатков по счёту — шапка «Операций» счёта (решение 48)

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
  post: (path, body) => post(path, body, { base: apiBase(location.search), initData: tg.initData }),
  queued: (ref) => pending.filter((j) => j.ref === ref),
  async enqueue(j) {
    const ok = await queue.add(cloud, j);
    pending = await queue.load(cloud);
    return ok;
  },
  async unqueue(id) {
    await queue.drop(cloud, id);
    pending = await queue.load(cloud);
  },
  changed: () => stale(),
  accounts: () => accounts,
  balanceOf: (account) => balanceRows.get(account) || null,
  healthView(m) {
    const d = cache.get(m) || (snap && snap.month === m ? snap : null);
    return d ? view(d) : null;
  },
  render: () => render(),
  problem: (kind, detail) => problem(kind, detail),
  get hasSnap() { return hasSnap; },
  snapshot: () => openSnapshot(),
  push(entry) {
    stack[stack.length - 1].scroll = window.scrollY;
    stack.push(entry);
    open(entry);
    window.scrollTo(0, 0);
  },
  noteOf(ctx, m) {
    // резерв: чей перерасход и сколько покрыто — из «Здоровья» того же месяца
    if (!ctx.reserve) return '';
    const hh = cache.get(m);
    const l = hh && view(hh).limits.find((x) => x.name === ctx.params.limit);
    return (l && l.note) || 'перерасход других лимитов';
  },
  savePeriod(p) {
    try { localStorage.setItem(STORE, JSON.stringify({ kind: p.kind, from: p.from, to: p.to })); } catch { /* приватный режим */ }
  },
  limitOf(ctx, m) {
    // лимит месяца — из «Здоровья» того же месяца, если оно уже загружено; у категории — лимит периода с «Категорий»
    if (ctx.limitValue != null) return ctx.limitValue;
    if (!ctx.params.limit) return null;
    const hh = cache.get(m);
    const l = hh && hh.limits.find((x) => x.name === ctx.params.limit);
    return l ? l.limit : null;
  },
};

function open(entry) {
  if (entry.kind === 'card') { render(); loadCard(entry, nav); } else if (entry.kind === 'ops') loadOps(entry, nav);
  else if (entry.kind === 'cats') loadCats(entry, nav);
  else if (isMore(entry.kind)) loadMore(entry, nav);
  else render();
}

function back() {
  if (stack.length < 2) return;
  const top = stack[stack.length - 1];
  if (top.sheet) { top.sheet = false; top.draft = null; return render(); }
  if (top.picker && top.picker.group && !top.picker.saving) { top.picker.group = null; return render(); }
  if (top.picker && !top.picker.saving) { top.picker = null; return render(); }
  stack.pop();
  const under = stack[stack.length - 1];
  // категорию сменили — данные под карточкой сброшены (stale): загрузить заново, а не оставить скелет
  if (under.kind === 'ops' && !under.pages.length) loadOps(under, nav);
  else if (under.kind === 'cats' && !under.data) loadCats(under, nav);
  else if (isMore(under.kind) && under.kind !== 'hidden' && !under.data) loadMore(under, nav);
  else if (under.kind === 'health' && !cache.has(month) && !snap) load(month);
  else render();
  window.scrollTo(0, under.scroll || 0);
}

function backButton() {
  const top = stack[stack.length - 1];
  try {
    if (stack.length > 1 || top.sheet || top.picker) tg.BackButton.show(); else tg.BackButton.hide();
  } catch { /* вне Telegram — без кнопки */ }
}

function switchTab(tab) {
  tap();
  if (tab === 'health') {
    stack = [{ kind: 'health' }];
    load(month);
  } else if (tab === 'cats') {
    if (!catsTab) catsTab = newCats(savedPeriod());
    stack = [catsTab];
    if (!catsTab.data) loadCats(catsTab, nav); else render();
  } else {
    if (!opsTab) opsTab = newOps(today().slice(0, 7));
    stack = [opsTab];
    if (!opsTab.pages.length) loadOps(opsTab, nav); else render();
  }
  window.scrollTo(0, stack[0].scroll || 0);
}

async function openSnapshot() {
  // холст 6.2: с «Операций» и «Категорий» без Мака — на снимок «Здоровья», без нового запроса
  tap();
  stack = [{ kind: 'health' }];
  const s = snap || await restore(cloud, today().slice(0, 7));
  if (!s) return problem('down');
  snap = s;
  month = s.month;
  render();
  window.scrollTo(0, 0);
}

function savedPeriod() {
  // прошлый период «Категорий»; нет или испорчен — текущий месяц (спека, «Периоды»)
  try {
    const p = JSON.parse(localStorage.getItem(STORE));
    if (isPeriod(p) && p.from <= today()) return p;
  } catch { /* нет хранилища */ }
  return periodOf('month', today());
}

function tabs() {
  const current = stack[0].kind;
  const tab = (kind, label, d) => h('button', { type: 'button', class: `tab${current === kind ? ' on' : ''}`,
    'aria-current': current === kind ? 'page' : null, on: { click: () => switchTab(kind) } }, icon(d, 24), label);
  return h('nav', { class: 'tabs', 'aria-label': 'Разделы' }, tab('health', 'Здоровье', ICONS.health),
    tab('ops', 'Операции', ICONS.list), tab('cats', 'Категории', ICONS.pie));
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

function monthNav(v, snapped) {
  // в снимке — один месяц: листать нечего (холст 6.1)
  const arrow = (dir, label, enabled, d) => h('button', { class: 'arrow', type: 'button', 'aria-label': label,
    disabled: !enabled || snapped, on: { click: () => { tap(); load(shiftMonth(month, dir)); } } }, icon(d));
  return h('header', { class: 'month' },
    arrow(-1, 'Прошлый месяц', true, ICONS.left),
    h('div', { class: 'month-title' }, h('h1', {}, v.title), h('p', { class: 'muted small' }, v.sub)),
    arrow(1, 'Следующий месяц', v.canNext, ICONS.right));
}

function banner(s) {
  // холст 6.1: Мак молчит — плашка над снимком: «Капуста не отвечает. Данные на …» и «Повторить»
  return h('div', { class: 'offline', role: 'status' },
    icon(['M12 9v4', 'M12 17h.01', 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'], 20),
    h('span', { class: 'offline-text' }, h('b', {}, s.banner), ` ${s.when}`),
    h('button', { type: 'button', class: 'link', disabled: retrying,
      on: { click: () => { tap(); load(month); } } }, retrying ? 'Проверяю…' : 'Повторить'));
}

function summary(v) {
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const at = v.bar.plan == null ? null : pct(Math.min(1, v.bar.plan));
  return h('section', { class: 'card pad stack' },
    // решение 49: доля нормы — у «Потрачено»; план на сегодня — подписью у черты; норма — только в «из N»
    h('div', { class: 'row' }, h('span', { class: 'muted small' }, `${v.big.label} · ${v.scale.pct}`),
      h('span', { class: `chip ${v.zone.tone}` }, v.zone.word)),
    h('div', { class: 'big' }, h('span', { class: `big-num ${v.big.tone}` }, v.big.value),
      h('span', { class: 'muted' }, `${v.big.of} RSD`)),
    h('div', { class: 'bar', role: 'img', 'aria-label': v.scale.aria },
      h('span', { class: `fill ${v.zone.tone}`, style: { width: pct(v.bar.fill) } }),
      at == null ? null : h('span', { class: 'plan-mark', style: { left: at } })),
    // подпись сдвинута влево на ту же долю своей ширины: у начала месяца — от черты вправо, у конца — влево
    v.scale.plan && at ? h('div', { class: 'plan-cap muted small', 'aria-hidden': 'true' },
      h('span', { style: { left: at, transform: `translateX(-${at})` } }, v.scale.plan)) : null,
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
  if (!v.curve.chart) {   // кривая отрезана в снимке (решение 32) — только подпись
    return h('section', { class: 'card' }, h('div', { class: 'curve-head' }, h('span', { class: 'grow' },
      h('span', { class: 'title' }, 'Темп месяца'), h('span', { class: `note ${v.curve.note.tone}` }, v.curve.note.text))));
  }
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

function opsOf(title, params, data, reserve = false) {
  // строка лимита -> операции этих трат за месяц (решение 3)
  tap();
  nav.push(newOps(data.month, { title: upper(title), params, reserve }));
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
  return [
    // решение 49: легенда цветов полосок — одной строкой у заголовка, а не абзацем под списком
    h('div', { class: 'section-head' }, h('h2', {}, 'Лимиты'),
      h('span', { class: 'legend muted small' }, ...v.legend.map((l) => h('span', { class: 'legend-item' },
        h('span', { class: 'swatch-bar', style: { background: l.color } }), l.text)))),
    h('section', { class: 'card list' }, ...shown.map((l) => limitRow(l, { plan: data.closed ? null : v.plan,
      open: () => opsOf(l.name, l.ops, data, !!l.note) })), more),
    v.reserve ? h('p', { class: 'note-text muted small' }, v.reserve) : null,
    budgetLinks(v, data),
  ];
}

function budgetLinks(v, data) {
  // решение 40: скрытые лимиты — своей кнопкой; «Бюджет» — продолжение «Все лимиты» (этап 7)
  const row = (label, entry) => h('button', { type: 'button', class: 'line op', on: { click: () => { tap(); nav.push(entry); } } },
    h('span', { class: 'grow' }, label), icon(ICONS.right, 16));
  return h('section', { class: 'card list' },
    v.hidden ? row(v.hidden.label, { kind: 'hidden', month: data.month }) : null,
    row(v.budgetLabel, { kind: 'budget', month: data.month }));
}

function balances(v, data) {
  // решение 38: остаток открывает «Операции» этого счёта за месяц «Здоровья» (фильтр «Кошелёк или счёт»);
  // решения 47, 48: плитка, суммы в две строки, группы по типу, итог наличных и карт в заголовке
  const opsOfAccount = (b) => {
    tap();
    const entry = newOps(data.month);
    entry.f.account = b.ops.account;
    nav.push(entry);
  };
  const row = (b) => h('button', { type: 'button', class: 'line op bal', on: { click: () => opsOfAccount(b) } },
    tile(b.tile), h('span', { class: 'grow' }, b.name),
    h('span', { class: 'bal-amounts' }, ...b.lines.map((l, i) => h('span', { class: i ? 'muted small' : 'num' }, l))),
    icon(ICONS.right, 16));
  return [h('div', { class: 'section-head' }, h('h2', {}, v.balTitle), v.balTotal ? h('span', { class: 'muted small' }, v.balTotal) : null),
    ...v.groups.map((g) => h('div', { class: 'bal-group' }, g.title ? h('p', { class: 'group-label muted small' }, g.title) : null,
      h('section', { class: 'card list' }, ...g.rows.map(row)))),
    v.empty ? h('p', { class: 'note-text muted small' }, v.empty) : null];
}

function healthScreen(data, snapped = false) {
  const v = view(data);
  const s = snapped ? snapView(data) : null;
  return h('div', { class: 'screen with-tabs' }, s ? banner(s) : null, monthNav(v, snapped), summary(v), pace(v, data),
    ...limits(v, data), ...balances(v, data), h('p', { class: 'fresh muted small' }, s ? s.fresh : v.fresh));
}

function render() {
  // поиск отвечает, пока человек печатает: перерисовка не должна убирать фокус (и клавиатуру) из поля
  const typing = document.activeElement && ['ops-q', 'cat-q'].includes(document.activeElement.id)
    && document.activeElement.id;
  draw();
  const q = typing && document.getElementById(typing);
  if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

function draw() {
  const top = stack[stack.length - 1];
  backButton();
  if (top.kind === 'health') {
    if (cache.has(month)) return show(healthScreen(cache.get(month)), tabs());
    if (snap && snap.month === month) return show(healthScreen(snap, true), tabs());
    return skeleton();
  }
  if (top.kind === 'ops') return show(opsScreen(top, nav), tabs());
  if (top.kind === 'cats') return show(catsScreen(top, nav), tabs());
  if (isMore(top.kind)) return show(moreScreen(top, nav), tabs());
  return show(cardScreen(top, nav));
}

async function load(next) {
  const base = apiBase(location.search);
  if (!base) return problem('stale');
  const mine = ++seq;
  month = next;
  if (cache.has(month)) return render();
  retrying = !!(snap && snap.month === month);
  if (retrying) render(); else skeleton();
  const r = await get(`/api/health${month ? `?month=${month}` : ''}`, { base, initData: tg.initData });
  if (mine !== seq) return;
  retrying = false;
  if (r.error === 'down') return offlineHealth(mine, r.detail);
  if (r.error) return problem(r.error, r.detail);
  month = r.data.month;
  cache.set(month, r.data);
  const fresh = view(r.data);
  accounts = fresh.accounts;
  balanceRows = new Map(fresh.groups.flatMap((g) => g.rows).map((b) => [b.ops.account, b]));
  snap = null;
  // после каждого удачного ответа — снимок в CloudStorage (ключ на месяц, до 4096 знаков, решение 32)
  save(cloud, r.data).then((ok) => { if (ok) hasSnap = true; });
  if (stack[stack.length - 1].kind === 'health') render();
  sendQueue();
}

function stale() {
  // категория сменилась: цифры «Здоровья», списки и категории — заново при следующем показе
  cache.clear();
  for (const e of new Set([opsTab, catsTab, ...stack])) {
    if (e && e.kind === 'ops') e.pages = [];
    if (e && e.kind === 'cats') e.data = null;
    if (e && isMore(e.kind) && e.kind !== 'hidden') e.data = null;
  }
}

async function sendQueue() {
  // решение 18: смены, ждавшие Мак, уходят при открытии, как только Капуста ответила; конфликт — вопрос в чате
  if (flushing || !pending.length) return;
  flushing = true;
  const out = await flush(cloud, (j) => nav.post(jobPath(j), jobBody(j)));
  pending = await queue.load(cloud);
  flushing = false;
  if (!out.done) return;
  const m = month;
  stale();
  const r = await nav.get(`/api/health?month=${m}`);
  if (r.data) cache.set(m, r.data);
  if (stack[stack.length - 1].kind === 'health') render();
}

async function offlineHealth(mine, detail) {
  // Мак молчит: снимок этого месяца (или самый поздний) с пометкой «данные на …»; снимка нет — «не отвечает»
  const s = await restore(cloud, month || today().slice(0, 7));
  if (mine !== seq) return;
  if (!s) return problem('down', detail);
  snap = s;
  hasSnap = true;
  month = s.month;
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
  queue.load(cloud).then((jobs) => { pending = jobs; sendQueue(); });
  load(null);
}
