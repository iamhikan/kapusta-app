// Слова приложения (решение 51) на собранных экранах: «Откуда и куда» без ref в карточке, «В лимитах» на «Категориях».
// Экраны собираются на поддельном DOM. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardScreen } from '../js/screens.js';
import { catsScreen } from '../js/catscreen.js';
import { emptyText } from '../js/ops.js';

class El {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.kids = []; this.style = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener() {}
  append(kid) { this.kids.push(kid); }
  set value(v) { this.attrs.value = v; }
}
globalThis.document = { createElement: (t) => new El(t), createElementNS: (_, t) => new El(t) };
const text = (el) => (typeof el === 'string' ? el : el.kids.map(text).join(' '));

const nav = { today: () => '2026-11-11', push() {}, render() {}, queued: () => [], accounts: () => [], savePeriod() {} };

test('карточка: «Откуда и куда» вместо «Проводки», ref не виден; сумма — с RSD', () => {
  // правка 3: «Откуда и куда» — у траты с долями; у простой траты его нет
  const card = { ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: 'чек', kind: 'spend', cats: ['алкоголь', 'продукты'],
    src: 'Freedom', amount: { number: 400, currency: 'RSD' }, rsd: 400, receipt: false, flag: false, by: 'Алексей',
    at: '2026-11-10 18:40', refs: ['sms:1', 'rcpt:XYZ-1'], similar: [],
    postings: [{ name: 'Freedom', number: -400, currency: 'RSD' }, { name: 'алкоголь', number: 300, currency: 'RSD' },
      { name: 'продукты', number: 100, currency: 'RSD' }] };
  const said = text(cardScreen({ kind: 'card', ref: 'sms:1', data: card }, nav));
  assert.match(said, /Откуда и куда/);
  assert.doesNotMatch(said, /Проводки/);
  assert.doesNotMatch(said, /sms:1|rcpt:XYZ/);
  assert.match(said, /400\s+RSD/);
});

test('«Категории»: переключатель «В лимитах / Все траты» (решение 51)', () => {
  const entry = { kind: 'cats', period: { kind: 'month', from: '2026-11-01', to: '2026-11-30' }, cat: null, title: '',
    scope: 'all', data: { from: '2026-11-01', to: '2026-11-30', end: '2026-11-11', scope: 'all', cat: null, total: 100,
      cats: [{ key: 'Expenses:Family:Food', name: 'продукты', rsd: 100, share: 1, limit: null }] }, bars: null };
  const said = text(catsScreen(entry, nav));
  assert.match(said, /В лимитах/);
  assert.doesNotMatch(said, /Шкала/);
});

test('«Категории»: «По дням» описан словами человека, без «тепловой карты» (critique 12.11, P2 № 5)', () => {
  const entry = { kind: 'cats', period: { kind: 'month', from: '2026-11-01', to: '2026-11-30' }, cat: null, title: '',
    scope: 'all', data: { from: '2026-11-01', to: '2026-11-30', end: '2026-11-11', scope: 'all', cat: null, total: 100,
      cats: [{ key: 'Expenses:Family:Food', name: 'продукты', rsd: 100, share: 1, limit: null }] }, bars: null };
  const said = text(catsScreen(entry, nav));
  assert.match(said, /По дням/);
  assert.doesNotMatch(said, /тепловая/i);
  assert.match(said, /траты каждого дня/);
});

test('«Ещё в …»: сумма и подпись — как в списке; сверка — «остаток после сверки» и остаток, не сумма прихода (решение 68)', () => {
  const card = { ref: 'add:c', date: '2026-11-11', at: '2026-11-11 21:46', where: 'Freedom', what: 'остаток', kind: 'transfer',
    cats: [], src: 'Freedom', rsd: 9000, receipt: null, flag: false, by: 'Алексей', opening: 'check', refs: ['add:c'],
    after: { lines: [{ number: 30.5, currency: 'EUR' }, { number: 0.2, currency: 'USD' }], rsd: 3600.6 },
    legs: [{ name: 'Freedom', number: 30.5, currency: 'EUR' }],
    postings: [{ account: 'Assets:Family:Freedom:EUR', name: 'Freedom', number: 30.5, currency: 'EUR' },
      { account: 'Equity:Opening-Balances', name: 'начальный остаток', number: -30.5, currency: 'EUR' }],
    similar: [{ ref: 'walt:2', date: '2026-11-06', where: 'Freedom', kind: 'income', cats: [], src: 'Freedom',
      amount: { number: 1000, currency: 'USDT' }, rsd: 104500, receipt: false, flag: false }] };
  const said = text(cardScreen({ kind: 'card', ref: 'add:c', data: card }, nav)).replace(/\s+/g, ' ');
  assert.match(said, /30,50 €/);
  assert.doesNotMatch(said, /9\s000/);
  assert.match(said, /остаток после сверки/);
  assert.match(said, /сверка остатка/);
  assert.doesNotMatch(said, /начальный остаток/);
  assert.match(said, /\+1\s000 USDT 104\s500 RSD/);
});

test('пустой период: «За ноябрь 2026 трат «салон» нет» — месяц строчной буквой; у недели, квартала, года и своего — как в названии (долг 12.11)', () => {
  const empty = (period, cat, title) => {
    const entry = { kind: 'cats', period, cat, title, scope: 'all', bars: null,
      data: { from: period.from, to: period.to, end: '2026-11-11', scope: 'all', cat, total: 0, cats: [] } };
    return text(catsScreen(entry, nav)).replace(/\s+/g, ' ');
  };
  const month = { kind: 'month', from: '2026-11-01', to: '2026-11-30' };
  assert.match(empty(month, 'Income:Angelina:PR', 'салон'), /За ноябрь 2026 трат «салон» нет/);
  assert.match(empty(month, null, ''), /За ноябрь 2026 трат нет/);
  assert.match(empty(month, null, ''), /‹ Октябрь 2026/);
  assert.match(empty({ kind: 'week', from: '2026-11-09', to: '2026-11-15' }, null, ''), /За 9–15 ноября 2026 трат нет/);
  assert.match(empty({ kind: 'quarter', from: '2026-10-01', to: '2026-12-31' }, null, ''), /За IV квартал 2026 трат нет/);
  assert.match(empty({ kind: 'year', from: '2026-01-01', to: '2026-12-31' }, null, ''), /За 2026 год трат нет/);
  assert.match(empty({ kind: 'custom', from: '2026-11-03', to: '2026-11-07' }, null, ''), /За 3–7 ноября 2026 трат нет/);
});

test('«Операции» категории за пустой месяц: «За октябрь 2026 трат «одежда» нет» (долг 12.11)', () => {
  assert.equal(emptyText(null, 'Одежда', { kind: 'month', from: '2026-10-01', to: '2026-10-31' }),
    'За октябрь 2026 трат «одежда» нет');
  assert.equal(emptyText(null, 'Одежда', { kind: 'quarter', from: '2026-10-01', to: '2026-12-31' }),
    'За IV квартал 2026 трат «одежда» нет');
});
