// Загрузка экранов (М1, фаза 6 рефакторинга 11.2026): новая загрузка идёт всегда, даже если старая ещё не ответила;
// поздний ответ старой экран не трогает (защита — номер запроса seq). Поддельный DOM — fakedom.js. Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seen } from './fakedom.js';
import { cardScreen, loadCard, loadOps, newOps, opsScreen } from '../js/screens.js';
import { catsScreen, loadCats, newCats } from '../js/catscreen.js';
import { loadMore, moreScreen } from '../js/more.js';

// сервер, который отвечает, когда скажет тест: каждый запрос ждёт своего resolve
function server() {
  const asked = [];
  return { asked, get: (path) => new Promise((resolve) => asked.push({ path, resolve })) };
}
const tick = () => new Promise((r) => setImmediate(r));

function makeNav(s) {
  const nav = { today: () => '2026-11-13', accounts: () => [], balanceOf: () => null, queued: () => [], savePeriod() {},
    focus() {}, push() {}, limitOf: () => null, noteOf: () => '', renders: 0, get: s.get };
  nav.render = () => { nav.renders += 1; };
  return nav;
}

const op = (where) => ({ ref: `sms:${where}`, date: '2026-11-10', where, what: '', kind: 'spend', cats: ['продукты'],
  src: 'Freedom', amount: { number: 500, currency: 'RSD' }, rsd: 500, receipt: false, flag: false, by: 'Алексей' });
const page = (where) => ({ days: [{ date: '2026-11-10', sum: 500, ops: [op(where)] }], count: 1, total: 500, next: null });

// что меняет человек, пока список грузится, и как это видно в запросе
const CHANGES = [
  ['«Переводы»', (e) => { e.f.transfers = true; }, /transfers=1/],
  ['поиск', (e) => { e.f.q = 'сыр'; }, /q=%D1%81%D1%8B%D1%80/],
  ['стрелка месяца', (e) => { e.month = '2026-10'; }, /from=2026-10-01/],
];

for (const [what, change, fresh] of CHANGES) {
  test(`«Операции»: ${what} во время подгрузки — список под новый выбор; поздний ответ старого запроса экран не трогает`, async () => {
    const s = server();
    const nav = makeNav(s);
    const entry = newOps('2026-11');
    loadOps(entry, nav);
    change(entry);
    loadOps(entry, nav);
    const now = s.asked.find((x) => fresh.test(x.path));
    assert.ok(now, `запрос под новый выбор ушёл; ушли: ${s.asked.map((x) => x.path).join(', ')}`);
    now.resolve({ data: page('Maxi') });
    await tick();
    const renders = nav.renders;
    s.asked.find((x) => x !== now).resolve({ data: page('Lidl') });
    await tick();
    assert.equal(nav.renders, renders, 'поздний ответ старого запроса не перерисовывает экран');
    const text = seen(opsScreen(entry, nav));
    assert.match(text, /Maxi/);
    assert.doesNotMatch(text, /Lidl/);
    assert.equal(entry.loading, false, '«Загружаю…» не висит');
  });
}

test('«Операции»: «Показать ещё» во время подгрузки следующих 50 — одна страница, без повтора', async () => {
  const s = server();
  const nav = makeNav(s);
  const entry = newOps('2026-11');
  loadOps(entry, nav);
  s.asked[0].resolve({ data: { ...page('Lidl'), next: '50' } });
  await tick();
  loadOps(entry, nav, true);
  loadOps(entry, nav, true);
  assert.equal(s.asked.length, 2, 'следующие 50 запрошены один раз');
  s.asked[1].resolve({ data: page('Maxi') });
  await tick();
  assert.equal((seen(opsScreen(entry, nav)).match(/Maxi/g) || []).length, 1);
});

test('«Операции»: фильтр сменили, пока грузятся следующие 50, — ответ на старый курсор в новый список не попадает', async () => {
  const s = server();
  const nav = makeNav(s);
  const entry = newOps('2026-11');
  loadOps(entry, nav);
  s.asked[0].resolve({ data: { ...page('Lidl'), next: '50' } });
  await tick();
  loadOps(entry, nav, true);
  entry.f.transfers = true;
  loadOps(entry, nav);
  const now = s.asked.find((x) => /transfers=1/.test(x.path));
  assert.ok(now, `запрос под новый фильтр ушёл; ушли: ${s.asked.map((x) => x.path).join(', ')}`);
  now.resolve({ data: page('Maxi') });
  await tick();
  s.asked.find((x) => /cursor=50/.test(x.path)).resolve({ data: page('Idea') });
  await tick();
  const text = seen(opsScreen(entry, nav));
  assert.match(text, /Maxi/);
  assert.doesNotMatch(text, /Idea|Lidl/);
});

const cats = (name) => ({ from: '2026-11-01', to: '2026-11-30', end: '2026-11-13', scope: 'all', cat: null, total: 500,
  cats: [{ key: `Expenses:Family:${name}`, name, rsd: 500, share: 1, limit: null }] });

test('«Категории»: период сменили во время подгрузки — категории нового периода; поздний ответ старого не виден', async () => {
  const s = server();
  const nav = makeNav(s);
  const entry = newCats({ kind: 'month', from: '2026-11-01', to: '2026-11-30' });
  loadCats(entry, nav);
  entry.period = { kind: 'month', from: '2026-10-01', to: '2026-10-31' };
  loadCats(entry, nav);
  const now = s.asked.filter((x) => x.path.startsWith('/api/categories') && x.path.includes('from=2026-10-01'));
  assert.equal(now.length, 1, 'запрос нового периода ушёл');
  for (const x of s.asked.filter((y) => y.path.startsWith('/api/series'))) x.resolve({ data: null });
  now[0].resolve({ data: cats('питомцы') });
  await tick();
  const renders = nav.renders;
  s.asked.find((x) => x.path.startsWith('/api/categories') && x !== now[0]).resolve({ data: cats('аптека') });
  await tick();
  assert.equal(nav.renders, renders);
  const text = seen(catsScreen(entry, nav));
  assert.match(text, /питомцы/i);
  assert.doesNotMatch(text, /аптека/i);
});

test('экраны этапа 7 («По товарам», «Бюджет», «По дням»): повтор загрузки — поздний ответ первой не виден', async () => {
  const s = server();
  const nav = makeNav(s);
  const entry = { kind: 'basket', month: '2026-11' };
  loadMore(entry, nav);
  loadMore(entry, nav);
  assert.equal(s.asked.length, 2, 'второй запрос ушёл');
  s.asked[1].resolve({ data: { month: '2026-11', receipts: 0, total: 0, cats: [], top: [], food: null } });
  await tick();
  s.asked[0].resolve({ error: 'down', detail: 'сеть: TypeError: Failed to fetch' });
  await tick();
  const text = seen(moreScreen(entry, nav));
  assert.match(text, /чеков с продуктами нет/);
  assert.doesNotMatch(text, /не отвечает/);
});

const CARD = { ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: 'чек', kind: 'spend', cats: ['продукты'], src: 'Freedom',
  amount: { number: 400, currency: 'RSD' }, rsd: 400, receipt: false, flag: false, by: 'Алексей', at: '2026-11-10 18:40',
  refs: ['sms:1'], similar: [], postings: [{ name: 'Freedom', number: -400, currency: 'RSD' },
    { name: 'продукты', number: 400, currency: 'RSD' }] };

test('карточка: повтор загрузки — поздняя ошибка первого запроса не закрывает открытую операцию', async () => {
  const s = server();
  const nav = makeNav(s);
  const entry = { kind: 'card', ref: 'sms:1' };
  loadCard(entry, nav);
  loadCard(entry, nav);
  s.asked[1].resolve({ data: CARD });
  await tick();
  s.asked[0].resolve({ error: 'down', detail: 'сеть: нет ответа за 8 с' });
  await tick();
  const text = seen(cardScreen(entry, nav));
  assert.match(text, /Lidl/);
  assert.doesNotMatch(text, /Операцию не открыть/);
});
