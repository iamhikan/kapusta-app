// Смена категории из карточки (этап 6, решения 12, 18, 33–36): вся операция или позиция чека. Страница шлёт прежнюю
// категорию, которую видела, и id нажатия; Мак молчит — смена ждёт в очереди CloudStorage. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { body, category, flush, job, picker, path, queue, result, QUEUE } from '../js/recat.js';

const H = 'Expenses:Family:Household';
const E = 'Expenses:Family:Electronics';
const F = 'Expenses:Family:Food';
const ALC = 'Expenses:Family:Food:Alcohol';
const CHOICES = [['хозяйство', H], ['продукты', F], ['техника', E], ['дом', 'Expenses:Family:Home'],
  ['одежда', 'Expenses:Family:Clothes'], ['подарки', 'Expenses:Family:Gifts'], ['алкоголь', ALC]]
  .map(([name, account]) => ({ name, account }));

const CARD = { ref: 'add:7', where: 'Сушилка', date: '2026-11-05', kind: 'spend', cats: ['хозяйство'], rsd: 4000,
  change: { accounts: [H], choices: CHOICES }, receipt: null };
const RCPT = { ...CARD, ref: 'sms:9', where: 'Маркет', cats: ['продукты', 'алкоголь'],
  change: { accounts: [F, ALC], choices: CHOICES },
  receipt: { items: [{ name: 'SUHARI', total: 120, account: F, cat: 'продукты' },
    { name: 'SENF BELO VINO', total: 150, account: ALC, cat: 'алкоголь' }] } };

test('строка «Категория»: текущие словами и «Сменить»; в очереди — «было → стало»; нельзя — без кнопки', () => {
  assert.deepEqual(category(CARD), { text: 'хозяйство', can: true, queued: false });
  assert.deepEqual(category(RCPT), { text: 'продукты, алкоголь', can: true, queued: false });
  const waiting = job(CARD, E, { id: 'c1', now: '2026-11-11T19:40:00' });
  assert.deepEqual(category(CARD, waiting), { text: 'хозяйство → техника', can: true, queued: true });
  assert.deepEqual(category({ ...CARD, change: null }), { text: 'хозяйство', can: false, queued: false });
});

test('выбор категории: «Часто» — 5 первых, текущая помечена «сейчас»; поиск — по всем; кнопка — после выбора', () => {
  const v = picker(CARD, {});
  assert.equal(v.title, 'Категория для Сушилка');
  assert.deepEqual(v.often.map((c) => c.name), ['хозяйство', 'продукты', 'техника', 'дом', 'одежда']);
  assert.deepEqual(v.often[0], { name: 'хозяйство', account: H, hint: 'сейчас', on: false, current: true });
  assert.equal(v.allLabel, 'Все категории — 7');
  assert.deepEqual(v.button, { label: 'Выберите категорию', disabled: true });
  const chosen = picker(CARD, { chosen: E });
  assert.equal(chosen.often[2].on, true);
  assert.deepEqual(chosen.button, { label: 'Сменить на «техника»', disabled: false });
  assert.equal(picker(CARD, { chosen: H }).button.disabled, true);           // та же, что сейчас
  const found = picker(CARD, { q: 'ПОД' });
  assert.equal(found.often, null);
  assert.deepEqual(found.all.map((c) => c.name), ['подарки']);
});

test('выбор для позиции чека: текущая — её категория, заголовок — название позиции', () => {
  const v = picker(RCPT, { item: 1, chosen: F });
  assert.equal(v.title, 'SENF BELO VINO');
  assert.equal(v.often.find((c) => c.current).name, 'алкоголь');
  assert.deepEqual(v.button, { label: 'Сменить на «продукты»', disabled: false });
});

test('смена: прежние — что видели в карточке; адрес и тело запроса; позиция — свой адрес', () => {
  const j = job(RCPT, H, { id: 'c2', now: '2026-11-11T19:40:00' });
  assert.deepEqual(j, { id: 'c2', ref: 'sms:9', n: null, was: [F, ALC], to: H, from: 'продукты, алкоголь',
    toName: 'хозяйство', what: 'Маркет', at: '2026-11-11T19:40:00' });
  assert.equal(path(j), '/api/tx/sms%3A9/category');
  assert.deepEqual(body(j), { was: [F, ALC], to: H, id: 'c2' });
  const it = job(RCPT, F, { id: 'c3', n: 1, now: '2026-11-11T19:41:00' });
  assert.equal(it.was, ALC);
  assert.equal(it.what, 'SENF BELO VINO');
  assert.equal(path(it), '/api/tx/sms%3A9/items/1/category');
  assert.ok(job(CARD, E).id.length >= 8);                                      // id нажатия — сам, если не дан
});

test('итог словами: сменили, позиция, конфликт, очередь, отказ', () => {
  const j = job(CARD, E, { id: 'c1' });
  assert.deepEqual(result({ data: {} }, j), { kind: 'done', text: 'Сменили на «техника». Капуста написала в чат.' });
  const it = job(RCPT, F, { id: 'c3', n: 1 });
  assert.equal(result({ data: {} }, it).text,
    'SENF BELO VINO → «продукты». Остальной чек не тронут, следующие такие чеки — тоже «продукты». Капуста написала в чат.');
  const names = (a) => ({ [H]: 'хозяйство', 'Expenses:Family:Restaurants': 'рестораны' }[a]);
  assert.deepEqual(result({ error: 'conflict', data: { now: ['Expenses:Family:Restaurants'] } }, j, names), {
    kind: 'conflict', text: 'Запись уже изменили: сейчас «рестораны». Капуста спросила вас в чате, что оставить.' });
  assert.deepEqual(result({ error: 'down' }, j), { kind: 'queued',
    text: 'Капуста не отвечает. Смена в очереди: уйдёт, когда вы откроете приложение и Капуста ответит.' });
  assert.deepEqual(result({ error: 'refused', detail: 'нельзя' }, j), { kind: 'refused', text: 'Не сменили: нельзя.' });
  assert.equal(result({ error: 'stale' }, j).kind, 'stale');
});

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

test('очередь — в CloudStorage под своим ключом (не снимок «Здоровья»); та же запись — последняя смена', async () => {
  assert.equal(QUEUE, 'recat_queue');
  assert.doesNotMatch(QUEUE, /^health_/);
  const cs = cloud();
  assert.deepEqual(await queue.load(cs), []);
  assert.equal(await queue.add(cs, job(CARD, E, { id: 'a' })), true);
  assert.equal(await queue.add(cs, job(CARD, 'Expenses:Family:Home', { id: 'b' })), true);
  assert.equal(await queue.add(cs, job(RCPT, F, { id: 'c', n: 1 })), true);
  assert.deepEqual((await queue.load(cs)).map((x) => x.id), ['b', 'c']);
  await queue.drop(cs, 'b');
  assert.deepEqual((await queue.load(cs)).map((x) => x.id), ['c']);
  assert.deepEqual(await queue.load(null), []);                                  // старый клиент — очереди нет
  assert.equal(await queue.add(null, job(CARD, E)), false);
});

test('очередь не больше 4096 знаков: не влезло — не кладём', async () => {
  const cs = cloud();
  let ok = true;
  for (let i = 0; ok && i < 100; i += 1) ok = await queue.add(cs, job({ ...CARD, ref: `add:${i}` }, E, { id: `x${i}` }));
  assert.equal(ok, false);
  assert.ok(cs.items[QUEUE].length <= 4096);
});

test('при открытии очередь уходит по порядку: сменили, конфликт, отказ — из очереди; Мак молчит — ждёт дальше', async () => {
  const cs = cloud();
  for (const id of ['a', 'b', 'c', 'd']) await queue.add(cs, job({ ...CARD, ref: `add:${id}` }, E, { id }));
  const answers = { a: { data: {} }, b: { error: 'conflict', data: { now: [F] } }, c: { error: 'refused', detail: 'x' },
    d: { error: 'down' } };
  const sent = [];
  const out = await flush(cs, async (j) => { sent.push(j.id); return answers[j.id]; });
  assert.deepEqual(sent, ['a', 'b', 'c', 'd']);
  assert.deepEqual(out, { done: 1, conflicts: 1, left: 1 });
  assert.deepEqual((await queue.load(cs)).map((x) => x.id), ['d']);
  const again = await flush(cs, async () => ({ error: 'down' }));
  assert.deepEqual(again, { done: 0, conflicts: 0, left: 1 });
});
