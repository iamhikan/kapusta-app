// Вход и ошибки: страница без данных; API — только из подписанного Telegram, адрес API — из ссылки кнопки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiBase, get, screen } from '../js/api.js';

test('адрес API — только https на ts.net из параметра ?api=, иначе нет', () => {
  assert.equal(apiBase('?api=https://mac.tail0.ts.net'), 'https://mac.tail0.ts.net');
  assert.equal(apiBase('?api=https://mac.tail0.ts.net/'), 'https://mac.tail0.ts.net');
  assert.equal(apiBase('?api=https://evil.example'), null);
  assert.equal(apiBase('?api=http://mac.tail0.ts.net'), null);
  assert.equal(apiBase('?api=https://mac.tail0.ts.net.evil.example'), null);
  assert.equal(apiBase(''), null);
});

function fake(status, body) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (status === 'down') throw new TypeError('Failed to fetch');
    return { status, ok: status === 200, json: async () => body };
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

test('401, 403, Мак молчит — свой экран', async () => {
  const base = 'https://mac.tail0.ts.net';
  for (const [status, kind] of [[401, 'stale'], [403, 'stranger'], [503, 'down'], ['down', 'down'], [404, 'down']]) {
    const r = await get('/api/me', { base, initData: 'x', fetch: fake(status, { error: 'e' }) });
    assert.equal(r.error, kind, String(status));
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

test('«не отвечает» — с причиной мелким шрифтом: код ответа или ошибка сети и адрес', async () => {
  const base = 'https://mac.tail0.ts.net';
  const http = await get('/api/me', { base, initData: 'x', fetch: fake(503, {}) });
  assert.equal(http.detail, 'HTTP 503 · mac.tail0.ts.net');
  const net = await get('/api/me', { base, initData: 'x', fetch: fake('down') });
  assert.equal(net.detail, 'сеть: TypeError: Failed to fetch · mac.tail0.ts.net');
});
