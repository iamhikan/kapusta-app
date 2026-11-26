// «Бюджет» (этап 7) — продолжение «Все лимиты» на «Здоровье»: ответ /api/budget -> что видит человек. Куда идёт доход
// (fin limits) и деньги на месяц (fin plan) — только Алексею: Ангелине сервер их не шлёт (решение 11).
import { amountLines, fmt, OVER_HINT } from './health.js';
import { monthTitle } from './ops.js';
import { FX, dealOf, regularOf } from './regular.js';

const FOR_MONTH = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь',
  'ноябрь', 'декабрь'];
// доли дохода: норма — акцент темы, остальное — свои спокойные цвета (те же на светлой и тёмной теме)
const COLORS = { norm: 'var(--accent)', Обязательные: '#8d6e63', 'Регулярные платежи': '#e8833a', ПР: '#a1a1a6',
  Отложить: '#1f8f4e' };
const NORM = 'Норма — переменные траты';   // решение 59: одна подпись нормы на экране
const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];

// решение 82: /api/budget label лимита не шлёт (его шлёт только /api/health) — строка лимита словом приложения, в
// «Операции» уходит имя budget.yaml (key)
const LABEL = { 'курсовые разницы': 'обмен валюты' };

const strip = (s) => (s || '').replace(/^\(|\)$/g, '');
// решение 61: «в ср. с 05.2026» сервера — «в среднем с мая 2026», «в ср.» — «в среднем»; решение 98 (ответ 6):
// «медиана за 3 мес.» — «обычно за месяц» (слово статистики Ангелине ничего не даёт)
const avg = (s) => s.replace(/^в ср\.(?: с (\d\d)\.(\d{4}))?/, (_, m, y) => (m ? `в среднем с ${OF_MONTH[Number(m) - 1]} ${y}` : 'в среднем'))
  .replace(/^медиана за \d+ мес\.$/, 'обычно за месяц');

// R-15 (ревью 26.11): под суммой строки — одно понятие словами. Жильё и кредит РФ — basis сервера, как в шапке их
// «Операций» («по договору 650 €», «по графику 25 000 ₽»); сумма регулярной из budget.yaml («5 €») — «в норме 5 €»
const BARE = /^[\d\s\u00a0]+(?:[,.]\d+)?\s?(?:€|₽|\$|RSD|EUR|RUB)$/u;

function noteOf(r, regularGroup, env) {
  const note = avg(strip(r.note));
  const e = env.get(r.name);
  if (e && e.contract && e.basis) return e.basis;
  return regularGroup && BARE.test(note) ? `в норме ${note}` : note;
}

// значки групп — как метки в «Операциях» и в чате (решение 97): 📌 обязательные, 🔁 регулярные
const GLYPH = { Обязательные: '📌' };
const glyphOf = (name) => GLYPH[name] || (/^Регулярные/.test(name) ? '🔁' : '');

// R-11 (решение 98, ответ 5): строка регулярной (и коммуналки) — потрачено против суммы в норме и полоса, как у лимита
// (решение 78, правка 1): перебор — плашкой «+N», штриховкой и подписью про «Потрачено», как на «Здоровье» (R-9).
// Числа — envelopes «Здоровья» месяца; limit — сумма с конвертом (спортпит), под полосой — из чего она. Вернули больше,
// чем потратили (обмен с выигрышем, R-13), — без полосы и «из»: «+189», словами — в подписи. Повтор ревью p46a (язык):
// «выигрыш на обмене» (было «к курсу НБС»), «сверх нормы» (было «перебор») — как на «Здоровье» и в чате
function withGauge(row, e, note) {
  if (e.spent < 0) {
    const word = row.name === FX ? 'выигрыш на обмене' : 'вернули больше, чем потратили';
    return { ...row, sum: `+${fmt(-e.spent)}`, note: [word, BARE_NOTE.test(note) ? note : ''].filter(Boolean).join(' · ') };
  }
  const over = e.over > 0;
  const limitAt = over ? e.limit / e.spent : null;
  const hint = over ? OVER_HINT
    : e.carry ? `в норме ${fmt(e.norm)} + конверт ${fmt(e.carry)}` : BARE_NOTE.test(note) ? note : '';
  return { ...row, note: '', gauge: { name: row.name, focus: `regular:${row.name}`, spent: fmt(e.spent), limit: fmt(e.limit),
    over: over ? `сверх\u00a0${fmt(e.over)}` : '', fill: limitAt ?? (e.limit > 0 ? Math.min(1, e.spent / e.limit) : 0), limitAt,
    color: over ? 'var(--bad)' : 'var(--bar-green)', state: '', hint } };
}
const BARE_NOTE = /^в норме /;

// решение 81: месяц без курса (до начала учёта) — сервер шлёт пустой бюджет: дохода, групп, лимитов, нормы и плана нет.
// Слово — как плашка «Здоровья» (zone.word): /api/budget zone не шлёт
const NONE = { sub: 'нормы нет', title: 'Бюджета нет', text: 'Месяц до начала учёта.' };

// health — «Здоровье» того же месяца (если в памяти): какие строки регулярные (E10), см. regular.js
export function budgetView(b, health = null) {
  const word = FOR_MONTH[Number(b.month.slice(5)) - 1];
  if (b.norm == null && !b.income && !b.groups.length && !b.limits.rows.length && !b.plan) {
    return { title: `Бюджет · ${monthTitle(b.month)}`, sub: NONE.sub, empty: { title: NONE.title, text: NONE.text } };
  }
  const income = b.income ? { label: 'Доход ПР', value: fmt(b.income.rsd), set: b.income.set || '' } : null;
  let alloc = [];
  if (b.income) {
    const parts = [[NORM, b.norm, COLORS.norm], ...b.groups.map((g) => [g.name, g.rsd, COLORS[g.name]]),
      ...(b.savings ? [['Отложить', b.savings.rsd, COLORS.Отложить]] : [])];
    alloc = parts.map(([name, v, color]) => ({ name, sum: fmt(v), share: b.income.rsd ? v / b.income.rsd : 0,
      color: color || '#5ac8fa' }));
  }
  const lim = b.limits;
  // коммуналка (решение 94): в «Обязательных» и в «Деньгах на месяц» — одна доля семьи, доля ПР — строка «ПР
  // коммуналка» в группе ПР; пометок «с долей ПР» и «без доли ПР» больше нет
  const regular = regularOf(b, health);   // E10: строка регулярной нажимается — её операции и градусник
  const env = new Map(((health && health.envelopes) || []).map((e) => [e.key, e]));
  return {
    title: `Бюджет · ${monthTitle(b.month)}`,
    sub: b.income ? 'куда идёт доход' : 'обязательные траты и лимиты месяца',
    income,
    alloc,
    groups: b.groups.map((g) => {
      const rows = g.rows.map((r) => {
        const row = { name: r.name, sum: fmt(r.rsd), note: noteOf(r, /^Регулярные/.test(g.name), env),
          ...(g.name !== 'ПР' && regular(r.name) ? { regular: regular(r.name) } : {}) };
        const e = row.regular && env.get(r.name);
        // R-12: жильё и кредит РФ — «✓ оплачено» в валюте договора и разница строкой; fin до p46a — подпись, как была
        const deal = e && e.contract ? dealOf(e, !!health.closed) : null;
        if (deal) return { ...row, note: '', deal: { paid: deal.paid, status: deal.status, terms: deal.terms, rate: deal.rate } };
        return e && !e.contract ? withGauge(row, e, row.note) : row;
      });
      // R-11: у группы регулярных — сколько ушло из её суммы (envelopes есть у каждой строки)
      const spent = g.rows.map((r) => env.get(r.name));
      const gone = /^Регулярные/.test(g.name) && spent.length && spent.every(Boolean)
        ? `ушло\u00a0${fmt(spent.reduce((x, e) => x + e.spent, 0))} из\u00a0${fmt(g.rsd)}` : '';   // узко — перенос только перед «из»
      return { name: g.name, glyph: glyphOf(g.name), sum: gone || fmt(g.rsd),
        sub: g.avg_months ? `в среднем за ${g.avg_months} мес.` : '', rows };
    }),
    savings: b.savings ? { name: 'Отложить', sum: fmt(b.savings.rsd), note: b.savings.set || '' } : null,
    norm: b.norm != null ? { name: NORM, sum: fmt(b.norm) } : b.norm_parts ? normOf(b.norm_parts) : null,
    limits: {
      title: `Лимиты — ${fmt(lim.rsd)}`,
      sub: lim.eur ? `${fmt(lim.eur)} €` : '',
      rows: lim.rows.map((r) => ({ key: r.name, name: LABEL[r.name] ?? r.name, sum: fmt(r.rsd),
        note: [r.set, r.hot != null ? `скрытый, виден от ${r.hot} %` : '', r.off_norm ? 'вне нормы' : '']
          .filter(Boolean).join(' · ') })),
    },
    free: b.free == null ? null : b.free >= 0 ? { text: `Резерв (норма без лимитов): ${fmt(b.free)}`, tone: '' }   // решение 59: как на «Здоровье»
      : { text: `Лимиты больше нормы на ${fmt(-b.free)}`, tone: 'bad' },
    plan: b.plan ? planView(b.plan, word, b.month) : null,
  };
}

// S9C (находка 3 повтора ревью 26.11): Ангелине — из чего норма без дохода ПР: её лимиты и резерв (norm_parts fin)
function normOf(p) {
  // слово и число — неразрывно: узко — перенос только перед «+» или «—»
  const note = p.reserve >= 0 ? `лимиты\u00a0${fmt(p.limits)} + резерв\u00a0${fmt(p.reserve)}`
    : `лимиты\u00a0${fmt(p.limits)} — больше нормы на\u00a0${fmt(-p.reserve)}`;
  return { name: NORM, sum: fmt(p.norm), note };
}

// правка 5 (ui-ux-pro-max, 13.11): вывод — первым (плашка словом и значком, что делать, сколько), «есть» и «нужно» —
// двумя числами рядом и полосой «нужно из того, что есть»; разбивка — под «Из чего суммы» (было: четыре абзаца)
function planView(p, word, month) {
  const m = Number(month.slice(5));
  const have = Object.fromEntries(Object.entries(p.have).filter(([, v]) => v));   // динары первыми, как в остатках
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
    parts: p.parts.map((x) => `${x.name} ${fmt(x.rsd)}`),
    salary: p.salary ? `Зарплата ~${fmt(p.salary)} придёт в конце месяца и уйдёт в остаток к 1 ${OF_MONTH[m % 12]}.` : '',
  };
}
