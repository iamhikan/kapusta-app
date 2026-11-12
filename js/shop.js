// Покупки (этап 7, решение 37): «История цены» — ответ /api/price, «По товарам» — ответ /api/basket. Числа считает
// сервер (те же, что fin price и fin basket в чате); страница подписывает строки и рисует цену по датам.
import { fmt } from './health.js';
import { money, monthTitle, plural } from './ops.js';

const OF_MONTH = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь',
  'ноябрь', 'декабрь'];
export const PRICE_BOX = { width: 330, height: 170, left: 40, right: 318, top: 16, bottom: 140 };

const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const unitWord = (u) => (u && u !== 'шт' ? `за ${u}` : '');

function day(iso, today) {
  // «01.11» в этом году, иначе «09.03.2025» — как в fin price
  const [y, m, d] = iso.split('-');
  return y === today.slice(0, 4) ? `${d}.${m}` : `${d}.${m}.${y}`;
}

export const itemPrice = (card, n) => ({ receipt: card.receipt.number, line: n + 1 });   // строки чека в архиве — с 1

export function pricePath(q) {
  const p = new URLSearchParams();
  for (const k of ['receipt', 'line', 'product', 'kind']) if (q[k] != null) p.set(k, q[k]);
  return `/api/price?${p}`;
}

function chart(history, unit) {
  const B = PRICE_BOX;
  const t = history.map((x) => Date.UTC(...x.day.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0))));
  const prices = history.map((x) => x.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const pad = (hi - lo) * 0.15 || hi * 0.1 || 1;
  const [y0, y1] = [Math.max(0, lo - pad), hi + pad];
  const x = (v) => (t.length < 2 || t[t.length - 1] === t[0] ? (B.left + B.right) / 2
    : B.left + ((v - t[0]) / (t[t.length - 1] - t[0])) * (B.right - B.left));
  const y = (v) => B.bottom - ((v - y0) / (y1 - y0)) * (B.bottom - B.top);
  const points = history.map((h, i) => ({ x: +x(t[i]).toFixed(1), y: +y(h.price).toFixed(1), label: money(h.price) }));
  const grid = [y0, (y0 + y1) / 2, y1].map((v) => ({ y: +y(v).toFixed(1), label: fmt(v) }));
  const mmyy = (iso) => `${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const word = unitWord(unit);
  return { points, grid, line: points.map((p) => `${p.x},${p.y}`).join(' '),
    from: mmyy(history[0].day), to: mmyy(history[history.length - 1].day),
    aria: `Цена${word ? ` ${word}` : ''} по чекам: ${history.map((h) => `${money(h.price)} — ${h.day.split('-').reverse().join('.')}`).join(', ')}` };
}

export function priceView(b, today) {
  const kindOnly = b.history == null;
  const stores = b.stores.map((s) => ({ store: s.store, sub: `${s.name} · ${day(s.day, today)}`, price: money(s.price),
    per: s.per_price == null ? '' : `${money(s.per_price)} за ${s.per}`, mine: !!s.mine,
    open: s.mine ? null : { product: s.product } }));
  // с точкой: следом в той же подписи — «Цена за кг или л …» (critique 12.11)
  const cheapest = b.cheapest ? `Дешевле всего за ${b.cheapest.per}: ${b.cheapest.store} — ${money(b.cheapest.per_price)}.` : '';
  // один список — одно имя у товара и у вида (critique 12.11: было «Тот же вид в других сетях» и «Магазины»)
  const storesTitle = 'По магазинам';
  if (kindOnly) {
    return { title: upper(b.name), sub: `товаров: ${b.stores.length}, магазинов: ${new Set(b.stores.map((s) => s.store)).size}`,
      big: null, chart: null, stores, storesTitle, cheapest };
  }
  const last = b.history[b.history.length - 1];
  const change = b.change ? b.change.replace('-', '−') : '';
  const checks = plural(b.count, ['чек', 'чека', 'чеков']);
  return {
    title: b.name,
    sub: `${b.kind ? `вид «${b.kind}» · ` : ''}${checks} в ${b.store}`,
    big: { value: money(last.price), unit: unitWord(b.unit),
      meta: `${last.store}, ${day(last.day, today)}${change ? ` · с первой покупки ${change}` : ''}`,
      tone: change.startsWith('+') ? 'warn' : change ? 'good' : '' },
    chart: chart(b.history, b.unit),
    stores,
    storesTitle,
    cheapest,
  };
}

function qtyText(q, unit) {
  if (q == null) return '';
  return `${String(q).replace('.', ',')} ${unit}`;
}

export function basketView(b) {
  const m = Number(b.month.slice(5)) - 1;
  if (!b.receipts) {
    return { title: 'По товарам', sub: monthTitle(b.month), shares: [], rows: [], note: '',
      empty: `За ${OF_MONTH[m]} чеков с продуктами нет` };
  }
  return {
    title: 'По товарам',
    // решение 57: в корзине только продукты — чеки и сумма по ним, как «по 2 чекам на 1 470» в fin basket
    sub: `${monthTitle(b.month)} · продукты по ${plural(b.receipts, ['чеку', 'чекам', 'чекам'])} на ${fmt(b.total)} RSD`,
    shares: b.cats.slice(0, 6).map((c) => `${c.name} ${c.share} %`),
    rows: b.top.map((t) => ({ name: t.kind ? upper(t.name) : t.name, qty: qtyText(t.qty, t.unit), sum: fmt(t.rsd),
      open: t.kind ? { kind: t.kind } : { product: t.product } })),
    note: b.food == null ? '' : `По чекам видно ${b.food} % трат на продукты за ${OF_MONTH[m]}.`,
    empty: '',
  };
}
