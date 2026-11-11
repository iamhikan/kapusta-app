// Экраны «Операции» и карточка операции (DOM). Данные — только из /api/tx и /api/tx/{ref}, в памяти страницы.
import { h, icon, tap, ICONS, tg } from './dom.js';
import { cardView, dayLabel, emptyText, headView, money, monthRange, monthTitle, opRow, txPath } from './ops.js';
import { shiftMonth } from './health.js';

// фильтры (холст «Операции» → «Фильтры»): значение — параметр /api/tx
export const FILTERS = [
  { key: 'account', label: 'Кошелёк или счёт', chips: [['все', ''], ['карта ALTA', 'Assets:Family:ALTA'],
    ['нал Алексея', 'Assets:Family:Cash:Aleksey'], ['нал Ангелины', 'Assets:Family:Cash:Angelina'],
    ['Raiffeisen Ангелина', 'Assets:Family:Raiffeisen:RSD'], ['счёт салона', 'Assets:Angelina:PR:Bank']] },
  { key: 'who', label: 'Кто записал', chips: [['все', ''], ['Алексей', 'aleksey'], ['Ангелина', 'angelina']] },
  { key: 'source', label: 'Источник', chips: [['все', ''], ['чек', 'receipt'], ['словами', 'words'],
    ['выписка', 'bank'], ['Райф CSV', 'raif']] },
];

export function newOps(month, ctx = null) {
  return { kind: 'ops', month, ctx, f: { q: '', transfers: false, account: '', who: '', source: '', flag: false },
    pages: [], error: null, loading: false, expanded: new Set(), sheet: false, scroll: 0 };
}

function query(entry, today, cursor = null) {
  return txPath({ ...monthRange(entry.month, today), ...(entry.ctx ? entry.ctx.params : {}), ...entry.f, cursor });
}

export async function loadOps(entry, nav, more = false) {
  if (entry.loading) return;
  entry.loading = true;
  const cursor = more ? entry.pages[entry.pages.length - 1].next : null;
  const mine = (entry.seq = (entry.seq || 0) + 1);
  if (!more) { entry.pages = []; entry.error = null; nav.render(); }
  const r = await nav.get(query(entry, nav.today(), cursor));
  if (mine !== entry.seq) return;
  entry.loading = false;
  if (r.error === 'stale' || r.error === 'stranger') return nav.problem(r.error);
  if (r.error) entry.error = r.detail || r.error;
  else entry.pages.push(r.data);
  nav.render();
}

function days(entry) {
  // страницы по 50: день на стыке страниц — одним днём (сумма дня от сервера — за весь день)
  const out = [];
  for (const p of entry.pages) {
    for (const d of p.days) {
      const last = out[out.length - 1];
      if (last && last.date === d.date) last.ops.push(...d.ops);
      else out.push({ ...d, ops: [...d.ops] });
    }
  }
  return out;
}

function opLine(r, nav, opts = {}) {
  const inner = [
    h('span', { class: 'grow' },
      h('span', { class: 'op-where' }, h('span', { class: 'ellipsis' }, r.where),
        ...r.marks.map((m) => h('span', { class: `mark${m === '!' ? ' bad' : m === 'секрет' ? ' secret' : ''}` }, m))),
      r.sub ? h('span', { class: 'op-sub muted small' }, r.sub) : null,
      r.note ? h('span', { class: `op-note small ${r.noteTone}` }, r.note) : null),
    h('span', { class: 'op-amount' }, h('span', { class: r.income ? 'good' : '' }, r.amount),
      r.amountSub ? h('span', { class: 'muted small' }, r.amountSub) : null),
  ];
  const cls = `op${r.gray ? ' gray' : ''}${opts.nested ? ' nested' : ''}`;
  if (r.group.length) {
    const open = opts.expanded.has(opts.key);
    return [h('button', { type: 'button', class: cls, 'aria-expanded': String(open),
      on: { click: () => { tap(); open ? opts.expanded.delete(opts.key) : opts.expanded.add(opts.key); nav.render(); } } },
    ...inner), open ? r.group.map((g) => opLine(g, nav, { nested: true })) : null];
  }
  if (!r.ref) return h('div', { class: cls }, ...inner);        // теневая у Ангелины — без карточки (решение 24)
  return h('button', { type: 'button', class: cls, on: { click: () => { tap(); nav.push({ kind: 'card', ref: r.ref }); } } },
    ...inner);
}

function head(entry, nav) {
  const body = entry.pages[0] || { total: 0, count: 0 };
  const ctx = entry.ctx;
  const v = headView({ title: ctx.title, limit: nav.limitOf(ctx, entry.month), month: entry.month,
    to: monthRange(entry.month, nav.today()).to }, body);
  const arrow = (dir, label, d, enabled = true) => h('button', { class: 'arrow', type: 'button', 'aria-label': label,
    disabled: !enabled, on: { click: () => { tap(); entry.month = shiftMonth(entry.month, dir); loadOps(entry, nav); } } },
  icon(d));
  return h('section', { class: 'card pad stack' },
    h('div', { class: 'month' }, arrow(-1, 'Прошлый месяц', ICONS.left),
      h('div', { class: 'month-title' }, h('h1', {}, v.title), h('p', { class: 'muted small' }, v.period)),
      arrow(1, 'Следующий месяц', ICONS.right, entry.month < nav.today().slice(0, 7))),
    h('div', { class: 'big' }, h('span', { class: `big-num ${v.tone}` }, v.sum),
      h('span', { class: `muted ${v.tone}` }, v.note || 'RSD')),
    v.fill == null ? null : h('span', { class: 'bar thin' },
      h('span', { class: `fill ${v.tone}`, style: { width: `${(v.fill * 100).toFixed(1)}%` } })),
    h('div', { class: 'muted small' }, v.sub));
}

function toolbar(entry, nav) {
  const f = entry.f;
  const chip = (label, on, click, d) => h('button', { type: 'button', class: `chip-btn${on ? ' on' : ''}`,
    'aria-pressed': String(!!on), on: { click: () => { tap(); click(); } } }, d ? icon(d, 14) : null, label);
  const active = FILTERS.flatMap((g) => g.chips.filter(([, v]) => v && f[g.key] === v)
    .map(([label]) => chip(label, true, () => { f[g.key] = ''; loadOps(entry, nav); }, ICONS.close)));
  if (f.flag) active.push(chip('«!»', true, () => { f.flag = false; loadOps(entry, nav); }, ICONS.close));
  const search = h('label', { class: 'search' }, icon(ICONS.search, 18),
    h('input', { type: 'search', id: 'ops-q', placeholder: 'Поиск: где, что, товар', value: entry.typed ?? f.q, enterkeyhint: 'search',
      'aria-label': 'Поиск по операциям',
      on: { input: (e) => {
        entry.typed = e.target.value;                 // перерисовка во время запроса не вернёт старый текст
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => { f.q = entry.typed; loadOps(entry, nav); }, 350);
      } } }));
  return h('div', { class: 'toolbar' }, search,
    h('div', { class: 'chips wrap' },
      h('span', { class: 'chip-month' },
        h('button', { type: 'button', class: 'arrow small-arrow', 'aria-label': 'Прошлый месяц',
          on: { click: () => { tap(); entry.month = shiftMonth(entry.month, -1); loadOps(entry, nav); } } }, icon(ICONS.left, 16)),
        h('span', {}, monthTitle(entry.month)),
        h('button', { type: 'button', class: 'arrow small-arrow', 'aria-label': 'Следующий месяц',
          disabled: entry.month >= nav.today().slice(0, 7),
          on: { click: () => { tap(); entry.month = shiftMonth(entry.month, 1); loadOps(entry, nav); } } }, icon(ICONS.right, 16))),
      chip('Фильтры', false, () => { entry.sheet = true; nav.render(); }, ICONS.filter),
      chip('Переводы', f.transfers, () => { f.transfers = !f.transfers; loadOps(entry, nav); }, ICONS.transfer),
      ...active));
}

function sheet(entry, nav) {
  const draft = entry.draft || (entry.draft = { ...entry.f });
  const close = () => { entry.sheet = false; entry.draft = null; nav.render(); };
  return h('div', { class: 'sheet-back', on: { click: (e) => { if (e.target === e.currentTarget) close(); } } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Фильтры' },
      h('div', { class: 'row' }, h('h2', {}, 'Фильтры'),
        h('button', { type: 'button', class: 'link', on: { click: () => {
          tap(); Object.assign(draft, { account: '', who: '', source: '', flag: false }); nav.render(); } } }, 'Сбросить')),
      ...FILTERS.map((g) => h('div', { class: 'stack-s' }, h('span', { class: 'muted small' }, g.label),
        h('div', { class: 'chips wrap' }, ...g.chips.map(([label, v]) => h('button', { type: 'button',
          class: `chip-btn${draft[g.key] === v ? ' on' : ''}`, 'aria-pressed': String(draft[g.key] === v),
          on: { click: () => { tap(); draft[g.key] = v; nav.render(); } } }, label))))),
      h('label', { class: 'toggle' }, h('span', {}, 'Только с «!» — на разборе'),
        h('input', { type: 'checkbox', checked: draft.flag, on: { change: (e) => { draft.flag = e.target.checked; } } })),
      h('button', { type: 'button', class: 'button', on: { click: () => {
        tap(); entry.f = { ...draft }; entry.sheet = false; entry.draft = null; loadOps(entry, nav); } } }, 'Показать')));
}

export function opsScreen(entry, nav) {
  const list = days(entry);
  const last = entry.pages[entry.pages.length - 1];
  let body;
  if (entry.error && !entry.pages.length) {
    body = h('div', { class: 'empty' }, h('h2', {}, 'Капуста не отвечает'),
      h('p', { class: 'muted' }, 'Операции приходят с Мака. Мак спит или Капуста перезапускается.'),
      h('button', { type: 'button', class: 'button', on: { click: () => { tap(); loadOps(entry, nav); } } }, 'Повторить'),
      h('p', { class: 'small detail muted' }, entry.error));
  } else if (!entry.pages.length) {
    body = h('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': 'Загрузка' },
      ...[1, 2, 3].map(() => h('section', { class: 'card', style: { height: '160px' } })));
  } else if (!list.length) {
    body = h('div', { class: 'empty' }, h('h2', {}, emptyText(entry.month, entry.ctx && entry.ctx.title)),
    h('p', { class: 'muted' }, 'Смените месяц или фильтры.'));
  } else {
    body = h('div', { class: 'stack' }, ...list.map((d) => h('div', { class: 'day' },
      h('div', { class: 'day-head muted small' }, h('span', {}, dayLabel(d.date)), d.sum ? h('span', {}, money(d.sum)) : null),
      h('section', { class: 'card list' }, ...d.ops.map((op, i) => opLine(opRow(op, { inCategory: !!entry.ctx }), nav,
        { expanded: entry.expanded, key: `${d.date}:${i}:${op.where}` }))))),
    last && last.next ? h('button', { type: 'button', class: 'more card', disabled: entry.loading,
      on: { click: () => { tap(); loadOps(entry, nav, true); } } }, entry.loading ? 'Загружаю…' : 'Показать ещё') : null);
  }
  const screen = h('div', { class: 'screen with-tabs' }, entry.ctx ? head(entry, nav) : toolbar(entry, nav), body,
    entry.sheet ? sheet(entry, nav) : null);
  const more = screen.querySelector('.more');
  if (more && 'IntersectionObserver' in globalThis) {           // долистали до конца — следующие 50 сами
    const seen = new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) { seen.disconnect(); loadOps(entry, nav, true); } });
    seen.observe(more);
  }
  return screen;
}

export async function loadCard(entry, nav) {
  const r = await nav.get(`/api/tx/${encodeURIComponent(entry.ref)}`);
  if (r.error === 'stale' || r.error === 'stranger') return nav.problem(r.error);
  entry.data = r.data || null;
  entry.error = r.error ? (r.detail || 'нет такой операции') : null;
  nav.render();
}

export function cardScreen(entry, nav) {
  if (!entry.data) {
    return h('div', { class: 'screen' }, entry.error
      ? h('div', { class: 'empty' }, h('h2', {}, 'Операцию не открыть'), h('p', { class: 'muted small' }, entry.error))
      : h('section', { class: 'card', style: { height: '220px' }, 'aria-busy': 'true' }));
  }
  const c = cardView(entry.data);
  const r = c.row;
  const line = (name, value, sub) => h('div', { class: 'line' },
    h('span', { class: 'grow' }, h('span', {}, name), sub ? h('span', { class: 'muted small' }, sub) : null),
    h('span', { class: 'nowrap' }, value));
  return h('div', { class: 'screen' },
    h('section', { class: 'card pad stack' },
      h('div', { class: 'op-where' }, h('h1', { class: 'card-title' }, c.title),
        ...r.marks.map((m) => h('span', { class: `mark${m === '!' ? ' bad' : m === 'секрет' ? ' secret' : ''}` }, m))),
      c.what ? h('p', { class: 'muted' }, c.what) : null,
      h('div', { class: 'big' }, h('span', { class: `big-num${r.gray ? ' muted' : ''}` }, r.amount),
        r.amountSub ? h('span', { class: 'muted' }, r.amountSub) : null),
      r.note ? h('div', { class: `small ${r.noteTone}` }, r.note) : null,
      h('div', { class: 'muted small' }, `${r.sub ? `${r.sub} · ` : ''}${c.when} · ${c.by}`)),
    h('div', { class: 'section-head' }, h('h2', {}, 'Проводки')),
    h('section', { class: 'card list' }, ...c.postings.map((p) => line(p.name, p.value))),
    c.receipt ? [h('div', { class: 'section-head' }, h('h2', {}, `Чек · ${c.receipt.shop}`)),
      h('section', { class: 'card list' }, ...c.receipt.items.map((it) => line(it.name, it.value,
        [it.line, it.sub].filter(Boolean).join(' · '))),
      h('div', { class: 'line' }, h('b', {}, 'Итого'), h('b', {}, c.receipt.total)),
      c.receipt.url ? h('button', { type: 'button', class: 'more', on: { click: () => {
        tap(); try { tg.openLink(c.receipt.url); } catch { window.open(c.receipt.url, '_blank', 'noopener'); } } } },
      'Чек на сайте налоговой') : null)] : null,
    c.similar.length ? [h('div', { class: 'section-head' }, h('h2', {}, `Ещё в «${c.title}»`)),
      h('section', { class: 'card list' }, ...c.similar.map((s) => h('button', { type: 'button', class: 'line op',
        on: { click: () => { tap(); nav.push({ kind: 'card', ref: s.ref }); } } }, h('span', {}, s.label),
      h('span', {}, s.value))))] : null,
    c.refs ? h('p', { class: 'fresh muted small' }, c.refs) : null);
}
