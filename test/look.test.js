// Правки ui-ux-pro-max (13.11.2026): что видно в строках и графиках после правок 1–7. Поддельный DOM — fakedom.js.
// Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, one, seen } from './fakedom.js';
import { limitLegend, limitRow } from '../js/limitrow.js';

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
