// Ссылка «Чек на сайте налоговой» (М9, фаза 6 рефакторинга 11.2026): страница открывает только адреса
// https://suf.purs.gov.rs/ — чек на сайте налоговой Сербии; другой адрес из ответа сервера не открывает и кнопку не
// рисует. Telegram подменён до загрузки модулей (dom.js берёт его при импорте). Поддельный DOM — fakedom.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, seen } from './fakedom.js';

const opened = [];
const tried = [];
let broken = false;
globalThis.Telegram = { WebApp: { openLink: (url) => { if (broken) throw new Error('old client'); opened.push(url); } } };
globalThis.window = { open: (...args) => { tried.push(args); } };
const { cardScreen } = await import('../js/screens.js');
const { cardView } = await import('../js/ops.js');

const TAX = 'https://suf.purs.gov.rs/v/?vl=A1B2';
const card = (url) => ({ ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: 'чек', kind: 'spend', cats: ['продукты'],
  src: 'Freedom', amount: { number: 400, currency: 'RSD' }, rsd: 400, flag: false, by: 'Алексей', at: '2026-11-10 18:40',
  refs: ['sms:1'], similar: [], change: null,
  postings: [{ name: 'Freedom', number: -400, currency: 'RSD' }, { name: 'продукты', number: 400, currency: 'RSD' }],
  receipt: { shop: 'Lidl', at: '2026-11-10 18:39', total: 400, url, by: 'Алексей',
    items: [{ name: 'SIR', kind: null, qty: 1, unit: 'шт', price: 400, total: 400, cat: 'продукты' }] } });
const nav = { today: () => '2026-11-13', accounts: () => [], balanceOf: () => null, queued: () => [], focus() {},
  render() {}, push() {} };
const link = (url) => all(cardScreen({ kind: 'card', ref: 'sms:1', data: card(url) }, nav), '<button')
  .find((b) => seen(b) === 'Чек на сайте налоговой') || null;
const press = (el) => el.handlers.click({ target: el, currentTarget: el });

const FOREIGN = ['javascript:alert(1)', 'https://evil.example/v/?vl=A1B2', 'https://suf.purs.gov.rs.evil.example/v/',
  'https://suf.purs.gov.rs@evil.example/v/', 'http://suf.purs.gov.rs/v/?vl=A1B2', 'data:text/html,x', ''];

test('чужой адрес чека — кнопки «Чек на сайте налоговой» нет, адрес в вид не попадает', () => {
  for (const url of FOREIGN) {
    assert.equal(cardView(card(url)).receipt.url, null, url);
    assert.equal(link(url), null, url);
  }
});

test('адрес налоговой — кнопка есть; нажатие открывает его через Telegram, старый клиент — окном браузера', () => {
  assert.equal(cardView(card(TAX)).receipt.url, TAX);
  press(link(TAX));
  assert.deepEqual(opened, [TAX]);
  broken = true;
  press(link(TAX));
  assert.deepEqual(tried, [[TAX, '_blank', 'noopener']]);
});
