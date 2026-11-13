// Правки ui-ux-pro-max (13.11.2026): что видно в строках и графиках после правок 1–7. Поддельный DOM — fakedom.js.
// Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, one, seen } from './fakedom.js';
import { limitLegend, limitRow } from '../js/limitrow.js';
import { catRow, stripChart } from '../js/catscreen.js';

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
