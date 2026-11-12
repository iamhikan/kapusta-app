// Что слышит диктор (VoiceOver, TalkBack) в строках-кнопках (фаза 12): aria-label не прячет суммы, которые видны
// на экране; состояние полоски лимита — словами. Фаза 15 (critique 12.11, P1): фокус после перерисовки — по ключу
// data-focus, листы — модальные, живая зона — своя маленькая. Экраны собираются на поддельном DOM. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { view } from '../js/health.js';
import { limitRow } from '../js/limitrow.js';
import { moreScreen } from '../js/more.js';
import { catsScreen, newCats } from '../js/catscreen.js';
import { cardScreen, newOps, offlineBody, opsScreen } from '../js/screens.js';
import { painter } from '../js/a11y.js';
import { h } from '../js/dom.js';
import { returnTo } from '../js/back.js';

class El {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.kids = []; this.style = {}; this.parent = null; this.handlers = {}; }
  get tagName() { return this.tag.toUpperCase(); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  hasAttribute(k) { return k in this.attrs; }
  addEventListener(ev, fn) { this.handlers[ev] = fn; }
  click() { if (!this.disabled && this.handlers.click) this.handlers.click({ target: this, currentTarget: this }); }
  append(...kids) {
    for (const kid of kids) {
      if (kid instanceof El) {
        if (kid.parent) kid.parent.kids = kid.parent.kids.filter((x) => x !== kid);
        kid.parent = this;
      }
      this.kids.push(kid);
    }
  }
  replaceChildren(...kids) {
    for (const k of this.kids) if (k instanceof El) k.parent = null;
    this.kids = [];
    this.append(...kids);
    // как в браузере: узел с фокусом убрали — фокус уходит в body
    const a = globalThis.document.activeElement;
    if (a && !globalThis.document.body.contains(a)) globalThis.document.activeElement = globalThis.document.body;
  }
  get children() { return this.kids.filter((k) => k instanceof El); }
  contains(el) { for (let e = el; e; e = e.parent) if (e === this) return true; return false; }
  matches(sel) {
    const m = /^\[([\w-]+)\]$/.exec(sel);
    if (m) return this.hasAttribute(m[1]);
    return sel.startsWith('.') ? this.classes.includes(sel.slice(1)) : this.tag === sel;
  }
  closest(sel) { for (let e = this; e instanceof El; e = e.parent) if (e.matches(sel)) return e; return null; }
  querySelectorAll(sel) { const out = []; walk(this, (e) => { if (e !== this && e.matches(sel)) out.push(e); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  get disabled() { return this.hasAttribute('disabled'); }
  focus(opts) { globalThis.document.activeElement = this; this.focusOpts = opts; }
  setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; }
  set value(v) { this.attrs.value = v; }
  get value() { return this.attrs.value; }
  get textContent() { return text(this, () => false).join(''); }
  set textContent(t) { this.kids = t ? [t] : []; this.writes = (this.writes || 0) + 1; }
  get classes() { return (this.attrs.class || '').split(/\s+/); }
}
globalThis.document = { createElement: (t) => new El(t), createElementNS: (_, t) => new El(t), body: new El('body'),
  activeElement: null };

const walk = (el, fn) => {
  if (!(el instanceof El)) return;
  fn(el);
  el.kids.forEach((k) => walk(k, fn));
};
// текст поддерева; skip — что не читать (aria-hidden, для глаз — ещё и .sr)
function text(el, skip) {
  if (typeof el === 'string') return [el];
  if (skip(el)) return [];
  return el.kids.flatMap((k) => text(k, skip));
}
const hidden = (el) => el.attrs['aria-hidden'] === 'true';
const seen = (el) => text(el, (e) => hidden(e) || e.classes.includes('sr')).map((s) => s.trim()).filter(Boolean);
const heard = (el) => el.attrs['aria-label'] ?? text(el, hidden).join(' ');

// строки-кнопки экрана: всё, что видно в строке, диктор тоже слышит
function rows(tree) {
  const out = [];
  walk(tree, (el) => {
    if (el.tag === 'button' && el.classes.some((c) => ['line', 'limit', 'cat-row'].includes(c))) out.push(el);
  });
  return out;
}
function assertHeard(tree, min) {
  const all = rows(tree);
  assert.ok(all.length >= min, `строк ${all.length}`);
  for (const row of all) {
    const say = heard(row);
    for (const piece of seen(row)) assert.ok(say.includes(piece), `«${piece}» не слышно в «${say}»`);
  }
}

const NOW = {
  month: '2026-11', date: '2026-11-11', day: 11, days: 30, closed: false,
  zone: { status: 'ok', word: 'в норме' }, norm: 200000, spent: 80000, left: 120000, plan_today: 73333, per_day: 6000,
  regular: 0, oneoff: 0,
  limits: [
    { name: 'питомцы', spent: 6000, limit: 4000, over: 2000 },
    { name: 'путешествия', spent: 14000, limit: 16000, over: 0 },
    { name: 'еда вне дома', spent: 5000, limit: 25000, over: 0 },
  ],
  hidden: [{ name: 'образование', spent: 1000, limit: 20000, hot: 90 }],
  balances: [], empty: [], curve: [[1, 2000], [11, 80000]], forecast: 218182,
  fresh: { last: '2026-11-11 08:11', now: '2026-11-11T11:13' },
};

test('строка лимита: диктор слышит имя, потрачено, лимит, «+N» и состояние полоски — без подмены aria-label', () => {
  const v = view(NOW);
  const list = new El('section');
  for (const l of v.limits) list.append(limitRow(l, { plan: v.plan, open() {} }));
  const said = list.kids.map((row) => {
    assert.equal(row.attrs['aria-label'], undefined);
    return heard(row).replace(/\s+/g, ' ');
  });
  // после v3 (critique 12.11, P2 № 4): числа — словами, а не «+2 000 6 000 / 4 000»
  assert.equal(said[0], 'питомцы: 6 000 из 4 000, сверх на 2 000');
  // решение 63: перерасход покрыл резерв — без красного: «+N» и сумма спокойным цветом, подпись видна глазами
  const res = view({ ...NOW, limits: [...NOW.limits, { name: 'резерв', spent: 2000, limit: 30000, over: 0, eaten: 2000 }] });
  const pets = limitRow(res.limits[0], { plan: res.plan, open() {} });
  const all = [];
  walk(pets, (e) => all.push((e.attrs.class || '').split(' ')));
  assert.ok(!all.some((c) => c.includes('bad')));
  assert.ok(all.some((c) => c.includes('calm')));
  assert.equal(heard(pets).replace(/\s+/g, ' '), 'питомцы: 6 000 из 4 000, сверх на 2 000, покрыто резервом');
  assert.match(pets.textContent, /покрыто резервом/);
  assert.equal(said[1], 'путешествия: 14 000 из 16 000, выше плана');
  assert.equal(said[2], 'еда вне дома: 5 000 из 25 000, в плане');
  assertHeard(list, 3);
});

test('скрытый лимит (без состояния полоски): «образование: 1 000 из 20 000» и порог словами', () => {
  const row = view(NOW).hidden.rows[0];
  assert.equal(heard(limitRow(row, { open() {} })).replace(/\s+/g, ' '), 'образование: 1 000 из 20 000, в градуснике — от 90 % лимита');
});

const nav = {
  today: () => '2026-11-11', push() {}, render() {}, focus() {}, queued: () => [], healthView: () => view(NOW),
  accounts: () => [], balanceOf: () => null, savePeriod() {}, limitOf: () => null, noteOf: () => '',
  get: () => new Promise(() => {}),   // ответ не придёт: экран остаётся в загрузке
};

test('«Скрытые лимиты» и «Бюджет»: в строках слышны суммы, а не только «Операции: …»', () => {
  assertHeard(moreScreen({ kind: 'hidden', month: '2026-11' }, nav), 1);
  const budget = { month: '2026-11', income: null, groups: [{ name: 'Обязательные', rsd: 90000, avg_months: null,
    rows: [{ name: 'жильё', rsd: 90000, note: '(770 €)' }] }], savings: null, norm: 200000,
  limits: { rsd: 41000, eur: 350, rows: [{ name: 'продукты', rsd: 38000, set: '320 €', hot: null, off_norm: false },
    { name: 'комиссии', rsd: 3000, set: null, hot: 80, off_norm: true }] }, free: 0, plan: null };
  assertHeard(moreScreen({ kind: 'budget', month: '2026-11', data: budget }, nav), 2);
});

test('«История цены» и «По товарам»: в строках слышны цена, магазин и дата', () => {
  const price = { name: 'Mleko 1L', store: 'Lidl', unit: 'шт', product: 'P1:7', kind: 'молоко', count: 2, change: '+10 %',
    history: [{ day: '2026-06-01', store: 'Lidl', price: 100, receipt: 'A' }, { day: '2026-11-01', store: 'Lidl', price: 110, receipt: 'B' }],
    stores: [{ store: 'Lidl', name: 'Mleko 1L', price: 110, per: 'л', per_price: 110, day: '2026-11-01', product: 'P1:7', mine: true },
      { store: 'Maxi', name: 'MLEKO 0,5L', price: 70, per: 'л', per_price: 140, day: '2026-10-09', product: 'P2:9', mine: false }],
    cheapest: { store: 'Lidl', per_price: 110, per: 'л' } };
  assertHeard(moreScreen({ kind: 'price', q: { product: 'P1:7' }, data: price }, nav), 1);
  const basket = { month: '2026-11', receipts: 3, total: 9000, cats: [{ name: 'супермаркеты', share: 100, account: 'Expenses:Family:Food' }],
    top: [{ name: 'пиво', rsd: 1300, unit: 'шт', qty: 15, kind: 'пиво', product: null }], food: 50 };
  assertHeard(moreScreen({ kind: 'basket', month: '2026-11', data: basket }, nav), 1);
});

test('«Категории» и позиции чека в карточке: в строках слышны сумма, доля, разница и цена', () => {
  const cat = (key, name, rsd, prev) => ({ key, name, rsd, share: rsd / 10000, limit: null, prev });
  const cats = { from: '2026-11-01', to: '2026-11-30', end: '2026-11-11', scope: 'all', cat: null, total: 10000,
    prev: { from: '2026-10-01', to: '2026-10-11', total: 9000 },
    cats: [cat('Expenses:Family:Food', 'продукты', 6000, 5000), cat('Expenses:Family:Pets', 'питомцы', 4000, 4000)] };
  const entry = { kind: 'cats', period: { kind: 'month', from: '2026-11-01', to: '2026-11-30' }, cat: null, title: '',
    scope: 'all', data: cats, bars: null };
  assertHeard(catsScreen(entry, nav), 2);
  const card = { ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: 'чек', kind: 'spend', cats: ['алкоголь'], src: 'Freedom',
    amount: { number: 400, currency: 'RSD' }, rsd: 400, receipt: { shop: 'Lidl', at: '2026-11-10 18:39', total: 400, by: 'Алексей',
      items: [{ name: 'PIVO 0,5L', kind: null, qty: 4, unit: 'шт', price: 100, total: 400, cat: 'алкоголь' }] },
    flag: false, by: 'Алексей', at: '2026-11-10 18:40', refs: ['sms:1'], similar: [],
    postings: [{ name: 'Freedom', number: -400, currency: 'RSD' }, { name: 'алкоголь', number: 400, currency: 'RSD' }] };
  assertHeard(cardScreen({ kind: 'card', ref: 'sms:1', data: card }, nav), 1);
  assertHeard(cardScreen({ kind: 'card', ref: 'sms:1', data: { ...card, change: { accounts: ['Expenses:Family:Alcohol'],
    choices: [{ account: 'Expenses:Family:Alcohol', name: 'алкоголь' }] } } }, nav), 1);
});

// ——— фаза 15: фокус и диктор (critique 12.11, P1 № 2, персона Sam) ———

const doc = globalThis.document;
const focusKey = () => (doc.activeElement === doc.body ? 'BODY' : doc.activeElement.getAttribute('data-focus'));
const byKey = (root, k) => root.querySelectorAll('[data-focus]').find((e) => e.getAttribute('data-focus') === k);
const btn = (k, attrs = {}) => h('button', { type: 'button', 'data-focus': k, ...attrs }, k);
function setup() {
  const root = new El('main');
  const live = new El('div');
  doc.body.replaceChildren(root, live);
  doc.activeElement = doc.body;
  return { root, live, p: painter(root, doc, live) };
}

test('перерисовка: фокус — снова на кнопке с тем же ключом (это уже новый узел), страница не прокручивается', () => {
  const { root, p } = setup();
  p.show(btn('pace'), btn('limits-more'));
  byKey(root, 'pace').focus();
  const old = doc.activeElement;
  p.show(btn('pace'), btn('limits-more'));
  assert.notEqual(doc.activeElement, old);
  assert.equal(focusKey(), 'pace');
  assert.deepEqual(doc.activeElement.focusOpts, { preventScroll: true });
});

test('между перерисовками — скелет загрузки без кнопки: ключ помнится до экрана, где кнопка есть', () => {
  const { root, p } = setup();
  p.show(btn('month:prev'), btn('month:next'));
  byKey(root, 'month:prev').focus();
  p.show(h('div', { 'aria-busy': 'true' }));
  assert.equal(focusKey(), 'BODY');
  p.show(btn('month:prev'), btn('month:next'));
  assert.equal(focusKey(), 'month:prev');
});

test('кнопки с ключом на готовом экране нет (по ссылке «Открыть в Капусте»: трат категории за месяц нет) — фокус на заголовок', () => {
  const { root, p } = setup();
  p.show(btn('month:prev'), btn('cat-ops'));
  byKey(root, 'cat-ops').focus();
  p.focus('cat:Expenses:Family:Gifts');            // «Назад» — вернуть фокус на строку категории под экраном
  p.show(h('div', { 'aria-busy': 'true' }));        // скелет — строки ещё нет, ждём её
  assert.equal(focusKey(), 'BODY');
  p.show(h('h1', { 'data-focus': 'title', tabindex: '-1' }, 'Октябрь'), btn('month:prev'), btn('cat:Expenses:Family:Food'));
  assert.equal(focusKey(), 'title');
});

test('кнопка стала неактивной (стрелка «вперёд» дошла до текущего месяца) — фокус на соседнюю из data-focus-alt', () => {
  const { root, p } = setup();
  p.show(btn('month:prev'), btn('month:next', { 'data-focus-alt': 'month:prev' }));
  byKey(root, 'month:next').focus();
  p.show(btn('month:prev'), btn('month:next', { disabled: true, 'data-focus-alt': 'month:prev' }));
  assert.equal(focusKey(), 'month:prev');
});

test('поле поиска: фокус и курсор возвращаются, только пока поле в фокусе (иначе на телефоне выскочит клавиатура)', () => {
  const { root, p } = setup();
  const field = () => h('input', { type: 'search', 'data-focus': 'ops-q', value: 'лидл' });
  p.show(field(), btn('filters'));
  byKey(root, 'ops-q').focus();
  byKey(root, 'ops-q').setSelectionRange(2, 2);
  p.show(field(), btn('filters'));
  assert.equal(focusKey(), 'ops-q');
  assert.equal(doc.activeElement.selectionStart, 2);
  doc.activeElement = doc.body;          // тап мимо поля: клавиатура закрылась
  p.show(field(), btn('filters'));
  assert.equal(focusKey(), 'BODY');
});

test('поиск, затем тап по строке (на iPhone фокус остаётся в поле): «Назад» вернёт фокус на строку, не в BODY', () => {
  const { root, p } = setup();
  const row = h('button', { type: 'button', 'data-focus': 'op:add:1', on: { click: () => {} } }, 'Lidl');
  p.show(h('input', { type: 'search', 'data-focus': 'ops-q', value: 'лидл' }), row);
  byKey(root, 'ops-q').focus();
  byKey(root, 'op:add:1').click();          // тап: кнопка фокус не берёт, поле остаётся в фокусе
  assert.equal(focusKey(), 'ops-q');
  assert.equal(p.current(), 'op:add:1');     // это запомнит «Назад» (nav.push)
});

test('тап на телефоне кнопку не фокусирует: ни перерисовка, ни лист фокус не двигают (кольцо само не появится)', () => {
  const { p } = setup();
  p.show(btn('filters'));
  p.focus('sheet');
  p.show(btn('filters'), h('div', { role: 'dialog', 'data-focus': 'sheet', tabindex: '-1' }));
  assert.equal(focusKey(), 'BODY');
});

function opsSetup() {
  const s = setup();
  const entry = newOps('2026-11');
  entry.pages = [{ days: [], total: 0, count: 0, next: null }];
  const n = { ...nav, render: () => s.p.show(opsScreen(entry, n), btn('tab:ops')), focus: (k) => s.p.focus(k) };
  n.render();
  return { ...s, entry, n };
}

test('лист «Фильтры»: открыт — фокус в лист, aria-modal, фон inert; выбор чипа — фокус на нём; «Показать» — на «Фильтры»', () => {
  const { root, entry } = opsSetup();
  byKey(root, 'filters').focus();
  byKey(root, 'filters').click();
  const dialog = doc.activeElement;
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(dialog.getAttribute('tabindex'), '-1');
  const back = root.children.at(-1);
  assert.ok(back.contains(dialog), 'лист — последним в main, поверх всего');
  for (const el of root.children.slice(0, -1)) assert.ok(el.hasAttribute('inert'), el.tag);
  byKey(root, 'f:who:angelina').focus();
  byKey(root, 'f:who:angelina').click();
  assert.equal(focusKey(), 'f:who:angelina');
  assert.equal(entry.draft.who, 'angelina');
  byKey(root, 'sheet:show').focus();
  byKey(root, 'sheet:show').click();
  assert.equal(entry.sheet, false);
  assert.equal(focusKey(), 'filters');
  assert.ok(!root.children.some((el) => el.hasAttribute('inert')), 'без листа фон живой');
});

test('лист «Фильтры» закрыли «Назад» или Escape — фокус на «Фильтры»', () => {
  const { root, entry, n, p } = opsSetup();
  byKey(root, 'filters').focus();
  byKey(root, 'filters').click();
  // так закрывает app.js: back() — фокус на returnTo(stack), лист убрать, перерисовать
  p.focus(returnTo([entry]));
  entry.sheet = false;
  n.render();
  assert.equal(focusKey(), 'filters');
});

const CARD = { ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: 'чек', kind: 'spend', cats: ['алкоголь'], src: 'Freedom',
  amount: { number: 400, currency: 'RSD' }, rsd: 400, flag: false, by: 'Алексей', at: '2026-11-10 18:40', refs: ['sms:1'],
  similar: [], postings: [{ name: 'Freedom', number: -400, currency: 'RSD' }, { name: 'алкоголь', number: 400, currency: 'RSD' }],
  receipt: { shop: 'Lidl', at: '2026-11-10 18:39', total: 400, by: 'Алексей',
    items: [{ name: 'PIVO 0,5L', kind: null, qty: 4, unit: 'шт', price: 100, total: 400, cat: 'алкоголь',
      account: 'Expenses:Family:Alcohol' }] },
  change: { accounts: ['Expenses:Family:Alcohol'], choices: [{ account: 'Expenses:Family:Alcohol', name: 'алкоголь' },
    { account: 'Expenses:Family:Food', name: 'продукты' }, { account: 'Expenses:Family:Food:Market', name: 'рынок' }] } };

function cardSetup() {
  const s = setup();
  const entry = { kind: 'card', ref: 'sms:1', data: CARD };
  const n = { ...nav, render: () => s.p.show(cardScreen(entry, n)), focus: (k) => s.p.focus(k) };
  n.render();
  return { ...s, entry, n };
}

test('выбор категории: «Сменить» — фокус в лист; «Отмена» — назад на «Сменить»; позиция чека — назад на позицию', () => {
  const { root } = cardSetup();
  byKey(root, 'recat').focus();
  byKey(root, 'recat').click();
  assert.equal(doc.activeElement.getAttribute('role'), 'dialog');
  assert.equal(doc.activeElement.getAttribute('aria-modal'), 'true');
  byKey(root, 'sheet:cancel').focus();
  byKey(root, 'sheet:cancel').click();
  assert.equal(focusKey(), 'recat');
  byKey(root, 'item:0').focus();
  byKey(root, 'item:0').click();
  assert.equal(doc.activeElement.getAttribute('role'), 'dialog');
  byKey(root, 'sheet:cancel').click();
  assert.equal(focusKey(), 'item:0');
});

test('выбор категории: «Выберите категорию» неактивна — фокус остаётся в листе; группа — туда и обратно', () => {
  const { root, entry } = cardSetup();
  byKey(root, 'recat').focus();
  byKey(root, 'recat').click();
  const submit = byKey(root, 'sheet:submit');
  assert.ok(submit.disabled, 'без выбора — неактивна');
  byKey(root, 'cat:Expenses:Family:Food').focus();
  byKey(root, 'cat:Expenses:Family:Food').click();
  assert.equal(focusKey(), 'cat:Expenses:Family:Food');
  assert.equal(byKey(root, 'sheet:submit').disabled, false);
  byKey(root, 'cats-all').focus();
  byKey(root, 'cats-all').click();
  assert.equal(focusKey(), 'cats-all');
  byKey(root, 'catg:Expenses:Family:Food').focus();
  byKey(root, 'catg:Expenses:Family:Food').click();
  assert.equal(focusKey(), 'cats-back');          // группа открылась — фокус на «Все категории» сверху
  byKey(root, 'cats-back').click();
  assert.equal(focusKey(), 'catg:Expenses:Family:Food');
  assert.equal(entry.picker.group, null);
});

test('«Категории»: «В лимитах / Все траты» и чип периода — фокус остаётся на нажатом, пока грузится новый период', () => {
  const s = setup();
  const entry = newCats({ kind: 'month', from: '2026-11-01', to: '2026-11-30' });
  const n = { ...nav, render: () => s.p.show(catsScreen(entry, n), btn('tab:cats')), focus: (k) => s.p.focus(k) };
  n.render();
  byKey(s.root, 'scope:scale').focus();
  byKey(s.root, 'scope:scale').click();
  assert.equal(entry.scope, 'scale');
  assert.equal(focusKey(), 'scope:scale');
  byKey(s.root, 'period:week').focus();
  byKey(s.root, 'period:week').click();
  assert.equal(focusKey(), 'period:week');
  byKey(s.root, 'period:custom').focus();
  byKey(s.root, 'period:custom').click();
  assert.equal(doc.activeElement.getAttribute('aria-modal'), 'true');
  s.p.focus(returnTo([entry]));
  entry.sheet = false;
  n.render();
  assert.equal(focusKey(), 'period:custom');
});

// все кнопки и поля экранов — с ключом: иначе после перерисовки фокус не найдёт, куда вернуться
function unkeyed(tree) {
  const out = [];
  walk(tree, (el) => {
    if (['button', 'input', 'a'].includes(el.tag) && !el.hasAttribute('data-focus')) out.push(text(el, () => false).join('') || el.tag);
  });
  return out;
}

test('у каждой кнопки и поля экранов — ключ data-focus', () => {
  const { root: r1, entry } = opsSetup();
  entry.pages = [{ days: [{ date: '2026-11-10', sum: 400, ops: [{ ref: 'sms:1', where: 'Lidl', amount: { number: -400, currency: 'RSD' },
    rsd: -400, cats: ['алкоголь'], src: 'Freedom', marks: [], group: [] }] }], total: 400, count: 1, next: 'x' }];
  entry.f.who = 'angelina';
  entry.sheet = true;
  assert.deepEqual(unkeyed(opsScreen(entry, nav)), []);
  r1.replaceChildren();
  const sub = newCats({ kind: 'month', from: '2026-11-01', to: '2026-11-30' }, 'Expenses:Family:Food', 'продукты');
  sub.data = { from: '2026-11-01', to: '2026-11-30', end: '2026-11-11', scope: 'all', cat: 'Expenses:Family:Food', total: 6000,
    prev: null, limit: null, cats: [{ key: 'Expenses:Family:Food:Market', name: 'рынок', rsd: 6000, share: 1, limit: null, prev: null }],
    top: [{ ref: 'sms:2', where: 'Pijaca', date: '2026-11-03', rsd: 6000 }] };
  assert.deepEqual(unkeyed(catsScreen(sub, nav)), []);
  const root = newCats({ kind: 'month', from: '2026-11-01', to: '2026-11-30' });
  root.sheet = true;
  root.draft = { from: '2026-11-01', to: '2026-11-11' };
  assert.deepEqual(unkeyed(catsScreen(root, nav)), []);
  const card = { kind: 'card', ref: 'sms:1', data: CARD, notice: { tone: 'warn', text: 'в очереди', cancel: 'j1' },
    picker: { item: null, q: '', chosen: 'Expenses:Family:Food', all: true, group: null, from: 'recat' } };
  assert.deepEqual(unkeyed(cardScreen(card, nav)), []);
  assert.deepEqual(unkeyed(cardScreen({ ...card, picker: { ...card.picker, group: 'Expenses:Family:Food' } }, nav)), []);
  const v = view(NOW);
  assert.deepEqual(unkeyed(limitRow(v.limits[0], { open() {} })), []);
  assert.equal(limitRow(v.limits[0], { open() {} }).getAttribute('data-focus'), 'limit:питомцы');
  for (const mode of ['sum', 'plan']) {
    const days = { month: '2026-11', days: 30, scope: 'all', norm: 200000, points: [
      { date: '2026-11-03', rsd: 9000, scale: 9000, plan: 7000 }, { date: '2026-11-04', rsd: 1000, scale: 1000, plan: 7000 }] };
    assert.deepEqual(unkeyed(moreScreen({ kind: 'days', month: '2026-11', mode, data: days }, nav)), [], mode);
  }
  assert.deepEqual(unkeyed(moreScreen({ kind: 'hidden', month: '2026-11' }, nav)), []);
  assert.deepEqual(unkeyed(offlineBody('ops', { error: 'сеть' }, { ...nav, hasSnap: true }, () => {})), []);
});

test('открытый экран: заголовок принимает фокус скриптом (tabindex=-1, ключ title) — фокус не теряется в BODY', () => {
  const titles = [
    cardScreen({ kind: 'card', ref: 'sms:1', data: CARD }, nav),
    opsScreen({ ...newOps('2026-11', { title: 'Питомцы', params: { limit: 'питомцы' } }), pages: [{ days: [], total: 0, count: 0 }] }, nav),
    moreScreen({ kind: 'hidden', month: '2026-11' }, nav),
  ].map((tree) => byKey(tree, 'title'));
  for (const t of titles) {
    assert.ok(t, 'есть заголовок с ключом');
    assert.equal(t.getAttribute('tabindex'), '-1');
  }
});

test('диктор: сообщение (сохранено, ошибка, Мак спит) читается один раз; перерисовка его не повторяет', () => {
  const { root, live, entry, n } = cardSetup();
  entry.notice = { tone: 'good', text: 'Сменили на «продукты». Капуста написала в чат.' };
  n.render();
  assert.equal(live.textContent, 'Сменили на «продукты». Капуста написала в чат.');
  const once = live.writes;
  n.render();
  n.render();
  assert.equal(live.writes, once, 'та же плашка — диктор молчит');
  entry.notice = null;
  n.render();
  entry.notice = { tone: 'good', text: 'Сменили на «продукты». Капуста написала в чат.' };
  n.render();
  assert.equal(live.textContent, 'Сменили на «продукты». Капуста написала в чат.');
  assert.ok(live.writes > once + 1, 'новая смена — снова слышно');
  walk(root, (el) => {
    assert.equal(el.getAttribute('aria-live'), null, 'живых зон на экране нет — только своя маленькая');
    assert.notEqual(el.getAttribute('role'), 'status');
  });
});

test('диктор: Мак молчит на «Операциях» — слышно заголовок и что делать', () => {
  const { live, p } = setup();
  p.show(offlineBody('ops', { error: 'сеть: нет ответа за 8 с' }, { ...nav, hasSnap: true }, () => {}));
  assert.match(live.textContent, /\S/);
  assert.ok(!/сеть: нет ответа/.test(live.textContent), 'техническая причина — только на экране мелко');
});

test('живой зоны нет (index.html старый, из кэша Telegram) — экран всё равно рисуется', () => {
  const root = new El('main');
  doc.body.replaceChildren(root);
  const p = painter(root, doc, null);
  p.show(h('div', { 'data-say': 'Капуста не отвечает' }, 'Капуста не отвечает'));
  assert.equal(root.children.length, 1);
});

// ——— после v3: повторный critique 12.11, P2 № 3 и № 4 ———

const find = (root, fn) => { const out = []; walk(root, (e) => { if (fn(e)) out.push(e); }); return out; };

test('«Операции»: у экрана есть заголовок h1 — диктор находит экран по заголовкам; у счёта заголовок — его имя', () => {
  const { root } = opsSetup();
  assert.deepEqual(find(root, (e) => e.tag === 'h1').map((e) => e.textContent), ['Операции']);
  const acc = { ...newOps('2026-11'), pages: [{ days: [], total: 0, count: 0, next: null }] };
  acc.f.account = 'Assets:Family:Cash:Aleksey';
  const tree = opsScreen(acc, { ...nav, accounts: () => [['нал Алексея', 'Assets:Family:Cash:Aleksey']] });
  assert.deepEqual(find(tree, (e) => e.tag === 'h1').map((e) => e.textContent), ['Нал Алексея']);
});

test('лист «Фильтры»: группа чипов подписана — диктор слышит «Кто записал», а не третье «все» подряд', () => {
  const { root } = opsSetup();
  byKey(root, 'filters').click();
  const groups = find(root, (e) => e.getAttribute('role') === 'group');
  const names = groups.map((g) => find(root, (e) => e.getAttribute('id') === g.getAttribute('aria-labelledby'))[0].textContent);
  assert.deepEqual(names, ['Кошелёк или счёт', 'Кто записал', 'Источник']);
  for (const g of groups) assert.ok(find(g, (e) => e.textContent === 'все' && e.tag === 'button').length === 1);
});

test('карточка: категорию сменить нельзя — причина под категорией, кнопки «Сменить» нет', () => {
  const tree = cardScreen({ kind: 'card', ref: 'sms:1', data: { ...CARD, change: null, refs: ['sms:1', 'add:2'] } }, nav);
  assert.ok(!byKey(tree, 'recat'));
  assert.ok(find(tree, (e) => e.textContent === 'Из нескольких записей: сменить можно в чате с Капустой').length);
});
