// Вид «Здоровья» из ответа /api/health: что видит человек. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, amounts, shiftMonth, view } from '../js/health.js';

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
  outside: [{ name: 'салон', rsd: 100 }],
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
  outside: [{ name: 'банк', rsd: 5000 }, { name: 'налоги', rsd: 3000 }],
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
  assert.deepEqual(v.scale, ['40 % нормы', 'план на сегодня 73 333', 'норма 200 000']);
  assert.deepEqual(v.stats, [
    { label: 'Осталось из нормы', value: '120 000', tone: '' },
    { label: 'Можно в день', value: '~6 000', tone: '' },
    { label: 'Весь доход, осталось', value: '170 000', tone: '' },
  ]);
  assert.equal(v.canNext, false);
});

test('Ангелине — без «Весь доход» (сервер его не шлёт): вместо него лимиты сверх', () => {
  const v = view(ANGELINA);
  assert.deepEqual(v.stats[2], { label: 'Лимитов сверх', value: '1 из 7', tone: 'bad' });
  assert.ok(!JSON.stringify(v).includes('Весь доход'));
});

test('лимиты: горячие сверху, «+N» сверх лимита; полоска зелёная до плана, выше — от жёлтого к оранжевому, красная — сверх', () => {
  const v = view(NOW);
  const [pets, travel, food] = v.limits;
  assert.equal(pets.name, 'питомцы');
  assert.deepEqual(pets.ops, { limit: 'питомцы' });               // тап — операции лимита за месяц (решение 3)
  assert.equal(pets.over, '+2 000');
  assert.equal(pets.color, 'var(--bad)');
  assert.equal(pets.fill, 1);                                    // полоска не вылезает за край
  assert.equal(travel.over, '');
  assert.equal(travel.color, 'color-mix(in oklch, var(--bar-orange) 80%, var(--bar-yellow))');   // 87,5 % при плане 37 %
  assert.equal(view({ ...NOW, day: 30 }).limits[1].color, 'var(--bar-green)');                   // к концу месяца — в плане
  assert.equal(food.color, 'var(--bar-green)');                 // 20 % при плане 37 %
  assert.deepEqual([food.spent, food.limit], ['5 000', '25 000']);
  assert.equal(v.limitsShown, 6);                                // остальные — по «Все 7»
  assert.equal(v.plan, 11 / 30);
});

test('вне лимитов — строкой, остатки — все счета, Freedom «остаток — позже», пустые одной строкой', () => {
  const v = view(NOW);
  assert.deepEqual(v.outside, [{ name: 'салон', value: '100', ops: { outside: 'салон' } }]);
  assert.deepEqual(v.outsideAll, { outside: '*' });                 // решение 25: строка «Вне лимитов» нажимается
  assert.deepEqual(v.balances[0], { name: 'Нал Алексея', value: '150 000 RSD · 1 000 €', later: false });
  assert.deepEqual(v.balances[1], { name: 'Freedom', value: 'остаток — позже', later: true });
  assert.equal(v.empty, 'Пустые счета: другая карта, Walt.');
  assert.equal(v.balTitle, 'Остатки');
  assert.equal(v.fresh, 'последняя запись 11.11 в 08:11 · обновлено в 11:13');
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
  assert.deepEqual(v.scale, ['250 % нормы', '', 'норма 200 000']);
  assert.deepEqual(v.stats, [
    { label: 'Сверх нормы', value: '300 000', tone: 'bad' },
    { label: 'Вне лимитов', value: '8 000', tone: '' },
    { label: 'Сверх дохода', value: '240 000', tone: 'bad' },
  ]);
  assert.deepEqual(v.curve.note, { text: 'итог 500 000 · норма кончилась 2 октября', tone: 'bad' });
  assert.equal(v.plan, 1);
  assert.equal(v.balTitle, 'Остатки на 31.10');
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

test('резерв: под лимитами — из чего он (свои + перевалы других) и чей перерасход покрыт', () => {
  assert.equal(view(NOW).reserve, 'Резерв: свои 0 + перевалы других 2 000 — перерасход «питомцы» покрыт резервом.');
  const short = { ...NOW, limits: [...NOW.limits.slice(0, 3), { name: 'резерв', spent: 3000, limit: 3000, over: 0, eaten: 3000 },
    { name: 'одежда', spent: 15000, limit: 12000, over: 3000 }] };
  assert.equal(view(short).reserve,
    'Резерв: свои 0 + перевалы других 3 000 — перерасход «питомцы», «одежда» покрыт резервом частично.');
  const calm = { ...NOW, limits: NOW.limits.filter((l) => !l.eaten && !l.over) };
  assert.equal(view(calm).reserve, '');
});
