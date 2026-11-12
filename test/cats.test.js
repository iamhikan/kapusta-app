// Вид «Категорий» из ответов /api/categories и /api/series. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barsView, catsView, colorOf, OTHER } from '../js/cats.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1\u00a0$2');   // разделитель тысяч — неразрывный пробел

const cat = (key, name, rsd, extra = {}) => ({ key, name, rsd, share: rsd / 10000, limit: null, prev: 0, ...extra });
const BODY = {
  from: '2026-11-01', to: '2026-11-30', end: '2026-11-11', scope: 'all', cat: null, total: 10000,
  prev: { from: '2026-10-01', to: '2026-10-11', total: 12500 },
  cats: [
    cat('Expenses:Family:Food', 'продукты', 3000, { prev: 2500, limit: { name: 'продукты', own: true, limit: 9000, spent: 3000 } }),
    cat('Expenses:Family:Restaurants', 'рестораны', 1500, { prev: 1500,
      limit: { name: 'еда вне дома', own: false, limit: 5000, spent: 2000 } }),
    cat('Expenses:Family:Travel', 'путешествия', 1200, { prev: 6000 }),
    cat('Expenses:Family:Pets', 'питомцы', 1000),
    cat('Expenses:Family:Health', 'здоровье', 900),
    cat('Expenses:Family:Gifts', 'подарки', 800),
    cat('Expenses:Family:Household', 'хозяйство', 700),
    cat('Expenses:Family:Beauty', 'красота', 500),
    cat('Expenses:Angelina:PR', 'салон', 400),
  ],
};

test('цвет закреплён за категорией: один и тот же на любом экране, у незнакомой — постоянный из палитры', () => {
  assert.equal(colorOf('Expenses:Family:Food'), colorOf('Expenses:Family:Food'));
  assert.notEqual(colorOf('Expenses:Family:Food'), colorOf('Expenses:Family:Travel'));
  assert.equal(colorOf('Expenses:Family:Нечто'), colorOf('Expenses:Family:Нечто'));
  assert.match(colorOf('Expenses:Family:Нечто'), /^#[0-9a-f]{6}$/);
});

test('кольцо: 7 самых больших и «прочее» — остальные вместе', () => {
  const v = catsView(BODY);
  assert.equal(v.segments.length, 8);
  assert.deepEqual(v.segments.slice(0, 2).map((s) => s.color), [colorOf('Expenses:Family:Food'),
    colorOf('Expenses:Family:Restaurants')]);
  assert.equal(v.segments[7].color, OTHER);
  assert.equal(v.total, sp('10 000'));
  assert.match(v.aria, /продукты 3\s000.*прочее 900/);
});

test('список: сумма, доля, лимит периода и изменение к прошлому периоду на те же дни', () => {
  const v = catsView(BODY);
  assert.equal(v.rows.length, 9);                                // список — все категории, кольцо — 7 и «прочее»
  const [food, rest, travel, pets] = v.rows;
  assert.deepEqual([food.name, food.sum, food.share, food.delta, food.deltaTone],
    ['продукты', sp('3 000'), '30 %', '+500', 'warn']);
  assert.equal(food.limit, sp('лимит 9 000'));
  assert.equal(rest.limit, 'лимит «еда вне дома»');               // общий лимит — подписью (Алексей 12.11)
  assert.deepEqual([rest.delta, rest.deltaTone], ['0', '']);
  assert.deepEqual([travel.delta, travel.deltaTone], [sp('−4 800'), 'good']);
  assert.equal(pets.limit, '');
  assert.equal(v.rows[8].color, colorOf('Expenses:Angelina:PR'));
  assert.deepEqual(v.cmp, { label: 'к 1–11 октября', value: sp('−2 500'), tone: 'good', sub: sp('было 12 500') });
  assert.equal(v.cmpHead, 'к 1–11.10');
});

test('без сравнения — без колонки изменений', () => {
  const v = catsView({ ...BODY, prev: undefined, cats: BODY.cats.map(({ prev, ...c }) => c) });
  assert.equal(v.cmp, null);
  assert.equal(v.rows[0].delta, '');
  assert.equal(v.cmpHead, '');
  // решение 76: прошлый период до начала учёта — сравнения нет, пустая колонка «к …» не занимает место
  assert.equal(v.rowClass, 'cat-row no-cmp');
  assert.equal(catsView(BODY).rowClass, 'cat-row');
});

test('подкатегории: оттенки цвета категории, лимит категории сверху, самые дорогие', () => {
  const sub = { ...BODY, cat: 'Expenses:Family:Food', name: 'продукты', total: 3000,
    limit: { name: 'продукты', own: true, limit: 9000, spent: 3000 },
    cats: [{ key: 'Expenses:Family:Food:Supermarket', name: 'супермаркеты', rsd: 2000, share: 0.667, exact: false, prev: 1000 },
      { key: 'Expenses:Family:Food', name: 'продукты', rsd: 1000, share: 0.333, exact: true, prev: 1500 }],
    top: [{ ref: 'sms:1', date: '2026-11-03', where: 'Lidl', cats: ['супермаркеты'], src: 'карта', rsd: 1200.5, total: 1500.5 }] };
  const v = catsView(sub);
  assert.equal(v.head.title, 'Продукты');
  assert.deepEqual([v.head.sum, v.head.note, v.head.fill, v.head.tone], [sp('3 000'), sp('из лимита 9 000'), 1 / 3, '']);
  assert.match(v.rows[0].color, /color-mix/);
  assert.notEqual(v.rows[0].color, v.rows[1].color);
  assert.equal(v.rows[1].exact, true);
  assert.deepEqual(v.top[0], { ref: 'sms:1', where: 'Lidl', sub: '3 ноября, вт · супермаркеты', amount: sp('1 200,50') });
  const shared = catsView({ ...sub, limit: { name: 'еда вне дома', own: false, limit: 5000, spent: 6000 } });
  assert.deepEqual([shared.head.note, shared.head.tone, shared.head.fill],
    [sp('лимит «еда вне дома»: 6 000 из 5 000'), 'bad', 1]);
  assert.equal(catsView({ ...sub, limit: null }).head.note, '');
});

test('столбцы по месяцам: подписи в тысячах, текущий месяц светлее, черта нормы', () => {
  const v = barsView({ by: 'month', scope: 'scale', points: [
    { from: '2026-09-01', to: '2026-09-30', rsd: 150000, partial: false, norm: 200000 },
    { from: '2026-10-01', to: '2026-10-31', rsd: 250000, partial: false, norm: 200000 },
    { from: '2026-11-01', to: '2026-11-30', rsd: 40000, partial: true, norm: 210000 }] });
  assert.deepEqual(v.bars.map((b) => [b.m, b.v, b.partial]), [['сен', '150', false], ['окт', '250', false], ['ноя', '40', true]]);
  assert.ok(v.bars[1].h > v.bars[0].h && v.bars[0].h > v.bars[2].h);
  assert.equal(v.bars[0].normY != null, true);
  assert.ok(v.bars[0].normY < v.bars[0].y);                      // норма 200 выше столбца 150
  assert.match(v.aria, /сентябрь 150, октябрь 250, ноябрь 40 на сегодня/);
  assert.equal(v.note, 'в лимитах, тыс. RSD · черта — норма');
  const all = barsView({ by: 'month', scope: 'all', points: [{ from: '2026-11-01', to: '2026-11-30', rsd: 0, partial: true, norm: null }] });
  assert.equal(all.bars[0].normY, null);
  assert.equal(all.note, 'все траты, тыс. RSD');
});

// расстояние цветов в OKLab: меньше ~0,07 глаз путает соседние сегменты кольца
function oklab(hex) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dist = (a, b) => Math.hypot(...oklab(a).map((x, i) => x - oklab(b)[i]));

test('транспорт и хозяйство — не один бирюзовый (ревью): их цвета глаз различает', () => {
  assert.ok(dist(colorOf('Expenses:Family:Transport'), colorOf('Expenses:Family:Household')) > 0.08);
});

test('категория из общего лимита — «лимит «…»» под именем; лимит с тем же именем — «лимит N» (Алексей 12.11)', () => {
  const v = catsView({ ...BODY, cats: [
    cat('Expenses:Family:Household', 'хозяйство', 700, { limit: { name: 'дом и хозяйство', own: false, limit: 5000, spent: 900 } }),
    cat('Expenses:Family:Transport', 'транспорт', 600, { limit: { name: 'транспорт', own: false, limit: 2000, spent: 650 } }),
    cat('Expenses:Family:Food', 'продукты', 500, { limit: { name: 'продукты', own: true, limit: 9000, spent: 500 } }),
  ] });
  assert.deepEqual(v.rows.map((r) => r.limit), ['лимит «дом и хозяйство»', 'лимит 2 000', 'лимит 9 000']);
});

test('«В лимитах» вместо «Шкала градусника» (решение 51): подпись столбцов по месяцам', () => {
  const pts = [{ from: '2026-10-01', rsd: 100000, norm: 200000 }, { from: '2026-11-01', rsd: 50000, norm: 200000, partial: true }];
  assert.equal(barsView({ scope: 'scale', points: pts }).note, 'в лимитах, тыс. RSD · черта — норма');
  assert.equal(barsView({ scope: 'all', points: pts }).note, 'все траты, тыс. RSD · черта — норма');
});

test('прошлый период в столбце и в карточке: месяц у обоих концов, у года — «к 2025» и год в карточке (долг 12.11)', () => {
  const cmp = (from, to, prev) => { const v = catsView({ ...BODY, from, to, prev: { ...prev, total: 12500 } }); return [v.cmpHead, v.cmp.label]; };
  assert.deepEqual(cmp('2026-11-01', '2026-11-30', { from: '2026-10-01', to: '2026-10-11' }), ['к 1–11.10', 'к 1–11 октября']);
  assert.deepEqual(cmp('2026-10-01', '2026-12-31', { from: '2026-07-01', to: '2026-08-12' }),
    ['к 1.07–12.08', 'к 1 июля — 12 августа']);
  assert.deepEqual(cmp('2026-01-01', '2026-12-31', { from: '2025-01-01', to: '2025-11-12' }),
    ['к 2025', 'к 1 января — 12 ноября 2025']);
  assert.deepEqual(cmp('2026-11-02', '2026-11-08', { from: '2026-10-26', to: '2026-11-01' }),
    ['к 26.10–1.11', 'к 26 октября — 1 ноября']);
  assert.deepEqual(cmp('2026-01-01', '2026-01-31', { from: '2025-12-01', to: '2025-12-11' }),
    ['к 1–11.12', 'к 1–11 декабря 2025']);
  assert.deepEqual(cmp('2026-11-12', '2026-11-12', { from: '2026-11-11', to: '2026-11-11' }), ['к 11.11', 'к 11 ноября']);
});
