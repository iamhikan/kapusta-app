// Бюджет (этап 7): продолжение «Все лимиты» на «Здоровье» — куда идёт доход (fin limits) и деньги на месяц (fin plan,
// только Алексею). Страница ничего не считает: суммы и состав — с сервера. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetView } from '../js/budget.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1\u00a0$2');

const ALEKSEY = {
  month: '2026-11',
  income: { rsd: 500000, set: '4 300 €' },
  groups: [
    { name: 'Обязательные', rsd: 120000, avg_months: null, rows: [{ name: 'жильё', rsd: 90000, note: '(770 €)' },
      { name: 'кредит', rsd: 30000, note: null }] },
    { name: 'Регулярные по карте', rsd: 30000, avg_months: 3, rows: [{ name: 'связь', rsd: 30000, note: null }] },
    { name: 'ПР', rsd: 50000, avg_months: null, rows: [{ name: 'резерв налога 10 %', rsd: 50000, note: null }] },
  ],
  savings: { rsd: 60000, set: '510 €' },
  norm: 240000,
  limits: { rsd: 200000, eur: 1600, rows: [
    { name: 'продукты', rsd: 50000, set: '430 €', hot: null, off_norm: false },
    { name: 'образование', rsd: 20000, set: '170 €', hot: 90, off_norm: false },
    { name: 'комиссии', rsd: 3000, set: null, hot: 80, off_norm: true }] },
  free: 43000,
  plan: { have_rsd: 300000, have: { RUB: 0, EUR: 170, RSD: 280000 }, need: 420000,
    parts: [{ name: 'траты в лимитах (норма)', rsd: 240000 }, { name: 'жильё', rsd: 180000 }],
    transfer: 120000, spare: 0, transfer_eur: '1025 €', salary: 300000 },
};

test('куда идёт доход: полоса долей — группы, «отложить» и норма; доли дают весь доход', () => {
  const v = budgetView(ALEKSEY);
  assert.equal(v.title, 'Бюджет · Ноябрь 2026');
  assert.deepEqual(v.income, { label: 'Доход ПР', value: sp('500 000'), set: '4 300 €' });
  assert.deepEqual(v.alloc.map((a) => [a.name, a.sum]), [['Норма — переменные траты', sp('240 000')],
    ['Обязательные', sp('120 000')], ['Регулярные по карте', sp('30 000')], ['ПР', sp('50 000')], ['Отложить', sp('60 000')]]);
  assert.ok(Math.abs(v.alloc.reduce((s, a) => s + a.share, 0) - 1) < 1e-9);
  assert.equal(new Set(v.alloc.map((a) => a.color)).size, 5);
});

test('группы со строками; регулярные — «в среднем за 3 мес.»', () => {
  const v = budgetView(ALEKSEY);
  assert.deepEqual(v.groups.map((g) => [g.name, g.sum, g.sub]), [['Обязательные', sp('120 000'), ''],
    ['Регулярные по карте', sp('30 000'), 'в среднем за 3 мес.'], ['ПР', sp('50 000'), '']]);
  assert.deepEqual(v.groups[0].rows, [{ name: 'жильё', sum: sp('90 000'), note: '770 €' }, { name: 'кредит', sum: sp('30 000'), note: '' }]);
});

test('лимиты месяца: сумма, евро, скрытые и вне нормы — пометкой; без лимита из нормы', () => {
  const v = budgetView(ALEKSEY);
  assert.equal(v.limits.title, sp('Лимиты — 200 000'));
  assert.equal(v.limits.sub, sp('1 600 €'));
  assert.deepEqual(v.limits.rows.map((r) => [r.name, r.sum, r.note]), [
    ['продукты', sp('50 000'), '430 €'], ['образование', sp('20 000'), '170 € · скрытый, виден от 90 %'],
    ['комиссии', sp('3 000'), 'скрытый, виден от 80 % · вне нормы']]);
  assert.deepEqual(v.free, { text: sp('Без лимита из нормы: 43 000'), tone: '' });
  assert.deepEqual(budgetView({ ...ALEKSEY, free: -4200 }).free, { text: sp('Лимиты больше нормы на 4 200'), tone: 'bad' });
});

test('деньги на месяц (Алексею): есть, нужно, перевести с ПР; хватает — «сверху N»', () => {
  const p = budgetView(ALEKSEY).plan;
  assert.equal(p.title, 'Деньги на ноябрь');
  assert.equal(p.have, sp('На счетах и в нале: 300 000 RSD'));
  assert.equal(p.haveSub, sp('280 000 RSD · 170 €'));
  assert.equal(p.need, sp('Нужно на месяц: 420 000 RSD'));
  assert.deepEqual(p.parts, [sp('траты в лимитах (норма) 240 000'), sp('жильё 180 000')]);
  assert.deepEqual(p.verdict, { text: sp('Перевести себе с ПР: 120 000 RSD (≈ 1025 €)'), tone: 'warn' });
  assert.equal(p.salary, sp('Зарплата (~300 000) придёт в конце месяца — уйдёт в остаток к следующему 1-му.'));
  const ok = budgetView({ ...ALEKSEY, plan: { ...ALEKSEY.plan, transfer: 0, spare: 5000, transfer_eur: null, salary: null } }).plan;
  assert.deepEqual(ok.verdict, { text: sp('Переводить с ПР не нужно: хватает, сверху 5 000 RSD'), tone: 'good' });
  assert.equal(ok.salary, '');
});

test('Ангелине: без дохода, ПР, «отложить», нормы и плана — обязательные, регулярные и лимиты', () => {
  const v = budgetView({ month: '2026-11', groups: ALEKSEY.groups.slice(0, 2), savings: null, norm: null,
    limits: { rsd: 70000, eur: 600, rows: ALEKSEY.limits.rows.slice(0, 2) }, free: null });
  assert.equal(v.income, null);
  assert.deepEqual(v.alloc, []);
  assert.equal(v.plan, null);
  assert.equal(v.free, null);
  assert.equal(v.sub, 'обязательные траты и лимиты месяца');
  assert.equal(budgetView(ALEKSEY).sub, 'куда идёт доход');
});
