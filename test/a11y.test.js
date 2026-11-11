// Что слышит диктор (VoiceOver, TalkBack) в строках-кнопках (фаза 12): aria-label не прячет суммы, которые видны
// на экране; состояние полоски лимита — словами. Экраны собираются на поддельном DOM. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { view } from '../js/health.js';
import { limitRow } from '../js/limitrow.js';
import { moreScreen } from '../js/more.js';
import { catsScreen } from '../js/catscreen.js';
import { cardScreen } from '../js/screens.js';

class El {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.kids = []; this.style = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener() {}
  append(kid) { this.kids.push(kid); }
  set value(v) { this.attrs.value = v; }
  get classes() { return (this.attrs.class || '').split(/\s+/); }
}
globalThis.document = { createElement: (t) => new El(t), createElementNS: (_, t) => new El(t) };

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
  assert.match(said[0], /питомцы.*\+2 000.*6 000.*4 000.*сверх лимита/);
  assert.match(said[1], /путешествия.*14 000.*16 000.*выше плана/);
  assert.match(said[2], /еда вне дома.*5 000.*25 000.*в плане/);
  assertHeard(list, 3);
});

const nav = {
  today: () => '2026-11-11', push() {}, render() {}, queued: () => [], healthView: () => view(NOW),
  accounts: () => [], balanceOf: () => null, savePeriod() {},
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
