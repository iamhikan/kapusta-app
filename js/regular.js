// Регулярная трата и её градусник (решение 86; E10, Алексей 20.11.2026: «нажать на категорию регулярных трат и
// увидеть все её транзакции, внутри — свой градусник»). Строки «Регулярных платежей» и коммуналки в «Бюджете»
// нажимаются: «Операции» с regular=<имя>, в шапке — потрачено против суммы в норме (у спортпита — с конвертом).
// С E14 (Алексей 20.11.2026: «давай») — и жильё с кредитом РФ: платёж месяца против суммы по договору.
// Числа — сервера, страница их не считает: envelopes /api/health — все регулярные месяца, коммуналка (доля семьи,
// решение 94), E13, и жильё с кредитом РФ (contract: true), E14. Ответ без envelopes (снимок, сервер до E13) —
// regulars (только перебор: сумма с конвертом) и строка «Бюджета» (сумма в норме, конверт неизвестен).

import { fmt } from './health.js';

// регулярная «обмен валюты» (budget.yaml/regular, решение 88): её сумма — разница к курсу НБС, итог меньше нуля — выигрыш
export const FX = 'обмен валюты';

const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const SIGN = { EUR: '€', RUB: '₽' };
const money = (a) => `${fmt(a.number)}\u00a0${SIGN[a.currency] || a.currency}`;
// R-15 (решение 98, ответ 6): «медиана за 3 мес.» прежнего fin — «обычно за месяц», как fin с p46a
const usual = (s) => s.replace(/^медиана за \d+ мес\.$/, 'обычно за месяц');
// «25 000 ₽» сервера — одной строкой: при 320 px было «по графику 25 / 000 ₽»
const keep = (s) => s.replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d) (?=[€₽])/g, '$1\u00a0');

// дни платежей месяца: «11 ноября», «4 и 20 ноября», «4, 11 и 20 ноября»
function payDays(on) {
  const d = on.map((x) => String(Number(x.slice(8))));
  const list = d.length > 1 ? `${d.slice(0, -1).join(', ')} и ${d.at(-1)}` : d[0];
  return `${list} ${OF_MONTH[Number(on[0].slice(5, 7)) - 1]}`;
}

// R-12 (решение 98, ответ 5): договорный платёж (жильё, кредит РФ) — «оплачено» или «ждёт оплаты» в валюте договора,
// а не лимит. e — строка envelopes с contract (due, paid, paid_on — fin с p46a; без них — null: страница пишет, как
// раньше). status — «✓ оплачено 11 ноября», «ждёт оплаты», у закрытого месяца без платежа — «платежа не было»; sum —
// платёж (до оплаты — сумма по договору) в валюте договора; terms — «по договору 650 €», а если платёж в валюте
// договора другой — и он («24 937 ₽, по графику 25 000 ₽»); rate — разница с суммой в норме (курс дня оплаты против
// курса 1-го): в «Потрачено» не идёт (E14)
export function dealOf(e, closed = false) {
  if (!e || !e.contract || !e.due || !e.paid) return null;
  const paid = (e.paid_on || []).length > 0;
  const same = Math.abs(e.paid.number - e.due.number) < 0.005;
  const diff = Math.round(e.spent - e.norm);
  return {
    paid,
    sum: money(paid ? e.paid : e.due),
    status: paid ? `✓ оплачено ${payDays(e.paid_on)}` : closed ? 'платежа не было' : 'ждёт оплаты',
    terms: keep(paid && !same ? `${money(e.paid)}, ${e.basis}` : e.basis),
    rate: paid && diff ? `разница с нормой\u00a0${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}: курс дня оплаты`
      + `${same ? '' : ' и сумма платежа'}, в «Потрачено» не идёт` : '',
  };
}

// группа регулярных в /api/budget: «Регулярные по карте» сервера, «Регулярные платежи» — словами страницы (api.js)
const isRegularGroup = (g) => /^Регулярные/.test(g.name);

function envelope(key, health) {
  if (!health) return null;
  return (health.envelopes || []).find((e) => e.key === key) || (health.regulars || []).find((e) => e.key === key) || null;
}

// имя строки «Бюджета» -> ключ regular= или null. С envelopes — его ключи (с E14 — и жильё, кредит РФ); без них — вся
// группа регулярных и строки с перебором (коммуналка): у жилья и кредита РФ перебора нет, и сервер до E14 regular=
// для них не принимает. Строки ПР («ПР коммуналка») — не в семейном «Потрачено»: ни в envelopes, ни в группе
export function regularOf(budget, health) {
  const known = health && health.envelopes ? new Set(health.envelopes.map((e) => e.key))
    : new Set([...(budget.groups || []).filter(isRegularGroup).flatMap((g) => g.rows.map((r) => r.name)),
      ...((health && health.regulars) || []).map((e) => e.key)]);
  return (name) => (known.has(name) ? name : null);
}

// сумма в норме по строке «Бюджета» (ответ без envelopes): у коммуналки — доля семьи (решение 94)
function inNorm(key, budget) {
  if (!budget) return null;
  const r = (budget.groups || []).flatMap((g) => g.rows).find((x) => x.name === key);
  return r ? r.rsd : null;
}

// градусник регулярной за месяц -> { limit, norm, carry, over, basis, contract } или null (данных нет): limit —
// сколько входит в норму (сумма и конверт), carry — конверт (null — неизвестен), over — перебор по слову сервера
// (null — не знаем), basis — на чём сумма словами сервера («медиана за 3 мес.», «доля семьи, …», «по договору 650 €»),
// contract — жильё и кредит РФ (E14): их «сверх» — курс дня оплаты, не перебор, в «Потрачено» не идёт; cap — предел
// конверта у редкой (спортпит): пустой месяц у неё — так и задумано (R-14); deal — договорный платёж словами (R-12)
export function gaugeOf(key, health, budget) {
  const e = envelope(key, health);
  if (e) {
    return { limit: e.limit, norm: e.norm ?? e.limit, carry: e.carry || 0, over: e.over > 0, basis: keep(usual(e.basis || '')),
      contract: !!e.contract, cap: e.cap || 0, deal: dealOf(e, !!health.closed) };
  }
  const n = inNorm(key, budget);
  if (n == null) return null;
  // без envelopes regulars приходят только при переборе: «Здоровье» месяца есть, строки нет — перебора нет
  return { limit: n, norm: n, carry: null, over: health ? false : null, basis: '' };
}
