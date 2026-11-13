// Правки ui-ux-pro-max (13.11.2026): что видно в строках и графиках после правок 1–7. Поддельный DOM — fakedom.js.
// Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, one, seen } from './fakedom.js';
import { limitLegend, limitRow } from '../js/limitrow.js';
import { catRow, stripChart } from '../js/catscreen.js';
import { cardScreen, opLine } from '../js/screens.js';
import { opRow } from '../js/ops.js';
import { planCard } from '../js/more.js';

const OVER = { name: 'транспорт', spent: '24 900', limit: '5 800', over: '+19 100', fill: 5800 / 24900, limitAt: 5800 / 24900,
  color: 'var(--bar-orange)', state: 'сверх лимита, покрыто резервом', hint: 'покрыто резервом', covered: true };
const UNDER = { name: 'путешествия', spent: '15 400', limit: '17 600', over: '', fill: 0.875, limitAt: null,
  color: 'var(--bar-yellow)', state: 'выше плана' };

test('правка 1: строка сверх лимита — сплошная часть до метки лимита, дальше штриховка того же цвета; черты плана нет', () => {
  const row = limitRow(OVER, { plan: 0.43, open() {} });
  assert.equal(one(row, 'fill').style.width, '23.3%');
  assert.equal(one(row, 'over').style.left, '23.3%');
  assert.equal(one(row, 'over').style.color, 'var(--bar-orange)');
  assert.equal(one(row, 'limit-mark').style.left, '23.3%');
  assert.equal(one(row, 'plan-mark'), null);
});

test('правка 1: строка в лимите — как было: полоска до доли, черта плана, без штриховки и метки', () => {
  const row = limitRow(UNDER, { plan: 0.43, open() {} });
  assert.equal(one(row, 'fill').style.width, '87.5%');
  assert.equal(one(row, 'plan-mark').style.left, '43.0%');
  assert.equal(one(row, 'over'), null);
  assert.equal(one(row, 'limit-mark'), null);
});

test('правка 1: легенда — штриховка у перерасхода, метка «лимит» отдельным образцом', () => {
  const lg = limitLegend([{ text: 'в плане', color: 'var(--bar-green)' },
    { text: 'покрыто резервом', color: 'var(--bar-orange)', hatch: true }, { text: 'лимит', mark: true }]);
  assert.deepEqual(all(lg, 'legend-item').map(seen), ['в плане', 'покрыто резервом', 'лимит']);
  assert.equal(one(lg, 'swatch-hatch').style.color, 'var(--bar-orange)');
  assert.equal(all(lg, 'swatch-mark').length, 1);
  assert.equal(one(lg, 'swatch-bar').style.background, 'var(--bar-green)');
});

const STRIP = { total: '10 000', aria: 'Траты: продукты 3 000, прочее 7 000', cmp: null,
  strip: [{ name: 'продукты', pct: '30 %', share: 0.3, color: '#2481cc' }, { name: 'ещё 4', pct: '70 %', share: 0.7, color: '#a1a1a6' }] };

test('правка 2: полоса долей — доли по ширине и цвету, подписи «имя процент» под ней; диктору — одна фраза', () => {
  const el = stripChart(STRIP);
  assert.deepEqual(all(el, 'strip-part').map((s) => [s.style.width, s.style.background]), [['30.0%', '#2481cc'], ['70.0%', '#a1a1a6']]);
  assert.deepEqual(all(el, 'legend-item').map(seen), ['продукты 30 %', 'ещё 4 70 %']);
  assert.equal(one(el, 'strip').getAttribute('aria-label'), STRIP.aria);
  assert.equal(all(el, '<svg').length, 0);                              // кольца нет
});

test('правка 2: строка категории со своим лимитом — полоска лимита и «из N»; с лимитом группы — подпись', () => {
  const own = catRow({ rowClass: 'cat-row', cmpHead: 'к 1–11.10' }, { key: 'k', name: 'транспорт', sum: '6 000', share: '60 %',
    delta: '+1', deltaTone: 'warn', color: '#827717', limit: 'лимит 2 000', of: 'из 2 000',
    bar: { fill: 1 / 3, limitAt: 1 / 3, color: '#827717' } }, () => {});
  assert.equal(one(own, 'limit-mark').style.left, '33.3%');
  assert.ok(seen(own).includes('из 2 000'));
  assert.ok(!seen(own).includes('лимит 2 000'));
  assert.match(own.getAttribute('aria-label'), /транспорт, лимит 2 000: 6 000 RSD/);
  const group = catRow({ rowClass: 'cat-row', cmpHead: '' }, { key: 'r', name: 'рестораны', sum: '1 500', share: '15 %',
    delta: '', color: '#e05a8a', limit: 'в лимите «еда вне дома»', of: '', bar: null }, () => {});
  assert.equal(one(group, 'bar'), null);
  assert.ok(seen(group).includes('в лимите «еда вне дома»'));
});

const NAV = { queued: () => [], focus() {}, render() {}, push() {}, unqueue() {} };
const DM = { ref: 'add:1', date: '2026-11-12', at: '2026-11-12 13:33', where: 'dm', what: 'чек', kind: 'spend', cats: ['хозяйство'],
  src: 'Райффайзен Ангелины', amount: { number: 172, currency: 'RSD' }, rsd: 172, receipt: true, flag: false, by: 'Ангелина',
  account: 'Expenses:Family:Household', change: { accounts: ['Expenses:Family:Household'], choices: [{ account: 'Expenses:Family:Household', name: 'хозяйство' }] },
  postings: [{ name: 'Райффайзен Ангелины', account: 'Assets:Family:Raiffeisen:RSD', number: -172, currency: 'RSD' },
    { name: 'хозяйство', account: 'Expenses:Family:Household', number: 172, currency: 'RSD' }],
  receipt: { shop: 'DM', total: 172, url: null, items: [{ name: 'Profissimo papir', kind: null, qty: 1, unit: 'шт', price: 109,
    total: 109, cat: 'хозяйство' }] } };

test('правка 3: карточка простой траты — под суммой только дата; категория, кошелёк, автор — по одному разу', () => {
  const el = cardScreen({ kind: 'card', ref: 'add:1', data: DM }, NAV);
  const text = seen(el);
  assert.equal(text.split('хозяйство').length - 1, 2);           // строка «Категория» и позиция чека
  assert.equal(text.split('Райффайзен Ангелины').length - 1, 1);  // строка «Кошелёк»
  assert.ok(!text.includes('Откуда и куда'));
  assert.ok(!text.includes('записала Ангелина'));
  assert.deepEqual(all(el, 'kv-key').map(seen), ['Категория', 'Кошелёк', 'Записала']);
  assert.ok(text.includes('12 ноября, чт · 13:33'));
});

test('правка 3: позиция чека — с шевроном, без подсказки «тап — …» в шапке чека', () => {
  const el = cardScreen({ kind: 'card', ref: 'add:1', data: DM }, NAV);
  assert.ok(!seen(el).includes('тап —'));
  const item = all(el, 'op').find((b) => b.getAttribute('data-focus') === 'item:0');
  assert.ok(all(item, '<svg').length === 1, 'шеврон у позиции');
});

const TAXI = { ref: 'add:t', date: '2026-11-12', where: 'Такси', kind: 'spend', cats: ['такси'], src: 'нал Алексея',
  amount: { number: 320, currency: 'RSD' }, rsd: 320, receipt: false, flag: false, key: 'Expenses:Family:Transport' };

test('правка 4: строка операции — плитка категории слева: тон цвета и значок; для диктора — украшение', () => {
  const row = opLine(opRow(TAXI), NAV);
  const t = one(row, 'cat-tile');
  assert.equal(row.kids[0], t, 'плитка — первой в строке');
  assert.equal(t.getAttribute('aria-hidden'), 'true');
  assert.match(t.style.background, /#827717/);
  assert.equal(all(t, '<svg').length, 1);
});

const PLAN = { title: 'Деньги на ноябрь', verdict: { word: 'хватает', text: 'Переводить с ПР не нужно', value: 'сверху 5 000 RSD', tone: 'good' },
  have: { label: 'Наличные и карты на 1 ноября', value: '≈ 1 680 000', sub: '1 600 000 RSD + 680 € по курсу НБС' },
  need: { label: 'Нужно на месяц', value: '420 000' }, fill: 0.25, ratio: 'нужно — 25 % того, что есть',
  parts: ['траты в лимитах (норма) 240 000', 'жильё 180 000'], salary: '' };

test('правка 5: карточка «Деньги на …» — сначала вывод, потом «есть / нужно», разбивка — под «Из чего суммы»', () => {
  const el = planCard(PLAN);
  const text = seen(el);
  assert.ok(text.indexOf('Переводить с ПР не нужно') < text.indexOf('Наличные и карты на 1 ноября'), 'вывод выше чисел');
  assert.ok(seen(one(el, 'pill')).includes('хватает'));
  assert.equal(all(one(el, 'pill'), '<svg').length, 1, 'у плашки — значок, не только цвет');
  const more = one(el, '<details');
  assert.equal(seen(one(more, '<summary')), 'Из чего суммы');
  assert.ok(seen(more).includes('жильё 180 000') && seen(more).includes('по курсу НБС'));
  assert.equal(one(el, 'fill').style.width, '25.0%');
});
