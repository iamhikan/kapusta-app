// «Операции» и карточка: ответы /api/tx и /api/tx/{ref} -> что видит человек. Свёртку, доли, переводы и вид зрителя
// считает сервер (fin api); страница только подписывает и раскладывает строки.
import { fmt } from './health.js';
import { periodInText, periodTitle, rangeText } from './period.js';
import { tileOf } from './tiles.js';
import { colorOf, glyphOf, OTHER } from './catcolor.js';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь',
  'Ноябрь', 'Декабрь'];
const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const IN_MONTH = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре',
  'ноябре', 'декабре'];
const WEEKDAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const SYMBOL = { RSD: '', EUR: ' €', RUB: ' ₽', USD: ' $' };
// regular — регулярная трата (решение 86): строка её перебора в списке лимитов «Здоровья»
// exact — траты самой категории без подкатегорий: строка «прочие продукты» (R-31 п. 3; fin знает его с этапа «Категорий»)
const KEYS = ['from', 'to', 'limit', 'regular', 'cat', 'exact', 'q', 'transfers', 'account', 'who', 'source', 'flag', 'cursor'];

// фильтры (холст «Операции» → «Фильтры»): значение — параметр /api/tx. Кошелёк или счёт — счета зрителя из остатков
// «Здоровья» (решение 38); «Здоровье» ещё не грузилось — прежний список
const ACCOUNTS = [['карта ALTA', 'Assets:Family:ALTA'], ['нал Алексея', 'Assets:Family:Cash:Aleksey'],
  ['нал Ангелины', 'Assets:Family:Cash:Angelina'], ['Райффайзен Ангелины', 'Assets:Family:Raiffeisen:RSD'],
  ['счёт салона', 'Assets:Angelina:PR:Bank']];

export function filters(accounts = []) {
  return [
    { key: 'account', label: 'Кошелёк или счёт', chips: [['все', ''], ...(accounts.length ? accounts : ACCOUNTS)] },
    { key: 'who', label: 'Кто записал', chips: [['все', ''], ['Алексей', 'aleksey'], ['Ангелина', 'angelina']] },
    { key: 'source', label: 'Источник', chips: [['все', ''], ['чек', 'receipt'], ['словами', 'words'],
      ['из банка', 'bank'], ['SMS банка', 'sms'], ['выписка РФ', 'raif'], ['Walt', 'walt'],
      ['посчитала Капуста', 'calc']] },   // решения 61, 64, 70, 71: было «выписка», «Райф CSV»; SMS и расчёт — в «из банка»
  ];
}

export const FLAG = 'Только с «!» — надо уточнить';

const FROM = { walt: 'из кошелька Walt', sms: 'из SMS банка', calc: 'посчитала Капуста' };   // запись без автора: откуда пришла (решения 70, 71: было «из выписки банка»)

// R-31 (ревью 26.11): имя позиции чека без штрихкода кассы в начале («9009301009805 SIR …» → «SIR …»); в найденной
// позиции поиска («вид: позиция — сумма») — и после «вид: »
export const itemName = (s) => String(s || '').replace(/(^|: )\d{8,14}\s+/u, '$1');

export function money(n) {
  // «3 098,86», «6 220», «−500»: копейки — только если есть. Округляем до копеек всё число, потом делим на целые и
  // копейки (М9: было — целые отдельно, 1,999 давало «1»: копейки 100 терялись в остатке)
  const all = Math.round(Math.abs(n) * 100);
  const cents = all % 100;
  const whole = fmt((all - cents) / 100);
  const sign = n < 0 && all ? '−' : '';   // −0,29: у нуля целых минус терялся; −0,004 — «0» без минуса
  return `${sign}${whole}${cents ? `,${String(cents).padStart(2, '0')}` : ''}`;
}

// итог дня «Операций»: траты дня; есть регулярные или обязательные — и траты без них (plain, Алексей 26.11.2026)
export function dayTotal(d) {
  if (!d.sum) return '';
  return d.plain == null ? money(d.sum) : `${money(d.sum)} · без 🔁📌 ${money(d.plain)}`;
}

// R-4, R-8 (ревью 26.11): что значат 🔁 и 📌 — строками чата (apart сервера, names.APART_NOTE fin), «без 🔁📌» — если у
// дня есть вторая сумма, минус — если день меньше нуля. Строка: glyph — значок для глаз, text — слова; say — вся строка
// диктору, когда её вид для глаз — значками
export function marksNote(pages) {
  const lines = [...new Set(pages.flatMap((p) => p.apart || []))].map((n) => {
    const [, glyph, text] = /^(\S+) — (.+)$/u.exec(n) || [];
    return glyph ? { glyph, text: ` — ${text}.` } : { text: `${n}.` };
  });
  const days = pages.flatMap((p) => p.days || []);
  if (days.some((d) => d.plain != null)) {
    lines.push({ text: '«без 🔁📌» — траты дня без них.', say: 'Вторая сумма дня — траты без регулярных и обязательных.' });
  }
  if (days.some((d) => d.sum < 0 || d.plain < 0)) lines.push({ text: 'Минус — в этот день вернули больше, чем потратили.' });
  return lines;
}

// тот же итог для диктора — словами (R-5, ревью 26.11): значки 🔁📌 он читает названиями эмодзи. Без меток — не нужен
export function daySay(d) {
  return d.sum && d.plain != null ? `траты ${money(d.sum)}, без регулярных и обязательных ${money(d.plain)}` : '';
}

const cur = (number, currency) => `${money(number)}${currency in SYMBOL ? SYMBOL[currency] : ` ${currency}`}`;
const full = (number, currency) => cur(number, currency) + (currency === 'RSD' ? ' RSD' : '');

export function plural(n, [one, few, many]) {
  const d = n % 10;
  const t = n % 100;
  if (d === 1 && t !== 11) return `${n} ${one}`;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}
const records = (n) => plural(n, ['запись', 'записи', 'записей']);

export function dayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${OF_MONTH[m - 1]}, ${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

export function monthRange(month, today) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = today.startsWith(month) ? today : `${month}-${String(last).padStart(2, '0')}`;
  return { from: `${month}-01`, to };
}

export function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function emptyText(month, title, period = null) {
  const what = title ? `трат «${title.toLowerCase()}»` : 'операций';
  if (period) return `За ${periodInText(period)} ${what} нет`;
  return `В ${IN_MONTH[Number(month.slice(5)) - 1]} ${what} нет`;
}

// R-14 (ревью 26.11): пустой список говорит правду о своём месте. Поиск — «по запросу … ничего нет» и «Очистить поиск»;
// регулярная — «платежа не было»; редкая (конверт, cap) — так и задумано и сколько нормы ушло в конверт; фильтров на
// экране нет — «Смените … стрелкой». g — градусник регулярной (gaugeOf), today — сегодня (прошлый месяц или текущий)
export function emptyView(entry, g, today) {
  const ctx = entry.ctx;
  const f = entry.f || {};
  const i = Number(entry.month.slice(5)) - 1;
  const filtered = !!(f.transfers || f.account || f.who || f.source || f.flag);
  const out = (title, text = '', clear = false) => ({ title, text, clear });
  if (!ctx && f.q) return out(`По запросу «${f.q}» в ${IN_MONTH[i]} ничего нет`, filtered ? 'Смените месяц или фильтры.' : '', true);
  if (!ctx) {
    return filtered ? out(`В ${IN_MONTH[i]} таких операций нет`, 'Смените месяц или фильтры.')
      : out(`В ${IN_MONTH[i]} операций нет`, 'Смените месяц стрелкой.');
  }
  if (ctx.params && ctx.params.regular) {
    if (!(g && g.cap > 0)) return out(`В ${IN_MONTH[i]} платежа не было`, 'Смените месяц стрелкой.');
    const into = Math.max(0, Math.min(g.norm, g.cap - g.carry));
    const past = entry.month < today.slice(0, 7);
    return out(`В ${IN_MONTH[i]} покупки не было`, `Так и задумано: покупка редкая. ${!into ? `Конверт уже полон — ${fmt(g.carry)}.`
      : past ? `${fmt(into)} из нормы ${OF_MONTH[i]} ушли в конверт.` : `Без неё ${fmt(into)} из нормы ${OF_MONTH[i]} уйдут в конверт.`}`);
  }
  const p = ctx.period;
  if (p && p.kind === 'custom' && p.from === p.to) return out(`${ctx.title} трат нет`, 'Смените день стрелкой.');
  return out(emptyText(entry.month, ctx.title, p), p ? 'Смените период стрелкой.' : 'Смените месяц стрелкой.');
}

export function txPath(state) {
  const q = new URLSearchParams();
  for (const k of KEYS) {
    const v = state[k];
    if (v === true) q.set(k, '1');
    else if (v != null && v !== '' && v !== false) q.set(k, v);
  }
  return `/api/tx?${q}`;
}

function exchange(op) {
  const out = op.legs.filter((l) => l.number < 0);
  const into = op.legs.filter((l) => l.number > 0);
  const rate = op.rate ? ` · по ${money(op.rate.deal)}, НБС ${money(op.rate.nbs)}` : '';
  const note = op.fx > 0 ? [`выигрыш +${fmt(op.fx)} к курсу НБС`, 'good']
    : op.fx < 0 ? [`потеря −${fmt(-op.fx)} к курсу НБС`, 'warn'] : ['по курсу НБС', ''];
  return { sub: `${op.src}${rate}`, amount: out.length ? full(-out[0].number, out[0].currency) : '',
    amountSub: into.length ? `→ ${full(into[0].number, into[0].currency)}` : '', note: note[0], noteTone: note[1] };
}

// начальный остаток в одной валюте (решение 73) -> [сумма, валюта]; у долга (кредит) нога с минусом — сумма без знака
function startSum(op) {
  if (op.opening !== 'start' || op.kind !== 'transfer' || !op.legs) return null;
  const curs = new Set(op.legs.map((l) => l.currency));
  if (curs.size !== 1) return null;
  return [Math.abs(op.legs.reduce((s, l) => s + l.number, 0)), [...curs][0]];
}

// «по факту 36 956,10 EUR» (решение 72) у начального остатка — та же сумма, что крупно в карточке (решение 73)
function repeatsStart(c) {
  const start = startSum(c);
  const m = /^по факту (.+) ([A-Z]+)$/.exec(c.what || '');
  if (!start || !m || m[2] !== start[1]) return false;
  const n = Number(m[1].replace(/[\s−-]/g, '').replace(',', '.'));
  return Math.abs(n - start[0]) < 0.005;
}

// плитка строки (правка 4, ui-ux-pro-max 13.11): трата — тон цвета категории самой большой доли (key) и её значок;
// перевод и обмен — серая со стрелками; доход — зелёная. Прежний сервер без key — серая с точками
function tileOfOp(op) {
  if (op.kind === 'transfer' || op.kind === 'exchange') return { color: OTHER, glyph: 'transfer' };
  if (op.kind === 'income') return { color: '#3f9d5f', glyph: 'income' };
  return op.key ? { color: colorOf(op.key), glyph: glyphOf(op.key) } : { color: OTHER, glyph: 'dots' };
}

// регулярная и обязательная — в норме отдельно от шкалы, правило градусника (решение 97). R-3 (решение 98, ответ 3):
// в строке — только значок после категории, как в `fin last` («образование 🔁 · Райффайзен»); слово — в карточке и в
// пояснении. bare — экран самой регулярной (и карточка): там значок ничего не добавляет
const GLYPHS = [['regular', '🔁'], ['mandatory', '📌']];

export function opRow(op, { inCategory = false, account = '', bare = false } = {}) {
  const marks = [op.receipt && 'чек', op.flag && '!', op.secret && 'секрет'].filter(Boolean);
  const glyph = bare ? '' : GLYPHS.filter(([k]) => op[k]).map(([, g]) => g).join('');
  const base = { ref: op.ref, where: op.count > 1 ? `${op.where} · ${records(op.count)}` : op.where, marks, note: itemName(op.hit), noteTone: '', gray: false,
    group: (op.group || []).map((g) => opRow(g, { bare })), count: op.count || 1, tile: tileOfOp(op) };
  if (op.kind === 'exchange') {
    // R-6: у обмена регулярная — только разница к курсу НБС (решение 88): значок — у строки выигрыша или потери
    const ex = exchange(op);
    return { ...base, gray: true, ...ex, note: glyph && ex.note ? `${glyph} ${ex.note}` : ex.note };
  }
  if (op.kind === 'transfer') {
    const from = op.legs.filter((l) => l.number < 0).map((l) => l.name);
    const to = op.legs.filter((l) => l.number > 0);
    const into = [...new Set(to.map((l) => l.name))].join(', ');
    // сверка остатка (решение 68): остаток счёта после неё, как на экране банка, — не сумма поступлений по курсу
    if (op.opening === 'check' && op.after) {
      const [first] = op.after.lines;
      return { ...base, gray: true, sub: 'сверка остатка', amount: first ? full(first.number, first.currency) : full(0, 'RSD'),
        amountSub: 'остаток' };
    }
    // начальный остаток в одной валюте (решение 73) — в валюте счёта, как на экране банка, рядом ≈ RSD по курсу НБС;
    // курса нет (rsd 0) — без «≈ 0 RSD»
    const start = startSum(op);
    if (start) {
      const [n, c] = start;
      const sub = from.length ? [...new Set(from)].join(', ') : into ? `→ ${into}` : '';   // R-26: было «на карта ALTA, динары»
      return { ...base, gray: true, sub, amount: full(n, c), amountSub: c !== 'RSD' && op.rsd ? `≈ ${fmt(op.rsd)} RSD` : '' };
    }
    // приход без «откуда» (начальный остаток, поправка, сверка нала): весь приход по курсу НБС, а не первая из валют
    // (ревью); у сверки без остатка (нал — экрана банка нет, решение 68) — подпись «сверка остатка»
    if (!from.length) {
      return { ...base, gray: true, sub: op.opening === 'check' ? 'сверка остатка' : into ? `→ ${into}` : '',
        amount: full(op.rsd, 'RSD'), amountSub: '' };
    }
    const main = to[0] || { number: op.rsd, currency: 'RSD' };
    return { ...base, gray: true, sub: [...new Set(from)].join(', ') + (to.length ? ` → ${into}` : ''),
      amount: full(main.number, main.currency), amountSub: '' };
  }
  // операции счёта (решение 48): счёт — в шапке, под строкой его не повторяем
  const own = account && op.account && op.account.startsWith(account);
  // сверка нала (`pad`, решение 72) — «сверка остатка», как у сверки через начальный остаток (решение 68)
  const cats = inCategory ? glyph : [op.cats.join(', '), glyph].filter(Boolean).join(' ');   // значок — после категории
  const sub = op.opening === 'check' ? 'сверка остатка' : [cats, own ? '' : op.src].filter(Boolean).join(' · ');
  if (op.kind === 'income') {
    return { ...base, sub, amount: `+${full(op.amount.number, op.amount.currency)}`, noteTone: 'good',
      amountSub: op.amount.currency !== 'RSD' ? `${money(op.rsd)} RSD` : '', income: true };
  }
  const foreign = op.amount && op.amount.currency !== 'RSD' && op.total == null;
  // поправка дублей SMS (R-30, решение 98): fin шлёт одной строкой с `correction` — серая, как служебная
  return { ...base, sub, gray: op.kind === 'other' || !!op.correction,
    amount: foreign ? cur(op.amount.number, op.amount.currency) : full(op.rsd, 'RSD'),   // RSD — у каждой суммы (ревью)
    amountSub: op.total != null ? `из платежа ${money(op.total)}` : foreign ? `${money(op.rsd)} RSD` : '' };   // R-16: «из» в шапке — из нормы
}

export function headView(ctx, body) {
  // шапка операций лимита или категории: сумма периода против лимита (решение 3); период — месяц
  // или любой период «Категорий» (неделя, квартал, год, свой)
  const days = ctx.period ? rangeText(ctx.period.from, ctx.to)
    : `1–${Number(ctx.to.slice(8))} ${OF_MONTH[Number(ctx.month.slice(5)) - 1]}`;
  const lim = ctx.note ? null : ctx.limit;          // своя подпись (резерв) — вместо «из лимита»
  // регулярная (E10): конверт неизвестен (carry null), а сервер сказал «перебора нет» — сверх суммы её покрыл конверт
  const covered = lim != null && body.total > lim && ctx.over === false && ctx.carry == null;
  const over = lim != null && body.total > lim && !covered;
  // жильё и кредит РФ (E14): «сверх» — курс дня оплаты, в «Потрачено» не идёт — число есть, красного нет
  const bad = over && !ctx.contract;
  // у спортпита — «В норме 2 433 + конверт 7 300»: limit — сумма с конвертом; обмен валюты — норма на потери к курсу
  const word = `${ctx.limitWord || 'Лимит'} ${ctx.carry ? `${fmt(ctx.norm ?? lim - ctx.carry)} + конверт ${fmt(ctx.carry)}` : fmt(lim)}`
    + (ctx.fx ? ' на потери к курсу' : '');
  // R-13 (ревью 26.11): вернули больше, чем потратили (обмен с выигрышем) — «+N», без «из» и без полосы: «−189 из 588»
  // читалось как «потратили минус 189»
  const back = lim != null && !ctx.note && body.total < 0;
  // экран дня из «По дням» (R-2): то же число, что клетка, — «как в „Потрачено“» (spent fin); прежний сервер — без него
  const day = ctx.days && body.days && body.days[0];
  const spent = day && day.spent != null ? `в «Потрачено» ${fmt(day.spent)}` : '';
  return {
    title: ctx.title, period: ctx.period ? periodTitle(ctx.period) : monthTitle(ctx.month),
    sum: back ? `+${fmt(-body.total)}` : fmt(body.total),
    note: back ? (ctx.fx ? 'выигрыш к курсу НБС' : 'вернули больше, чем потратили')
      : ctx.note || (lim == null ? '' : covered ? 'в пределах конверта' : over ? `сверх ${fmt(body.total - lim)}`
        : `из ${fmt(lim)}`), tone: bad ? 'bad' : back ? 'good' : '',
    fill: lim == null || back ? null : lim > 0 ? Math.max(0, Math.min(1, body.total / lim)) : 1,
    sub: [spent, lim == null ? '' : word, records(body.count), days].filter(Boolean).join(' · '),
    basis: lim != null && ctx.basis ? `сумма в норме — ${ctx.basis}` : '',
  };
}

export function accountView(bal, body, month) {
  // шапка «Операций» счёта (решение 48): плитка, имя, остаток, пришло и ушло за месяц списка. Остаток — из «Здоровья»
  // месяца списка (balanceRow): у прошлого — «остаток на 31.10», «сейчас» — только у текущего (R-25)
  const flow = body.flow ? [['пришло', `+${fmt(body.flow.in)}`], ['ушло', fmt(-body.flow.out)]] : [];
  return { title: bal.name, tile: bal.tile, lines: bal.lines, label: bal.lines.length ? bal.label || 'остаток сейчас' : '', flow,
    sub: [monthTitle(month).split(' ')[0].toLowerCase(), records(body.count || 0)].join(' · ') };
}

// «Откуда и куда» (решение 65): ушло — «Откуда», пришло — «Куда», суммы без знаков. Один счёт в нескольких валютах —
// одной строкой: RSD сверху, остальные ниже (как остатки, решение 48) — начальный остаток Freedom в 2 строки, а не в 8
function flow(postings) {
  const side = (label, sign) => {
    const by = new Map();
    for (const p of postings.filter((x) => Math.sign(x.number) === sign)) {
      if (!by.has(p.name)) by.set(p.name, []);
      by.get(p.name).push(p);
    }
    const lines = [...by].map(([name, ps]) => {
      const [first, ...rest] = [...ps.filter((p) => p.currency === 'RSD'), ...ps.filter((p) => p.currency !== 'RSD')]
        .map((p) => full(Math.abs(p.number), p.currency));
      return { name, value: first, more: rest.join(' · ') };
    });
    return lines.length ? [{ label, lines }] : [];
  };
  return [...side('Откуда', -1), ...side('Куда', 1)];
}

const OPENING = 'Equity:Opening-Balances';

// время записи из at любого вида: «15:35» (Walt) или «2026-11-10 18:40» (решение 68: было «· ·» у Walt)
const clock = (at) => (/(?:^|[ T])(\d{1,2}:\d{2})/.exec(at || '') || [])[1] || '';

function checkHead(row, after) {
  // сверка (решение 68): крупно — первая валюта остатка, рядом — итог по курсу НБС, ниже — остальные валюты
  const rest = after.lines.slice(1);
  return { ...row, sub: 'остаток после сверки', note: rest.map((l) => cur(l.number, l.currency)).join(' · '), noteTone: 'muted',
    amountSub: after.lines.some((l) => l.currency !== 'RSD') ? `≈ ${fmt(after.rsd)} RSD` : '' };
}

function similarRow(s) {
  // «Ещё в …» — сумма, как в списке «Операций» (решение 68); прежний сервер слал только ref, date, rsd — числом
  if (!s.kind) return { ref: s.ref, label: dayLabel(s.date), value: money(s.rsd), sub: '' };
  const r = opRow(s);
  return { ref: s.ref, label: dayLabel(s.date), value: r.amount, sub: r.amountSub };
}

// правка 3 (ui-ux-pro-max, 13.11): простая трата — одна сторона «откуда», одна «куда», одна сумма. У неё блока «Откуда
// и куда» нет: кошелёк — строкой под категорией (было: категория и кошелёк по три раза)
function simpleOf(kind, sides) {
  if (kind !== 'spend' || sides.length !== 2 || sides.some((s) => s.lines.length !== 1)) return false;
  const [[from], [to]] = sides.map((s) => s.lines);
  return !from.more && !to.more && from.value === to.value;
}

function whoOf(c) {
  if (c.by) return { label: `Записал${c.by === 'Ангелина' ? 'а' : ''}`, value: c.by };
  return { label: 'Запись', value: FROM[c.origin || c.source] || 'из выписки банка' };
}

// М9: страница открывает только чек на сайте налоговой Сербии; другой адрес из ответа сервера не открывает и кнопку
// «Чек на сайте налоговой» не рисует (было: открывала любой адрес — window.open)
const TAX = 'https://suf.purs.gov.rs/';
export const taxLink = (url) => (typeof url === 'string' && url.startsWith(TAX) ? url : null);

// карточка (R-4): метка регулярной и обязательной — своей строкой с переходом на её операции, ниже — пояснение чата
// без значка («Регулярная трата: она в норме отдельно, …»); у имени остаются «чек», «!», «секрет»
const APART = [['regular', '🔁', 'регулярная'], ['mandatory', '📌', 'обязательная']];

function apartLines(c) {
  return APART.filter(([k]) => c[k]).map(([kind, glyph, word]) => {
    const note = (c.apart || []).find((n) => n.startsWith(`${glyph} — `));
    const why = note ? note.slice(glyph.length + 3) : '';
    return { kind, glyph, word, name: c[kind], why: why ? `${why.charAt(0).toUpperCase()}${why.slice(1)}.` : '' };
  });
}

export function cardView(c) {
  const check = c.opening === 'check';
  const postings = (c.postings || []).map((p) => (check && p.account === OPENING ? { ...p, name: 'сверка остатка' } : p));
  const time = clock(c.at);
  const sides = flow(postings);
  const simple = simpleOf(c.kind, sides);
  const payer = simple ? postings.find((p) => p.number < 0) : null;
  const row = opRow(c, { bare: true });   // метка в карточке — своей строкой со словом (apart), значок у суммы не нужен
  return {
    simple, who: whoOf(c),
    wallet: payer ? { name: payer.name, tile: tileOf(payer.account || '', payer.name) } : null,
    title: c.where, what: c.what && c.what !== c.where && !repeatsStart(c) ? c.what : '',
    when: dayLabel(c.date) + (time ? ` · ${time}` : ''),
    by: c.by ? `записал${c.by === 'Ангелина' ? 'а' : ''} ${c.by}` : FROM[c.origin || c.source] || 'из выписки банка',   // origin — без учёта чека (решение 71)
    row: check && c.after ? checkHead(row, c.after) : row,
    marks: row.marks,
    apart: apartLines(c),
    flow: sides,
    receipt: c.receipt && {
      shop: c.receipt.shop, total: money(c.receipt.total), url: taxLink(c.receipt.url),
      items: c.receipt.items.map((it) => ({ name: itemName(it.name),
        line: it.qty === 1 ? '' : `${String(it.qty).replace('.', ',')}${it.unit === 'шт' ? '' : ` ${it.unit}`} × ${money(it.price)}`,
        value: money(it.total), sub: [it.kind, it.cat].filter(Boolean).join(' · ') })),
    },
    similar: (c.similar || []).map(similarRow),
  };   // ref в карточке не показываем (решение 51): он для бота, человеку ничего не говорит
}
