// «По дням» (этап 7, решение 19): тепловая карта месяца из /api/days. «По сумме» — траты дня в разрезе «Категорий»
// (все траты или шкала); «к плану на день» — траты шкалы против плана дня, который считает сервер:
// (норма − «Потрачено» до этого дня) / оставшиеся дни. В плане — зелёный, выше — оранжевый, вдвое выше — красный.
import { fmt } from './health.js';
import { monthTitle } from './ops.js';

const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const LEVELS = [4000, 8000, 15000];   // оттенки «по сумме» — как на холсте later-days

const thousands = (v) => {
  if (!v) return '';
  const k = v / 1000;
  return k >= 10 ? String(Math.round(k)) : k.toFixed(1).replace(/\.0$/, '').replace('.', ',');
};

const SAY = { good: 'в плане', warn: 'выше плана', bad: 'вдвое выше плана' };   // цвет клетки — словами для диктора
const level = (v) => (v <= 0 ? 0 : v <= LEVELS[0] ? 1 : v <= LEVELS[1] ? 2 : v <= LEVELS[2] ? 3 : 4);

function tone(v, plan) {
  if (v <= 0) return 'good';
  if (plan <= 0) return 'bad';
  const r = v / plan;
  return r > 2 ? 'bad' : r > 1 ? 'warn' : 'good';
}

export function daysView(b, mode) {
  const plan = mode === 'plan';
  const [y, m] = b.month.split('-').map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;   // пн = 0
  const byDay = new Map(b.points.map((p) => [Number(p.date.slice(8)), p]));
  const name = (d) => `${d} ${OF_MONTH[m - 1]}`;
  const short = (iso) => `${Number(iso.slice(8))}.${iso.slice(5, 7)}`;
  const cells = Array.from({ length: lead }, () => ({ blank: true }));
  for (let d = 1; d <= b.days; d += 1) {
    const p = byDay.get(d);
    if (!p) { cells.push({ d: String(d), future: true, date: null }); continue; }
    const v = plan ? p.scale : p.rsd;
    cells.push({ d: String(d), date: p.date, k: thousands(v), level: level(v), tone: tone(p.scale, p.plan),
      aria: plan ? `${name(d)}: ${fmt(p.scale)} RSD при плане ${fmt(p.plan)} — ${SAY[tone(p.scale, p.plan)]}` : `${name(d)}: ${fmt(v)} RSD` });
  }
  while (cells.length % 7) cells.push({ blank: true });
  const last = b.points.length ? Number(b.points[b.points.length - 1].date.slice(8)) : 0;
  const tail = 'Тап по дню — операции дня.';
  let note;
  if (plan) {
    const twice = b.points.filter((p) => tone(p.scale, p.plan) === 'bad').map((p) => short(p.date));
    note = `${twice.length ? `Вдвое выше плана: ${twice.join(', ')}. ` : ''}План дня — «Можно в день» `
      + `на утро этого дня. ${tail}`;   // решение 61: было формулой
  } else {
    const top = [...b.points].filter((p) => p.rsd > 0).sort((a, c) => c.rsd - a.rsd).slice(0, 2);
    note = top.length ? `Самые дорогие дни: ${top.map((p) => `${short(p.date)} — ${fmt(p.rsd)}`).join(', ')}. ${tail}`
      : `Трат нет. ${tail}`;
  }
  return {
    title: `Траты по дням · ${monthTitle(b.month)}`,
    sub: `1–${last} ${OF_MONTH[m - 1]} · ${plan ? 'к плану на день' : b.scope === 'scale' ? 'в лимитах' : 'без аренды и регулярных'}`,
    cells,
    legend: plan ? [{ text: 'в плане', tone: 'good' }, { text: 'выше', tone: 'warn' }, { text: 'вдвое выше', tone: 'bad' }]
      : [{ text: 'до 4 тыс.', level: 1 }, { text: 'до 8', level: 2 }, { text: 'до 15', level: 3 }, { text: 'больше 15 тыс.', level: 4 }],
    note,
    scale: plan || b.scope === 'scale',
  };
}
