// Слова приложения (решение 51) на собранных экранах: «Откуда и куда» без ref в карточке, «В лимитах» на «Категориях».
// Экраны собираются на поддельном DOM. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardScreen } from '../js/screens.js';
import { catsScreen } from '../js/catscreen.js';

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
  const card = { ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: 'чек', kind: 'spend', cats: ['алкоголь'], src: 'Freedom',
    amount: { number: 400, currency: 'RSD' }, rsd: 400, receipt: false, flag: false, by: 'Алексей', at: '2026-11-10 18:40',
    refs: ['sms:1', 'rcpt:XYZ-1'], similar: [],
    postings: [{ name: 'Freedom', number: -400, currency: 'RSD' }, { name: 'алкоголь', number: 400, currency: 'RSD' }] };
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
