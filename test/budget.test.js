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

test('лимиты месяца: сумма, евро, скрытые и вне нормы — пометкой; резерв — норма без лимитов (решение 59)', () => {
  const v = budgetView(ALEKSEY);
  assert.equal(v.limits.title, sp('Лимиты — 200 000'));
  assert.equal(v.limits.sub, sp('1 600 €'));
  assert.deepEqual(v.limits.rows.map((r) => [r.name, r.sum, r.note]), [
    ['продукты', sp('50 000'), '430 €'], ['образование', sp('20 000'), '170 € · скрытый, виден от 90 %'],
    ['комиссии', sp('3 000'), 'скрытый, виден от 80 % · вне нормы']]);
  assert.deepEqual(v.free, { text: sp('Резерв (норма без лимитов): 43 000'), tone: '' });
  assert.deepEqual(budgetView({ ...ALEKSEY, free: -4200 }).free, { text: sp('Лимиты больше нормы на 4 200'), tone: 'bad' });
});

// правка 5 (ui-ux-pro-max, 13.11.2026): вывод — первым, «есть» и «нужно» — двумя числами рядом, разбивка — под
// раскрытием (было: четыре абзаца, вывод — пятым)
test('правка 5: деньги на месяц (Алексею) — вывод плашкой и словами, есть и нужно — числами, разбивка отдельно', () => {
  const p = budgetView(ALEKSEY).plan;
  assert.equal(p.title, 'Деньги на ноябрь');
  assert.deepEqual(p.verdict, { word: 'не хватает', text: 'Перевести себе с ПР', value: sp('120 000 RSD (≈ 1025 €)'), tone: 'warn' });
  // решение 60: имя и дата; итог «≈» по курсу НБС, слагаемые — через «+»
  assert.deepEqual(p.have, { label: 'Наличные и карты на 1 ноября', value: sp('≈ 300 000'), sub: sp('280 000 RSD + 170 € по курсу НБС') });
  assert.deepEqual(p.need, { label: 'Нужно на месяц', value: sp('420 000') });
  assert.deepEqual([p.fill, p.ratio], [1, 'нужно — 140 % того, что есть']);
  assert.deepEqual(p.parts, [sp('траты в лимитах (норма) 240 000'), sp('жильё 180 000')]);
  assert.equal(p.salary, sp('Зарплата ~300 000 придёт в конце месяца и уйдёт в остаток к 1 декабря.'));
  const ok = budgetView({ ...ALEKSEY, plan: { ...ALEKSEY.plan, have_rsd: 1680000, transfer: 0, spare: 5000, transfer_eur: null,
    salary: null } }).plan;
  assert.deepEqual(ok.verdict, { word: 'хватает', text: 'Переводить с ПР не нужно', value: sp('сверху 5 000 RSD'), tone: 'good' });
  assert.deepEqual([ok.fill, ok.ratio, ok.salary], [0.25, 'нужно — 25 % того, что есть', '']);
  const dec = budgetView({ ...ALEKSEY, month: '2026-12' }).plan;
  assert.match(dec.salary, /к 1 января\.$/);
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

// решение 94 (Алексей 20.11.2026: «давай все по ПР в ПР»): коммуналка в «Обязательных» — только доля семьи, доля ПР —
// своя строка «ПР коммуналка» в группе ПР. В «Деньгах на месяц» — та же доля семьи; full у частей плана сервер не шлёт
test('коммуналка: доля семьи — одна сумма в «Обязательных» и в «Деньгах на месяц», без пометок о ПР; ПР — строкой группы ПР', () => {
  const health = { month: '2026-11', envelopes: [{ key: 'коммуналка', label: 'коммуналка', kind: 'mandatory',
    basis: 'доля семьи, среднее с 05.2026', spent: 13491, limit: 12045, norm: 12045, carry: 0, over: 1446 }] };
  const b = { ...ALEKSEY,
    groups: [{ name: 'Обязательные', rsd: 102045, avg_months: null, rows: [{ name: 'жильё', rsd: 90000, note: '(770 €)' },
      { name: 'коммуналка', rsd: 12045, note: '(в ср. с 05.2026)' }] },
    { name: 'ПР', rsd: 915, avg_months: null, rows: [{ name: 'ПР коммуналка', rsd: 915, note: '(в ср. с 05.2026)' }] }],
    plan: { ...ALEKSEY.plan, parts: [{ name: 'жильё', rsd: 90000 }, { name: 'коммуналка', rsd: 12045 }] } };
  const v = budgetView(b, health);
  // E10, E13: коммуналка нажимается (её операции и градусник против доли семьи), «ПР коммуналка» — нет
  assert.deepEqual(v.groups[0].rows[1], { name: 'коммуналка', sum: sp('12 045'), note: 'в среднем с мая 2026',
    regular: 'коммуналка' });
  assert.deepEqual(v.groups[1].rows, [{ name: 'ПР коммуналка', sum: '915', note: 'в среднем с мая 2026' }]);
  assert.deepEqual(v.plan.parts, [sp('жильё 90 000'), sp('коммуналка 12 045')]);
  // ответ до решения 94 (часть плана с full) — страница full не читает: пометок «с долей ПР» и «без доли ПР» нет
  const old = budgetView({ ...b, plan: { ...b.plan, parts: [{ name: 'коммуналка', rsd: 8427, full: 12045 }] } }, health);
  assert.deepEqual([old.groups[0].rows[1].note, old.plan.parts[0]], ['в среднем с мая 2026', sp('коммуналка 8 427')]);
});

// R-15 (ревью 26.11): у строк «Бюджета» под суммой — четыре смысла. Сумма по договору и по графику — словами, как в
// шапке их «Операций» (basis сервера); сумма регулярной из budget.yaml — «в норме 5 €». «медиана» — ответ 6 (p46a)
test('R-15: «по договору 650 €», «по графику 25 000 ₽», «в норме 5 €»; среднее и медиана — как были', () => {
  const env = (key, kind, basis, extra = {}) => ({ key, label: key, kind, basis, spent: 0, limit: 1, norm: 1, carry: 0, over: 0, ...extra });
  const health = { month: '2026-11', envelopes: [env('жильё', 'mandatory', 'по договору 650 €', { contract: true }),
    env('кредит РФ', 'mandatory', 'по графику 25 000 ₽', { contract: true }), env('обмен валюты', 'regular', '5 EUR в месяц'),
    env('связь', 'regular', 'медиана за 3 мес.')] };
  const b = { ...ALEKSEY, groups: [
    { name: 'Обязательные', rsd: 109245, avg_months: null, rows: [{ name: 'жильё', rsd: 76390, note: '(650 €)' },
      { name: 'кредит РФ', rsd: 32855, note: '(25 000 ₽)' }] },
    { name: 'Регулярные по карте', rsd: 4860, avg_months: 3, rows: [{ name: 'связь', rsd: 4272, note: '(медиана за 3 мес.)' },
      { name: 'обмен валюты', rsd: 588, note: '(5 €)' }] }] };
  const notes = budgetView(b, health).groups.flatMap((g) => g.rows.map((r) => r.note));
  assert.deepEqual(notes, ['по договору 650 €', 'по графику 25 000 ₽', 'медиана за 3 мес.', 'в норме 5 €']);
});
