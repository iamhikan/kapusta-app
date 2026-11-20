// Регулярная трата и её градусник (решение 86; E10, Алексей 20.11.2026: «нажать на категорию регулярных трат и
// увидеть все её транзакции, внутри — свой градусник»). Строки «Регулярных платежей» и коммуналки в «Бюджете»
// нажимаются: «Операции» с regular=<имя>, в шапке — потрачено против суммы в норме (у спортпита — с конвертом).
// Числа — сервера, страница их не считает: envelopes /api/health — все регулярные месяца; прежний сервер — regulars
// (только перебор: сумма с конвертом) и строка «Бюджета» (сумма в норме, конверт неизвестен).

// группа регулярных в /api/budget: «Регулярные по карте» сервера, «Регулярные платежи» — словами страницы (api.js)
const isRegularGroup = (g) => /^Регулярные/.test(g.name);

function envelope(key, health) {
  if (!health) return null;
  return (health.envelopes || []).find((e) => e.key === key) || (health.regulars || []).find((e) => e.key === key) || null;
}

// имя строки «Бюджета» -> ключ regular= или null. С envelopes — его ключи (и коммуналка без перебора); прежний
// сервер — вся группа регулярных и строки с перебором (коммуналка). Жильё и кредит РФ — сумма по договору, перебора
// у них нет (fin: over_kinds), операций по regular= сервер не даёт
export function regularOf(budget, health) {
  // коммуналку прежнего сервера выдаёт и часть «Денег на месяц» с full (доля семьи — только Алексею)
  const known = health && health.envelopes ? new Set(health.envelopes.map((e) => e.key))
    : new Set([...(budget.groups || []).filter(isRegularGroup).flatMap((g) => g.rows.map((r) => r.name)),
      ...((health && health.regulars) || []).map((e) => e.key),
      ...(budget.plan ? budget.plan.parts.filter((x) => x.full != null).map((x) => x.name) : [])]);
  return (name) => (known.has(name) ? name : null);
}

// сумма в норме по строке «Бюджета»: у коммуналки Алексею «Обязательные» — средняя с долей ПР, в норме — доля семьи
// (часть «Денег на месяц» с full)
function inNorm(key, budget) {
  if (!budget) return null;
  const part = budget.plan && budget.plan.parts.find((p) => p.name === key && p.full != null);
  if (part) return { rsd: part.rsd, basis: 'доля семьи' };
  const r = (budget.groups || []).flatMap((g) => g.rows).find((x) => x.name === key);
  return r ? { rsd: r.rsd, basis: '' } : null;
}

// градусник регулярной за месяц -> { limit, norm, carry, over, basis } или null (данных нет): limit — сколько входит
// в норму (сумма и конверт), carry — конверт (null — неизвестен), over — перебор по слову сервера (null — не знаем),
// basis — на чём сумма словами сервера («медиана за 3 мес.», «доля семьи, …»): у коммуналки в «Обязательных» Алексею
// стоит средняя с долей ПР, а в норме — доля семьи
export function gaugeOf(key, health, budget) {
  const e = envelope(key, health);
  if (e) return { limit: e.limit, norm: e.norm ?? e.limit, carry: e.carry || 0, over: e.over > 0, basis: e.basis || '' };
  const n = inNorm(key, budget);
  if (n == null) return null;
  // прежний сервер шлёт regulars только при переборе: «Здоровье» месяца есть, строки нет — перебора нет
  return { limit: n.rsd, norm: n.rsd, carry: null, over: health ? false : null, basis: n.basis };
}
