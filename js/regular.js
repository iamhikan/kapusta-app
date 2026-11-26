// Регулярная трата и её градусник (решение 86; E10, Алексей 20.11.2026: «нажать на категорию регулярных трат и
// увидеть все её транзакции, внутри — свой градусник»). Строки «Регулярных платежей» и коммуналки в «Бюджете»
// нажимаются: «Операции» с regular=<имя>, в шапке — потрачено против суммы в норме (у спортпита — с конвертом).
// С E14 (Алексей 20.11.2026: «давай») — и жильё с кредитом РФ: платёж месяца против суммы по договору.
// Числа — сервера, страница их не считает: envelopes /api/health — все регулярные месяца, коммуналка (доля семьи,
// решение 94), E13, и жильё с кредитом РФ (contract: true), E14. Ответ без envelopes (снимок, сервер до E13) —
// regulars (только перебор: сумма с конвертом) и строка «Бюджета» (сумма в норме, конверт неизвестен).

// регулярная «обмен валюты» (budget.yaml/regular, решение 88): её сумма — разница к курсу НБС, итог меньше нуля — выигрыш
export const FX = 'обмен валюты';

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
// конверта у редкой (спортпит): пустой месяц у неё — так и задумано (R-14)
export function gaugeOf(key, health, budget) {
  const e = envelope(key, health);
  if (e) {
    return { limit: e.limit, norm: e.norm ?? e.limit, carry: e.carry || 0, over: e.over > 0, basis: e.basis || '',
      contract: !!e.contract, cap: e.cap || 0 };
  }
  const n = inNorm(key, budget);
  if (n == null) return null;
  // без envelopes regulars приходят только при переборе: «Здоровье» месяца есть, строки нет — перебора нет
  return { limit: n, norm: n, carry: null, over: health ? false : null, basis: '' };
}
