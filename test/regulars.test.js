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
