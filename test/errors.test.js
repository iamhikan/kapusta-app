// Ошибки на экране (М2, фаза 6 рефакторинга 11.2026; долг 2026-11-13-miniapp-errors-as-offline): fin ответил отказом —
// его словами; fin ответил ошибкой — «Капуста ошиблась» и «Повторить», без снимка; «Капуста не отвечает» и ссылка на
// снимок «Здоровья» — только когда Мак молчит (сеть, тайм-аут, прокси Funnel без слов fin). Путь — как в приложении:
// fetch -> get -> загрузчик экрана -> экран. Поддельный DOM — fakedom.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, one, seen } from './fakedom.js';
import { get } from '../js/api.js';
import { loadOps, newOps, opsScreen } from '../js/screens.js';
import { catsScreen, loadCats, newCats } from '../js/catscreen.js';
import { loadMore, moreScreen } from '../js/more.js';

const BASE = 'https://mac.tail0.ts.net';
const NOBODY = Symbol('тело не JSON');

function fetchOf(status, body) {
  return async (url, opts) => {
    if (status === 'down') throw new TypeError('Failed to fetch');
    if (status === 'hang') {
      return new Promise((_, reject) => opts.signal.addEventListener('abort',
        () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }))));
    }
    return { status, ok: status >= 200 && status < 300, json: async () => {
      if (body === NOBODY) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    } };
  };
}

function navOf(status, body) {
  const fetch = fetchOf(status, body);
  return { today: () => '2026-11-13', accounts: () => [], balanceOf: () => null, queued: () => [], savePeriod() {},
    focus() {}, push() {}, render() {}, limitOf: () => null, noteOf: () => '', problem() {}, snapshot() {}, hasSnap: true,
    get: (path) => get(path, { base: BASE, initData: 'x', fetch, timeout: 20 }) };
}

const button = (tree, text) => all(tree, '<button').find((b) => seen(b) === text) || null;

// что видит человек на «Операциях»: заголовок, текст, мелкая причина, «Повторить», ссылка на снимок
const CASES = [
  ['400: отказ словами fin', 400, { error: 'нет такого лимита' },
    { title: 'Капуста не может это показать', text: 'Нет такого лимита.', small: null, snap: false }],
  ['404: отказ словами fin', 404, { error: 'нет такого адреса' },
    { title: 'Капуста не может это показать', text: 'Нет такого адреса.', small: null, snap: false }],
  ['503 от fin: Капуста ошиблась', 503, { error: 'ledger не грузится' },
    { title: 'Капуста ошиблась', text: 'Мак на связи, но Капуста не смогла ответить. Попробуйте ещё раз через минуту.',
      small: 'HTTP 503 · ledger не грузится', snap: false }],
  ['500 от fin: Капуста ошиблась', 500, { error: 'сбой' },
    { title: 'Капуста ошиблась', text: 'Мак на связи, но Капуста не смогла ответить. Попробуйте ещё раз через минуту.',
      small: 'HTTP 500 · сбой', snap: false }],
  ['сеть: Мак молчит', 'down', null,
    { title: 'Капуста не отвечает', small: 'сеть: TypeError: Failed to fetch · mac.tail0.ts.net', snap: true }],
  ['тайм-аут: Мак молчит', 'hang', null,
    { title: 'Капуста не отвечает', small: 'сеть: нет ответа за 0.02 с · mac.tail0.ts.net', snap: true }],
  ['502 от прокси без слов fin: fin serve лежит', 502, NOBODY,
    { title: 'Капуста не отвечает', small: 'HTTP 502 · mac.tail0.ts.net', snap: true }],
];

for (const [what, status, body, want] of CASES) {
  test(`«Операции», ${what}`, async () => {
    const nav = navOf(status, body);
    const entry = newOps('2026-11');
    await loadOps(entry, nav);
    const tree = opsScreen(entry, nav);
    const box = one(tree, 'empty');
    assert.ok(box, 'экран ошибки вместо списка');
    assert.equal(seen(one(box, '<h2')), want.title);
    if (want.text) assert.equal(seen(one(box, '<p')), want.text);
    const small = one(box, 'detail');
    assert.equal(small ? seen(small) || null : null, want.small);
    assert.ok(button(box, 'Повторить'), '«Повторить» есть');
    assert.equal(!!button(box, 'Открыть снимок «Здоровья»'), want.snap, 'ссылка на снимок — только когда Мак молчит');
    if (!want.snap) assert.doesNotMatch(seen(tree), /не отвечает|Мак спит/);
  });
}

test('«Категории», 503 от fin: «Капуста ошиблась», не «не отвечает» и не снимок', async () => {
  const nav = navOf(503, { error: 'ledger не грузится' });
  const entry = newCats({ kind: 'month', from: '2026-11-01', to: '2026-11-30' });
  await loadCats(entry, nav);
  const text = seen(catsScreen(entry, nav));
  assert.match(text, /Капуста ошиблась/);
  assert.doesNotMatch(text, /не отвечает|Открыть снимок/);
});

test('«Бюджет», 400 от fin: отказ его словами; «Повторить» — новый запрос', async () => {
  const nav = navOf(400, { error: 'month — ГГГГ-ММ' });
  const entry = { kind: 'budget', month: '2026-1' };
  await loadMore(entry, nav);
  const tree = moreScreen(entry, nav);
  assert.match(seen(tree), /Капуста не может это показать/);
  assert.match(seen(tree), /Month — ГГГГ-ММ\./);
  assert.doesNotMatch(seen(tree), /не отвечает|Истории цены нет/);
});

test('«История цены», 404 «нет такой позиции» — «Истории цены нет»; 400 — отказ словами fin (было: регэксп по «HTTP 404»)', async () => {
  const missing = { kind: 'price', q: { product: 'P1:7' } };
  await loadMore(missing, navOf(404, { error: 'нет такой позиции' }));
  assert.match(seen(moreScreen(missing, navOf(200, {}))), /Истории цены нет/);
  const bad = { kind: 'price', q: { product: 'P1:7' } };
  await loadMore(bad, navOf(400, { error: 'нужны receipt и line, product или kind' }));
  const text = seen(moreScreen(bad, navOf(200, {})));
  assert.match(text, /Нужны receipt и line, product или kind\./);
  assert.doesNotMatch(text, /Истории цены нет|не отвечает/);
});

// М14 (этап 2 фазы 6): следующие 50 не пришли — список на месте, под ним ошибка тем же видом и «Повторить»
const op = (where) => ({ ref: `sms:${where}`, date: '2026-11-10', where, what: '', kind: 'spend', cats: ['продукты'],
  src: 'Freedom', amount: { number: 500, currency: 'RSD' }, rsd: 500, receipt: false, flag: false, by: 'Алексей' });
const page = (where, next = null) => ({ days: [{ date: '2026-11-10', sum: 500, ops: [op(where)] }], count: 2, total: 1000, next });
const press = (el) => el.handlers.click({ target: el, currentTarget: el });
const tick = () => new Promise((r) => setImmediate(r));

for (const [what, fail, title] of [['Капуста ошиблась (503)', [503, { error: 'ledger не грузится' }], 'Капуста ошиблась'],
  ['Мак молчит (сеть)', ['down', null], 'Капуста не отвечает']]) {
  test(`«Операции»: следующие 50 не пришли, ${what} — список на месте, под ним ошибка тем же видом и «Повторить» (М14)`, async () => {
    const answers = [[200, page('Lidl', '50')], fail, [200, page('Maxi')]];
    const asked = [];
    const nav = navOf(200, {});
    nav.get = (path) => {
      asked.push(path);
      const [status, body] = answers.shift();
      return get(path, { base: BASE, initData: 'x', fetch: fetchOf(status, body), timeout: 20 });
    };
    const entry = newOps('2026-11');
    await loadOps(entry, nav);
    await loadOps(entry, nav, true);
    const tree = opsScreen(entry, nav);
    const text = seen(tree);
    assert.match(text, /Lidl/, 'первые 50 на месте');
    assert.match(text, new RegExp(title));
    assert.equal(one(tree, 'more'), null, 'кнопки «Показать ещё» нет: подгрузка при прокрутке не повторяет запрос сама');
    press(button(tree, 'Повторить'));
    for (let i = 0; i < 5; i += 1) await tick();
    assert.deepEqual(asked.map((x) => /cursor=50/.test(x)), [false, true, true], '«Повторить» — те же следующие 50');
    const after = seen(opsScreen(entry, nav));
    assert.match(after, /Lidl/);
    assert.match(after, /Maxi/);
    assert.doesNotMatch(after, new RegExp(`${title}|Повторить`));
  });
}
