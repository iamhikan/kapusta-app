// Первый экран по адресу кнопки «Открыть в Капусте» под ответом бота (решение 74): screen, month, cat после ?api=.
// Нет параметров или они неверные — «Здоровье», как было. Числа и месяцы в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startAt } from '../js/start.js';
import { loadCats, newCats } from '../js/catscreen.js';

const TODAY = '2026-07-14';
const API = '?api=https://mac.tail0.ts.net';
const kinds = (s) => s.stack.map((e) => e.kind);

test('без параметров — «Здоровье» текущего месяца, как было', () => {
  const s = startAt(API, TODAY);
  assert.deepEqual(kinds(s), ['health']);
  assert.equal(s.month, null);
});

test('fin last — «Операции» текущего месяца, вкладка внизу стека', () => {
  const s = startAt(`${API}&screen=ops`, TODAY);
  assert.deepEqual(kinds(s), ['ops']);
  assert.equal(s.stack[0].month, '2026-07');
  assert.equal(s.stack[0].ctx, null);
});

test('fin spent — «Категории» месяца из адреса, «Все траты»', () => {
  const s = startAt(`${API}&screen=cats&month=2026-04`, TODAY);
  assert.deepEqual(kinds(s), ['cats']);
  assert.deepEqual(s.stack[0].period, { kind: 'month', from: '2026-04-01', to: '2026-04-30' });
  assert.equal(s.stack[0].scope, 'all');
  assert.equal(s.stack[0].cat, null);
});

test('fin spent --cat — подкатегории поверх всех категорий того же месяца; «Назад» вернёт фокус на строку категории', () => {
  const s = startAt(`${API}&screen=cats&month=2026-04&cat=Expenses%3AFamily%3AFood`, TODAY);
  assert.deepEqual(kinds(s), ['cats', 'cats']);
  const [root, sub] = s.stack;
  assert.equal(root.cat, null);
  assert.equal(root.focus, 'cat:Expenses:Family:Food');
  assert.equal(sub.cat, 'Expenses:Family:Food');
  assert.deepEqual(sub.period, root.period);
  assert.notEqual(sub.period, root.period, 'у каждого экрана свой период: стрелки подкатегорий не листают корень');
  assert.equal(sub.title, '', 'имя категории придёт с ответом API');
  assert.equal(sub.scope, 'all');
});

test('fin limits, fin plan — «Бюджет» месяца над «Здоровьем» того же месяца; «Назад» — на строку «Весь бюджет»', () => {
  const s = startAt(`${API}&screen=budget&month=2026-06`, TODAY);
  assert.deepEqual(kinds(s), ['health', 'budget']);
  assert.equal(s.stack[1].month, '2026-06');
  assert.equal(s.stack[0].focus, 'budget');
  assert.equal(s.month, '2026-06');
});

test('неверный адрес — «Здоровье»: экран чужой, месяц кривой или ещё не начался', () => {
  for (const q of ['&screen=card', '&screen=cats', '&screen=cats&month=2026-13', '&screen=cats&month=2026-8',
    '&screen=budget&month=2026-08', '&screen=budget&month=июнь', '&screen=health&month=2026-05']) {
    assert.deepEqual(kinds(startAt(`${API}${q}`, TODAY)), ['health'], q);
  }
});

test('категория не из трат — только «Категории» месяца', () => {
  for (const cat of ['Assets:Family:Cash', 'Expenses', 'Expenses:Family:<b>', '']) {
    const s = startAt(`${API}&screen=cats&month=2026-04&cat=${encodeURIComponent(cat)}`, TODAY);
    assert.deepEqual(kinds(s), ['cats'], cat);
    assert.equal(s.stack[0].focus, undefined, cat);
  }
});

test('месяц «Операций» — всегда текущий: fin last про последние траты', () => {
  assert.equal(startAt(`${API}&screen=ops&month=2026-02`, TODAY).stack[0].month, '2026-07');
});

test('подкатегории по ссылке: заголовок — имя категории из ответа API', async () => {
  const entry = newCats({ kind: 'month', from: '2026-04-01', to: '2026-04-30' }, 'Expenses:Family:Food', '');
  const nav = { render() {}, get: async () => ({ data: { cat: 'Expenses:Family:Food', name: 'продукты', total: 10,
    cats: [] } }) };
  await loadCats(entry, nav);
  assert.equal(entry.title, 'продукты');
  const own = newCats({ kind: 'month', from: '2026-04-01', to: '2026-04-30' }, 'Expenses:Family:Food', 'своё имя');
  await loadCats(own, nav);
  assert.equal(own.title, 'своё имя', 'имя строки, по которой открыли, не меняется');
});
