// «Бюджет» (этап 7) — продолжение «Все лимиты» на «Здоровье»: ответ /api/budget -> что видит человек. Куда идёт доход
// (fin limits) и деньги на месяц (fin plan) — только Алексею: Ангелине сервер их не шлёт (решение 11).
import { amounts, fmt } from './health.js';
import { monthTitle } from './ops.js';

const FOR_MONTH = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь',
  'ноябрь', 'декабрь'];
// доли дохода: норма — акцент темы, остальное — свои спокойные цвета (те же на светлой и тёмной теме)
const COLORS = { norm: 'var(--accent)', Обязательные: '#8d6e63', 'Регулярные по карте': '#e8833a', ПР: '#a1a1a6',
  Отложить: '#1f8f4e' };

const strip = (s) => (s || '').replace(/^\(|\)$/g, '');

export function budgetView(b) {
  const word = FOR_MONTH[Number(b.month.slice(5)) - 1];
  const income = b.income ? { label: 'Доход ПР', value: fmt(b.income.rsd), set: b.income.set || '' } : null;
  let alloc = [];
  if (b.income) {
    const parts = [['Норма — переменные траты', b.norm, COLORS.norm], ...b.groups.map((g) => [g.name, g.rsd, COLORS[g.name]]),
      ...(b.savings ? [['Отложить', b.savings.rsd, COLORS.Отложить]] : [])];
    alloc = parts.map(([name, v, color]) => ({ name, sum: fmt(v), share: b.income.rsd ? v / b.income.rsd : 0,
      color: color || '#5ac8fa' }));
  }
  const lim = b.limits;
  return {
    title: `Бюджет · ${monthTitle(b.month)}`,
    sub: b.income ? 'куда идёт доход' : 'обязательные траты и лимиты месяца',
    income,
    alloc,
    groups: b.groups.map((g) => ({ name: g.name, sum: fmt(g.rsd), sub: g.avg_months ? `в среднем за ${g.avg_months} мес.` : '',
      rows: g.rows.map((r) => ({ name: r.name, sum: fmt(r.rsd), note: strip(r.note) })) })),
    savings: b.savings ? { name: 'Отложить', sum: fmt(b.savings.rsd), note: b.savings.set || '' } : null,
    norm: b.norm == null ? null : { name: 'На переменные траты (норма)', sum: fmt(b.norm) },
    limits: {
      title: `Лимиты — ${fmt(lim.rsd)}`,
      sub: lim.eur ? `${fmt(lim.eur)} €` : '',
      rows: lim.rows.map((r) => ({ name: r.name, sum: fmt(r.rsd),
        note: [r.set, r.hot != null ? `скрытый, виден от ${r.hot} %` : '', r.off_norm ? 'вне нормы' : '']
          .filter(Boolean).join(' · ') })),
    },
    free: b.free == null ? null : b.free >= 0 ? { text: `Без лимита из нормы: ${fmt(b.free)}`, tone: '' }
      : { text: `Лимиты больше нормы на ${fmt(-b.free)}`, tone: 'bad' },
    plan: b.plan ? planView(b.plan, word) : null,
  };
}

function planView(p, word) {
  const have = Object.fromEntries(Object.entries(p.have).filter(([, v]) => v));   // динары первыми, как в остатках
  return {
    title: `Деньги на ${word}`,
    have: `На счетах и в нале: ${fmt(p.have_rsd)} RSD`,
    haveSub: amounts(have),
    need: `Нужно на месяц: ${fmt(p.need)} RSD`,
    parts: p.parts.map((x) => `${x.name} ${fmt(x.rsd)}`),
    verdict: p.transfer
      ? { text: `Перевести себе с ПР: ${fmt(p.transfer)} RSD${p.transfer_eur ? ` (≈ ${p.transfer_eur})` : ''}`, tone: 'warn' }
      : { text: `Переводить с ПР не нужно: хватает, сверху ${fmt(p.spare)} RSD`, tone: 'good' },
    salary: p.salary ? `Зарплата (~${fmt(p.salary)}) придёт в конце месяца — уйдёт в остаток к следующему 1-му.` : '',
  };
}
