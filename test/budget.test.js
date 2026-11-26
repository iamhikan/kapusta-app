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
  // E10, E13: коммуналка нажимается (её операции и градусник против доли семьи), «ПР коммуналка» — нет. R-11: в строке —
  // потрачено против доли семьи и полоса; основа суммы («в среднем с мая 2026») — на её экране
  const util = v.groups[0].rows[1];
  assert.deepEqual([util.name, util.sum, util.regular, util.gauge.spent, util.gauge.limit],
    ['коммуналка', sp('12 045'), 'коммуналка', sp('13 491'), sp('12 045')]);
  assert.deepEqual(v.groups[1].rows, [{ name: 'ПР коммуналка', sum: '915', note: 'в среднем с мая 2026' }]);
  assert.deepEqual(v.plan.parts, [sp('жильё 90 000'), sp('коммуналка 12 045')]);
  // ответ до решения 94 (часть плана с full) — страница full не читает: пометок «с долей ПР» и «без доли ПР» нет
  const old = budgetView({ ...b, plan: { ...b.plan, parts: [{ name: 'коммуналка', rsd: 8427, full: 12045 }] } }, health);
  assert.deepEqual([old.groups[0].rows[1].gauge.limit, old.plan.parts[0]], [sp('12 045'), sp('коммуналка 8 427')]);
});

// R-15 (ревью 26.11): у строк «Бюджета» под суммой — четыре смысла. Сумма по договору и по графику — словами, как в
// шапке их «Операций» (basis сервера); сумма регулярной из budget.yaml — «в норме 5 €» (с p46a — подпись под полосой,
// R-11); «медиана» — «обычно за месяц» (ответ 6), с p46a — на экране регулярной
test('R-15: «по договору 650 €», «по графику 25 000 ₽», «в норме 5 €»; у медианы подписи в строке нет', () => {
  const env = (key, kind, basis, extra = {}) => ({ key, label: key, kind, basis, spent: 0, limit: 1, norm: 1, carry: 0, over: 0, ...extra });
  const health = { month: '2026-11', envelopes: [env('жильё', 'mandatory', 'по договору 650 €', { contract: true }),
    env('кредит РФ', 'mandatory', 'по графику 25 000 ₽', { contract: true }), env('обмен валюты', 'regular', '5 EUR в месяц'),
    env('связь', 'regular', 'медиана за 3 мес.')] };
  const b = { ...ALEKSEY, groups: [
    { name: 'Обязательные', rsd: 109245, avg_months: null, rows: [{ name: 'жильё', rsd: 76390, note: '(650 €)' },
      { name: 'кредит РФ', rsd: 32855, note: '(25 000 ₽)' }] },
    { name: 'Регулярные по карте', rsd: 4860, avg_months: 3, rows: [{ name: 'связь', rsd: 4272, note: '(медиана за 3 мес.)' },
      { name: 'обмен валюты', rsd: 588, note: '(5 €)' }] }] };
  const notes = budgetView(b, health).groups.flatMap((g) => g.rows.map((r) => (r.gauge ? r.gauge.hint : r.note)));
  assert.deepEqual(notes, ['по договору 650 €', 'по графику 25 000 ₽', '', 'в норме 5 €']);
});

// R-11 (решение 98, ответ 5): «Бюджет» показывал только план — факт был виден по одной регулярной, после нажатия
// (вопрос «где мы по счетам месяца» — 9 нажатий). Теперь у каждой регулярной (и коммуналки) — потрачено против суммы
// в норме и полоса, как у лимита: перебор — плашкой «+N», штриховкой и подписью про «Потрачено» (как на «Здоровье»).
// У группы регулярных — «ушло N из M». Числа — envelopes «Здоровья» месяца: живой ответ 26.11.2026
// неразрывные пробелы (числа, «перебор +N», валюта) — проверяются отдельно, здесь — слова и числа
const plain = (x) => JSON.parse(JSON.stringify(x).replace(/\u00a0/g, ' '));
const ENV = (key, spent, norm, extra = {}) => ({ key, label: key, kind: 'regular', basis: 'обычно за месяц', spent,
  limit: norm + (extra.carry || 0), norm, carry: 0, over: Math.max(0, spent - norm - (extra.carry || 0)), ...extra });
const NOV_HEALTH = { month: '2026-11', closed: false, envelopes: [ENV('спортпит', 0, 5411, { basis: 'среднее за 3 мес.' }),
  ENV('подписки', 13786, 20684), ENV('связь', 3068, 4272), ENV('образование', 15684, 14322), ENV('банк', 2941, 2535),
  ENV('обмен валюты', -189, 588, { basis: '5 EUR в месяц' }),
  ENV('коммуналка', 13491, 12045, { kind: 'mandatory', basis: 'доля семьи, среднее с 05.2026' })] };
const NOV_GROUPS = [
  { name: 'Обязательные', rsd: 12045, avg_months: null, rows: [{ name: 'коммуналка', rsd: 12045, note: '(в ср. с 05.2026)' }] },
  { name: 'Регулярные по карте', rsd: 47812, avg_months: null, rows: [{ name: 'спортпит', rsd: 5411, note: '(в ср. за 3 мес.)' },
    { name: 'подписки', rsd: 20684, note: '(медиана за 3 мес.)' }, { name: 'связь', rsd: 4272, note: '(медиана за 3 мес.)' },
    { name: 'образование', rsd: 14322, note: '(медиана за 3 мес.)' }, { name: 'банк', rsd: 2535, note: '(медиана за 3 мес.)' },
    { name: 'обмен валюты', rsd: 588, note: '(5 €)' }] },
  { name: 'ПР', rsd: 915, avg_months: null, rows: [{ name: 'ПР коммуналка', rsd: 915, note: '(в ср. с 05.2026)' }] }];

test('R-11: регулярные в «Бюджете» — «потрачено / в норме» и полоса; перебор — «+N» и подпись про «Потрачено»', () => {
  const v = budgetView({ ...ALEKSEY, groups: NOV_GROUPS }, NOV_HEALTH);
  const gauges = v.groups.map((g) => g.rows.map((r) => (r.gauge
    ? [r.gauge.name, r.gauge.spent, r.gauge.limit, r.gauge.over, r.gauge.color, r.gauge.hint, r.gauge.focus] : [r.name, r.sum, r.note])));
  assert.deepEqual(plain(gauges), plain([
    [['коммуналка', sp('13 491'), sp('12 045'), sp('+1 446'), 'var(--bad)', sp('в «Потрачено» идёт только то, что сверх нормы: +1 446'), 'regular:коммуналка']],
    [['спортпит', '0', sp('5 411'), '', 'var(--bar-green)', '', 'regular:спортпит'],
      ['подписки', sp('13 786'), sp('20 684'), '', 'var(--bar-green)', '', 'regular:подписки'],
      ['связь', sp('3 068'), sp('4 272'), '', 'var(--bar-green)', '', 'regular:связь'],
      ['образование', sp('15 684'), sp('14 322'), sp('+1 362'), 'var(--bad)', sp('в «Потрачено» идёт только то, что сверх нормы: +1 362'),
        'regular:образование'],
      ['банк', sp('2 941'), sp('2 535'), '+406', 'var(--bad)', 'в «Потрачено» идёт только то, что сверх нормы: +406', 'regular:банк'],
      // R-13: вернули больше, чем потратили — без «из» и полосы; «5 €» — «в норме 5 €» (R-15)
      ['обмен валюты', '+189', 'выигрыш на обмене · в норме 5 €']],
    [['ПР коммуналка', '915', 'в среднем с мая 2026']]]));
  const subs = v.groups[1].rows[1].gauge;
  assert.ok(Math.abs(subs.fill - 13786 / 20684) < 1e-9 && subs.limitAt == null);
  const edu = v.groups[1].rows[3].gauge;
  assert.ok(Math.abs(edu.fill - 14322 / 15684) < 1e-9 && edu.limitAt === edu.fill);   // штриховка — сверх суммы
  // у группы регулярных — сколько ушло из суммы группы; значки групп — как метки в «Операциях» и в чате
  assert.deepEqual(plain(v.groups.map((g) => [g.name, g.sum, g.glyph])), [['Обязательные', '12 045', '📌'],
    ['Регулярные по карте', 'ушло 35 290 из 47 812', '🔁'], ['ПР', '915', '']]);
  assert.equal(v.groups[1].sum, sp('ушло\u00a035 290 из\u00a047 812'));   // узко — перенос только перед «из»
});

test('R-11: спортпит с конвертом — «из» суммы с конвертом, подпись — из чего она; без envelopes — строки как были', () => {
  const sport = ENV('спортпит', 3000, 2433, { basis: 'среднее за 3 мес.', carry: 7300 });
  const v = budgetView({ ...ALEKSEY, groups: NOV_GROUPS.slice(1, 2) }, { month: '2026-11', envelopes: [sport] });
  assert.deepEqual([v.groups[0].rows[0].gauge.spent, v.groups[0].rows[0].gauge.limit, v.groups[0].rows[0].gauge.hint],
    [sp('3 000'), sp('9 733'), sp('в норме 2 433 + конверт 7 300')]);
  // «Здоровья» месяца нет или оно без envelopes — сумма в норме и подпись; «медиана» — «обычно за месяц» (R-15, ответ 6)
  const old = budgetView({ ...ALEKSEY, groups: NOV_GROUPS.slice(1, 2) }, null);
  assert.deepEqual(old.groups[0].rows.map((r) => [r.name, r.sum, r.note, r.gauge]).slice(0, 2),
    [['спортпит', sp('5 411'), 'в среднем за 3 мес.', undefined], ['подписки', sp('20 684'), 'обычно за месяц', undefined]]);
  assert.equal(old.groups[0].sum, sp('47 812'));
});

// R-12 (решение 98, ответ 5): договорный платёж — «оплачено» или «ждёт оплаты», а не лимит. Было: «76 460 сверх 70» с
// зелёной полосой и «32 009 из 32 855» — обещание остатка, которого нет. Стало: «✓ оплачено» в валюте договора (due,
// paid, paid_on fin), разница с суммой в норме — отдельной строкой: она в «Потрачено» не идёт (E14)
const DEAL = (key, basis, spent, norm, due, paid, on) => ({ key, label: key, kind: 'mandatory', basis, spent, limit: norm,
  norm, carry: 0, over: Math.max(0, spent - norm), contract: true, due, paid, paid_on: on });
const DEALS = { month: '2026-11', closed: false, envelopes: [
  DEAL('жильё', 'по договору 650 €', 76460, 76390, { number: 650, currency: 'EUR' }, { number: 650, currency: 'EUR' },
    ['2026-11-11']),
  DEAL('кредит РФ', 'по графику 25 000 ₽', 32009, 32855, { number: 25000, currency: 'RUB' },
    { number: 24937.26, currency: 'RUB' }, ['2026-11-13'])] };
const MANDATORY = { ...ALEKSEY, groups: [{ name: 'Обязательные', rsd: 109245, avg_months: null,
  rows: [{ name: 'жильё', rsd: 76390, note: '(650 €)' }, { name: 'кредит РФ', rsd: 32855, note: '(25 000 ₽)' }] }] };

test('R-12: жильё и кредит РФ — «✓ оплачено» в валюте договора, разница — своей строкой; до оплаты — «ждёт оплаты»', () => {
  const rows = budgetView(MANDATORY, DEALS).groups[0].rows;
  assert.deepEqual(plain(rows.map((r) => [r.name, r.sum, r.note, r.deal, r.gauge ?? null])), plain([
    ['жильё', sp('76 390'), '', { paid: true, status: '✓ оплачено 11 ноября', terms: 'по договору 650 €',
      rate: 'разница с нормой +70: курс дня оплаты, в «Потрачено» не идёт' }, null],
    ['кредит РФ', sp('32 855'), '', { paid: true, status: '✓ оплачено 13 ноября',
      terms: '24 937 ₽, по графику 25 000 ₽', rate: 'разница с нормой −846: курс дня оплаты и сумма платежа, в «Потрачено» не идёт' },
    null]]));
  assert.equal(rows[1].deal.terms, '24\u00a0937\u00a0₽, по графику 25\u00a0000\u00a0₽');   // при 320 px было «25 / 000 ₽»
  // платежа ещё нет — «ждёт оплаты», разницы нет; закрытый месяц без платежа — «платежа не было»
  const none = { ...DEALS, envelopes: DEALS.envelopes.map((e) => ({ ...e, spent: 0, over: 0, paid: { ...e.paid, number: 0 },
    paid_on: [] })) };
  assert.deepEqual(plain(budgetView(MANDATORY, none).groups[0].rows.map((r) => [r.deal.status, r.deal.terms, r.deal.rate])),
    [['ждёт оплаты', 'по договору 650 €', ''], ['ждёт оплаты', 'по графику 25 000 ₽', '']]);
  assert.equal(budgetView(MANDATORY, { ...none, closed: true }).groups[0].rows[0].deal.status, 'платежа не было');
  // два платежа в месяце — оба дня; прежний сервер (без due и paid) — подпись, как была
  const two = { ...DEALS, envelopes: [{ ...DEALS.envelopes[0], paid_on: ['2026-11-04', '2026-11-20'] }] };
  assert.equal(budgetView(MANDATORY, two).groups[0].rows[0].deal.status, '✓ оплачено 4 и 20 ноября');
  const old = { ...DEALS, envelopes: DEALS.envelopes.map(({ due, paid, paid_on: on, ...e }) => e) };
  assert.deepEqual(budgetView(MANDATORY, old).groups[0].rows.map((r) => [r.note, r.deal]),
    [['по договору 650 €', undefined], ['по графику 25 000 ₽', undefined]]);
});
