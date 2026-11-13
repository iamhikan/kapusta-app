// Снимок «Здоровья» в Telegram CloudStorage (этап 5, решения 6, 31, 32): Мак молчит — страница показывает последний
// ответ /api/health этого человека с пометкой «данные на …». Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { key, offline, pack, pickKey, restore, save, snapView, unpack, LIMIT } from '../js/snapshot.js';

const NOW = {
  month: '2026-11', date: '2026-11-11', day: 11, days: 30, closed: false,
  zone: { status: 'ok', word: 'в норме' }, norm: 200000, spent: 80000, left: 120000, plan_today: 73333, per_day: 6000,
  regular: 0, oneoff: 0,
  limits: [{ name: 'питомцы', spent: 6000, limit: 4000, over: 2000 }],
  balances: [{ account: 'Assets:Family:Cash:Aleksey', name: 'нал Алексея', amounts: { RSD: 150000 } }],
  empty: ['другая карта', 'Walt'],
  curve: [[1, 2000], [2, 20000], [11, 80000]],
  forecast: 218182,
  fresh: { last: '2026-11-11 08:11', now: '2026-11-11T23:40:12' },
};

// CloudStorage Telegram: методы с колбэком (err, value); значение — строка до 4096 знаков
function cloud(init = {}) {
  const items = { ...init };
  return {
    items,
    setItem(k, v, cb) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(k) || v.length > 4096) return cb(new Error('bad'), false);
      items[k] = v; cb(null, true);
    },
    getItem(k, cb) { cb(null, items[k] ?? ''); },
    getKeys(cb) { cb(null, Object.keys(items)); },
  };
}

test('ключ — на месяц, из разрешённых Telegram знаков', () => {
  assert.equal(key('2026-11'), 'health_2026-11');
  assert.match(key('2026-11'), /^[A-Za-z0-9_-]{1,128}$/);
  assert.equal(LIMIT, 4096);
});

test('ответ до 4096 знаков ложится целиком и читается обратно', () => {
  const raw = pack(NOW);
  assert.ok(raw.length <= LIMIT);
  assert.deepEqual(unpack(raw), NOW);
});

test('больше 4096 — сначала каждая вторая точка кривой (последняя остаётся), потом кривая, потом пустые счета', () => {
  const curve = Array.from({ length: 31 }, (_, i) => [i + 1, (i + 1) * 1000]);
  const big = { ...NOW, curve };
  const size = pack(big).length;

  const half = unpack(pack(big, size - 1));
  assert.equal(half.curve.length, 16);
  assert.deepEqual(half.curve.at(-1), [31, 31000]);
  assert.deepEqual(half.curve[0], [1, 1000]);
  assert.deepEqual(half.empty, NOW.empty);

  const noCurve = unpack(pack(big, pack({ ...big, curve: half.curve }).length - 1));
  assert.deepEqual(noCurve.curve, []);
  assert.deepEqual(noCurve.empty, NOW.empty);

  const bare = unpack(pack(big, pack({ ...big, curve: [] }).length - 1));
  assert.deepEqual(bare.empty, []);
  assert.deepEqual(bare.limits, NOW.limits);          // лимиты и остатки — всегда целиком
  assert.deepEqual(bare.balances, NOW.balances);

  assert.equal(pack(big, 100), null);                  // и так не влезло — снимка нет, остаётся прошлый
});

test('испорченный или чужой снимок не читается', () => {
  assert.equal(unpack(''), null);
  assert.equal(unpack('{не json'), null);
  assert.equal(unpack('{"month":"2026-11"}'), null);
});

test('показываем снимок своего месяца, иначе — самый поздний', () => {
  assert.equal(pickKey(['health_2026-10', 'health_2026-11', 'x'], '2026-11'), 'health_2026-11');
  assert.equal(pickKey(['health_2026-09', 'health_2026-10', 'queue_1'], '2026-11'), 'health_2026-10');
  assert.equal(pickKey(['queue_1'], '2026-11'), null);
  assert.equal(pickKey([], null), null);
});

test('save кладёт снимок под ключом месяца; restore достаёт его', async () => {
  const cs = cloud();
  assert.equal(await save(cs, NOW), true);
  assert.deepEqual(Object.keys(cs.items), ['health_2026-11']);
  assert.deepEqual(await restore(cs, '2026-11'), NOW);
  assert.deepEqual(await restore(cs, '2026-12'), NOW);  // своего нет — последний
});

test('нет CloudStorage (старый клиент) или он падает — без снимка, без ошибки', async () => {
  assert.equal(await save(undefined, NOW), false);
  assert.equal(await restore(undefined, '2026-11'), null);
  const broken = { setItem() { throw new Error('not supported'); }, getKeys() { throw new Error('not supported'); } };
  assert.equal(await save(broken, NOW), false);
  assert.equal(await restore(broken, '2026-11'), null);
  assert.equal(await restore(cloud(), '2026-11'), null);
});

test('пометка снимка — время ответа сервера (холст 6.1)', () => {
  const v = snapView(NOW);
  assert.equal(v.banner, 'Капуста не отвечает.');
  assert.equal(v.when, 'Данные на 11.11 в 23:40.');
  assert.equal(v.fresh, 'снимок из Telegram от 11.11 в 23:40 · операций и категорий в снимке нет');
});

test('«Операции» и «Категории» без Мака — «Повторить» и ссылка на снимок, если он есть (холст 6.2)', () => {
  const ops = offline('ops', true);
  assert.equal(ops.title, 'Капуста не отвечает');
  assert.equal(ops.text, 'Операции приходят с Мака. Мак спит или Капуста перезапускается. Снимок есть только у «Здоровья».');
  assert.equal(ops.link, 'Открыть снимок «Здоровья»');
  assert.equal(offline('cats', true).text.startsWith('Категории приходят с Мака.'), true);
  const none = offline('ops', false);
  assert.equal(none.text, 'Операции приходят с Мака. Мак спит или Капуста перезапускается.');
  assert.equal(none.link, null);
});

test('без Мака — «… приходит / приходят с Мака» в согласии с именем экрана (было: «Бюджет приходят с Мака»)', () => {
  const said = (kind) => offline(kind, false).text.split('.')[0];
  assert.equal(said('budget'), 'Бюджет приходит с Мака');
  assert.equal(said('ops'), 'Операции приходят с Мака');
  assert.equal(said('cats'), 'Категории приходят с Мака');
  assert.equal(said('price'), 'Цены приходят с Мака');
  assert.equal(said('basket'), 'Покупки приходят с Мака');
  assert.equal(said('days'), 'Траты по дням приходят с Мака');
});
