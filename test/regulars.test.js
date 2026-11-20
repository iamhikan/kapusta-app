// Решение 86, вариант 2 (Алексей 18.11.2026): перебор регулярной траты (связь, подписки, образование, спортпит) —
// строкой в списке лимитов «Здоровья», как лимит сверх: «связь +2 019 · 3 019 / 1 000». Строка — только при переборе
// (сервер шлёт regulars), тап — операции этой регулярной (regular=), шапка — «В норме», а не «Лимит». Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heard, one, seen } from './fakedom.js';
import { get } from '../js/api.js';
import { view } from '../js/health.js';
import { limitRow } from '../js/limitrow.js';
import { headView, txPath } from '../js/ops.js';

const BASE = 'https://mac.tail0.ts.net';
const flat = (s) => s.replace(/\s+/g, ' ').trim();

async function served(body) {
  const fetch = async () => ({ status: 200, ok: true, json: async () => body });
  const r = await get('/api/x', { base: BASE, initData: 'x', fetch });
  return r.data;
}

const limit = (key, state, spent, lim) => ({ key, name: key, label: key, state, spent, limit: lim,
  over: Math.max(0, spent - lim) });

const HEALTH = {
  month: '2026-11', date: '2026-11-18', day: 18, days: 30, closed: false,
  zone: { status: 'fast', word: 'тратим быстрее плана' }, norm: 250000, spent: 211000, left: 39000,
  plan_today: 150000, per_day: 3000, regular: 30000, oneoff: 0,
  limits: [limit('красота', 'over', 48942, 5876), limit('питомцы', 'over', 9726, 4113),
    limit('продукты', 'ok', 30000, 60000)],
  regulars: [
    { key: 'связь', label: 'связь', spent: 3019, limit: 1000, norm: 1000, carry: 0, over: 2019 },
    { key: 'спортпит', label: 'спортпит', spent: 9000, limit: 8000, norm: 3000, carry: 5000, over: 1000 },
  ],
  balances: [], empty: [], balances_total: 0, curve: [[1, 0], [18, 211000]], forecast: 351667,
  fresh: { last: '2026-11-18 08:11', now: '2026-11-18T15:00' },
};

test('перебор регулярной — строкой в списке лимитов, по «жаре» среди лимитов: имя, +сверх, потрачено / в норме', async () => {
  const v = view(await served(HEALTH));
  assert.deepEqual(v.limits.map((l) => l.name), ['красота', 'связь', 'питомцы', 'спортпит', 'продукты']);
  const row = limitRow(v.limits[1], { plan: v.plan, open() {} });
  assert.equal(seen(one(one(row, 'limit-name'), 'ellipsis')), 'связь');
  assert.equal(flat(seen(one(row, 'badge'))), '+2 019');
  assert.equal(flat(heard(row)), 'связь: 3 019 из 1 000, сверх на 2 019, регулярная: сумма в норме — среднее за 3 месяца');
  assert.equal(one(row, 'fill').style.background, 'var(--bad)');
  const sport = limitRow(v.limits[3], { plan: v.plan, open() {} });
  assert.match(flat(heard(sport)), /^спортпит: 9 000 из 8 000, сверх на 1 000, регулярная: 3 000 в норме \+ 5 000 конверт$/);
});

test('перебор регулярной не считается лимитом: «Лимитов сверх» и резерв — только по лимитам', async () => {
  const v = view(await served({ ...HEALTH, available: undefined }));
  assert.deepEqual(v.stats[2], { label: 'Лимитов сверх', value: '2 из 3', tone: 'bad' });
  assert.equal(v.reserve, '');
});

test('строки нет без перебора и у прежнего сервера без regulars', async () => {
  const { regulars, ...old } = HEALTH;
  assert.deepEqual(view(await served(old)).limits.map((l) => l.name), ['красота', 'питомцы', 'продукты']);
  assert.deepEqual(view(await served({ ...HEALTH, regulars: [] })).limits.map((l) => l.name),
    ['красота', 'питомцы', 'продукты']);
});

test('тап — операции регулярной: regular= в запросе, шапка «В норме», а не «Лимит»', async () => {
  const v = view(await served(HEALTH));
  assert.deepEqual(v.limits[1].ops, { regular: 'связь' });
  assert.equal(txPath({ from: '2026-11-01', to: '2026-11-18', regular: 'связь', cursor: null }),
    `/api/tx?from=2026-11-01&to=2026-11-18&regular=${encodeURIComponent('связь')}`);
  const h = headView({ title: 'Связь', limit: 1000, limitWord: 'В норме', month: '2026-11', to: '2026-11-18' },
    { total: 3019, count: 2 });
  assert.equal(flat(h.note), 'сверх 2 019');
  assert.equal(flat(h.sub), 'В норме 1 000 · 2 записи · 1–18 ноября');
});

test('коммуналка сверх своей доли — строкой «обязательная», основа суммы — словами сервера (basis)', async () => {
  const utilities = { key: 'коммуналка', label: 'коммуналка', kind: 'mandatory', basis: 'доля семьи, среднее с 05.2026',
    spent: 13491, limit: 8427, norm: 8427, carry: 0, over: 5064 };
  const v = view(await served({ ...HEALTH, regulars: [utilities] }));
  const row = v.limits.find((l) => l.name === 'коммуналка');
  assert.deepEqual(row.ops, { regular: 'коммуналка' });
  assert.equal(flat(heard(limitRow(row, { open() {} }))),
    'коммуналка: 13 491 из 8 427, сверх на 5 064, обязательная: сумма в норме — доля семьи, среднее с 05.2026');
});

// E10 (Алексей 20.11.2026): «нажать на категорию регулярных трат и увидеть все её транзакции, внутри — свой
// градусник». Строки «Регулярных платежей» (и коммуналки) в «Бюджете» нажимаются: «Операции» с regular=<имя>, в шапке —
// потрачено за месяц против суммы в норме, у спортпита — с конвертом, перебор — красным. Числа — сервера: строка
// «Бюджета» (сумма в норме), regulars «Здоровья» (перебор: сумма с конвертом), envelopes — все регулярные месяца.
import { all } from './fakedom.js';
import { moreScreen } from '../js/more.js';
import { loadOps, newOps, opsScreen } from '../js/screens.js';

const NOV = { ...HEALTH, date: '2026-11-20', day: 20, regulars: [
  { key: 'обмен валюты', label: 'обмен валюты', kind: 'regular', basis: '5 EUR в месяц', spent: 3699, limit: 588, norm: 588,
    carry: 0, over: 3111 },
  { key: 'коммуналка', label: 'коммуналка', kind: 'mandatory', basis: 'доля семьи, среднее с 05.2026', spent: 13491,
    limit: 12045, norm: 12045, carry: 0, over: 1446 }] };
const OCT = { ...HEALTH, month: '2026-10', date: '2026-10-31', day: 31, days: 31, closed: true, regulars: [
  { key: 'спортпит', label: 'спортпит', kind: 'regular', basis: 'среднее за 3 мес.', spent: 16232, limit: 9733, norm: 2433,
    carry: 7300, over: 6499 }] };
const row = (name, rsd, note) => ({ name, rsd, note });
const budgetOf = (month, regular, extra = {}) => ({ month, savings: null, norm: 250000, free: 0,
  limits: { rsd: 0, eur: 0, rows: [] },
  groups: [
    { name: 'Обязательные', rsd: 122204, avg_months: null, rows: [row('жильё', 76390, '(650 €)'),
      row('кредит РФ', 32855, '(25 000 ₽)'), row('коммуналка', 12959, '(в ср. с 05.2026)')] },
    { name: 'Регулярные по карте', rsd: 47812, avg_months: null, rows: regular }], ...extra });
const NOV_REG = [row('спортпит', 5411, '(в ср. за 3 мес.)'), row('подписки', 20684, '(медиана за 3 мес.)'),
  row('связь', 4272, '(медиана за 3 мес.)'), row('обмен валюты', 588, '(5 €)')];
// Алексею — «Деньги на месяц»: коммуналка в норме — доля семьи (full — с долей ПР, как в «Обязательных»)
const PLAN = { have_rsd: 1, have: { RSD: 1 }, need: 1, transfer: 0, spare: 0, transfer_eur: null, salary: null,
  parts: [{ name: 'коммуналка', rsd: 12045, full: 12959 }] };

// «Капуста» на Маке: ответы по путям; «Здоровье» и «Бюджет» месяцев — в памяти страницы (nav.health, nav.budget)
function navOf({ health = {}, budget = {}, tx = {} }) {
  const kept = { health: { ...health }, budget: { ...budget } };
  const nav = { today: () => '2026-11-20', accounts: () => [], balanceOf: () => null, queued: () => [], savePeriod() {},
    focus() {}, render() {}, limitOf: () => null, noteOf: () => '', pushed: [], asked: [],
    health: (m) => kept.health[m] || null, budget: (m) => kept.budget[m] || null,
    keep: (kind, data) => { kept[kind][data.month] = data; },
    get: async (path) => {
      nav.asked.push(path);
      const q = new URLSearchParams(path.split('?')[1]);
      if (path.startsWith('/api/tx')) {
        const t = tx[`${q.get('regular')} ${q.get('from').slice(0, 7)}`] || { total: 0, count: 0 };
        return { data: { days: [], next: null, ...t } };
      }
      const all = path.startsWith('/api/health') ? health.all || {} : budget.all || {};
      return all[q.get('month')] ? { data: await served(all[q.get('month')]) } : { error: 'refused', detail: 'нет' };
    } };
  nav.push = (entry) => nav.pushed.push(entry);
  return nav;
}
const keys = (tree) => all(tree, '<button').map((b) => b.getAttribute('data-focus'));
const press = (tree, key) => all(tree, '<button').find((b) => b.getAttribute('data-focus') === key).handlers.click({});
const header = (tree) => {
  const card = all(tree, 'card')[0];
  return { sum: flat(seen(one(card, 'big-num'))), note: flat(seen(one(card, 'big').kids[1])),
    tone: one(card, 'big-num').getAttribute('class'), fill: one(card, 'fill').style.width,
    sub: flat(seen(one(card, 'head-sub'))), basis: flat(seen(one(card, 'basis') || '')) };
};

async function openFromBudget(nav, month, name) {
  const screen = moreScreen({ kind: 'budget', month, data: nav.budget(month) }, nav);
  press(screen, `regular:${name}`);
  const entry = nav.pushed.at(-1);
  await loadOps(entry, nav);
  return entry;
}

test('E10: строка регулярной в «Бюджете» ведёт на экран её операций с градусником «потрачено / в норме»', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, { plan: PLAN })) },
    tx: { 'связь 2026-11': { total: 3068, count: 2 } } });
  const entry = await openFromBudget(nav, '2026-11', 'связь');
  assert.deepEqual([entry.ctx.title, entry.ctx.params, entry.ctx.limitWord], ['Связь', { regular: 'связь' }, 'В норме']);
  assert.equal(nav.asked.at(-1), `/api/tx?from=2026-11-01&to=2026-11-20&regular=${encodeURIComponent('связь')}`);
  assert.deepEqual(header(opsScreen(entry, nav)), { sum: '3 068', note: 'из 4 272', tone: 'big-num ', fill: '71.8%',
    sub: 'В норме 4 272 · 2 записи · 1–20 ноября', basis: '' });
});

test('E10: нажимаются регулярные и коммуналка; жильё и кредит РФ (сумма по договору, перебора нет) — строкой без перехода', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, { plan: PLAN })) } });
  const screen = moreScreen({ kind: 'budget', month: '2026-11', data: nav.budget('2026-11') }, nav);
  assert.deepEqual(keys(screen).filter((k) => k.startsWith('regular:')),
    ['regular:коммуналка', 'regular:спортпит', 'regular:подписки', 'regular:связь', 'regular:обмен валюты']);
});

test('E10: коммуналка — против доли семьи (не средней с долей ПР из «Обязательных»), перебор — красным', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, { plan: PLAN })) },
    tx: { 'коммуналка 2026-11': { total: 13491, count: 2 } } });
  const h = header(opsScreen(await openFromBudget(nav, '2026-11', 'коммуналка'), nav));
  assert.deepEqual(h, { sum: '13 491', note: 'сверх 1 446', tone: 'big-num bad', fill: '100.0%',
    sub: 'В норме 12 045 · 2 записи · 1–20 ноября', basis: 'сумма в норме — доля семьи, среднее с 05.2026' });
});

test('E10: спортпит — сумма в норме и конверт (накоплено): «В норме 2 433 + конверт 7 300», сверх — сверх обоих', async () => {
  const nav = navOf({ health: { '2026-10': await served(OCT) },
    budget: { '2026-10': await served(budgetOf('2026-10', [row('спортпит', 2433, '(в ср. за 3 мес.)')])) },
    tx: { 'спортпит 2026-10': { total: 16232, count: 1 } } });
  const h = header(opsScreen(await openFromBudget(nav, '2026-10', 'спортпит'), nav));
  assert.deepEqual(h, { sum: '16 232', note: 'сверх 6 499', tone: 'big-num bad', fill: '100.0%',
    sub: 'В норме 2 433 + конверт 7 300 · 1 запись · 1–31 октября', basis: 'сумма в норме — среднее за 3 мес.' });
  // та же шапка — у строки перебора на «Здоровье» (решение 86): её тап — те же «Операции»
  const over = view(await served(OCT)).limits.find((l) => l.name === 'спортпит');
  const entry = newOps('2026-10', { title: 'Спортпит', params: over.ops, limitWord: over.limitWord });
  await loadOps(entry, nav);
  assert.equal(header(opsScreen(entry, nav)).sub, 'В норме 2 433 + конверт 7 300 · 1 запись · 1–31 октября');
});

test('E10: сервер шлёт envelopes (все регулярные месяца) — конверт виден и без перебора, нажимается и коммуналка без перебора', async () => {
  const env = (key, spent, norm, carry, kind = 'regular') => ({ key, label: key, kind, basis: 'среднее за 3 мес.', spent, limit: norm + carry,
    norm, carry, over: Math.max(0, spent - norm - carry) });
  const sep = { ...OCT, month: '2026-09', date: '2026-09-30', days: 30, regulars: [],
    envelopes: [env('коммуналка', 9000, 9922, 0, 'mandatory'), env('спортпит', 3000, 2433, 7300)] };
  const nav = navOf({ health: { '2026-09': await served(sep) },
    budget: { '2026-09': await served(budgetOf('2026-09', [row('спортпит', 2433, '(в ср. за 3 мес.)')])) },
    tx: { 'спортпит 2026-09': { total: 3000, count: 1 } } });
  const screen = moreScreen({ kind: 'budget', month: '2026-09', data: nav.budget('2026-09') }, nav);
  assert.deepEqual(keys(screen).filter((k) => k.startsWith('regular:')), ['regular:коммуналка', 'regular:спортпит']);
  const h = header(opsScreen(await openFromBudget(nav, '2026-09', 'спортпит'), nav));
  assert.deepEqual(h, { sum: '3 000', note: 'из 9 733', tone: 'big-num ', fill: '30.8%',
    sub: 'В норме 2 433 + конверт 7 300 · 1 запись · 1–30 сентября', basis: 'сумма в норме — среднее за 3 мес.' });
});

test('E10: прежний сервер, конверт неизвестен — потрачено больше суммы в норме, но перебора нет: «в пределах конверта», не красным', async () => {
  const sep = { ...OCT, month: '2026-09', date: '2026-09-30', days: 30, regulars: [] };
  const nav = navOf({ health: { '2026-09': await served(sep) },
    budget: { '2026-09': await served(budgetOf('2026-09', [row('спортпит', 2433, '(в ср. за 3 мес.)')])) },
    tx: { 'спортпит 2026-09': { total: 3000, count: 1 } } });
  const h = header(opsScreen(await openFromBudget(nav, '2026-09', 'спортпит'), nav));
  assert.deepEqual(h, { sum: '3 000', note: 'в пределах конверта', tone: 'big-num ', fill: '100.0%',
    sub: 'В норме 2 433 · 1 запись · 1–30 сентября', basis: '' });
});

test('E10: прошлый месяц стрелкой — градусник того месяца: «Здоровье» и «Бюджет» месяца грузятся, если их нет', async () => {
  const oct = { ...OCT, regulars: [] };
  const nav = navOf({ health: { '2026-11': await served(NOV), all: { '2026-10': oct } },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, { plan: PLAN })),
      all: { '2026-10': budgetOf('2026-10', [row('связь', 5734, '(медиана за 3 мес.)')]) } },
    tx: { 'связь 2026-11': { total: 3068, count: 2 }, 'связь 2026-10': { total: 4272, count: 3 } } });
  let drawn = 0;
  nav.render = () => { drawn += 1; };
  const entry = await openFromBudget(nav, '2026-11', 'связь');
  press(opsScreen(entry, nav), 'month:prev');
  assert.equal(entry.month, '2026-10');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(nav.asked.includes('/api/health?month=2026-10'), nav.asked.join(' '));
  assert.ok(nav.asked.includes('/api/budget?month=2026-10'), nav.asked.join(' '));
  assert.deepEqual(header(opsScreen(entry, nav)), { sum: '4 272', note: 'из 5 734', tone: 'big-num ', fill: '74.5%',
    sub: 'В норме 5 734 · 3 записи · 1–31 октября', basis: '' });
  assert.ok(drawn > 0);
});

test('E10: вернули больше, чем потратили (обмен с выигрышем) — полоса пустая, не «−92 %»', () => {
  const h = headView({ title: 'Обмен валюты', limit: 587, limitWord: 'В норме', month: '2026-10', to: '2026-10-31' },
    { total: -540, count: 2 });
  assert.deepEqual([h.sum, h.note, h.fill], ['−540', 'из 587', 0]);
});

test('E10: коммуналка без перебора у прежнего сервера — Алексею нажимается: доля семьи из «Денег на месяц», подписью «доля семьи»', async () => {
  const quiet = { ...NOV, regulars: [] };
  const nav = navOf({ health: { '2026-11': await served(quiet) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, { plan: PLAN })) },
    tx: { 'коммуналка 2026-11': { total: 9000, count: 1 } } });
  // Алексею её выдаёт часть «Денег на месяц» с full (доля семьи); Ангелине плана нет — строка без перехода, пока нет перебора
  const angelina = budgetOf('2026-11', NOV_REG);
  assert.ok(!keys(moreScreen({ kind: 'budget', month: '2026-11', data: await served(angelina) }, nav)).includes('regular:коммуналка'));
  const entry = await openFromBudget(nav, '2026-11', 'коммуналка');
  assert.deepEqual(header(opsScreen(entry, nav)), { sum: '9 000', note: 'из 12 045', tone: 'big-num ', fill: '74.7%',
    sub: 'В норме 12 045 · 1 запись · 1–20 ноября', basis: 'сумма в норме — доля семьи' });
});
