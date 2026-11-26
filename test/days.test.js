// Траты по дням (этап 7, решение 19): тепловая карта месяца из /api/days, «по сумме» и «к плану на день». План дня
// считает сервер; страница только красит: в плане — зелёный, выше — оранжевый, вдвое выше — красный. Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysView } from '../js/days.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1\u00a0$2');

// ноябрь 2026: 1-е — воскресенье; данные по 5-е
const NOV = { month: '2026-11', days: 30, scope: 'all', norm: 240000, points: [
  { date: '2026-11-01', rsd: 2000, scale: 2000, plan: 8000 },
  { date: '2026-11-02', rsd: 22000, scale: 20000, plan: 8200 },
  { date: '2026-11-03', rsd: 9000, scale: 9000, plan: 7600 },
  { date: '2026-11-04', rsd: 0, scale: 0, plan: 7500 },
  { date: '2026-11-05', rsd: 5000, scale: 4000, plan: 0 }] };

test('календарь: недели с понедельника, пустые клетки до 1-го, будущие дни — без суммы', () => {
  const v = daysView(NOV, 'sum');
  assert.equal(v.cells.length % 7, 0);
  assert.equal(v.cells.slice(0, 6).every((c) => c.blank), true);           // пн–сб до воскресенья 1 ноября
  assert.equal(v.cells[6].d, '1');
  const sixth = v.cells.find((c) => c.d === '6');
  assert.equal(sixth.future, true);
  assert.equal(sixth.date, null);
  assert.equal(v.title, 'Траты по дням · Ноябрь 2026');
  assert.equal(v.sub, '1–5 ноября · как в «Потрачено»');   // решение 98, ответ 2 (было «без аренды и регулярных», решение 64)
  assert.equal(daysView({ ...NOV, scope: 'scale' }, 'sum').sub, '1–5 ноября · в лимитах');   // решение 51
});

test('по сумме: тысячи в клетке, четыре оттенка (до 4, 8, 15 тыс. и больше), нажатие — операции дня (R-31)', () => {
  const v = daysView(NOV, 'sum');
  const day = (d) => v.cells.find((c) => c.d === d);
  assert.deepEqual([day('1').k, day('2').k, day('4').k], ['2', '22', '']);
  assert.deepEqual([day('1').level, day('3').level, day('2').level, day('4').level, day('5').level], [1, 3, 4, 0, 2]);
  assert.equal(day('2').aria, sp('2 ноября: 22 000 RSD'));
  assert.equal(day('2').date, '2026-11-02');
  assert.deepEqual(v.legend.map((l) => l.text), ['до 4 тыс.', 'до 8', 'до 15', 'больше 15 тыс.']);
  assert.equal(v.note, sp('Самые дорогие дни: 2.11 — 22 000, 3.11 — 9 000. Нажмите на день — откроются его операции.'));
  assert.equal(v.scale, false);
});

test('к плану на день: траты шкалы против плана дня; без трат — в плане; план 0 — любая трата вдвое выше', () => {
  const v = daysView(NOV, 'plan');
  const day = (d) => v.cells.find((c) => c.d === d);
  assert.deepEqual(['1', '2', '3', '4', '5'].map((d) => day(d).tone), ['good', 'bad', 'warn', 'good', 'bad']);
  assert.equal(day('2').k, '20');
  // цвет клетки — и словами для диктора (фаза 12)
  assert.equal(day('3').aria, sp('3 ноября: 9 000 RSD при плане 7 600 — выше плана'));
  assert.equal(day('1').aria, sp('1 ноября: 2 000 RSD при плане 8 000 — в плане'));
  assert.equal(day('2').aria, sp('2 ноября: 20 000 RSD при плане 8 200 — вдвое выше плана'));
  assert.deepEqual(v.legend.map((l) => [l.text, l.tone]), [['в плане', 'good'], ['выше', 'warn'], ['вдвое выше', 'bad']]);
  assert.equal(v.sub, '1–5 ноября · к плану на день');
  assert.equal(v.note, 'Вдвое выше плана: 2.11, 5.11. План дня — «Можно в день» на утро этого дня. '
    + 'Нажмите на день — откроются его операции.');   // решение 61: без формулы
  assert.equal(v.scale, true);
});

test('прошлый месяц — все дни; трат нет — пустая строка про дорогие дни', () => {
  const oct = { month: '2026-10', days: 31, scope: 'all', norm: 200000,
    points: Array.from({ length: 31 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, rsd: 0, scale: 0, plan: 6000 })) };
  const v = daysView(oct, 'sum');
  assert.equal(v.cells.filter((c) => c.future).length, 0);
  assert.equal(v.sub, '1–31 октября · как в «Потрачено»');
  assert.equal(v.note, 'Трат нет. Нажмите на день — откроются его операции.');
});

test('месяц без нормы (до начала учёта): плана дня нет — только «по сумме», «к плану на день» не предлагается', () => {
  const early = { ...NOV, norm: null, points: NOV.points.map((p) => ({ ...p, plan: null })) };
  assert.equal(daysView(NOV, 'sum').canPlan, true);
  for (const mode of ['sum', 'plan']) {
    const v = daysView(early, mode);
    assert.equal(v.canPlan, false, mode);
    assert.equal(v.mode, 'sum', mode);
    assert.equal(v.sub, '1–5 ноября · как в «Потрачено»', mode);
    assert.deepEqual(v.legend.map((l) => l.text), ['до 4 тыс.', 'до 8', 'до 15', 'больше 15 тыс.'], mode);
    assert.equal(v.cells.find((c) => c.d === '2').aria, sp('2 ноября: 22 000 RSD'), mode);
  }
});

// R-8 (ревью 26.11): 13.11 — «−3,1» дефисом и цветом «мало трат». Минус — знаком «−», клетка — контуром, в легенде —
// что значит минус; легенда без минусовых дней — как была
test('R-8: день меньше нуля — «−3,1», контур вместо цвета «мало трат», в легенде — что это значит', () => {
  const back = { ...NOV, points: [...NOV.points, { date: '2026-11-06', rsd: -3100, scale: -3100, plan: 7400 },
    { date: '2026-11-07', rsd: -12400, scale: -12400, plan: 7600 }] };
  for (const mode of ['sum', 'plan']) {
    const v = daysView(back, mode);
    const day = (d) => v.cells.find((c) => c.d === d);
    assert.deepEqual([day('6').k, day('7').k, day('6').neg, day('5').neg], ['−3,1', '−12', true, false], mode);
    assert.match(day('6').aria, /^6 ноября: −3\u00a0100 RSD/, mode);
    assert.match(day('6').aria, /возвратов больше, чем трат$/, mode);
    assert.equal(v.legend.at(-1).text, 'меньше нуля — возвратов больше, чем трат', mode);
    assert.equal(v.legend.at(-1).neg, true, mode);
  }
  assert.ok(!daysView(NOV, 'sum').legend.some((l) => l.neg));
});
