// «Операции» и карточка: ответы /api/tx и /api/tx/{ref} -> что видит человек. Свёртку, доли, переводы и вид зрителя
// считает сервер (fin api); страница только подписывает и раскладывает строки.
import { fmt } from './health.js';
import { periodTitle, rangeText } from './period.js';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь',
  'Ноябрь', 'Декабрь'];
const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const IN_MONTH = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре',
  'ноябре', 'декабре'];
const WEEKDAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const SYMBOL = { RSD: '', EUR: ' €', RUB: ' ₽', USD: ' $' };
const KEYS = ['from', 'to', 'limit', 'cat', 'q', 'transfers', 'account', 'who', 'source', 'flag', 'cursor'];

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
      ['из банка', 'bank'], ['выписка РФ', 'raif']] },   // решения 61, 64: было «выписка», «Райф CSV»
  ];
}

export const FLAG = 'Только с «!» — надо уточнить';   // решение 61: было «на разборе»

export function money(n) {
  // «3 098,86», «6 220», «−500»: копейки — только если есть
  const cents = Math.round(Math.abs(n) * 100) % 100;
  const whole = fmt(Math.trunc(Math.abs(n)));
  const sign = n < 0 && (whole !== '0' || cents) ? '−' : '';   // −0,29: у нуля целых минус терялся
  return `${sign}${whole}${cents ? `,${String(cents).padStart(2, '0')}` : ''}`;
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
  if (period) return `За ${periodTitle(period)} ${what} нет`;
  return `В ${IN_MONTH[Number(month.slice(5)) - 1]} ${what} нет`;
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

export function opRow(op, { inCategory = false, account = '' } = {}) {
  const marks = [op.receipt && 'чек', op.flag && '!', op.secret && 'секрет'].filter(Boolean);
  const base = { ref: op.ref, where: op.count > 1 ? `${op.where} · ${records(op.count)}` : op.where, marks, note: op.hit || '', noteTone: '', gray: false,
    group: (op.group || []).map(opRow), count: op.count || 1 };
  if (op.kind === 'exchange') return { ...base, gray: true, ...exchange(op) };
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
    // приход без «откуда» (начальный остаток, поправка): весь приход по курсу НБС, а не первая из валют (ревью)
    if (!from.length) return { ...base, gray: true, sub: into ? `на ${into}` : '', amount: full(op.rsd, 'RSD'), amountSub: '' };
    const main = to[0] || { number: op.rsd, currency: 'RSD' };
    return { ...base, gray: true, sub: [...new Set(from)].join(', ') + (to.length ? ` → ${into}` : ''),
      amount: full(main.number, main.currency), amountSub: '' };
  }
  // операции счёта (решение 48): счёт — в шапке, под строкой его не повторяем
  const own = account && op.account && op.account.startsWith(account);
  const sub = [inCategory ? '' : op.cats.join(', '), own ? '' : op.src].filter(Boolean).join(' · ');
  if (op.kind === 'income') {
    return { ...base, sub, amount: `+${full(op.amount.number, op.amount.currency)}`, noteTone: 'good',
      amountSub: op.amount.currency !== 'RSD' ? `${money(op.rsd)} RSD` : '', income: true };
  }
  const foreign = op.amount && op.amount.currency !== 'RSD' && op.total == null;
  return { ...base, sub, gray: op.kind === 'other',
    amount: foreign ? cur(op.amount.number, op.amount.currency) : full(op.rsd, 'RSD'),   // RSD — у каждой суммы (ревью)
    amountSub: op.total != null ? `из ${money(op.total)}` : foreign ? `${money(op.rsd)} RSD` : '' };
}

export function headView(ctx, body) {
  // шапка операций лимита или категории: сумма периода против лимита (решение 3); период — месяц
  // или любой период «Категорий» (неделя, квартал, год, свой)
  const days = ctx.period ? rangeText(ctx.period.from, ctx.to)
    : `1–${Number(ctx.to.slice(8))} ${OF_MONTH[Number(ctx.month.slice(5)) - 1]}`;
  const lim = ctx.note ? null : ctx.limit;          // своя подпись (резерв) — вместо «из лимита»
  const over = lim != null && body.total > lim;
  return {
    title: ctx.title, period: ctx.period ? periodTitle(ctx.period) : monthTitle(ctx.month), sum: fmt(body.total),
    note: ctx.note || (lim == null ? '' : over ? `сверх ${fmt(body.total - lim)}` : `из ${fmt(lim)}`), tone: over ? 'bad' : '',
    fill: lim == null ? null : lim > 0 ? Math.min(1, body.total / lim) : 1,
    sub: [lim == null ? '' : `Лимит ${fmt(lim)}`, records(body.count), days]
      .filter(Boolean).join(' · '),
  };
}

export function accountView(bal, body, month) {
  // шапка «Операций» счёта (решение 48): плитка, имя, остаток на сейчас, пришло и ушло за месяц списка
  const flow = body.flow ? [['пришло', `+${fmt(body.flow.in)}`], ['ушло', fmt(-body.flow.out)]] : [];
  return { title: bal.name, tile: bal.tile, lines: bal.lines, label: bal.lines.length ? 'остаток сейчас' : '', flow,
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

export function cardView(c) {
  const check = c.opening === 'check';
  const postings = (c.postings || []).map((p) => (check && p.account === OPENING ? { ...p, name: 'сверка остатка' } : p));
  const time = clock(c.at);
  return {
    title: c.where, what: c.what && c.what !== c.where ? c.what : '',
    when: dayLabel(c.date) + (time ? ` · ${time}` : ''),
    by: c.by ? `записал${c.by === 'Ангелина' ? 'а' : ''} ${c.by}` : 'из выписки банка',
    row: check && c.after ? checkHead(opRow(c), c.after) : opRow(c),
    flow: flow(postings),
    receipt: c.receipt && {
      shop: c.receipt.shop, total: money(c.receipt.total), url: c.receipt.url,
      items: c.receipt.items.map((it) => ({ name: it.name,
        line: it.qty === 1 ? '' : `${String(it.qty).replace('.', ',')}${it.unit === 'шт' ? '' : ` ${it.unit}`} × ${money(it.price)}`,
        value: money(it.total), sub: [it.kind, it.cat].filter(Boolean).join(' · ') })),
    },
    similar: (c.similar || []).map(similarRow),
  };   // ref в карточке не показываем (решение 51): он для бота, человеку ничего не говорит
}
