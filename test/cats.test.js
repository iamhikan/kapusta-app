// Вид «Категорий» из ответов /api/categories и /api/series. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barsView, catsView, colorOf, OTHER } from '../js/cats.js';
import { words } from '../js/api.js';

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

// правка 2 (ui-ux-pro-max, 13.11.2026): кольцо из 8 долей без подписей — полосой долей с подписями (no-pie-overuse)
test('правка 2: вместо кольца — полоса долей: 5 самых больших и «ещё N», у каждой — процент', () => {
  const v = catsView(BODY);
  assert.deepEqual(v.strip.map((s) => [s.name, s.pct]), [['продукты', '30 %'], ['рестораны', '15 %'],
    ['путешествия', '12 %'], ['питомцы', '10 %'], ['здоровье', '9 %'], ['ещё 4', '24 %']]);
  assert.deepEqual([v.strip[0].color, v.strip[5].color], [colorOf('Expenses:Family:Food'), OTHER]);
  assert.equal(v.strip.reduce((s, x) => s + x.share, 0).toFixed(6), '1.000000');
  assert.equal(v.total, sp('10 000'));
  assert.match(v.aria, /продукты 3\s000.*прочее 2\s400/);
  assert.equal(v.segments, undefined);
});

test('правка 2: категорий шесть и меньше — все по именам, без «ещё»; минусовые — только в списке', () => {
  const six = catsView({ ...BODY, cats: BODY.cats.slice(0, 6) });
  assert.deepEqual(six.strip.map((s) => s.name), ['продукты', 'рестораны', 'путешествия', 'питомцы', 'здоровье', 'подарки']);
  const back = catsView({ ...BODY, cats: [...BODY.cats.slice(0, 2), cat('Expenses:Family:Gifts', 'подарки', -300)] });
  assert.deepEqual(back.strip.map((s) => s.name), ['продукты', 'рестораны']);
});

test('список: сумма, доля, лимит периода и изменение к прошлому периоду на те же дни', () => {
  const v = catsView(BODY);
  assert.equal(v.rows.length, 9);                                // список — все категории, кольцо — 7 и «прочее»
  const [food, rest, travel, pets] = v.rows;
  assert.deepEqual([food.name, food.sum, food.share, food.delta, food.deltaTone],
    ['продукты', sp('3 000'), '30 %', '+500', 'warn']);
  assert.equal(food.limit, sp('лимит 9 000'));
  assert.equal(rest.limit, sp('в лимите «еда вне дома»: 2 000 из 5 000'));   // общий лимит — подписью (Алексей 12.11)
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
  assert.equal(v.note, 'в лимитах, тыс. RSD');                    // правка 6: «норма N» — подписью у черты
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

test('категория из общего лимита — «в лимите «…»: N из M» под именем, и у лимита с тем же именем (R-27)', () => {
  const v = catsView({ ...BODY, cats: [
    cat('Expenses:Family:Household', 'хозяйство', 700, { limit: { name: 'дом и хозяйство', own: false, limit: 5000, spent: 900 } }),
    cat('Expenses:Family:Transport', 'транспорт', 600, { limit: { name: 'транспорт', own: false, limit: 2000, spent: 650 } }),
    cat('Expenses:Family:Food', 'продукты', 500, { limit: { name: 'продукты', own: true, limit: 9000, spent: 500 } }),
  ] });
  // R-27 (ревью 26.11): «транспорт» вместе с машиной — общий лимит, хоть имя и то же: его число — не число категории
  assert.deepEqual(v.rows.map((r) => r.limit), [sp('в лимите «дом и хозяйство»: 900 из 5 000'),
    sp('в лимите «транспорт»: 650 из 2 000'), sp('лимит 9 000')]);
});

test('«В лимитах» вместо «Шкала градусника» (решение 51): подпись столбцов по месяцам', () => {
  const pts = [{ from: '2026-10-01', rsd: 100000, norm: 200000 }, { from: '2026-11-01', rsd: 50000, norm: 200000, partial: true }];
  assert.equal(barsView({ scope: 'scale', points: pts }).note, 'в лимитах, тыс. RSD');   // правка 6: черта подписана сама
  assert.equal(barsView({ scope: 'all', points: pts }).note, 'все траты, тыс. RSD');
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

test('правка 2, R-27: полоска к лимиту и «из N» — только у лимита одной категории; общий — без полоски', () => {
  const v = catsView({ ...BODY, cats: [
    cat('Expenses:Family:Food', 'продукты', 3000, { limit: { name: 'продукты', own: true, limit: 9000, spent: 3000 } }),
    cat('Expenses:Family:Transport', 'транспорт', 6000, { limit: { name: 'транспорт', own: false, limit: 2000, spent: 6000 } }),
    cat('Expenses:Family:Restaurants', 'рестораны', 1500, { limit: { name: 'еда вне дома', own: false, limit: 5000, spent: 2000 } }),
    cat('Expenses:Family:Pets', 'питомцы', 1000),
  ] });
  const [food, transport, rest, pets] = v.rows;
  assert.deepEqual(food.bar, { fill: 3000 / 9000, limitAt: null, color: colorOf('Expenses:Family:Food') });
  assert.equal(food.of, sp('из 9 000'));
  assert.deepEqual([transport.bar, transport.of], [null, '']);       // R-27: лимит «транспорт» — и машина, полоска не её
  assert.deepEqual([rest.bar, rest.of], [null, '']);
  assert.deepEqual([pets.bar, pets.limit], [null, '']);
  const sub = catsView({ ...BODY, cat: 'Expenses:Family:Food', name: 'продукты', limit: null });
  assert.ok(sub.rows.every((r) => r.bar === null));                  // в подкатегориях лимита нет
});

// правка 6 (ui-ux-pro-max, 13.11.2026): подписи 10 px, черта нормы без числа, «текущий месяц светлее» — сноской
test('правка 6: «норма N» — подписью справа у черты последнего месяца, столбцы — левее; у текущего месяца — «по 13.11»', () => {
  const pts = [{ from: '2026-09-01', to: '2026-09-30', rsd: 150000, partial: false, norm: 200000 },
    { from: '2026-10-01', to: '2026-10-31', rsd: 250000, partial: false, norm: 200000 },
    { from: '2026-11-01', to: '2026-11-30', rsd: 40000, partial: true, norm: 210000 }];
  const v = barsView({ scope: 'scale', points: pts }, '2026-11-13');
  assert.deepEqual(v.bars.map((b) => b.upto), ['', '', 'по 13.11']);
  assert.deepEqual([v.norm.value, v.norm.y], ['210', v.bars[2].normY]);
  assert.ok(v.bars.every((b) => b.x + b.w + 4 <= v.norm.x), 'подпись не наезжает на столбцы');
  const plain = barsView({ scope: 'all', points: pts.map((p) => ({ ...p, norm: null })) }, '2026-11-13');
  assert.equal(plain.norm, null);
  assert.ok(plain.bars[2].x > v.bars[2].x, 'без нормы — столбцы на всю ширину');
});

test('R-27: «здоровье» 12 351 в общем лимите «здоровье» (с «аптекой») — без штриховки, число лимита словами', () => {
  const v = catsView({ ...BODY, cats: [
    cat('Expenses:Family:Health', 'здоровье', 12351, { limit: { name: 'здоровье', own: false, limit: 14103, spent: 31144 } }),
    cat('Expenses:Family:Pharmacy', 'аптека', 18793, { limit: { name: 'здоровье', own: false, limit: 14103, spent: 31144 } }),
  ] });
  const [health, pharmacy] = v.rows;
  assert.deepEqual([health.bar, health.of, health.limit], [null, '', sp('в лимите «здоровье»: 31 144 из 14 103')]);
  assert.equal(pharmacy.limit, health.limit);
});

// R-31 п. 3 (ревью 26.11, решение 98, ответ 8): в подкатегориях «Продуктов» строка самих продуктов (`exact`) — «прочие
// продукты»: рядом с «супермаркетами» просто «продукты» читалось как вся категория. Сервер и чат говорят по-старому
// (решения 52, 58: `names.py` не трогаем); на «Категориях» и в строках «Операций» категория — «продукты», как была
test('R-31: в «Продуктах» подкатегория самих продуктов — «прочие продукты» в списке, полосе, для диктора и в самых дорогих', () => {
  const sub = { ...BODY, cat: 'Expenses:Family:Food', name: 'продукты', total: 3000, limit: null,
    cats: [{ key: 'Expenses:Family:Food:Supermarket', name: 'супермаркеты', rsd: 2000, share: 0.667, exact: false, prev: 1000 },
      { key: 'Expenses:Family:Food', name: 'продукты', rsd: 1000, share: 0.333, exact: true, prev: 1500 }],
    top: [{ ref: 'sms:1', date: '2026-11-03', where: 'Lidl', cats: ['супермаркеты', 'продукты'], src: 'карта', rsd: 1200 }] };
  const v = catsView(sub);
  assert.deepEqual(v.rows.map((r) => r.name), ['супермаркеты', 'прочие продукты']);
  assert.deepEqual(v.strip.map((s) => s.name), ['супермаркеты', 'прочие продукты']);
  assert.match(v.aria, /прочие продукты 1/);
  assert.equal(v.top[0].sub, '3 ноября, вт · супермаркеты, прочие продукты');
  assert.equal(v.head.title, 'Продукты', 'шапка — сама категория');
  assert.equal(catsView(BODY).rows[0].name, 'продукты', 'на «Категориях» — «продукты»');
});

// Алексей 26.11 на вопрос S5 («строка самой категории есть ещё у 11 категорий»): «Да, у всех 11». Имя — как сервер
// его шлёт (`where` fin), после слов приложения (`words`: «учёба» — «образование»); род и число — как у категории
const REST_11 = [
  ['Expenses:Family:Health', 'здоровье', 'Expenses:Family:Health:Doctors', 'врачи и анализы', 'прочее здоровье'],
  ['Expenses:Family:Subscriptions', 'подписки', 'Expenses:Family:Subscriptions:AI', 'ИИ и разработка', 'прочие подписки'],
  ['Expenses:Family:Entertainment', 'развлечения', 'Expenses:Family:Entertainment:Cinema', 'кино', 'прочие развлечения'],
  ['Expenses:Family:Travel', 'путешествия', 'Expenses:Family:Travel:Flights', 'авиабилеты', 'прочие путешествия'],
  ['Expenses:Family:Household', 'хозяйство', 'Expenses:Family:Household:Hygiene', 'гигиена', 'прочее хозяйство'],
  ['Expenses:Family:Restaurants', 'рестораны', 'Expenses:Family:Restaurants:Alcohol', 'алкоголь в ресторанах',
    'прочие рестораны'],
  ['Expenses:Family:Delivery', 'доставка', 'Expenses:Family:Delivery:Alcohol', 'алкоголь с доставкой', 'прочая доставка'],
  ['Expenses:Family:Education', 'учёба', 'Expenses:Family:Education:English', 'английский', 'прочее образование'],
  ['Expenses:Family:Transport', 'транспорт', 'Expenses:Family:Transport:Taxi', 'такси', 'прочий транспорт'],
  ['Expenses:Family:Clothes', 'одежда', 'Expenses:Family:Clothes:Sport', 'спортивная одежда', 'прочая одежда'],
  ['Expenses:Family:Outings', 'выходы', 'Expenses:Family:Outings:Alcohol', 'алкоголь на выходах', 'прочие выходы'],
];

for (const [key, name, subKey, subName, rest] of REST_11) {
  test(`R-31 п. 3, все 11: в «${name}» строка самой категории — «${rest}» в списке, полосе, для диктора и в самых дорогих`, () => {
    const sub = words({ ...BODY, cat: key, name, total: 3000, limit: null,
      cats: [{ key: subKey, name: subName, rsd: 2000, share: 0.667, exact: false, prev: 1000 },
        { key, name, rsd: 1000, share: 0.333, exact: true, prev: 1500 }],
      top: [{ ref: 'sms:1', date: '2026-11-03', where: 'Место', cats: [subName, name], src: 'карта', rsd: 1200 }] });
    const v = catsView(sub);
    assert.deepEqual(v.rows.map((r) => r.name), [subName, rest]);
    assert.deepEqual(v.strip.map((s) => s.name), [subName, rest]);
    assert.match(v.aria, new RegExp(`${rest} 1`));
    assert.equal(v.top[0].sub, `3 ноября, вт · ${subName}, ${rest}`);
    assert.equal(v.head.title, words(name).charAt(0).toUpperCase() + words(name).slice(1), 'шапка — сама категория');
    assert.equal(v.rows[1].exact, true, 'строка открывает только саму категорию: exact=1');
  });
}

// Стенд S8 (данные 26.11): у «Ресторанов», «Доставки», «Выходов» за весь 2026 год, у «Путешествий» за ноябрь строка
// самой категории — единственная. «прочие рестораны» без других строк говорили бы о «других», которых нет: одна строка —
// это вся категория, имя — её имя. «Прочие …» — только рядом с другими подкатегориями
test('R-31 п. 3: строка самой категории без других подкатегорий — имя категории, не «прочие …»', () => {
  const alone = words({ ...BODY, cat: 'Expenses:Family:Restaurants', name: 'рестораны', total: 7906, limit: null,
    cats: [{ key: 'Expenses:Family:Restaurants', name: 'рестораны', rsd: 7906, share: 1, exact: true, prev: 5000 }],
    top: [{ ref: 'sms:1', date: '2026-11-03', where: 'Лала', cats: ['рестораны'], src: 'карта', rsd: 1200 }] });
  const v = catsView(alone);
  assert.deepEqual(v.rows.map((r) => r.name), ['рестораны']);
  assert.deepEqual(v.strip.map((s) => s.name), ['рестораны']);
  assert.equal(v.top[0].sub, '3 ноября, вт · рестораны');
  assert.equal(v.rows[0].exact, true, 'открывает те же операции: exact=1');
});

test('R-31 п. 3: на «Категориях» имена 11 категорий — как были, «прочие …» — только среди подкатегорий', () => {
  const top = words({ ...BODY, cats: REST_11.map(([key, name]) => cat(key, name, 100)) });
  assert.deepEqual(catsView(top).rows.map((r) => r.name), REST_11.map(([, name]) => words(name)));
});
