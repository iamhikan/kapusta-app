// Кривая месяца: траты нарастающим итогом, линия плана к норме, прогноз пунктиром (только текущий месяц). Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curve, BOX } from '../js/chart.js';

const NOW = { days: 30, closed: false, norm: 200000, spent: 80000, forecast: 218182,
  curve: [[1, 2000], [2, 20000], [11, 80000]] };

test('последняя точка — «Потрачено», дни слева направо, в рамке', () => {
  const c = curve(NOW);
  const pts = c.line.split(' ').map((p) => p.split(',').map(Number));
  assert.equal(pts.length, 3);
  assert.deepEqual([c.end.x, c.end.y], pts.at(-1));
  assert.ok(pts.every(([x, y], i) => x >= BOX.left && x <= BOX.right && y >= BOX.top && y <= BOX.bottom
    && (i === 0 || x > pts[i - 1][0])));
  assert.ok(c.normY > BOX.top && c.normY < BOX.bottom);
  assert.ok(c.forecast.y < c.normY);                         // прогноз выше нормы — выше черты нормы
  assert.equal(c.plan.to.y, c.normY);                        // план к концу месяца — ровно норма
});

test('шкала Y покрывает и норму, и траты, и прогноз; подписи — в тысячах', () => {
  const c = curve(NOW);
  assert.ok(c.grid.length >= 2 && c.grid.length <= 5);
  assert.equal(c.grid[0].label, '0');
  assert.match(c.grid[1].label, /^\d+ тыс\.$/);
  assert.deepEqual(c.days.map((d) => d.label), ['1', '10', '20', '30']);
});

test('прошлый месяц — без прогноза; подпись для экранного диктора', () => {
  const c = curve({ ...NOW, closed: true, forecast: null, days: 31, curve: [[1, 50000], [31, 500000]], spent: 500000 });
  assert.equal(c.forecast, null);
  assert.equal(c.aria, 'Траты нарастающим итогом: 500 000 на 31-е число, норма 200 000');
  assert.match(curve(NOW).aria, /прогноз на конец месяца 218 182/);
});
