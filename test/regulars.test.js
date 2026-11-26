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
  assert.equal(flat(heard(row)), 'связь: 3 019 из 1 000, сверх на 2 019, в «Потрачено» идёт только то, что сверх нормы: +2 019');   // R-9
  assert.equal(one(row, 'fill').style.background, 'var(--bad)');
  const sport = limitRow(v.limits[3], { plan: v.plan, open() {} });
  assert.equal(flat(heard(sport)), 'спортпит: 9 000 из 8 000, сверх на 1 000, в «Потрачено» идёт только то, что сверх нормы: +1 000');
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

test('коммуналка сверх своей доли — строкой со значком 📌; подпись — что перебор делает с «Потрачено» (R-9)', async () => {
  const utilities = { key: 'коммуналка', label: 'коммуналка', kind: 'mandatory', basis: 'доля семьи, среднее с 05.2026',
    spent: 13491, limit: 8427, norm: 8427, carry: 0, over: 5064 };
  const v = view(await served({ ...HEALTH, regulars: [utilities] }));
  const row = v.limits.find((l) => l.name === 'коммуналка');
  assert.deepEqual(row.ops, { regular: 'коммуналка' });
  assert.equal(flat(heard(limitRow(row, { open() {} }))),
    'коммуналка: 13 491 из 8 427, сверх на 5 064, в «Потрачено» идёт только то, что сверх нормы: +5 064');
  assert.equal(row.glyph, '📌');
});

// R-9 (решение 98, ответ 6): строка перебора на «Здоровье» говорит, что она делает с «Потрачено», а не на чём сумма
// («медиана за 3 мес.» — слово статистики, Ангелине оно ничего не даёт; основа суммы — на экране регулярной). Значок —
// как метка в чате: 🔁 регулярная, 📌 обязательная (коммуналка). Было: «регулярная: сумма в норме — медиана за 3 мес.»
const shown = (el) => (typeof el === 'string' ? el : el.classes.includes('sr') ? '' : el.kids.map(shown).join(' '));

test('R-9: строка сверх нормы — «банк 🔁 +406 … в «Потрачено» идёт только то, что сверх нормы: +406»; коммуналка — 📌; без основы суммы', async () => {
  const bank = { key: 'банк', label: 'банк', kind: 'regular', basis: 'обычно за месяц', spent: 2941, limit: 2535,
    norm: 2535, carry: 0, over: 406 };
  const util = { key: 'коммуналка', label: 'коммуналка', kind: 'mandatory', basis: 'доля семьи, среднее с 05.2026',
    spent: 13491, limit: 12045, norm: 12045, carry: 0, over: 1446 };
  const v = view(await served({ ...HEALTH, regulars: [bank, util, HEALTH.regulars[1]] }));
  const rowOf = (name) => limitRow(v.limits.find((l) => l.name === name), { open() {} });
  const b = rowOf('банк');
  assert.equal(flat(shown(one(b, 'limit-name'))), 'банк 🔁 +406');   // повтор ревью, п. 12: значок — после имени
  assert.equal(flat(shown(b)), 'банк 🔁 +406 2 941 / 2 535 в «Потрачено» идёт только то, что сверх нормы: +406');
  assert.equal(flat(heard(b)), 'банк: 2 941 из 2 535, сверх на 406, в «Потрачено» идёт только то, что сверх нормы: +406');
  assert.equal(flat(shown(one(rowOf('коммуналка'), 'limit-name'))), 'коммуналка 📌 +1 446');
  assert.match(flat(shown(rowOf('коммуналка'))), /в «Потрачено» идёт только то, что сверх нормы: \+1 446$/);
  // у спортпита с конвертом — тоже про «Потрачено»: «3 000 в норме + 5 000 конверт» — на его экране
  assert.match(flat(shown(rowOf('спортпит'))), /в «Потрачено» идёт только то, что сверх нормы: \+1 000$/);
  for (const name of ['банк', 'коммуналка', 'спортпит']) {
    assert.doesNotMatch(shown(rowOf(name)) + heard(rowOf(name)), /медиана|сумма в норме|конверт|регулярная:/, name);
  }
  // лимит — без значка; «+406» не уходит один на строку при 320 px
  assert.equal(one(rowOf('красота'), 'limit-glyph'), null);
  assert.match(v.limits.find((l) => l.name === 'банк').hint, /нормы:\u00a0\+406$/);
});

// E10 (Алексей 20.11.2026): «нажать на категорию регулярных трат и увидеть все её транзакции, внутри — свой
// градусник». Строки «Регулярных платежей» (и коммуналки) в «Бюджете» нажимаются: «Операции» с regular=<имя>, в шапке —
// потрачено за месяц против суммы в норме, у спортпита — с конвертом, перебор — красным. Числа — сервера: envelopes
// «Здоровья» — все регулярные месяца (E13, решение 95); ответ без них — regulars (перебор) и строка «Бюджета».
import { all } from './fakedom.js';
import { moreScreen } from '../js/more.js';
import { loadOps, newOps, opsScreen } from '../js/screens.js';

// живой ответ Алексея 20.11.2026: решение 94 (коммуналка — доля семьи, «ПР коммуналка» — в группе ПР) и E13 (envelopes —
// все регулярные месяца, с перебором и без; regulars — только перебор)
const env = (key, basis, spent, norm, carry = 0, kind = 'regular') => ({ key, label: key, kind, basis, spent,
  limit: norm + carry, norm, carry, over: Math.max(0, spent - norm - carry) });
const NOV_ENV = [env('спортпит', 'среднее за 3 мес.', 0, 5411), env('подписки', 'медиана за 3 мес.', 12610, 20684),
  env('связь', 'медиана за 3 мес.', 3068, 4272), env('образование', 'медиана за 3 мес.', 4643, 14322),
  env('банк', 'медиана за 3 мес.', 1361, 2535), env('обмен валюты', '5 EUR в месяц', 3699, 588),
  env('коммуналка', 'доля семьи, среднее с 05.2026', 13491, 12045, 0, 'mandatory')];
const NOV = { ...HEALTH, date: '2026-11-20', day: 20, regulars: NOV_ENV.filter((e) => e.over > 0), envelopes: NOV_ENV };
const OCT_SPORT = env('спортпит', 'среднее за 3 мес.', 16232, 2433, 7300);
const OCT = { ...HEALTH, month: '2026-10', date: '2026-10-31', day: 31, days: 31, closed: true, regulars: [OCT_SPORT],
  envelopes: [OCT_SPORT, env('связь', 'медиана за 3 мес.', 4272, 5734)] };
// ответ до E13: envelopes нет
const before = ({ envelopes, ...h }) => h;
const row = (name, rsd, note) => ({ name, rsd, note });
const budgetOf = (month, regular, { pr = [], ...extra } = {}) => ({ month, savings: null, norm: 250000, free: 0,
  limits: { rsd: 0, eur: 0, rows: [] },
  groups: [
    { name: 'Обязательные', rsd: 121290, avg_months: null, rows: [row('жильё', 76390, '(650 €)'),
      row('кредит РФ', 32855, '(25 000 ₽)'), row('коммуналка', 12045, '(в ср. с 05.2026)')] },
    { name: 'Регулярные по карте', rsd: 47812, avg_months: null, rows: regular },
    ...pr], ...extra });
const NOV_REG = [row('спортпит', 5411, '(в ср. за 3 мес.)'), row('подписки', 20684, '(медиана за 3 мес.)'),
  row('связь', 4272, '(медиана за 3 мес.)'), row('образование', 14322, '(медиана за 3 мес.)'),
  row('банк', 2535, '(медиана за 3 мес.)'), row('обмен валюты', 588, '(5 €)')];
// Алексею — группа ПР («ПР коммуналка», решение 94) и «Деньги на месяц»: коммуналка — та же доля семьи, без full
const PR = [{ name: 'ПР', rsd: 1426, avg_months: null, rows: [row('ПР коммуналка', 915, '(в ср. с 05.2026)'),
  row('ПР банк', 511, '(в ср.)')] }];
const PLAN = { have_rsd: 1, have: { RSD: 1 }, need: 1, transfer: 0, spare: 0, transfer_eur: null, salary: null,
  parts: [{ name: 'коммуналка', rsd: 12045 }] };
const ALEKSEY = { plan: PLAN, pr: PR };

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
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)) },
    tx: { 'связь 2026-11': { total: 3068, count: 2 } } });
  const entry = await openFromBudget(nav, '2026-11', 'связь');
  assert.deepEqual([entry.ctx.title, entry.ctx.params, entry.ctx.limitWord], ['Связь', { regular: 'связь' }, 'В норме']);
  assert.equal(nav.asked.at(-1), `/api/tx?from=2026-11-01&to=2026-11-20&regular=${encodeURIComponent('связь')}`);
  // E13: числа — envelopes «Здоровья», второй строкой — на чём сумма (basis)
  assert.deepEqual(header(opsScreen(entry, nav)), { sum: '3 068', note: 'из 4 272', tone: 'big-num ', fill: '71.8%',
    sub: 'В норме 4 272 · 2 записи · 1–20 ноября', basis: 'сумма в норме — обычно за месяц' });
});

test('E10, E13: сервер до E14 — нажимаются регулярные и коммуналка; жильё, кредит РФ (их нет в envelopes) и строки ПР («ПР коммуналка») — без перехода', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)) } });
  const screen = moreScreen({ kind: 'budget', month: '2026-11', data: nav.budget('2026-11') }, nav);
  assert.deepEqual(keys(screen).filter((k) => k.startsWith('regular:')),
    ['regular:коммуналка', 'regular:спортпит', 'regular:подписки', 'regular:связь', 'regular:образование', 'regular:банк',
      'regular:обмен валюты']);
  // решение 94: траты ПР не в семейном «Потрачено» — у «ПР коммуналки» нет ни перебора, ни операций по regular=
  assert.match(flat(seen(screen)), /ПР коммуналка/);
});

test('E10: коммуналка — против доли семьи, перебор — красным', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)) },
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

test('E13: envelopes — конверт виден и без перебора, коммуналка без перебора нажимается и у Ангелины', async () => {
  const sep = { ...OCT, month: '2026-09', date: '2026-09-30', days: 30, regulars: [],
    envelopes: [env('спортпит', 'среднее за 3 мес.', 3000, 2433, 7300),
      env('коммуналка', 'доля семьи, среднее с 05.2026', 9000, 9922, 0, 'mandatory')] };
  // Ангелине — без ПР и без «Денег на месяц» (решение 11)
  const nav = navOf({ health: { '2026-09': await served(sep) },
    budget: { '2026-09': await served(budgetOf('2026-09', [row('спортпит', 2433, '(в ср. за 3 мес.)')])) },
    tx: { 'спортпит 2026-09': { total: 3000, count: 1 }, 'коммуналка 2026-09': { total: 9000, count: 1 } } });
  const screen = moreScreen({ kind: 'budget', month: '2026-09', data: nav.budget('2026-09') }, nav);
  assert.deepEqual(keys(screen).filter((k) => k.startsWith('regular:')), ['regular:коммуналка', 'regular:спортпит']);
  assert.deepEqual(header(opsScreen(await openFromBudget(nav, '2026-09', 'спортпит'), nav)), { sum: '3 000',
    note: 'из 9 733', tone: 'big-num ', fill: '30.8%', sub: 'В норме 2 433 + конверт 7 300 · 1 запись · 1–30 сентября',
    basis: 'сумма в норме — среднее за 3 мес.' });
  assert.deepEqual(header(opsScreen(await openFromBudget(nav, '2026-09', 'коммуналка'), nav)), { sum: '9 000',
    note: 'из 9 922', tone: 'big-num ', fill: '90.7%', sub: 'В норме 9 922 · 1 запись · 1–30 сентября',
    basis: 'сумма в норме — доля семьи, среднее с 05.2026' });
});

test('E10: ответ без envelopes, конверт неизвестен — потрачено больше суммы в норме, но перебора нет: «в пределах конверта», не красным', async () => {
  const sep = { ...before(OCT), month: '2026-09', date: '2026-09-30', days: 30, regulars: [] };
  const nav = navOf({ health: { '2026-09': await served(sep) },
    budget: { '2026-09': await served(budgetOf('2026-09', [row('спортпит', 2433, '(в ср. за 3 мес.)')])) },
    tx: { 'спортпит 2026-09': { total: 3000, count: 1 } } });
  const h = header(opsScreen(await openFromBudget(nav, '2026-09', 'спортпит'), nav));
  assert.deepEqual(h, { sum: '3 000', note: 'в пределах конверта', tone: 'big-num ', fill: '100.0%',
    sub: 'В норме 2 433 · 1 запись · 1–30 сентября', basis: '' });
});

test('E10, E13: прошлый месяц стрелкой — градусник того месяца: «Здоровье» месяца грузится, если его нет; числа — его envelopes', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV), all: { '2026-10': OCT } },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)) },
    tx: { 'связь 2026-11': { total: 3068, count: 2 }, 'связь 2026-10': { total: 4272, count: 3 } } });
  let drawn = 0;
  nav.render = () => { drawn += 1; };
  const entry = await openFromBudget(nav, '2026-11', 'связь');
  press(opsScreen(entry, nav), 'month:prev');
  assert.equal(entry.month, '2026-10');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(nav.asked.includes('/api/health?month=2026-10&envelopes=1'), nav.asked.join(' '));
  assert.ok(!nav.asked.includes('/api/budget?month=2026-10'), nav.asked.join(' '));   // строка «Бюджета» не нужна
  assert.deepEqual(header(opsScreen(entry, nav)), { sum: '4 272', note: 'из 5 734', tone: 'big-num ', fill: '74.5%',
    sub: 'В норме 5 734 · 3 записи · 1–31 октября', basis: 'сумма в норме — обычно за месяц' });
  assert.ok(drawn > 0);
});

test('E10: прошлый месяц стрелкой, «Здоровье» без envelopes — сумма в норме из «Бюджета» того месяца', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV), all: { '2026-10': { ...before(OCT), regulars: [] } } },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)),
      all: { '2026-10': budgetOf('2026-10', [row('связь', 5734, '(медиана за 3 мес.)')]) } },
    tx: { 'связь 2026-11': { total: 3068, count: 2 }, 'связь 2026-10': { total: 4272, count: 3 } } });
  const entry = await openFromBudget(nav, '2026-11', 'связь');
  press(opsScreen(entry, nav), 'month:prev');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(nav.asked.includes('/api/budget?month=2026-10'), nav.asked.join(' '));
  assert.deepEqual(header(opsScreen(entry, nav)), { sum: '4 272', note: 'из 5 734', tone: 'big-num ', fill: '74.5%',
    sub: 'В норме 5 734 · 3 записи · 1–31 октября', basis: '' });
});

test('E10, R-13: вернули больше, чем потратили — без «из» и полосы; у обмена валюты — «выигрыш на обмене»', () => {
  // было «−189 из 588» и пустая полоса: «потратили −189 из 588» — бессмыслица (R-13, ревью 26.11)
  const ctx = { title: 'Обмен валюты', limit: 588, limitWord: 'В норме', month: '2026-11', to: '2026-11-26' };
  const fx = headView({ ...ctx, fx: true }, { total: -189, count: 5 });
  assert.deepEqual([fx.sum, fx.note, fx.tone, fx.fill, fx.sub], ['+189', 'выигрыш на обмене', 'good', null,
    'В норме 588 на потери при обмене · 5 записей · 1–26 ноября']);
  const back = headView({ ...ctx, title: 'Банк' }, { total: -540, count: 2 });
  assert.deepEqual([back.sum, back.note, back.fill], ['+540', 'вернули больше, чем потратили', null]);
  assert.equal(headView({ ...ctx, fx: true }, { total: 520, count: 1 }).note, 'из 588');   // потеря в пределах — как была
});

test('E13: ответ без envelopes — коммуналка без перебора без перехода и у Алексея: full в плане страница не читает (решение 94)', async () => {
  const old = { ...PLAN, parts: [{ name: 'коммуналка', rsd: 12045, full: 12959 }] };
  const nav = navOf({ health: { '2026-11': await served({ ...before(NOV), regulars: [] }) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, { ...ALEKSEY, plan: old })) } });
  const screen = moreScreen({ kind: 'budget', month: '2026-11', data: nav.budget('2026-11') }, nav);
  assert.deepEqual(keys(screen).filter((k) => k.startsWith('regular:')),
    ['regular:спортпит', 'regular:подписки', 'regular:связь', 'regular:образование', 'regular:банк', 'regular:обмен валюты']);
});

import { loadMore } from '../js/more.js';

test('E13: «Бюджет» открыт раньше «Здоровья» месяца (кнопка «Открыть в Капусте») — «Здоровье» догружается: коммуналка нажимается', async () => {
  const nav = navOf({ health: { all: { '2026-11': NOV } }, budget: { all: { '2026-11': budgetOf('2026-11', NOV_REG, ALEKSEY) } } });
  let drawn = 0;
  nav.render = () => { drawn += 1; };
  const entry = { kind: 'budget', month: '2026-11' };
  await loadMore(entry, nav);
  assert.deepEqual(nav.asked, ['/api/budget?month=2026-11', '/api/health?month=2026-11&envelopes=1']);
  assert.ok(keys(moreScreen(entry, nav)).includes('regular:коммуналка'));
  assert.ok(drawn >= 3);                              // скелет, «Бюджет», «Бюджет» с переходами

  // «Здоровье» месяца уже в памяти — второй раз не просим
  const again = { kind: 'budget', month: '2026-11' };
  await loadMore(again, nav);
  assert.deepEqual(nav.asked.slice(2), ['/api/budget?month=2026-11']);
});

// E14 (Алексей 20.11.2026 на вопрос «нужен ли переход у «жилья» и «кредита РФ»?»: «давай»): жильё и кредит РФ в
// «Бюджете» тоже нажимаются — те же «Операции» с regular=<имя>. Сервер шлёт их в envelopes с contract: true: потрачено —
// весь платёж месяца (у кредита — тело долга и проценты), сумма — в норме. «Сверх» у них — курс дня оплаты, а не
// перебор: в «Потрачено» не идёт, поэтому не красным. Живые числа ноября 2026.
const deal = (key, basis, spent, norm) => ({ ...env(key, basis, spent, norm, 0, 'mandatory'), contract: true });
const NOV_DEALS = [...NOV_ENV, deal('жильё', 'по договору 650 €', 76460, 76390),
  deal('кредит РФ', 'по графику 25 000 ₽', 32009, 32855)];
const NOV14 = { ...NOV, envelopes: NOV_DEALS };

test('E14: жильё и кредит РФ нажимаются, как коммуналка; строки ПР — по-прежнему без перехода', async () => {
  for (const extra of [ALEKSEY, {}]) {          // Алексей и Ангелина: «Обязательные» видят оба
    const nav = navOf({ health: { '2026-11': await served(NOV14) },
      budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, extra)) } });
    const screen = moreScreen({ kind: 'budget', month: '2026-11', data: nav.budget('2026-11') }, nav);
    assert.deepEqual(keys(screen).filter((k) => k.startsWith('regular:')),
      ['regular:жильё', 'regular:кредит РФ', 'regular:коммуналка', 'regular:спортпит', 'regular:подписки',
        'regular:связь', 'regular:образование', 'regular:банк', 'regular:обмен валюты']);
  }
});

test('E14: жильё — платёж против суммы по договору; «сверх» (курс дня оплаты) — не красным', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV14) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)) },
    tx: { 'жильё 2026-11': { total: 76460, count: 1 } } });
  const entry = await openFromBudget(nav, '2026-11', 'жильё');
  assert.deepEqual([entry.ctx.title, entry.ctx.params], ['Жильё', { regular: 'жильё' }]);
  assert.deepEqual(header(opsScreen(entry, nav)), { sum: '76 460', note: 'сверх 70', tone: 'big-num ', fill: '100.0%',
    sub: 'В норме 76 390 · 1 запись · 1–20 ноября', basis: 'сумма в норме — по договору 650 €' });
});

test('E14: кредит РФ — весь платёж месяца против суммы по графику', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV14) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG)) },
    tx: { 'кредит РФ 2026-11': { total: 32009, count: 1 } } });
  const entry = await openFromBudget(nav, '2026-11', 'кредит РФ');
  // пробел в имени — «+», как у URLSearchParams; fin (parse_qsl) читает его пробелом
  assert.equal(nav.asked.at(-1), `/api/tx?from=2026-11-01&to=2026-11-20&${new URLSearchParams({ regular: 'кредит РФ' })}`);
  assert.deepEqual(header(opsScreen(entry, nav)), { sum: '32 009', note: 'из 32 855', tone: 'big-num ', fill: '97.4%',
    sub: 'В норме 32 855 · 1 запись · 1–20 ноября', basis: 'сумма в норме — по графику 25 000 ₽' });
});

// R-11 (решение 98, ответ 5): строка регулярной в «Бюджете» — как строка лимита на «Здоровье»: имя, «+N» при переборе,
// «потрачено / в норме», полоса; нажатие — те же «Операции» регулярной, фокус после «Назад» — на ту же строку
test('R-11: «Бюджет» — строка регулярной с полосой и «потрачено / в норме»; группа — «🔁 Регулярные платежи · ушло N из M»', async () => {
  const nov = { ...NOV, envelopes: NOV_ENV.map((e) => (e.key === 'образование' ? { ...e, spent: 15684, over: 1362 } : e)) };
  const nav = navOf({ health: { '2026-11': await served(nov) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)) },
    tx: { 'образование 2026-11': { total: 15684, count: 4 } } });
  const screen = moreScreen({ kind: 'budget', month: '2026-11', data: nav.budget('2026-11') }, nav);
  const edu = all(screen, '<button').find((b) => b.getAttribute('data-focus') === 'regular:образование');
  assert.equal(flat(shown(edu)), 'образование +1 362 15 684 / 14 322 в «Потрачено» идёт только то, что сверх нормы: +1 362');
  assert.equal(flat(heard(edu)), 'образование: 15 684 из 14 322, сверх на 1 362, в «Потрачено» идёт только то, что сверх нормы: +1 362');
  assert.ok(one(edu, 'bar') && one(edu, 'limit-mark'));
  const subs = all(screen, '<button').find((b) => b.getAttribute('data-focus') === 'regular:подписки');
  assert.equal(flat(heard(subs)), 'подписки: 12 610 из 20 684');
  const heads = all(screen, 'section-head').map((x) => flat(shown(x)));
  assert.ok(heads.includes('🔁 Регулярные платежи ушло 36 422 из 47 812'), heads.join(' | '));
  assert.ok(heads.includes('📌 Обязательные 121 290'), heads.join(' | '));
  assert.ok(all(screen, 'section-head').every((x) => !/[🔁📌]/u.test(heard(x))));   // значок диктору не читается
  edu.handlers.click({});
  const entry = nav.pushed.at(-1);
  assert.deepEqual([entry.ctx.title, entry.ctx.params, entry.ctx.limitWord], ['Образование', { regular: 'образование' }, 'В норме']);
});

// R-12 (решение 98, ответ 5): шапка жилья и кредита РФ — платёж в валюте договора и «✓ оплачено <день>» (или «ждёт
// оплаты»), без полосы; динары и сумма в норме по курсу 1-го — строкой ниже; разница — своей строкой: в «Потрачено»
// не идёт. Было: «76 460 сверх 70» с полной зелёной полосой, «32 009 из 32 855» (обещание остатка, которого нет)
const deal46 = (key, basis, spent, norm, due, paid, on) => ({ ...deal(key, basis, spent, norm), due, paid, paid_on: on });
const NOV46 = { ...NOV, envelopes: [...NOV_ENV,
  deal46('жильё', 'по договору 650 €', 76460, 76390, { number: 650, currency: 'EUR' }, { number: 650, currency: 'EUR' },
    ['2026-11-11']),
  deal46('кредит РФ', 'по графику 25 000 ₽', 32009, 32855, { number: 25000, currency: 'RUB' },
    { number: 24937.26, currency: 'RUB' }, ['2026-11-13'])] };
const dealHead = (tree) => {
  const card = all(tree, 'card')[0];
  const note = one(card, 'big').kids[1];
  return { sum: flat(seen(one(card, 'big-num'))), note: flat(seen(note)), noteClass: note.getAttribute('class'),
    bar: !!one(card, 'bar'), sub: flat(seen(one(card, 'head-sub'))), basis: flat(seen(one(card, 'basis') || '')),
    rate: flat(seen(one(card, 'rate') || '')) };
};

test('R-12: жильё — «650 € ✓ оплачено 11 ноября», без полосы; разница с нормой — своей строкой', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV46) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)) },
    tx: { 'жильё 2026-11': { total: 76460, count: 1 }, 'кредит РФ 2026-11': { total: 32009, count: 1 } } });
  assert.deepEqual(dealHead(opsScreen(await openFromBudget(nav, '2026-11', 'жильё'), nav)), { sum: '650 €',
    note: '✓ оплачено 11 ноября', noteClass: 'good', bar: false,
    sub: '76 460 RSD · в норме 76 390 по курсу 1 ноября · 1 запись · 1–20 ноября',
    basis: 'сумма в норме — по договору 650 €', rate: 'разница с нормой +70: курс дня оплаты, в «Потрачено» не идёт' });
  assert.deepEqual(dealHead(opsScreen(await openFromBudget(nav, '2026-11', 'кредит РФ'), nav)), { sum: '24 937 ₽',
    note: '✓ оплачено 13 ноября', noteClass: 'good', bar: false,
    sub: '32 009 RSD · в норме 32 855 по курсу 1 ноября · 1 запись · 1–20 ноября',
    basis: 'сумма в норме — по графику 25 000 ₽', rate: 'разница с нормой −846: курс дня оплаты и сумма платежа, в «Потрачено» не идёт' });
});

test('R-12: до оплаты — «650 € ждёт оплаты», без полосы и без строки курса; в «Бюджете» — те же слова', async () => {
  const none = { ...NOV46, envelopes: NOV46.envelopes.map((e) => (e.contract
    ? { ...e, spent: 0, over: 0, paid: { ...e.paid, number: 0 }, paid_on: [] } : e)) };
  const nav = navOf({ health: { '2026-11': await served(none) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG)) } });
  assert.deepEqual(dealHead(opsScreen(await openFromBudget(nav, '2026-11', 'жильё'), nav)), { sum: '650 €',
    note: 'ждёт оплаты', noteClass: 'muted ', bar: false, sub: 'в норме 76 390 по курсу 1 ноября · 1–20 ноября',
    basis: 'сумма в норме — по договору 650 €', rate: '' });
  const screen = moreScreen({ kind: 'budget', month: '2026-11', data: nav.budget('2026-11') }, nav);
  const rent = all(screen, '<button').find((b) => b.getAttribute('data-focus') === 'regular:жильё');
  assert.equal(flat(shown(rent)), 'жильё ждёт оплаты · по договору 650 € 76 390');
});

test('R-12: «Бюджет» — строка жилья: «✓ оплачено 11 ноября · по договору 650 €» и разница строкой ниже', async () => {
  const nav = navOf({ health: { '2026-11': await served(NOV46) },
    budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG, ALEKSEY)) } });
  const screen = moreScreen({ kind: 'budget', month: '2026-11', data: nav.budget('2026-11') }, nav);
  const line = (name) => all(screen, '<button').find((b) => b.getAttribute('data-focus') === `regular:${name}`);
  assert.equal(flat(shown(line('жильё'))),
    'жильё ✓ оплачено 11 ноября · по договору 650 € разница с нормой +70: курс дня оплаты, в «Потрачено» не идёт 76 390');
  assert.equal(flat(shown(line('кредит РФ'))), 'кредит РФ ✓ оплачено 13 ноября · 24 937 ₽, по графику 25 000 ₽'
    + ' разница с нормой −846: курс дня оплаты и сумма платежа, в «Потрачено» не идёт 32 855');
  assert.equal(one(line('жильё'), 'good').kids.join(''), '✓ оплачено 11 ноября');
});

// R-15, R-9 (решение 98, ответ 6): основа суммы — на экране регулярной словами «обычно за месяц», без «медианы».
// fin с p46a шлёт basis «обычно за месяц»; прежний fin («медиана за 3 мес.») — страница пишет те же слова
test('R-15: на экране регулярной — «сумма в норме — обычно за месяц»; и у прежнего fin', async () => {
  for (const basis of ['обычно за месяц', 'медиана за 3 мес.']) {
    const nov = { ...NOV, envelopes: NOV_ENV.map((e) => (e.key === 'связь' ? { ...e, basis } : e)) };
    const nav = navOf({ health: { '2026-11': await served(nov) },
      budget: { '2026-11': await served(budgetOf('2026-11', NOV_REG)) }, tx: { 'связь 2026-11': { total: 3068, count: 2 } } });
    const h = header(opsScreen(await openFromBudget(nav, '2026-11', 'связь'), nav));
    assert.equal(h.basis, 'сумма в норме — обычно за месяц', basis);
  }
});

// повтор ревью p46a (п. 12): значок метки стоял в «Здоровье» перед именем, в «Операциях» — после категории. Правило одно,
// как в чате (`fin last` — после категории, `fin spent` — «учёба 15 684 🔁»): в строке значок — после имени. Перед
// именем — только у заголовка группы («🔁 Регулярные платежи», как «🔁 Регулярные сверх нормы» градусника)
test('повтор ревью, п. 12: в строке «Здоровья» значок — после имени, рядом с ним; имя сжимается многоточием, значок — нет', async () => {
  const bank = { key: 'банк', label: 'банк', kind: 'regular', spent: 2941, limit: 2535, norm: 2535, carry: 0, over: 406 };
  const v = view(await served({ ...HEALTH, regulars: [bank] }));
  const row = limitRow(v.limits.find((l) => l.name === 'банк'), { open() {} });
  const title = one(row, 'limit-title');
  assert.ok(title, 'имя и значок — одной группой');
  assert.deepEqual(title.kids.map((k) => [k.classes.join(' '), shown(k)]), [['ellipsis', 'банк'], ['limit-glyph', '🔁']]);
  // у лимита без значка — имя, как было
  const plain = limitRow(v.limits.find((l) => l.name === 'красота'), { open() {} });
  assert.equal(one(plain, 'limit-title'), null);
  assert.equal(shown(one(plain, 'limit-name').kids[0]), 'красота');
});
