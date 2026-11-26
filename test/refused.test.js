// R-19 (ревью 26.11; решение 98, ответ 8 — меняет решение 83): fin отказал по сути запроса (4xx) — «Повторить» даёт тот
// же отказ. Вместо него — действие по месту: карточка — «К списку»; список с фильтром, поиском или категорией — «Все
// операции месяца»; другой месяц — «К текущему месяцу»; следующие 50 — «Загрузить список заново»; иначе — «Назад».
// Ошибка fin (5xx) и молчание Мака — «Повторить», как раньше. Путь — как в приложении: fetch -> get -> загрузчик -> экран.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, one, seen } from './fakedom.js';
import { get, refusedStep, screen } from '../js/api.js';
import { cardScreen, loadCard, loadOps, newOps, opsScreen, problemScreen } from '../js/screens.js';
import { catsScreen, loadCats, newCats } from '../js/catscreen.js';
import { loadMore, moreScreen } from '../js/more.js';

const BASE = 'https://mac.tail0.ts.net';
const TODAY = '2026-11-13';

// ответы по очереди: [код, тело]; asked — пути запросов
function navOf(answers, extra = {}) {
  const asked = [];
  const fetchOf = ([status, body]) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  return { asked, today: () => TODAY, accounts: () => [], balanceOf: () => null, queued: () => [], savePeriod() {},
    focus() {}, push() {}, render() {}, limitOf: () => null, noteOf: () => '', problem() {}, snapshot() {}, hasSnap: true,
    get: (path) => { asked.push(path); return get(path, { base: BASE, initData: 'x', fetch: fetchOf(answers.shift() || [200, {}]), timeout: 20 }); },
    ...extra };
}

const buttons = (tree) => all(tree, '<button').map(seen);
const button = (tree, text) => all(tree, '<button').find((b) => seen(b) === text) || null;
const press = (el) => el.handlers.click({ target: el, currentTarget: el });
const tick = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setImmediate(r)); };
const page = { days: [{ date: '2026-11-10', sum: 500, ops: [{ ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: '',
  kind: 'spend', cats: ['продукты'], src: 'Freedom', amount: { number: 500, currency: 'RSD' }, rsd: 500, receipt: false,
  flag: false, by: 'Алексей' }] }], count: 1, total: 500, next: null };

test('R-19: «Операции» лимита, 400 «нет лимита «кофе»» — «Все операции месяца» вместо «Повторить»; нажали — список месяца без лимита', async () => {
  const nav = navOf([[400, { error: 'нет лимита «кофе»' }], [200, page]]);
  const entry = newOps('2026-11', { title: 'Кофе', params: { limit: 'кофе' } });
  await loadOps(entry, nav);
  const box = one(opsScreen(entry, nav), 'empty');
  assert.equal(seen(one(box, '<p')), 'Нет лимита «кофе».');
  assert.deepEqual(buttons(box), ['Все операции месяца']);
  press(button(box, 'Все операции месяца'));
  await tick();
  assert.doesNotMatch(nav.asked[1], /limit=/);
  assert.match(nav.asked[1], /from=2026-11-01/);
  assert.match(seen(opsScreen(entry, nav)), /Lidl/);
});

test('R-19: «Операции» с поиском и фильтром счёта, 400 — «Все операции месяца» снимает и поиск, и фильтр', async () => {
  const nav = navOf([[400, { error: 'нет такого счёта' }], [200, page]]);
  const entry = newOps('2026-11');
  Object.assign(entry.f, { q: 'сыр', account: 'Assets:Family:Nope' });
  entry.typed = 'сыр';
  await loadOps(entry, nav);
  press(button(opsScreen(entry, nav), 'Все операции месяца'));
  await tick();
  assert.doesNotMatch(nav.asked[1], /q=|account=/);
  assert.equal(entry.typed, '');
});

test('R-19: «Операции» прошлого месяца без фильтров, 400 — «К текущему месяцу»; текущий без фильтров — без кнопки: над ошибкой стрелки месяца и фильтры', async () => {
  const nav = navOf([[400, { error: 'month — ГГГГ-ММ' }], [200, page]]);
  const old = newOps('2026-09');
  await loadOps(old, nav);
  press(button(one(opsScreen(old, nav), 'empty'), 'К текущему месяцу'));
  await tick();
  assert.match(nav.asked[1], /from=2026-11-01/);
  assert.equal(old.month, '2026-11');
  const now = newOps('2026-11');
  const nav2 = navOf([[400, { error: 'неверные параметры' }]]);
  await loadOps(now, nav2);
  const tree = opsScreen(now, nav2);
  assert.deepEqual(buttons(one(tree, 'empty')), []);
  assert.ok(button(tree, 'Фильтры'), 'над ошибкой — строка поиска и «Фильтры»');
});

test('R-19: следующие 50, 400 — под списком «Загрузить список заново», запрос — с начала, без cursor', async () => {
  const nav = navOf([[200, { ...page, next: '50' }], [400, { error: 'cursor — число' }], [200, page]]);
  const entry = newOps('2026-11');
  await loadOps(entry, nav);
  await loadOps(entry, nav, true);
  const tree = opsScreen(entry, nav);
  assert.match(seen(tree), /Lidl/);
  assert.equal(button(tree, 'Повторить'), null);
  press(button(tree, 'Загрузить список заново'));
  await tick();
  assert.doesNotMatch(nav.asked[2], /cursor=/);
});

test('R-19: карточка, 404 «нет такой операции» — «Её могли удалить или заменить.» и «К списку» («Назад» на список)', async () => {
  let back = 0;
  const nav = navOf([[404, { error: 'нет такой операции' }]], { back: () => { back += 1; }, under: () => 'ops' });
  const entry = { kind: 'card', ref: 'sms:gone' };
  await loadCard(entry, nav);
  const tree = cardScreen(entry, nav);
  // «или заменить» — через неразрывный пробел: при 390 px «заменить.» висело одно в строке (детектор, стенд S5)
  assert.match(seen(tree), /Нет такой операции\. Её могли удалить или\u00a0заменить\./);
  assert.deepEqual(buttons(one(tree, 'empty')), ['К списку']);
  press(button(tree, 'К списку'));
  assert.equal(back, 1);
  const deeper = navOf([[404, { error: 'нет такой операции' }]], { back() {}, under: () => 'card' });
  const again = { kind: 'card', ref: 'sms:gone' };
  await loadCard(again, deeper);
  assert.deepEqual(buttons(one(cardScreen(again, deeper), 'empty')), ['Назад'], 'под карточкой — карточка: «Назад»');
});

test('R-19: «Бюджет» с неверным месяцем, 400 — «К текущему месяцу»; нажали — «Бюджет» ноября', async () => {
  const nav = navOf([[400, { error: 'month — ГГГГ-ММ' }]], { under: () => 'health', back() {} });
  const entry = { kind: 'budget', month: '2026-1' };
  await loadMore(entry, nav);
  press(button(moreScreen(entry, nav), 'К текущему месяцу'));
  await tick();
  assert.equal(nav.asked[1], '/api/budget?month=2026-11');
});

test('R-19: подкатегории, 400 «нет такой категории» за текущий месяц — «Назад»; «Категории» другого месяца — «К текущему месяцу»', async () => {
  let back = 0;
  const nav = navOf([[400, { error: 'нет такой категории' }]], { under: () => 'cats', back: () => { back += 1; } });
  const sub = newCats({ kind: 'month', from: '2026-11-01', to: '2026-11-30' }, 'Expenses:Family:Nope', '');
  await loadCats(sub, nav);
  press(button(catsScreen(sub, nav), 'Назад'));
  assert.equal(back, 1);
  const saved = [];
  const nav2 = navOf([[400, { error: 'неверные параметры' }], [400, { error: 'неверные параметры' }]],
    { savePeriod: (p) => saved.push(p) });
  const root = newCats({ kind: 'year', from: '2025-01-01', to: '2025-12-31' });
  await loadCats(root, nav2);
  press(button(catsScreen(root, nav2), 'К текущему месяцу'));
  await tick();
  assert.deepEqual(root.period, { kind: 'month', from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(saved, [root.period], 'период «Категорий» запомнен, как у стрелки');
  assert.match(nav2.asked.slice(2).find((x) => x.startsWith('/api/categories')), /from=2026-11-01/);
});

test('R-19: 503 и молчание Мака — «Повторить», как раньше (решение 83)', async () => {
  const nav = navOf([[503, { error: 'ledger не грузится' }]], { under: () => 'ops', back() {} });
  const entry = { kind: 'card', ref: 'sms:1' };
  await loadCard(entry, nav);
  assert.deepEqual(buttons(one(cardScreen(entry, nav), 'empty')), ['Повторить']);
});

// «Здоровье» текущего месяца fin отказывает, когда часы телефона ушли вперёд часов Мака («месяц ещё не начался»):
// «К текущему месяцу» дал бы тот же отказ, «Закрыть» закрыл бы Капусту — по месту остаётся прошлый месяц
test('R-19: «Здоровье» другого месяца, 400 — «К текущему месяцу»; текущего — «Прошлый месяц», не «Повторить»', () => {
  assert.deepEqual(refusedStep('health', { month: '2026-09' }, { today: TODAY }), { label: 'К текущему месяцу', act: 'now' });
  assert.deepEqual(refusedStep('health', { month: '2026-11' }, { today: TODAY }), { label: 'Прошлый месяц', act: 'prev' });
  let went = 0;
  const s = screen('refused', 'месяц ещё не начался');
  const tree = problemScreen(s, { retry() {}, close() {}, step: { label: 'К текущему месяцу', run: () => { went += 1; } } });
  assert.match(seen(tree), /Месяц ещё не начался\./);
  assert.deepEqual(buttons(tree), ['К текущему месяцу']);
  press(button(tree, 'К текущему месяцу'));
  assert.equal(went, 1);
  assert.deepEqual(buttons(problemScreen(s, { retry() {}, close() {} })), ['Закрыть']);
});
