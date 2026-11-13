// Карточка операции: смена категории и ошибки (фаза 6 рефакторинга 11.2026, М6, М8; согласование с М2). Путь — как в
// приложении: кнопка -> submit -> post -> fetch. Поддельный DOM — fakedom.js. Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, seen } from './fakedom.js';
import { post } from '../js/api.js';
import { cardScreen } from '../js/screens.js';

const BASE = 'https://mac.tail0.ts.net';
const NOBODY = Symbol('тело не JSON');
const tick = () => new Promise((r) => setImmediate(r));

const CARD = { ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: 'чек', kind: 'spend', cats: ['алкоголь'], src: 'Freedom',
  amount: { number: 400, currency: 'RSD' }, rsd: 400, flag: false, by: 'Алексей', at: '2026-11-10 18:40', refs: ['sms:1'],
  similar: [], postings: [{ name: 'Freedom', number: -400, currency: 'RSD' }, { name: 'алкоголь', number: 400, currency: 'RSD' }],
  receipt: null,
  change: { accounts: ['Expenses:Family:Alcohol'], choices: [{ account: 'Expenses:Family:Alcohol', name: 'алкоголь' },
    { account: 'Expenses:Family:Food', name: 'продукты' }] } };

// ответ fetch: статус и тело; 'down' — сеть, NOBODY — тело не JSON
function answer(status, body) {
  if (status === 'down') return Promise.reject(new TypeError('Failed to fetch'));
  return Promise.resolve({ status, ok: status >= 200 && status < 300, json: async () => {
    if (body === NOBODY) throw new SyntaxError('Unexpected end of JSON input');
    return body;
  } });
}

// nav карточки: POST идёт через настоящий post(); что ушло на сервер и что легло в очередь — видно тесту
function navOf(...answers) {
  const nav = { sent: [], inQueue: [], today: () => '2026-11-13', accounts: () => [], balanceOf: () => null, focus() {},
    render() {}, push() {}, problem() {}, changed() {}, snapshot() {}, hasSnap: false, queued: () => [] };
  nav.enqueue = async (j) => { nav.inQueue.push(j); return true; };
  const fetch = async (url, opts) => {
    nav.sent.push(JSON.parse(opts.body));
    const [status, body] = answers.length > 1 ? answers.shift() : answers[0];
    return answer(status, body);
  };
  nav.post = (path, body) => post(path, body, { base: BASE, initData: 'x', fetch, timeout: 50 });
  return nav;
}

const buttons = (tree) => all(tree, '<button');
const button = (tree, text) => buttons(tree).find((b) => seen(b) === text) || null;
const press = (el) => el.handlers.click({ target: el, currentTarget: el });

// открыть лист выбора, выбрать «продукты» и нажать «Сменить на «продукты»»
async function change(entry, nav) {
  entry.picker = { item: null, q: '', chosen: 'Expenses:Family:Food', all: false, group: null, from: 'recat' };
  press(button(cardScreen(entry, nav), 'Сменить на «продукты»'));
  for (let i = 0; i < 5; i += 1) await tick();
  return seen(cardScreen(entry, nav));
}

test('смена категории: тело ответа не JSON — итог словами, кнопка «Меняем…» не висит (М8)', async () => {
  const nav = navOf([200, NOBODY]);
  const entry = { kind: 'card', ref: 'sms:1', data: CARD };
  const text = await change(entry, nav);
  assert.doesNotMatch(text, /Меняем…/);
  assert.equal(entry.picker, null, 'лист закрыт');
  assert.match(text, /Не сменили: Капуста ошиблась/);
});
