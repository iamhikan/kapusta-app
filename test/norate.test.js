// Месяц без курса (решение 81; решение 76 — учёт начат 30.11.2025; фаза 6 рефакторинга 11.2026): курса НБС ещё нет —
// нормы нет. /api/health: norm, left, plan_today, per_day — null, лимитов нет, zone — «нормы нет»; /api/budget: групп,
// лимитов, нормы и плана нет. На экране — «нормы нет», без «из N», полосы нормы, плана на сегодня и лимитов; на
// «Бюджете» — без долей дохода и «Денег на месяц». Ответы — в форме fin (fin/budget.py, fin/api.py). Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heard, one, seen } from './fakedom.js';
import { get } from '../js/api.js';
import { view } from '../js/health.js';
import { summary } from '../js/summary.js';
import { moreScreen } from '../js/more.js';

async function served(body) {
  const fetch = async () => ({ status: 200, ok: true, json: async () => body });
  return (await get('/api/x', { base: 'https://mac.tail0.ts.net', initData: 'x', fetch })).data;
}

// все строки вида: ни одна не несёт «NaN», «null», «undefined», «Infinity»
function strings(x, out = []) {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => strings(v, out));
  else if (x && typeof x === 'object') Object.values(x).forEach((v) => strings(v, out));
  return out;
}
const JUNK = /NaN|null|undefined|Infinity/;

// ноябрь 2025: учёт начат 30.11 — траты есть, курса нет (Алексею «Весь доход» сервер тоже не шлёт)
const NOV = {
  month: '2025-11', date: '2025-11-30', day: 30, days: 30, closed: true,
  zone: { status: 'none', word: 'нормы нет' },
  norm: null, spent: 1500, left: null, plan_today: null, per_day: null, regular: 0, oneoff: 0,
  limits: [], hidden: [],
  balances: [{ account: 'Assets:Family:Cash:Aleksey', name: 'нал Алексея', amounts: { RSD: 60000 }, group: 'cash', rsd: 60000 }],
  empty: ['Freedom'], balances_total: 60000,
  curve: [[1, 0], [29, 0], [30, 1500]], forecast: null,
  fresh: { last: '2026-11-13 08:11', now: '2026-11-13T11:13' },
};
// тот же месяц, пока он шёл: прогноз есть, плана на сегодня и «можно в день» нет
const OPEN = { ...NOV, date: '2025-11-20', day: 20, closed: false, forecast: 2250, curve: [[1, 0], [20, 1500]] };

for (const [what, h] of [['итог месяца', NOV], ['месяц идёт', OPEN]]) {
  test(`решение 81, «Здоровье» (${what}): «нормы нет», потрачено — без «из N», доли нормы, полосы, плана и чисел нормы`, async () => {
    const v = view(await served(h));
    const card = summary(v);
    const text = seen(card);
    assert.match(text, /нормы нет/);
    assert.match(text, /Потрачено/);
    assert.match(text, /1\s500\s*RSD/);
    assert.doesNotMatch(text, /из|%|план|Осталось|Можно в день|Лимитов сверх|Резерв/);
    assert.doesNotMatch(`${text} ${heard(card)}`, JUNK);
    assert.equal(one(card, 'bar'), null, 'полосы нормы нет');
    assert.equal(one(card, 'stats'), null, 'чисел нормы под чертой нет');
    assert.doesNotMatch(one(card, 'chip').getAttribute('class'), /undefined/);
    // лимитов и легенды нет; «Темп месяца» — итог или прогноз без нормы, кривой с чертой нормы нет
    assert.deepEqual([v.limits, v.top, v.legend, v.hidden, v.reserve], [[], [], [], null, '']);
    assert.equal(v.curve.chart, false);
    assert.equal(v.curve.note.text, h.closed ? 'итог 1 500' : 'прогноз 2 250');
    assert.equal(v.curve.note.tone, '');
    assert.deepEqual(strings(v).filter((s) => JUNK.test(s)), []);
  });
}

test('решение 81, «Бюджет»: «нормы нет» — без долей дохода, «Денег на месяц», групп и «Лимиты — 0»', async () => {
  // у обоих один ответ: дохода и плана нет (их сервер не шлёт и Ангелине), групп и лимитов нет
  const body = { month: '2025-11', groups: [], savings: null, norm: null, free: null, limits: { rsd: 0, eur: 0, rows: [] } };
  const nav = { today: () => '2026-11-13', push() {}, render() {}, healthView: () => null };
  const screen = moreScreen({ kind: 'budget', month: '2025-11', data: await served(body) }, nav);
  const text = seen(screen);
  assert.match(text, /Бюджет · Ноябрь 2025/);
  assert.match(text, /нормы нет/i);
  assert.doesNotMatch(text, /Лимиты|Деньги на|Доход|Норма —|Резерв|куда идёт доход|обязательные траты/);
  assert.doesNotMatch(`${text} ${heard(screen)}`, JUNK);
});
