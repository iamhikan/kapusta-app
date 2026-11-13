// Вход и ошибки: страница без данных; API — только из подписанного Telegram, адрес API — из ссылки кнопки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiBase, get, post, screen, TIMEOUT } from '../js/api.js';

test('адрес API — только https на ts.net из параметра ?api=, иначе нет', () => {
  assert.equal(apiBase('?api=https://mac.tail0.ts.net'), 'https://mac.tail0.ts.net');
  assert.equal(apiBase('?api=https://mac.tail0.ts.net/'), 'https://mac.tail0.ts.net');
  assert.equal(apiBase('?api=https://evil.example'), null);
  assert.equal(apiBase('?api=http://mac.tail0.ts.net'), null);
  assert.equal(apiBase('?api=https://mac.tail0.ts.net.evil.example'), null);
  assert.equal(apiBase(''), null);
});

const NOBODY = Symbol('тело не JSON');   // так отвечает прокси Funnel, когда fin serve не запущен: 502 без слов fin

function fake(status, body) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (status === 'down') throw new TypeError('Failed to fetch');
    return { status, ok: status === 200, json: async () => {
      if (body === NOBODY) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    } };
  };
  fn.calls = calls;
  return fn;
}

test('запрос несёт initData в заголовке Authorization: tma …', async () => {
  const f = fake(200, { name: 'Алексей' });
  const r = await get('/api/me', { base: 'https://mac.tail0.ts.net', initData: 'user=1&hash=x', fetch: f });
  assert.deepEqual(r, { data: { name: 'Алексей' } });
  assert.equal(f.calls[0].url, 'https://mac.tail0.ts.net/api/me');
  assert.equal(f.calls[0].opts.headers.Authorization, 'tma user=1&hash=x');
});

test('кто ответил — тот и вид (М2): 4xx — отказ словами fin, 5xx со словами fin — ошибка Капусты; «Мак молчит» — только'
  + ' сеть, тайм-аут и прокси без слов fin (было: любой ответ не 2xx — «не отвечает» и снимок)', async () => {
  const base = 'https://mac.tail0.ts.net';
  const cases = [
    [401, {}, { error: 'stale' }],
    [403, {}, { error: 'stranger' }],
    [400, { error: 'нет такого лимита' }, { error: 'refused', status: 400, detail: 'нет такого лимита' }],
    [404, { error: 'нет такой операции' }, { error: 'refused', status: 404, detail: 'нет такой операции' }],
    [503, { error: 'ledger не грузится' }, { error: 'fault', detail: 'HTTP 503 · ledger не грузится' }],
    [500, { error: 'сбой' }, { error: 'fault', detail: 'HTTP 500 · сбой' }],
    [502, NOBODY, { error: 'down', detail: 'HTTP 502 · mac.tail0.ts.net' }],
    ['down', null, { error: 'down', detail: 'сеть: TypeError: Failed to fetch · mac.tail0.ts.net' }],
  ];
  for (const [status, body, want] of cases) {
    assert.deepEqual(await get('/api/me', { base, initData: 'x', fetch: fake(status, body) }), want, String(status));
  }
});

test('экраны ошибок — словами человека', () => {
  assert.equal(screen('outside').title, 'Капуста открывается из Telegram');
  assert.equal(screen('outside').link, 'https://t.me/ag_kapusta_bot');
  assert.equal(screen('stale').title, 'Откройте Капусту заново из чата');
  assert.equal(screen('stranger').title, 'Капуста вас не знает');
  assert.equal(screen('stranger').text, 'Этот аккаунт Telegram не в списке семьи. Доступ даёт Алексей.');
  assert.equal(screen('down').title, 'Капуста не отвечает');
  assert.equal(screen('down').retry, true);
  assert.equal(screen('stale').retry, false);
});

test('отказ fin — его словами, ошибка Капусты — своим видом и «Повторить»; причина мелко — код и слова fin (М2)', () => {
  assert.deepEqual(screen('refused', 'месяц ещё не начался'), { title: 'Капуста не может это показать', icon: 'warn',
    text: 'Месяц ещё не начался.', retry: true, link: null, detail: null });
  assert.deepEqual(screen('fault', 'HTTP 503 · ledger не грузится'), { title: 'Капуста ошиблась', icon: 'warn',
    text: 'Мак на связи, но Капуста не смогла ответить. Попробуйте ещё раз через минуту.', retry: true, link: null,
    detail: 'HTTP 503 · ledger не грузится' });
  assert.equal(screen('down', 'HTTP 502 · mac.tail0.ts.net').detail, 'HTTP 502 · mac.tail0.ts.net');
});

test('«не отвечает» — с причиной мелким шрифтом: код ответа прокси или ошибка сети и адрес', async () => {
  const base = 'https://mac.tail0.ts.net';
  const http = await get('/api/me', { base, initData: 'x', fetch: fake(502, NOBODY) });
  assert.equal(http.detail, 'HTTP 502 · mac.tail0.ts.net');
  const net = await get('/api/me', { base, initData: 'x', fetch: fake('down') });
  assert.equal(net.detail, 'сеть: TypeError: Failed to fetch · mac.tail0.ts.net');
});

test('Мак молчит дольше тайм-аута (решение 31: 8 с) — «не отвечает», запрос отменён', async () => {
  let aborted = false;
  const hang = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => {
      aborted = true;
      reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
    });
  });
  const r = await get('/api/health', { base: 'https://mac.tail0.ts.net', initData: 'x', fetch: hang, timeout: 20 });
  assert.equal(r.error, 'down');
  assert.equal(r.detail, 'сеть: нет ответа за 0.02 с · mac.tail0.ts.net');
  assert.equal(aborted, true);
});

test('тайм-аут по умолчанию — 8 секунд', async () => {
  const seen = [];
  const f = async (url, opts) => { seen.push(opts.signal); return { status: 200, ok: true, json: async () => ({}) }; };
  await get('/api/me', { base: 'https://mac.tail0.ts.net', initData: 'x', fetch: f });
  assert.ok(seen[0] instanceof AbortSignal);
  assert.equal(TIMEOUT, 8000);
});

// ---- М8: тело ответа — под тем же сроком и с защитой

test('тело не JSON — ошибка словами, а не исключение (М8): 200 и 409 — «Капуста ошиблась», 4xx — отказ с кодом', async () => {
  const base = 'https://mac.tail0.ts.net';
  const opts = (status) => ({ base, initData: 'x', fetch: fake(status, NOBODY) });
  assert.deepEqual(await get('/api/tx', opts(200)), { error: 'fault', detail: 'HTTP 200 · ответ не JSON' });
  assert.deepEqual(await post('/x', {}, opts(200)), { error: 'fault', detail: 'HTTP 200 · ответ не JSON' });
  assert.deepEqual(await post('/x', {}, opts(409)), { error: 'fault', detail: 'HTTP 409 · ответ не JSON' });
  const bad = await post('/x', {}, opts(400));
  assert.deepEqual([bad.error, bad.detail], ['refused', 'HTTP 400']);
});

// ответ пришёл, а тело — нет: json() не кончается и сигнал отмены не слушает (худший случай)
const slowBody = async () => ({ status: 200, ok: true, json: () => new Promise(() => {}) });

test('тело, которое не пришло за срок, — тайм-аут (М8: срок снимался до чтения тела — «Меняем…» висела)',
  { timeout: 2000 }, async () => {
    const o = { base: 'https://mac.tail0.ts.net', initData: 'x', fetch: slowBody, timeout: 20 };
    assert.deepEqual(await get('/api/tx', o), { error: 'down', detail: 'сеть: нет ответа за 0.02 с · mac.tail0.ts.net' });
    assert.deepEqual(await post('/x', {}, o), { error: 'down', detail: 'сеть: нет ответа за 0.02 с · mac.tail0.ts.net' });
  });

test('обрыв сети при чтении тела — «Мак молчит», как обрыв до ответа', async () => {
  const cut = async () => ({ status: 200, ok: true, json: async () => { throw new TypeError('network error'); } });
  const r = await get('/api/tx', { base: 'https://mac.tail0.ts.net', initData: 'x', fetch: cut });
  assert.deepEqual(r, { error: 'down', detail: 'сеть: TypeError: network error · mac.tail0.ts.net' });
});

// ---- POST: смена категории из карточки (этап 6)

test('POST — JSON с initData; 409 — конфликт с тем, что стоит сейчас; 400/404 — отказ словами', async () => {
  const base = 'https://mac.tail0.ts.net';
  const f = fake(200, { card: { ref: 'add:1' } });
  const ok = await post('/api/tx/add%3A1/category', { was: ['A'], to: 'B', id: 'c1' }, { base, initData: 'q', fetch: f });
  assert.deepEqual(ok, { data: { card: { ref: 'add:1' } } });
  const [call] = f.calls;
  assert.equal(call.url, `${base}/api/tx/add%3A1/category`);
  assert.equal(call.opts.method, 'POST');
  assert.equal(call.opts.headers.Authorization, 'tma q');
  assert.equal(call.opts.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(call.opts.body), { was: ['A'], to: 'B', id: 'c1' });
  const conflict = await post('/x', {}, { base, initData: 'q', fetch: fake(409, { error: 'e', now: ['C'], asked: 7 }) });
  assert.deepEqual(conflict, { error: 'conflict', data: { error: 'e', now: ['C'], asked: 7 } });
  for (const status of [400, 404]) {
    const r = await post('/x', {}, { base, initData: 'q', fetch: fake(status, { error: 'нельзя' }) });
    assert.deepEqual(r, { error: 'refused', detail: 'нельзя' });
  }
  for (const [status, kind] of [[401, 'stale'], [403, 'stranger'], [503, 'down'], ['down', 'down']]) {
    assert.equal((await post('/x', {}, { base, initData: 'q', fetch: fake(status, {}) })).error, kind, String(status));
  }
});

test('POST — кто ответил, тот и вид (как у GET, М2): 4xx — отказ словами fin, 5xx со словами fin — «Капуста ошиблась»;'
  + ' «Мак молчит» (смена — в очередь) — только сеть, тайм-аут и прокси без слов fin (было: 5xx и прочие 4xx — в очередь)', async () => {
  const base = 'https://mac.tail0.ts.net';
  const cases = [
    [422, { error: 'нет такой категории' }, { error: 'refused', detail: 'нет такой категории' }],
    [413, NOBODY, { error: 'refused', detail: 'HTTP 413' }],
    [503, { error: 'ledger не грузится' }, { error: 'fault', detail: 'HTTP 503 · ledger не грузится' }],
    [500, { error: 'сбой' }, { error: 'fault', detail: 'HTTP 500 · сбой' }],
    [502, NOBODY, { error: 'down', detail: 'HTTP 502 · mac.tail0.ts.net' }],
    ['down', null, { error: 'down', detail: 'сеть: TypeError: Failed to fetch · mac.tail0.ts.net' }],
  ];
  for (const [status, body, want] of cases) {
    assert.deepEqual(await post('/x', {}, { base, initData: 'q', fetch: fake(status, body) }), want, String(status));
  }
});

test('слова приложения (решение 51, Алексей 12.11): «неразобранное» — «без категории», Райффайзен — кириллицей;'
  + ' сервер и ответы бота — как были', async () => {
  const body = { cats: [{ name: 'неразобранное', key: 'Expenses:Family:Uncategorized' }], src: 'Raiffeisen Ангелина',
    days: [{ ops: [{ cats: ['супермаркеты', 'неразобранное'], legs: [{ name: 'Opening-Balances' }] }] }],
    what: 'неразобранное у Raiffeisen Ангелина', n: 1, ok: true, none: null };
  const r = await get('/api/tx', { base: 'https://mac.tail0.ts.net', initData: 'x', fetch: fake(200, body) });
  assert.deepEqual(r.data, { cats: [{ name: 'без категории', key: 'Expenses:Family:Uncategorized' }],
    src: 'Райффайзен Ангелины', days: [{ ops: [{ cats: ['супермаркеты', 'без категории'],
      legs: [{ name: 'начальный остаток' }] }] }],
    what: 'неразобранное у Raiffeisen Ангелина', n: 1, ok: true, none: null });   // описание человека не трогаем
  const p = await post('/api/recat', {}, { base: 'https://mac.tail0.ts.net', initData: 'x',
    fetch: fake(200, { card: { cats: ['неразобранное'] } }) });
  assert.deepEqual(p.data, { card: { cats: ['без категории'] } });
});
