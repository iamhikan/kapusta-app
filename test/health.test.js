// Вид «Здоровья» из ответа /api/health: что видит человек. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, amounts, shiftMonth, view } from '../js/health.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1\u00a0$2');

const NOW = {
  month: '2026-11', date: '2026-11-11', day: 11, days: 30, closed: false,
  zone: { status: 'ok', word: 'в норме' }, norm: 200000, spent: 80000, left: 120000, plan_today: 73333, per_day: 6000,
  regular: 0, oneoff: 0,
  limits: [
    { name: 'питомцы', spent: 6000, limit: 4000, over: 2000 },
    { name: 'путешествия', spent: 14000, limit: 16000, over: 0 },
    { name: 'еда вне дома', spent: 5000, limit: 25000, over: 0 },
    { name: 'резерв', spent: 2000, limit: 30000, over: 0, eaten: 2000 },
    { name: 'транспорт', spent: 0, limit: 5000, over: 0 },
    { name: 'спорт', spent: 0, limit: 8000, over: 0 },
    { name: 'одежда', spent: 0, limit: 12000, over: 0 },
  ],
  balances: [
    { account: 'Assets:Family:Cash:Aleksey', name: 'нал Алексея', amounts: { EUR: 1000, RSD: 150000 } },
    { account: 'Assets:Family:Freedom', name: 'Freedom', later: true },
    { account: 'Assets:Family:P2P', name: 'P2P', amounts: { RSD: 3000, RUB: -4000 } },
  ],
  empty: ['другая карта', 'Walt'],
  curve: [[1, 2000], [2, 20000], [11, 80000]],
  forecast: 218182,
  fresh: { last: '2026-11-11 08:11', now: '2026-11-11T11:13' },
  available: { total: 250000, left: 170000 },
};

const OCT = {
  ...NOW, month: '2026-10', date: '2026-10-31', day: 31, days: 31, closed: true,
  zone: { status: 'over', word: 'сверх дохода' }, norm: 200000, spent: 500000, left: -300000,
  plan_today: null, per_day: null, forecast: null,
  regular: 90000,
  curve: [[1, 50000], [2, 210000], [3, 250000], [31, 500000]],
  available: { total: 260000, left: -240000 },
};

const ANGELINA = (({ available, ...rest }) => rest)(NOW);

test('числа — по-русски, минус — настоящий', () => {
  assert.equal(fmt(80000), '80 000');
  assert.equal(fmt(-4000), '−4 000');
  assert.equal(amounts({ EUR: 1000, RSD: 150000 }), '150 000 RSD · 1 000 €');   // динары первыми
  assert.equal(amounts({ RSD: 3000, RUB: -4000 }), '3 000 RSD · −4 000 ₽');
});

test('месяцы листаются через год', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2025-12', 1), '2026-01');
});

test('текущий месяц: крупно — потрачено из нормы (решение 26); ниже — осталось, можно в день, весь доход', () => {
  const v = view(NOW);
  assert.equal(v.title, 'Ноябрь 2026');
  assert.equal(v.sub, 'на 11 ноября, день 11 из 30');
  assert.deepEqual(v.zone, { word: 'в норме', tone: 'good' });
  assert.deepEqual(v.big, { label: 'Потрачено', value: '80 000', of: 'из 200 000', tone: '' });
  assert.equal(v.bar.fill, 0.4);
  assert.equal(v.bar.plan, 73333 / 200000);
  // решение 49: норма — уже в «из N» у крупного числа; план на сегодня — подписью у черты, без слова «черта»
  // «Потрачено · 40 %» — у крупного числа (плашка «тратим быстрее плана» и «40 % нормы» в строку не помещались)
  assert.deepEqual(v.scale, { pct: '40 %', plan: 'план на сегодня 73 333', aria: '40 % нормы, план на сегодня 73 333' });
  assert.ok(!JSON.stringify(v.scale).includes('норма'));
  assert.deepEqual(v.stats, [
    { label: 'Осталось из нормы', value: '120 000', tone: '' },
    { label: 'Можно в день', value: '~6 000', tone: '' },
    { label: 'Весь доход, осталось', value: '170 000', tone: '' },
  ]);
  assert.equal(v.canNext, false);
});

test('Ангелине — без «Весь доход» (сервер его не шлёт): вместо него лимиты сверх; резерв всё покрыл — сколько в нём осталось', () => {
  const v = view(ANGELINA);
  // решение 63: перерасход «питомцев» покрыт резервом — не красный счётчик, а остаток резерва (30 000 − 2 000)
  assert.deepEqual(v.stats[2], { label: 'Резерв, осталось', value: sp('28 000'), tone: '' });
  const bare = { ...ANGELINA, limits: ANGELINA.limits.filter((l) => !l.eaten) };     // резерва нет — счётчик, как был
  assert.deepEqual(view(bare).stats[2], { label: 'Лимитов сверх', value: '1 из 6', tone: 'bad' });
  assert.ok(!JSON.stringify(v).includes('Весь доход'));
});

test('лимиты: горячие сверху, «+N» сверх лимита; полоска зелёная до плана, выше — жёлтая (решение 69), красная — сверх', () => {
  const v = view(NOW);
  const [pets, travel, food] = v.limits;
  assert.equal(pets.name, 'питомцы');
  assert.deepEqual(pets.ops, { limit: 'питомцы' });               // тап — операции лимита за месяц (решение 3)
  assert.equal(pets.over, '+2 000');
  assert.equal(pets.color, 'var(--bar-orange)');                 // решение 63: перерасход покрыл резерв — не красная
  const bare = { ...NOW, limits: NOW.limits.filter((l) => !l.eaten) };
  assert.equal(view(bare).limits[0].color, 'var(--bad)');        // резерва нет — красная
  assert.equal(pets.fill, 1);                                    // полоска не вылезает за край
  assert.equal(travel.over, '');
  assert.equal(travel.color, 'var(--bar-yellow)');            // 87,5 % при плане 37 %: у самого лимита — не оранжевая
  assert.equal(view({ ...NOW, day: 30 }).limits[1].color, 'var(--bar-green)');                   // к концу месяца — в плане
  assert.equal(food.color, 'var(--bar-green)');                 // 20 % при плане 37 %
  assert.deepEqual([food.spent, food.limit], ['5 000', '25 000']);
  assert.equal(v.limitsShown, 6);                                // остальные — по «Все 7»
  assert.equal(v.plan, 11 / 30);
});

test('состояние полоски лимита — словами для диктора (фаза 12): в плане, выше плана, сверх лимита; итог месяца — в лимите', () => {
  const [pets, travel, food] = view(NOW).limits;
  assert.deepEqual([pets.state, travel.state, food.state], ['сверх лимита, покрыто резервом', 'выше плана', 'в плане']);
  assert.equal(view(NOW).limits.find((l) => l.name === 'транспорт').state, 'в плане');      // трат нет
  assert.deepEqual(view(OCT).limits.slice(0, 3).map((l) => l.state), ['сверх лимита, покрыто резервом', 'в лимите', 'в лимите']);
});

test('остатки — группами по типу, суммы в две строки, плитка, итог наличных и карт (решения 47, 48)', () => {
  const v = view({ ...NOW, balances_total: 293200, balances: [
    { account: 'Assets:Family:Cash:Aleksey', name: 'нал Алексея', amounts: { EUR: 1000, RSD: 150000 }, group: 'cash', rsd: 267200 },
    { account: 'Assets:Family:Raiffeisen:RUB', name: 'Райффайзен РФ', amounts: { RUB: 20000 }, group: 'cards', rsd: 25000 },
    { account: 'Assets:PR:ALTA', name: 'ПР Алексея', amounts: { RSD: 300000 }, group: 'business', rsd: 300000 },
    { account: 'Assets:Family:ALTA', name: 'карта ALTA', amounts: { RSD: 1000 }, group: 'cards', rsd: 1000 },
  ] });
  assert.deepEqual(v.groups.map((g) => [g.title, g.rows.map((r) => r.name)]), [['Наличные', ['Нал Алексея']],
    ['Карты и счета', ['Райффайзен РФ', 'Карта ALTA']], ['Бизнес', ['ПР Алексея']]]);
  const cash = v.groups[0].rows[0];
  assert.deepEqual(cash.lines, [sp('150 000 RSD'), sp('1 000 €')]);    // динары сверху, валюта ниже
  assert.deepEqual(v.groups[1].rows[0].lines, [sp('20 000 ₽')]);
  assert.equal(cash.tile.glyph, 'cash');
  assert.deepEqual(cash.ops, { account: 'Assets:Family:Cash:Aleksey' });
  assert.equal(v.balTotal, sp('наличные и карты сейчас ≈ 293 200 RSD'));   // решение 60
  assert.equal(v.empty, 'Пустые счета: другая карта, Walt.');
  assert.equal(v.balTitle, 'Остатки');
  assert.equal(v.fresh, 'последняя запись 11.11 в 08:11 · обновлено в 11:13');
});

test('прежний сервер без групп и итога — одна группа без заголовка, итога нет; «Вне лимитов» нет (решение 44)', () => {
  const v = view(NOW);
  assert.equal(v.outside, undefined);
  assert.equal(view({ ...NOW, outside: [{ name: 'салон', rsd: 100 }] }).outside, undefined);   // старый сервер
  assert.deepEqual(v.groups.map((g) => [g.title, g.rows.length]), [['', 3]]);
  assert.equal(v.balTotal, '');
});

test('кривая свёрнута; заметка — прогноз к норме', () => {
  const v = view(NOW);
  assert.deepEqual(v.curve.note, { text: 'прогноз 218 182 · выше нормы на 18 182', tone: 'warn' });
  const calm = view({ ...NOW, forecast: 150000 });
  assert.deepEqual(calm.curve.note, { text: 'прогноз 150 000 · в пределах нормы', tone: 'good' });
});

test('прошлый месяц — итог: без плана на сегодня и прогноза, сверх нормы красным, когда кончилась норма', () => {
  const v = view(OCT);
  assert.equal(v.sub, 'итог месяца');
  assert.deepEqual(v.zone, { word: 'сверх дохода', tone: 'bad' });
  assert.deepEqual(v.big, { label: 'Потрачено', value: '500 000', of: 'из 200 000', tone: 'bad' });
  assert.equal(v.bar.plan, null);
  assert.equal(v.bar.fill, 1);
  assert.deepEqual(v.scale, { pct: '250 %', plan: '', aria: '250 % нормы' });
  assert.deepEqual(v.stats, [
    { label: 'Сверх нормы', value: '300 000', tone: 'bad' },
    { label: 'Регулярные', value: '90 000', tone: '' },           // решение 44: «Вне лимитов» больше нет
    { label: 'Сверх дохода', value: '240 000', tone: 'bad' },
  ]);
  assert.deepEqual(v.curve.note, { text: 'итог 500 000 · норма кончилась 2 октября', tone: 'bad' });
  assert.equal(v.plan, 1);
  assert.equal(v.balTitle, 'Остатки на 31.10');
  assert.equal(view({ ...OCT, balances_total: 293200 }).balTotal, sp('наличные и карты ≈ 293 200 RSD'));   // дата — в заголовке, не «сейчас»
  assert.equal(v.fresh, 'месяц закрыт · последняя запись 11.11 в 08:11');
  assert.equal(v.canNext, true);
});

test('норма исчерпана в текущем месяце — «можно в день» нет', () => {
  const v = view({ ...NOW, spent: 230000, left: -30000, per_day: null, zone: { status: 'savings', word: 'тратим отложенное' } });
  assert.deepEqual(v.big, { label: 'Потрачено', value: '230 000', of: 'из 200 000', tone: 'bad' });
  assert.deepEqual(v.stats[0], { label: 'Сверх нормы', value: '30 000', tone: 'bad' });
  assert.deepEqual(v.stats[1], { label: 'Можно в день', value: 'норма исчерпана', tone: 'bad' });
  assert.deepEqual(v.zone, { word: 'тратим отложенное', tone: 'warn' });
});

test('резерв: под лимитами — из чего он (свои + перерасход других, решение 51) и чей перерасход покрыт', () => {
  assert.equal(view(NOW).reserve, 'Резерв: свои 0 + перерасход других 2 000 — покрыл «питомцы».');
  const short = { ...NOW, limits: [...NOW.limits.slice(0, 3), { name: 'резерв', spent: 3000, limit: 3000, over: 0, eaten: 3000 },
    { name: 'одежда', spent: 15000, limit: 12000, over: 3000 }] };
  assert.equal(view(short).reserve,
    'Резерв: свои 0 + перерасход других 3 000 — покрыл «питомцы», «одежда» частично.');
  assert.ok(!JSON.stringify(view(short)).includes('перевал'));
  const calm = { ...NOW, limits: NOW.limits.filter((l) => !l.eaten && !l.over) };
  assert.equal(view(calm).reserve, '');
});

test('строка резерва открывает операции перерасхода других; шапка — чей перерасход и сколько покрыто (решение 51)', () => {
  const res = view(NOW).limits.find((l) => l.name === 'резерв');
  assert.deepEqual(res.ops, { limit: 'резерв' });
  assert.equal(res.note, 'перерасход «питомцы» · резерв покрыл 2\u00a0000');
  assert.equal(view(NOW).limits.find((l) => l.name === 'питомцы').note, undefined);
});

test('кривая отрезана в снимке (решение 32): графика нет, подпись — по итогу, а не по кривой', () => {
  const v = view({ ...NOW, curve: [] });
  assert.equal(v.curve.chart, false);
  assert.equal(view(NOW).curve.chart, true);
  assert.deepEqual(view({ ...OCT, curve: [] }).curve.note, { text: 'итог 500 000 · сверх нормы на 300 000', tone: 'bad' });
  assert.deepEqual(view({ ...OCT, spent: 150000, left: 50000, curve: [] }).curve.note,
    { text: 'итог 150 000 · в пределах нормы', tone: 'good' });
});

test('остатки нажимаются: операции этого счёта за месяц (решение 38); счета — в фильтр «Кошелёк или счёт»', () => {
  const v = view(NOW);
  assert.deepEqual(v.groups[0].rows[0].ops, { account: 'Assets:Family:Cash:Aleksey' });
  assert.equal(v.groups[0].rows[0].name, 'Нал Алексея');
  assert.deepEqual(v.accounts, [['нал Алексея', 'Assets:Family:Cash:Aleksey'], ['Freedom', 'Assets:Family:Freedom'],
    ['P2P', 'Assets:Family:P2P']]);
});

test('скрытые лимиты — отдельной кнопкой (решение 40): сколько, полоски, «виден от N %»; нет — кнопки нет', () => {
  const v = view({ ...NOW, hidden: [{ name: 'образование', spent: 5000, limit: 20000, hot: 90 }] });
  assert.equal(v.hidden.label, 'Скрытые лимиты · 1');
  assert.deepEqual(v.hidden.rows.map((r) => [r.name, r.spent, r.limit, r.fill, r.hint, r.ops.limit]),
    [['образование', sp('5 000'), sp('20 000'), 0.25, 'в градуснике — от 90 % лимита', 'образование']]);
  assert.equal(view(NOW).hidden, null);                         // старый ответ без hidden
  assert.equal(view({ ...NOW, hidden: [] }).hidden, null);
});

test('под лимитами — «Весь бюджет месяца»: у обоих (Ангелине — без дохода, это решает сервер)', () => {
  assert.equal(view(NOW).budgetLabel, 'Весь бюджет на ноябрь');
  assert.equal(view(OCT).budgetLabel, 'Весь бюджет на октябрь');
});

test('решение 46: выше плана на сегодня, но в норме — жёлтые плашка и полоска; слово — решения 50', () => {
  const v = view({ ...NOW, spent: 126000, zone: { status: 'fast', word: 'тратим быстрее плана' } });
  assert.deepEqual(v.zone, { word: 'тратим быстрее плана', tone: 'fast' });
});

test('решение 50: прежний сервер шлёт «быстрее плана» — на плашке «тратим быстрее плана»; новое слово — как есть', () => {
  assert.equal(view({ ...NOW, zone: { status: 'fast', word: 'быстрее плана' } }).zone.word, 'тратим быстрее плана');
  assert.equal(view({ ...NOW, zone: { status: 'fast', word: 'тратим быстрее плана' } }).zone.word, 'тратим быстрее плана');
  assert.equal(view(NOW).zone.word, 'в норме');
});

test('решения 49, 69: легенда у «Лимиты» — только цвета полосок месяца, один цвет — один смысл; у итога месяца плана нет', () => {
  // NOW: питомцы — сверх, покрыто резервом; путешествия — выше плана; остальные — в плане; красных нет
  assert.deepEqual(view(NOW).legend.map((l) => [l.text, l.color]), [['в плане', 'var(--bar-green)'],
    ['выше плана', 'var(--bar-yellow)'], ['покрыто резервом', 'var(--bar-orange)']]);
  assert.deepEqual(view(SHORT).legend.map((l) => l.text), ['в плане', 'выше плана', 'сверх лимита']);   // резерв кончился
  assert.deepEqual(view(OCT).legend.map((l) => l.text), ['в лимите', 'покрыто резервом']);
  const legend = view(NOW).legend.map((l) => l.color);
  for (const l of view(NOW).limits) assert.ok(legend.includes(l.color), `${l.name}: ${l.color} нет в легенде`);
});

test('резерв не кончился — он покрыл весь перерасход, хотя округлённые суммы расходятся на 1 (critique 12.11)', () => {
  // сервер округляет каждый перерасход отдельно: 2 000 + 1 001 = 3 001 против «перерасход других» 3 000
  const room = { ...NOW, limits: [NOW.limits[0], { name: 'резерв', spent: 3500, limit: 30000, over: 0, eaten: 3000 },
    { name: 'одежда', spent: 13001, limit: 12000, over: 1001 }] };
  assert.equal(view(room).reserve, 'Резерв: свои 500 + перерасход других 3 000 — покрыл «питомцы», «одежда».');
});

// решение 63 (critique 12.11, повтор, P1): покрытый резервом перерасход — спокойно; тревога — когда резерв кончился
const SHORT = { ...NOW, limits: [...NOW.limits.slice(0, 3), { name: 'резерв', spent: 3000, limit: 3000, over: 0, eaten: 3000 },
  { name: 'одежда', spent: 15000, limit: 12000, over: 3000 }] };

test('решение 63: перерасход, который покрыл резерв, — оранжевая полоска и «покрыто резервом»; резерв кончился — красная', () => {
  const pets = view(NOW).limits.find((l) => l.name === 'питомцы');
  assert.deepEqual([pets.covered, pets.color, pets.hint, pets.over], [true, 'var(--bar-orange)', 'покрыто резервом', sp('+2 000')]);
  for (const l of view(SHORT).limits.filter((x) => x.over)) {
    assert.deepEqual([l.covered, l.color, l.state, l.hint], [false, 'var(--bad)', 'сверх лимита', undefined], l.name);
  }
  assert.equal(view(SHORT).stats[2].label, 'Весь доход, осталось');       // Алексею — как было
  assert.deepEqual(view((({ available, ...r }) => r)(SHORT)).stats[2], { label: 'Лимитов сверх', value: '2 из 5', tone: 'bad' });
});

test('решение 63: строка резерва видна сразу, под горячими лимитами; в ней — из чего он и что покрыл', () => {
  const many = { ...NOW, limits: [...NOW.limits.filter((l) => !l.eaten), { name: 'красота', spent: 0, limit: 5000, over: 0 },
    NOW.limits.find((l) => l.eaten)] };
  const v = view(many);
  assert.equal(v.limits.length, 8);
  assert.deepEqual(v.top.map((l) => l.name), [...many.limits.slice(0, 6).map((l) => l.name), 'резерв']);
  assert.equal(v.top.at(-1).hint, sp('свои 0 + перерасход других 2 000 — покрыл «питомцы».'));
  assert.deepEqual(view(NOW).top.map((l) => l.name), NOW.limits.slice(0, 6).map((l) => l.name));   // резерв и так в первых 6
});
