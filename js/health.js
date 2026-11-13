// «Здоровье»: ответ /api/health -> что видит человек. Только строки и доли; цифры считает сервер (fin api), страница
// их не пересчитывает и не фильтрует: что видит зритель, решает сервер.
import { tileOf } from './tiles.js';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь',
  'Ноябрь', 'Декабрь'];
const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const SYMBOL = { EUR: '€', RUB: '₽' };
const FOR_MONTH = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь',
  'ноябрь', 'декабрь'];
// fast — выше плана на сегодня (решение 46); none — месяц без курса, нормы нет (решение 81): плашка серая, как ⚪️ в чате
const ZONE = { ok: 'good', fast: 'fast', savings: 'warn', over: 'bad', none: 'muted' };
// решение 50: «тратим быстрее плана» шлёт сервер; прежний сервер (и снимок до p14a) — «быстрее плана»
const OLD_WORD = { 'быстрее плана': 'тратим быстрее плана' };
// решение 49: легенда цветов полосок — одной строкой у «Лимиты»; решение 69: один цвет — один смысл, в легенде —
// только цвета, которые есть в полосках месяца (было: красный «сверх лимита», а покрытый перерасход — оранжевый)
const COVERED = 'var(--bar-orange)';   // перерасход, который покрыл резерв (решение 63)
const LEGEND = [{ text: 'в плане', color: 'var(--bar-green)' }, { text: 'выше плана', color: 'var(--bar-yellow)' },
  { text: 'покрыто резервом', color: COVERED }, { text: 'сверх лимита', color: 'var(--bad)' }];
const LEGEND_CLOSED = [{ text: 'в лимите', color: 'var(--bar-green)' }, ...LEGEND.slice(2)];
// решение 82 (Б6, М5): цвет полоски и слово диктору — по state лимита, точке градусника в чате (gauge.state): свои
// пороги и своё «покрыто резервом» страница больше не считает. Итог месяца: в плане — «в лимите»
const COLOR = { ok: 'var(--bar-green)', fast: 'var(--bar-yellow)', over: 'var(--bad)', covered: COVERED };
const SAY = { ok: 'в плане', fast: 'выше плана', over: 'сверх лимита', covered: 'сверх лимита, покрыто резервом' };
export const TOP = 6;   // лимитов сразу; остальные — по «Все N»
// группы остатков (решение 48), порядок показа; прежний сервер без group — одна группа без заголовка
const GROUPS = [['cash', 'Наличные'], ['cards', 'Карты и счета'], ['business', 'Бизнес'], ['debts', 'Долги']];

export function fmt(n) {
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + s;
}

export function amountLines(obj) {
  // динары первыми, остальные валюты — по алфавиту: «150 000 RSD», «1 000 €»
  const order = Object.keys(obj).sort((a, b) => (a !== 'RSD') - (b !== 'RSD') || a.localeCompare(b));
  return order.map((cur) => `${fmt(obj[cur])} ${SYMBOL[cur] || cur}`);
}

export const amounts = (obj) => amountLines(obj).join(' · ');

function balanceGroups(balances) {
  // решения 47, 48: строка — плитка, имя, суммы в две строки; группы по типу, у прежнего сервера — одна без заголовка
  const row = (b) => ({ name: upper(b.name), lines: amountLines(b.amounts || {}), tile: tileOf(b.account, b.name),
    ops: { account: b.account } });
  if (!balances.some((b) => b.group)) return balances.length ? [{ title: '', rows: balances.map(row) }] : [];
  return GROUPS.map(([key, title]) => ({ title, rows: balances.filter((b) => (b.group || 'cards') === key).map(row) }))
    .filter((g) => g.rows.length);
}

export function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function when(stamp) {
  // «2026-11-11 08:11» (время записи ботом) или «2026-11-11» -> «11.11 в 08:11» / «11.11»
  const [day, time] = String(stamp).split(/[ T]/);
  const [, m, d] = day.split('-');
  return `${d}.${m}` + (time ? ` в ${time.slice(0, 5)}` : '');
}

// легенда: только цвета полосок месяца (решение 69); у цвета перерасхода — образец штриховкой, метка «лимит» —
// если есть строка сверх лимита (правка 1)
function legendOf(limits, closed) {
  const over = limits.filter((r) => r.limitAt != null);
  const items = (closed ? LEGEND_CLOSED : LEGEND).filter((l) => limits.some((r) => r.color === l.color))
    .map((l) => (over.some((r) => r.color === l.color) ? { ...l, hatch: true } : l));
  return over.length ? [...items, { text: 'лимит', mark: true }] : items;
}

function reserveHit(limits) {
  // резерв — строка с eaten: его сжал перерасход других лимитов (fin budget, решения 28, 51); hit — чей перерасход.
  // short — резерв кончился и покрыл не всё: сервер тогда не ставит covered никому, и перерасход — over (решение 82)
  const res = limits.find((l) => l.eaten);
  if (!res) return null;
  const hit = limits.filter((l) => l.over > 0 && l !== res);
  return { res, hit, short: hit.some((l) => l.state === 'over') };
}

const quoted = (rows) => rows.map((l) => `«${l.label}»`).join(', ');

function reserveNote(r) {
  // из чего резерв и чей перерасход покрыл (решение 51); частично — только когда он кончился (critique 12.11)
  if (!r) return '';
  return `Резерв: свои ${fmt(r.res.spent - r.res.eaten)} + перерасход других ${fmt(r.res.eaten)} — покрыл `
    + `${quoted(r.hit)}${r.short ? ' частично' : ''}.`;
}

function curveNote(h) {
  // решение 81: нормы нет — итог или прогноз без сравнения с нормой
  if (h.norm == null) return { text: h.closed ? `итог ${fmt(h.spent)}` : `прогноз ${fmt(h.forecast)}`, tone: '' };
  if (h.closed) {
    if (!h.curve.length) {   // кривая отрезана в снимке (решение 32) — по итогу
      return h.spent > h.norm ? { text: `итог ${fmt(h.spent)} · сверх нормы на ${fmt(h.spent - h.norm)}`, tone: 'bad' }
        : { text: `итог ${fmt(h.spent)} · в пределах нормы`, tone: 'good' };
    }
    const crossed = h.curve.find(([, total]) => total > h.norm);
    if (!crossed) return { text: `итог ${fmt(h.spent)} · в пределах нормы`, tone: 'good' };
    return { text: `итог ${fmt(h.spent)} · норма кончилась ${crossed[0]} ${OF_MONTH[Number(h.month.slice(5)) - 1]}`,
      tone: 'bad' };
  }
  if (h.spent > h.norm) return { text: `сверх нормы на ${fmt(h.spent - h.norm)}`, tone: 'bad' };
  if (h.forecast > h.norm) return { text: `прогноз ${fmt(h.forecast)} · выше нормы на ${fmt(h.forecast - h.norm)}`, tone: 'warn' };
  return { text: `прогноз ${fmt(h.forecast)} · в пределах нормы`, tone: 'good' };
}

function scaleOf(h) {
  // решение 49: под полоской — доля нормы; план на сегодня — подписью у черты. Норма — уже в «из N» у крупного числа
  // доля — у «Потрачено» коротко («Потрачено · 50 %»): рядом плашка, «из N» — строкой ниже
  // М9: норма 0 или меньше (обязательные съели доход) — доли и плана нет, как в градуснике чата (было: «Infinity %»)
  if (!(h.norm > 0)) return { pct: '', plan: '', aria: h.spent > h.norm ? 'сверх нормы' : 'в пределах нормы' };
  const pct = `${Math.round((h.spent / h.norm) * 100)} %`;
  const plan = h.closed ? '' : `план на сегодня ${fmt(h.plan_today)}`;
  return { pct, plan, aria: [`${pct} нормы`, plan].filter(Boolean).join(', ') };
}

export function view(h) {
  const [y, m] = h.month.split('-').map(Number);
  const rated = h.norm != null;   // решение 81: месяц без курса (до начала учёта) — нормы, плана и лимитов нет
  const plan = h.closed ? 1 : h.day / h.days;
  const over = h.left < 0;
  const overCount = h.limits.filter((l) => l.state === 'over' || l.state === 'covered').length;
  const rv = reserveHit(h.limits);

  // решение 26: крупно — потрачено; осталось (или сверх нормы) — первым в строке чисел
  const left = over ? { label: 'Сверх нормы', value: fmt(-h.left), tone: 'bad' }
    : { label: 'Осталось из нормы', value: fmt(h.left), tone: '' };
  const first = h.closed
    ? { label: 'Регулярные', value: fmt(h.regular), tone: '' }   // решение 44: «Вне лимитов» нет
    : { label: 'Можно в день', value: h.per_day == null ? 'норма исчерпана' : `~${fmt(h.per_day)}`,
      tone: h.per_day == null ? 'bad' : '' };
  // «Весь доход» сервер шлёт только Алексею (решение 11); без него — сколько лимитов сверх, а если перерасход покрыл
  // резерв — сколько в резерве осталось (решение 63: не красный счётчик, когда тревоги нет)
  const second = h.available
    ? (h.available.left >= 0
      ? { label: 'Весь доход, осталось', value: fmt(h.available.left), tone: '' }
      : { label: 'Сверх дохода', value: fmt(-h.available.left), tone: 'bad' })
    : rv && !rv.short ? { label: 'Резерв, осталось', value: fmt(rv.res.limit - rv.res.spent), tone: '' }
      : { label: 'Лимитов сверх', value: `${overCount} из ${h.limits.length}`, tone: overCount ? 'bad' : 'good' };
  const note = reserveNote(rv);

  const limits = h.limits.map((l) => {
    const share = l.limit ? l.spent / l.limit : 0;
    const calm = l.state === 'covered';   // решение 63: перерасход покрыл резерв — так сказал сервер
    // правка 1 (ui-ux-pro-max, 13.11): сверх лимита шкала — до потраченного; limitAt — метка лимита и начало штриховки
    const limitAt = share > 1 ? l.limit / l.spent : null;
    // решение 82: подпись — label, в «Операции» — key (имя budget.yaml)
    const row = { key: l.key, name: l.label, ops: { limit: l.key }, spent: fmt(l.spent), limit: fmt(l.limit),
      over: l.over ? `+${fmt(l.over)}` : '', fill: limitAt ?? Math.max(0, Math.min(1, share)), limitAt,
      color: COLOR[l.state], state: h.closed && l.state === 'ok' ? 'в лимите' : SAY[l.state], covered: calm };
    if (calm) row.hint = 'покрыто резервом';
    // резерв: операции перерасхода других лимитов, в шапке — чей перерасход и сколько покрыто (решение 51);
    // в самой строке — из чего он и что покрыл (решение 63: раньше — серым абзацем под списком)
    if (l.eaten) {
      row.note = `перерасход ${quoted(rv.hit)} · резерв покрыл ${fmt(l.eaten)}`;
      row.hint = note.replace(/^Резерв: /, '');
    }
    return row;
  });

  return {
    title: `${MONTHS[m - 1]} ${y}`,
    sub: h.closed ? 'итог месяца' : `на ${h.day} ${OF_MONTH[m - 1]}, день ${h.day} из ${h.days}`,
    zone: { word: OLD_WORD[h.zone.word] || h.zone.word, tone: ZONE[h.zone.status] },
    big: { label: 'Потрачено', value: fmt(h.spent), of: rated ? `из ${fmt(h.norm)}` : '', tone: over ? 'bad' : '' },
    // нормы нет — нет и полосы, доли нормы, плана на сегодня и чисел под чертой (решение 81)
    bar: rated ? { fill: h.norm > 0 ? Math.max(0, Math.min(1, h.spent / h.norm)) : 1,
      plan: h.closed || !(h.norm > 0) ? null : h.plan_today / h.norm } : null,
    scale: rated ? scaleOf(h) : null,
    stats: rated ? [left, first, second] : [],
    curve: { note: curveNote(h), chart: rated && h.curve.length > 0 },   // кривая — с чертой нормы и планом
    plan,
    limits,
    // решение 63: строка резерва видна сразу — под горячими лимитами, даже если по порядку она дальше первых TOP
    top: [...limits.slice(0, TOP), ...limits.slice(TOP).filter((l) => l.note)],
    limitsShown: Math.min(TOP, h.limits.length),
    legend: legendOf(limits, h.closed),
    reserve: note,
    // решение 40: скрытые лимиты (show: hot) — отдельной кнопкой; дошли до порога — уже в общем списке (сервер)
    hidden: h.hidden && h.hidden.length ? { label: `Скрытые лимиты · ${h.hidden.length}`,
      rows: h.hidden.map((l) => ({ key: l.key, name: l.label, spent: fmt(l.spent), limit: fmt(l.limit), ops: { limit: l.key },
        fill: l.limit ? Math.max(0, Math.min(1, l.spent / l.limit)) : 0, hint: `в градуснике — от ${l.hot} % лимита` })) }
      : null,
    budgetLabel: `Весь бюджет на ${FOR_MONTH[m - 1]}`,
    // решение 38: строка остатка открывает операции этого счёта за месяц; счета — в фильтр «Операций»
    groups: balanceGroups(h.balances),
    // решение 60: «сейчас» — у текущего месяца; у закрытого дата — в заголовке «Остатки на 31.10»
    balTotal: h.balances_total == null ? '' : `наличные и карты${h.closed ? '' : ' сейчас'} ≈ ${fmt(h.balances_total)} RSD`,
    accounts: h.balances.map((b) => [b.name, b.account]),
    empty: h.empty.length ? `Пустые счета: ${h.empty.join(', ')}.` : '',
    balTitle: h.closed ? `Остатки на ${when(h.date)}` : 'Остатки',
    fresh: h.closed ? `месяц закрыт · последняя запись ${when(h.fresh.last)}`
      : `последняя запись ${when(h.fresh.last)} · обновлено в ${h.fresh.now.slice(11, 16)}`,
    canNext: h.closed,
  };
}
