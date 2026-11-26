// Пустой список говорит правду о своём месте (R-14, ревью 26.11.2026): поиск, фильтры, регулярная, редкая регулярная
// с конвертом, лимит, день. Было одно на всё: «В ноябре операций нет. Смените период или фильтры.» — и у пустого
// поиска, где операции есть, и там, где фильтров нет. Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, seen } from './fakedom.js';
import { emptyView } from '../js/ops.js';
import { opsScreen } from '../js/screens.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1\u00a0$2');
const F = { q: '', transfers: false, account: '', who: '', source: '', flag: false };
const entry = (extra = {}) => ({ kind: 'ops', month: '2026-11', ctx: null, f: { ...F }, ...extra });
const TODAY = '2026-11-26';

test('поиск без находок — «По запросу «…» в ноябре ничего нет» и «Очистить поиск»', () => {
  const v = emptyView(entry({ f: { ...F, q: 'zzzqqq' } }), null, TODAY);
  assert.deepEqual(v, { title: 'По запросу «zzzqqq» в ноябре ничего нет', text: '', clear: true });
  const filtered = emptyView(entry({ f: { ...F, q: 'сыр', who: 'angelina' } }), null, TODAY);
  assert.equal(filtered.text, 'Смените месяц или фильтры.');
});

test('список без поиска: с фильтрами — «таких операций нет», без них — сменить месяц стрелкой', () => {
  assert.deepEqual(emptyView(entry({ f: { ...F, transfers: true } }), null, TODAY),
    { title: 'В ноябре таких операций нет', text: 'Смените месяц или фильтры.', clear: false });
  assert.deepEqual(emptyView(entry(), null, TODAY), { title: 'В ноябре операций нет', text: 'Смените месяц стрелкой.', clear: false });
});

test('регулярная без платежа — «В ноябре платежа не было», фильтров на экране нет', () => {
  const ctx = { title: 'Связь', params: { regular: 'связь' }, limitWord: 'В норме' };
  assert.deepEqual(emptyView(entry({ ctx }), { norm: 4272, carry: 0, cap: 0 }, TODAY),
    { title: 'В ноябре платежа не было', text: 'Смените месяц стрелкой.', clear: false });
});

test('редкая регулярная (спортпит, конверт): пустой месяц — так и задумано; сколько уйдёт в конверт', () => {
  const ctx = { title: 'Спортпит', params: { regular: 'спортпит' }, limitWord: 'В норме' };
  const now = emptyView(entry({ ctx }), { norm: 5411, carry: 0, cap: 16233 }, TODAY);
  assert.equal(now.title, 'В ноябре покупки не было');
  assert.equal(now.text, sp('Так и задумано: покупка редкая. Без неё 5 411 из нормы ноября уйдут в конверт.'));
  const past = emptyView(entry({ month: '2026-10', ctx }), { norm: 5411, carry: 12000, cap: 16233 }, TODAY);
  assert.equal(past.text, sp('Так и задумано: покупка редкая. 4 233 из нормы октября ушли в конверт.'));   // до предела
  const full = emptyView(entry({ ctx }), { norm: 5411, carry: 16233, cap: 16233 }, TODAY);
  assert.equal(full.text, sp('Так и задумано: покупка редкая. Конверт уже полон — 16 233.'));
});

test('лимит и категория — «трат «…» нет» и стрелка; день из «По дням» — без повтора даты', () => {
  const limit = { title: 'Одежда', params: { limit: 'одежда' } };
  assert.deepEqual(emptyView(entry({ ctx: limit }), null, TODAY),
    { title: 'В ноябре трат «одежда» нет', text: 'Смените месяц стрелкой.', clear: false });
  const week = { title: 'Одежда', period: { kind: 'week', from: '2026-11-09', to: '2026-11-15' }, params: { cat: 'x' } };
  assert.equal(emptyView(entry({ ctx: week }), null, TODAY).text, 'Смените период стрелкой.');
  const day = { title: '25 ноября', period: { kind: 'custom', from: '2026-11-25', to: '2026-11-25' }, params: {} };
  assert.deepEqual(emptyView(entry({ ctx: day }), null, TODAY),
    { title: '25 ноября трат нет', text: 'Смените день стрелкой.', clear: false });
});

test('экран: «Очистить поиск» снимает запрос и грузит список заново', () => {
  const asked = [];
  const focused = [];
  const nav = { today: () => TODAY, accounts: () => [], balanceOf: () => null, queued: () => [], render() {}, focus: (k) => focused.push(k),
    get: async (p) => { asked.push(p); return { data: { days: [], count: 0, total: 0, next: null } }; } };
  const e = { ...entry({ f: { ...F, q: 'zzzqqq' } }), pages: [{ days: [], count: 0, total: 0, next: null }],
    expanded: new Set() };
  const screen = opsScreen(e, nav);
  assert.match(seen(screen), /По запросу «zzzqqq» в ноябре ничего нет/);
  assert.doesNotMatch(seen(screen), /Смените период или фильтры/);
  const clear = all(screen, '<button').find((b) => seen(b) === 'Очистить поиск');
  clear.handlers.click({});
  assert.equal(e.f.q, '');
  assert.deepEqual(focused, ['title'], 'фокус — на заголовок экрана: поле поиска скрипт не фокусирует (клавиатура телефона)');
  assert.equal(asked.length, 1);
  assert.doesNotMatch(asked[0], /q=/);
});
