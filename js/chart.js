// Кривая месяца (свой SVG, решение 14 — свёрнута): траты нарастающим итогом, линия плана от нормы на день к норме
// месяца, норма — пунктиром поперёк, прогноз — пунктиром от сегодня к концу месяца (у прошлого месяца его нет).
import { fmt } from './health.js';

export const BOX = { width: 330, height: 150, left: 50, right: 322, top: 10, bottom: 128 };  // слева — «100 тыс.»
const STEPS = [10000, 20000, 50000, 100000, 200000, 250000, 500000, 1000000];

export function curve(h) {
  const top = Math.max(h.norm, h.spent, h.forecast || 0, 1) * 1.08;
  const step = STEPS.find((s) => top / s <= 4) || STEPS.at(-1);
  const max = Math.ceil(top / step) * step;
  const x = (day) => +(BOX.left + ((day - 1) / Math.max(1, h.days - 1)) * (BOX.right - BOX.left)).toFixed(1);
  const y = (v) => +(BOX.top + (1 - Math.max(0, v) / max) * (BOX.bottom - BOX.top)).toFixed(1);
  const pts = h.curve.map(([day, total]) => [x(day), y(total)]);
  const last = h.curve.at(-1) || [1, 0];
  const grid = [];
  for (let v = 0; v < max; v += step) grid.push({ y: y(v), label: v ? `${Math.round(v / 1000)} тыс.` : '0' });
  return {
    grid,
    days: [1, 10, 20, h.days].map((d) => ({ x: x(d), label: String(d) })),
    normY: y(h.norm),
    normLabel: `норма ${Math.round(h.norm / 1000)} тыс.`,
    plan: { from: { x: x(1), y: y(h.norm / h.days) }, to: { x: x(h.days), y: y(h.norm) } },
    line: pts.map((p) => p.join(',')).join(' '),
    area: [[x(1), y(0)], ...pts, [x(last[0]), y(0)]].map((p) => p.join(',')).join(' '),
    end: { x: x(last[0]), y: y(last[1]) },
    forecast: h.closed || h.forecast == null ? null : { x: x(h.days), y: y(h.forecast) },
    aria: `Траты нарастающим итогом: ${fmt(last[1])} на ${last[0]}-е число, норма ${fmt(h.norm)}`
      + (h.closed || h.forecast == null ? '' : `, прогноз на конец месяца ${fmt(h.forecast)}`),
  };
}
