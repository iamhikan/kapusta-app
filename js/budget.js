// «Бюджет» (этап 7) — продолжение «Все лимиты» на «Здоровье»: ответ /api/budget -> что видит человек. Куда идёт доход
// (fin limits) и деньги на месяц (fin plan) — только Алексею: Ангелине сервер их не шлёт (решение 11).
import { amountLines, fmt } from './health.js';
import { monthTitle } from './ops.js';

const FOR_MONTH = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь',
  'ноябрь', 'декабрь'];
// доли дохода: норма — акцент темы, остальное — свои спокойные цвета (те же на светлой и тёмной теме)
const COLORS = { norm: 'var(--accent)', Обязательные: '#8d6e63', 'Регулярные платежи': '#e8833a', ПР: '#a1a1a6',
  Отложить: '#1f8f4e' };
const NORM = 'Норма — переменные траты';   // решение 59: одна подпись нормы на экране
const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];

const strip = (s) => (s || '').replace(/^\(|\)$/g, '');
// решение 61: «в ср. с 05.2026» сервера — «в среднем с мая 2026», «в ср.» — «в среднем»
const avg = (s) => s.replace(/^в ср\.(?: с (\d\d)\.(\d{4}))?/, (_, m, y) => (m ? `в среднем с ${OF_MONTH[Number(m) - 1]} ${y}` : 'в среднем'));

export function budgetView(b) {
  const word = FOR_MONTH[Number(b.month.slice(5)) - 1];
  const income = b.income ? { label: 'Доход ПР', value: fmt(b.income.rsd), set: b.income.set || '' } : null;
  let alloc = [];
  if (b.income) {
    const parts = [[NORM, b.norm, COLORS.norm], ...b.groups.map((g) => [g.name, g.rsd, COLORS[g.name]]),
      ...(b.savings ? [['Отложить', b.savings.rsd, COLORS.Отложить]] : [])];
    alloc = parts.map(([name, v, color]) => ({ name, sum: fmt(v), share: b.income.rsd ? v / b.income.rsd : 0,
      color: color || '#5ac8fa' }));
  }
  const lim = b.limits;
  // коммуналка: в «Обязательных» — средняя вместе с долей ПР, в «Деньгах на месяц» — доля семьи (ревью: 9 341 и
  // 8 427 без подписи). Часть плана с full — доля семьи; прежний сервер full не шлёт — без подписей
  const shared = new Set(b.plan ? b.plan.parts.filter((x) => x.full != null).map((x) => x.name) : []);
  const prShare = (r) => shared.has(r.name);
  return {
    title: `Бюджет · ${monthTitle(b.month)}`,
    sub: b.income ? 'куда идёт доход' : 'обязательные траты и лимиты месяца',
    income,
    alloc,
    groups: b.groups.map((g) => ({ name: g.name, sum: fmt(g.rsd), sub: g.avg_months ? `в среднем за ${g.avg_months} мес.` : '',
      rows: g.rows.map((r) => ({ name: r.name, sum: fmt(r.rsd),
        note: [avg(strip(r.note)), prShare(r) ? 'с долей ПР' : ''].filter(Boolean).join(' · ') })) })),
    savings: b.savings ? { name: 'Отложить', sum: fmt(b.savings.rsd), note: b.savings.set || '' } : null,
    norm: b.norm == null ? null : { name: NORM, sum: fmt(b.norm) },
    limits: {
      title: `Лимиты — ${fmt(lim.rsd)}`,
      sub: lim.eur ? `${fmt(lim.eur)} €` : '',
      rows: lim.rows.map((r) => ({ name: r.name, sum: fmt(r.rsd),
        note: [r.set, r.hot != null ? `скрытый, виден от ${r.hot} %` : '', r.off_norm ? 'вне нормы' : '']
          .filter(Boolean).join(' · ') })),
    },
    free: b.free == null ? null : b.free >= 0 ? { text: `Резерв (норма без лимитов): ${fmt(b.free)}`, tone: '' }   // решение 59: как на «Здоровье»
      : { text: `Лимиты больше нормы на ${fmt(-b.free)}`, tone: 'bad' },
    plan: b.plan ? planView(b.plan, word, b.month) : null,
  };
}

// правка 5 (ui-ux-pro-max, 13.11): вывод — первым (плашка словом и значком, что делать, сколько), «есть» и «нужно» —
// двумя числами рядом и полосой «нужно из того, что есть»; разбивка — под «Из чего суммы» (было: четыре абзаца)
function planView(p, word, month) {
  const m = Number(month.slice(5));
  const have = Object.fromEntries(Object.entries(p.have).filter(([, v]) => v));   // динары первыми, как в остатках
  const label = (x) => (x.full != null ? `${x.name} без доли ПР` : x.name);
  const share = p.have_rsd > 0 ? p.need / p.have_rsd : 1;
  return {
    title: `Деньги на ${word}`,
    verdict: p.transfer
      ? { word: 'не хватает', text: 'Перевести себе с ПР', value: `${fmt(p.transfer)} RSD${p.transfer_eur ? ` (≈ ${p.transfer_eur})` : ''}`,
        tone: 'warn' }
      : { word: 'хватает', text: 'Переводить с ПР не нужно', value: `сверху ${fmt(p.spare)} RSD`, tone: 'good' },
    // решение 60: имя — как у итога на «Здоровье», дата — явно (fin plan считает на утро 1-го, «Здоровье» — сейчас);
    // итог «≈» по курсу НБС, слагаемые через «+» — в разбивке (ревью: «1 752 566» над «175 362 RSD» — как опечатка)
    have: { label: `Наличные и карты на 1 ${OF_MONTH[m - 1]}`, value: `≈ ${fmt(p.have_rsd)}`, sub: `${amountLines(have).join(' + ')} по курсу НБС` },
    need: { label: 'Нужно на месяц', value: fmt(p.need) },
    fill: Math.max(0, Math.min(1, share)),
    ratio: `нужно — ${Math.round(share * 100)} % того, что есть`,
    parts: p.parts.map((x) => `${label(x)} ${fmt(x.rsd)}`),
    salary: p.salary ? `Зарплата ~${fmt(p.salary)} придёт в конце месяца и уйдёт в остаток к 1 ${OF_MONTH[m % 12]}.` : '',
  };
}
