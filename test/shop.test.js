// Покупки (этап 7, решение 37): «История цены» из /api/price и «По товарам» из /api/basket. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basketView, itemPrice, pricePath, priceView } from '../js/shop.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1\u00a0$2');

const PRICE = {
  name: 'Mleko 2,8% 1L', store: 'Lidl', unit: 'шт', product: 'P1:7', kind: 'молоко', count: 3, change: '+25 %',
  history: [{ day: '2026-02-01', store: 'Lidl', price: 100, receipt: 'A' },
    { day: '2026-06-01', store: 'Lidl', price: 110, receipt: 'B' },
    { day: '2026-11-01', store: 'Lidl', price: 125, receipt: 'C' }],
  stores: [{ store: 'Lidl', name: 'Mleko 2,8% 1L', price: 125, per: 'л', per_price: 125, day: '2026-11-01', product: 'P1:7', mine: true },
    { store: 'Maxi', name: 'MLEKO 0,5L', price: 70.5, per: 'л', per_price: 141, day: '2025-03-09', product: 'P2:9', mine: false },
    { store: 'Idea', name: 'MLEKO DUGOTRAJNO', price: 99.99, per: null, per_price: null, day: '2026-10-20', product: 'P3:1', mine: false }],
  cheapest: { store: 'Lidl', per_price: 125, per: 'л' },
};

test('история цены: последняя цена крупно, где и когда, рост с первой покупки; график по датам', () => {
  const v = priceView(PRICE, '2026-11-11');
  assert.equal(v.title, 'Mleko 2,8% 1L');
  assert.equal(v.sub, 'вид «молоко» · 3 чека в Lidl');
  assert.deepEqual(v.big, { value: '125', unit: '', meta: 'Lidl, 01.11 · с первой покупки +25 %', tone: 'warn' });
  const c = v.chart;
  assert.equal(c.points.length, 3);
  assert.ok(c.points[0].x < c.points[1].x && c.points[1].x < c.points[2].x);           // время — слева направо
  assert.ok(c.points[0].y > c.points[2].y);                                             // дороже — выше
  assert.ok(c.points[1].x - c.points[0].x < c.points[2].x - c.points[1].x);              // 4 месяца короче 5
  assert.equal(c.from, '02.2026');
  assert.equal(c.to, '11.2026');
  assert.match(c.aria, /100 — 01\.02\.2026.*125 — 01\.11\.2026/);
});

test('товары того же вида: дешевле за кг/л — выше, свой отмечен, чужой открывает свою историю', () => {
  const v = priceView(PRICE, '2026-11-11');
  assert.deepEqual(v.stores.map((s) => [s.store, s.price, s.per, s.mine, s.open]), [
    ['Lidl', '125', '125 за л', true, null],
    ['Maxi', '70,50', '141 за л', false, { product: 'P2:9' }],
    ['Idea', sp('99,99'), '', false, { product: 'P3:1' }]]);
  assert.deepEqual(v.stores.map((s) => s.sub), ['Mleko 2,8% 1L · 01.11', 'MLEKO 0,5L · 09.03.2025', 'MLEKO DUGOTRAJNO · 20.10']);
  assert.equal(v.cheapest, 'Дешевле всего за л: Lidl — 125.');   // critique 12.11: следом идёт «Цена за кг или л …»
  assert.equal(v.storesTitle, 'По магазинам');
});

test('товар без вида и одна покупка; весовой — «за кг»; цена упала — зелёным', () => {
  const one = priceView({ ...PRICE, kind: null, stores: [], cheapest: null, count: 1, change: null,
    history: [PRICE.history[0]] }, '2026-11-11');
  assert.equal(one.sub, '1 чек в Lidl');
  assert.equal(one.big.meta, 'Lidl, 01.02');
  assert.equal(one.chart.points.length, 1);
  assert.equal(one.stores.length, 0);
  assert.equal(one.cheapest, '');
  const kg = priceView({ ...PRICE, unit: 'кг', change: '−9 %' }, '2026-11-11');
  assert.equal(kg.big.unit, 'за кг');
  assert.equal(kg.big.tone, 'good');
});

test('вид без товара (строка вида в корзине): только сравнение по магазинам', () => {
  const v = priceView({ ...PRICE, name: 'молоко', store: null, unit: null, product: null, history: null, count: null,
    change: null, stores: PRICE.stores.map((s) => ({ ...s, mine: false })) }, '2026-11-11');
  assert.equal(v.title, 'Молоко');
  assert.equal(v.sub, 'товаров: 3, магазинов: 3');
  assert.equal(v.big, null);
  assert.equal(v.chart, null);
  assert.equal(v.stores[0].open.product, 'P1:7');
  // тот же список, что у товара, — то же имя (critique 12.11: «Магазины» и «Тот же вид в других сетях»)
  assert.equal(v.storesTitle, 'По магазинам');
});

test('адрес истории цены: позиция чека (строка с 1), товар или вид', () => {
  assert.equal(pricePath({ receipt: 'AB-1', line: 2 }), '/api/price?receipt=AB-1&line=2');
  assert.deepEqual(itemPrice({ receipt: { number: 'AB-1', items: [{}, {}] } }, 1), { receipt: 'AB-1', line: 2 });
  assert.equal(pricePath({ product: 'P1:7' }), '/api/price?product=P1%3A7');
  assert.equal(new URLSearchParams(pricePath({ kind: 'сыр твёрдый' }).split('?')[1]).get('kind'), 'сыр твёрдый');
});

const BASKET = {
  month: '2026-11', receipts: 21, total: 31000,
  cats: [['супермаркеты', 40], ['аптека', 20], ['доставка', 10], ['снеки', 10], ['алкоголь', 8], ['напитки', 7], ['хлеб', 5]]
    .map(([name, share]) => ({ name, share, account: `Expenses:Family:${name}` })),
  top: [{ name: 'Fibre Cat 2kg', rsd: 4500, unit: 'шт', qty: 1, kind: null, product: 'P:1' },
    { name: 'пиво', rsd: 1300, unit: 'шт', qty: 15, kind: 'пиво', product: null },
    { name: 'курица', rsd: 1450, unit: 'кг', qty: null, kind: 'курица', product: null },
    { name: 'плескавица', rsd: 900, unit: 'кг', qty: 0.92, kind: 'плескавица', product: null }],
  food: 69,
};

test('по товарам: чеки и сумма, доли категорий (6), что больше всего — тап по товару или виду', () => {
  const v = basketView(BASKET);
  assert.equal(v.title, 'По товарам');
  assert.equal(v.sub, sp('Ноябрь 2026 · продукты по 21 чеку на 31 000 RSD'));   // решение 57: только продукты
  assert.deepEqual(v.shares, ['супермаркеты 40 %', 'аптека 20 %', 'доставка 10 %', 'снеки 10 %', 'алкоголь 8 %', 'напитки 7 %']);
  assert.deepEqual(v.rows.map((r) => [r.name, r.qty, r.sum, r.open]), [
    ['Fibre Cat 2kg', '1 шт', sp('4 500'), { product: 'P:1' }],
    ['Пиво', '15 шт', sp('1 300'), { kind: 'пиво' }],
    ['Курица', '', sp('1 450'), { kind: 'курица' }],
    ['Плескавица', '0,92 кг', '900', { kind: 'плескавица' }]]);
  assert.equal(v.note, 'По чекам видно 69 % трат на продукты за ноябрь.');
  assert.equal(v.empty, '');
});

test('по товарам: чеков нет — пусто словами; доля продуктов неизвестна — без строки', () => {
  const v = basketView({ month: '2026-09', receipts: 0, total: 0, cats: [], top: [], food: null });
  assert.equal(v.empty, 'За сентябрь чеков с продуктами нет');
  assert.equal(v.note, '');
  assert.equal(basketView({ ...BASKET, receipts: 3, food: null }).sub, sp('Ноябрь 2026 · продукты по 3 чекам на 31 000 RSD'));
});

test('«По товарам» открывается из «Продуктов» и просит у сервера только продукты (решение 57, critique 12.11)', async () => {
  const { loadMore } = await import('../js/more.js');
  const asked = [];
  const nav = { render() {}, get: async (path) => { asked.push(path); return { data: { month: '2026-11' } }; } };
  await loadMore({ kind: 'basket', month: '2026-11' }, nav);
  assert.deepEqual(asked, ['/api/basket?month=2026-11&cat=food']);
});
