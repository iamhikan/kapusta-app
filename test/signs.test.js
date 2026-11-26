// Повтор 2 ревью p48a (находки 1 и 2; Алексей 26.11: «Да исправляй все как рекомендуешь»). Одно значение — одна
// кодировка, цвет — не единственный знак (WCAG 1.4.1):
// - перерасход — словом «сверх N» на красной плашке и штриховкой полосы за меткой лимита; число «потрачено» — без
//   красного (было трижды: плашка «+N», красное число, штриховка);
// - «+N» — только выигрыш: зелёным и со словом («выигрыш на обмене», «вернули больше, чем потратили»);
// - потеря на обмене — «−N» со словом «потеря».
// Было: «банк +406» — красная плашка перерасхода, а «обмен валюты +189» на том же экране — выигрыш без цвета; день
// обмена «25 ноября −3 888» над строками «выигрыш на обмене +346», «+3 542». Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, heard, one } from './fakedom.js';
import { view } from '../js/health.js';
import { limitRow } from '../js/limitrow.js';
import { budgetView } from '../js/budget.js';

const flat = (s) => s.replace(/\s+/g, ' ').trim();
// что видят глаза: строка для глаз (aria-hidden) — да, текст только для диктора (.sr) — нет
const eyes = (el) => (typeof el === 'string' ? el : !el ? '' : el.classes.includes('sr') ? '' : el.kids.map(eyes).join(' '));
const shown = (el) => flat(eyes(el));
const said = (el) => flat(heard(el));
const classesOf = (tree) => {
  const out = [];
  const walk = (e) => { if (e && e.kids) { out.push(...e.classes); e.kids.forEach(walk); } };
  walk(tree);
  return out;
};

const L = (key, spent, limit, state, extra = {}) =>
  ({ key, name: key, label: key, state, spent, limit, over: Math.max(0, spent - limit), ...extra });
const REG = (key, spent, norm, kind = 'regular') => ({ key, label: key, kind, basis: 'обычно за месяц', spent, limit: norm,
  norm, carry: 0, over: Math.max(0, spent - norm) });

const HEALTH = {
  month: '2026-11', date: '2026-11-26', day: 26, days: 30, closed: false, zone: { status: 'fast', word: 'тратим быстрее плана' },
  norm: 250000, spent: 211000, left: 39000, plan_today: 200000, per_day: 9750, regular: 30000, oneoff: 0,
  limits: [L('красота', 9000, 5000, 'over'), L('питомцы', 6000, 4000, 'covered'), L('продукты', 30000, 60000, 'ok')],
  regulars: [REG('банк', 2941, 2535), REG('коммуналка', 13491, 12045, 'mandatory')],
  balances: [], empty: [], balances_total: 0, curve: [[1, 0], [26, 211000]], forecast: 243462,
  fresh: { last: '2026-11-26 08:11', now: '2026-11-26T15:00' },
};
const rowOf = (v, name) => limitRow(v.limits.find((l) => l.name === name), { plan: v.plan, open() {} });

test('«Здоровье»: лимит сверх — плашка «сверх 4 000» и штриховка; число «потрачено» не красное, «+» нет', () => {
  const row = rowOf(view(HEALTH), 'красота');
  assert.equal(shown(one(row, 'badge')), 'сверх 4 000');
  assert.equal(shown(row), 'красота сверх 4 000 9 000 / 5 000');
  assert.ok(!classesOf(one(row, 'row')).includes('bad'), 'число «потрачено» — без красного');
  assert.equal(one(row, 'over').style.color, 'var(--bad)');   // штриховка за меткой лимита — красная
  assert.ok(one(row, 'limit-mark'));
  assert.equal(said(row), 'красота: 9 000 из 5 000, сверх на 4 000');
  assert.doesNotMatch(shown(row), /\+/);
});

test('«Здоровье»: перерасход покрыл резерв — та же плашка словами, спокойным цветом; красного нет', () => {
  const row = rowOf(view(HEALTH), 'питомцы');
  assert.equal(shown(one(row, 'badge')), 'сверх 2 000');
  assert.ok(one(row, 'badge').classes.includes('calm'));
  assert.ok(!classesOf(row).includes('bad'));
  assert.equal(said(row), 'питомцы: 6 000 из 4 000, сверх на 2 000, покрыто резервом');
});

test('«Здоровье»: регулярная сверх нормы — «банк 🔁 сверх 406», подпись без числа — слова пояснения 🔁 чата', () => {
  const v = view(HEALTH);
  const bank = rowOf(v, 'банк');
  assert.equal(shown(one(bank, 'limit-name')), 'банк 🔁 сверх 406');
  assert.equal(shown(bank), 'банк 🔁 сверх 406 2 941 / 2 535 в «Потрачено» идёт только то, что сверх нормы');
  assert.ok(!classesOf(one(bank, 'row')).includes('bad'));
  assert.equal(said(bank), 'банк: 2 941 из 2 535, сверх на 406, в «Потрачено» идёт только то, что сверх нормы');
  assert.equal(shown(one(rowOf(v, 'коммуналка'), 'badge')), 'сверх 1 446');
  for (const l of v.limits) assert.doesNotMatch(shown(rowOf(v, l.name)), /\+/, l.name);
});

const ENV = (key, spent, norm, extra = {}) => ({ ...REG(key, spent, norm), ...extra });
const BUDGET = { month: '2026-11', income: null, norm: 257975, savings: null, plan: null, free: null,
  limits: { rsd: 0, rows: [] },
  groups: [{ name: 'Регулярные по карте', rsd: 17445, avg_months: null, rows: [{ name: 'образование', rsd: 14322, note: '' },
    { name: 'банк', rsd: 2535, note: '' }, { name: 'обмен валюты', rsd: 588, note: '(5 €)' }] }] };
const BUDGET_HEALTH = { month: '2026-11', closed: false, envelopes: [ENV('образование', 15684, 14322),
  ENV('банк', 2941, 2535), ENV('обмен валюты', -189, 588, { basis: '5 EUR в месяц' })] };

test('«Бюджет»: регулярная сверх нормы — как на «Здоровье»: «сверх 1 362», штриховка, число без красного', () => {
  const rows = budgetView(BUDGET, BUDGET_HEALTH).groups[0].rows;
  const edu = limitRow(rows[0].gauge, { open() {} });
  assert.equal(shown(one(edu, 'badge')), 'сверх 1 362');
  assert.equal(shown(edu), 'образование сверх 1 362 15 684 / 14 322 в «Потрачено» идёт только то, что сверх нормы');
  assert.ok(!classesOf(one(edu, 'row')).includes('bad'));
  assert.equal(one(edu, 'over').style.color, 'var(--bad)');
  assert.equal(said(edu), 'образование: 15 684 из 14 322, сверх на 1 362, в «Потрачено» идёт только то, что сверх нормы');
  assert.equal(all(edu, 'badge').length, 1);
});
