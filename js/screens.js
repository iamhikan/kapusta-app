// Экраны «Операции» и карточка операции (DOM). Данные — только из /api/tx и /api/tx/{ref}, в памяти страницы.
import { h, icon, tap, ICONS, tg } from './dom.js';
import { FLAG, accountView, cardView, dayLabel, emptyText, filters, headView, money, monthRange, monthTitle, opRow, txPath } from './ops.js';
import { tile, tileOf } from './tiles.js';
import { shiftMonth } from './health.js';
import { canNext, periodEnd, shiftPeriod } from './period.js';
import { offline } from './snapshot.js';
import { body as jobBody, category, job, path as jobPath, picker, result } from './recat.js';
import { itemPrice } from './shop.js';

// фаза 15: ключи фокуса (js/a11y.js). Заголовок открытого экрана и лист принимают фокус скриптом; стрелка «вперёд»
// неактивна у текущего месяца — фокус на «назад»
export const TITLE = { 'data-focus': 'title', tabindex: '-1' };
export const DIALOG = { role: 'dialog', 'aria-modal': 'true', tabindex: '-1', 'data-focus': 'sheet' };
export const stepKey = (dir) => (dir < 0 ? { 'data-focus': 'month:prev' } : { 'data-focus': 'month:next', 'data-focus-alt': 'month:prev' });

export function newOps(month, ctx = null) {
  return { kind: 'ops', month, ctx, f: { q: '', transfers: false, account: '', who: '', source: '', flag: false },
    pages: [], error: null, loading: false, expanded: new Set(), sheet: false, scroll: 0 };
}

function range(entry, today) {
  // операции категории — за период «Категорий» (неделя, квартал, год, свой), остальные — за месяц
  const p = entry.ctx && entry.ctx.period;
  return p ? { from: p.from, to: periodEnd(p, today) } : monthRange(entry.month, today);
}

function query(entry, today, cursor = null) {
  return txPath({ ...range(entry, today), ...(entry.ctx ? entry.ctx.params : {}), ...entry.f, cursor });
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

// «1 500,50 RSD»: число и тихое «RSD» (ревью: у суммы нужна валюта, но не громче числа); прочие валюты — как есть
export function splitSum(text) {
  const m = /^(.*) RSD$/.exec(text || '');
  return m ? [m[1], 'RSD'] : [text, ''];
}
function sum(text, cls = '') {
  const [num, unit] = splitSum(text);
  return h('span', { class: cls }, num, unit ? [' ', h('span', { class: 'unit' }, unit)] : null);
}

function opLine(r, nav, opts = {}) {
  const inner = [
    h('span', { class: 'grow' },
      h('span', { class: 'op-where' }, h('span', { class: 'ellipsis' }, r.where),
        ...r.marks.map((m) => h('span', { class: `mark${m === '!' ? ' bad' : m === 'секрет' ? ' secret' : ''}` }, m))),
      r.sub ? h('span', { class: 'op-sub muted small' }, r.sub) : null,
      r.note ? h('span', { class: `op-note small ${r.noteTone}` }, r.note) : null),
    h('span', { class: 'op-amount' }, sum(r.amount, r.income ? 'good' : ''),
      r.amountSub ? h('span', { class: 'muted small' }, r.amountSub) : null),
  ];
  const cls = `op${r.gray ? ' gray' : ''}${opts.nested ? ' nested' : ''}`;
  if (r.group.length) {
    const open = opts.expanded.has(opts.key);
    return [h('button', { type: 'button', class: cls, 'aria-expanded': String(open), 'data-focus': `grp:${opts.key}`,
      on: { click: () => { tap(); open ? opts.expanded.delete(opts.key) : opts.expanded.add(opts.key); nav.render(); } } },
    ...inner), open ? r.group.map((g) => opLine(g, nav, { nested: true })) : null];
  }
  if (!r.ref) return h('div', { class: cls }, ...inner);        // теневая у Ангелины — без карточки (решение 24)
  return h('button', { type: 'button', class: cls, 'data-focus': `op:${r.ref}`,
    on: { click: () => { tap(); nav.push({ kind: 'card', ref: r.ref }); } } }, ...inner);
}

function head(entry, nav) {
  const body = entry.pages[0] || { total: 0, count: 0 };
  const ctx = entry.ctx;
  const today = nav.today();
  const v = headView({ title: ctx.title, limit: nav.limitOf(ctx, entry.month), note: nav.noteOf(ctx, entry.month),
    month: entry.month, period: ctx.period, to: range(entry, today).to }, body);
  const shift = (dir) => {
    if (ctx.period) entry.ctx = { ...ctx, period: shiftPeriod(ctx.period, dir) };
    else entry.month = shiftMonth(entry.month, dir);
  };
  const arrow = (dir, label, d, enabled = true) => h('button', { class: 'arrow', type: 'button', 'aria-label': label,
    disabled: !enabled, ...stepKey(dir), on: { click: () => { tap(); shift(dir); loadOps(entry, nav); } } }, icon(d));
  const word = ctx.period ? 'период' : 'месяц';
  return h('section', { class: 'card pad stack' },
    h('div', { class: 'month' }, arrow(-1, `Прошлый ${word}`, ICONS.left),
      h('div', { class: 'month-title' }, h('h1', TITLE, v.title), h('p', { class: 'muted small' }, v.period)),
      arrow(1, `Следующий ${word}`, ICONS.right, ctx.period ? canNext(ctx.period, today) : entry.month < today.slice(0, 7))),
    h('div', { class: 'big' }, h('span', { class: `big-num ${v.tone}` }, v.sum),
      h('span', { class: `muted ${v.tone}` }, v.note || 'RSD')),
    v.fill == null ? null : h('span', { class: 'bar thin' },
      h('span', { class: `fill ${v.tone}`, style: { width: `${(v.fill * 100).toFixed(1)}%` } })),
    h('div', { class: 'muted small' }, v.sub));
}

function accountHead(entry, nav) {
  // решение 48: «Операции» счёта — плитка, имя, остаток сейчас, пришло и ушло за месяц списка
  const acc = entry.f.account;
  const name = (nav.accounts().find(([, a]) => a === acc) || [acc.split(':').pop()])[0];
  const bal = nav.balanceOf(acc) || { name: name.charAt(0).toUpperCase() + name.slice(1), lines: [], tile: tileOf(acc, name) };
  const v = accountView(bal, entry.pages[0] || { count: 0 }, entry.month);
  return h('section', { class: 'card pad stack acct' },
    h('div', { class: 'acct-top' }, tile(v.tile, 40),
      h('div', { class: 'grow' }, h('h2', { class: 'acct-name', ...TITLE }, v.title), h('span', { class: 'muted small' }, v.sub)),
      v.lines.length ? h('div', { class: 'bal-amounts' }, h('span', { class: 'muted small' }, v.label),
        ...v.lines.map((l, i) => h('span', { class: i ? 'muted small' : 'num' }, l))) : null),
    v.flow.length ? h('div', { class: 'acct-flow' }, ...v.flow.map(([k, val]) => h('div', {},
      h('span', { class: 'muted small' }, k), h('span', { class: 'num' }, val)))) : null);
}

function toolbar(entry, nav) {
  const f = entry.f;
  const chip = (key, label, on, click, d) => h('button', { type: 'button', class: `chip-btn${on ? ' on' : ''}`,
    'aria-pressed': String(!!on), 'data-focus': key, on: { click: () => { tap(); click(); } } }, d ? icon(d, 14) : null, label);
  // снятый фильтр пропадает из ряда — фокус на «Фильтры»
  const off = (key) => () => { f[key] = key === 'flag' ? false : ''; nav.focus('filters'); loadOps(entry, nav); };
  const active = filters(nav.accounts()).flatMap((g) => g.chips.filter(([, v]) => v && f[g.key] === v)
    .map(([label]) => chip(`off:${g.key}`, label, true, off(g.key), ICONS.close)));
  if (f.flag) active.push(chip('off:flag', '«!»', true, off('flag'), ICONS.close));
  const search = h('label', { class: 'search' }, icon(ICONS.search, 18),
    h('input', { type: 'search', id: 'ops-q', 'data-focus': 'ops-q', placeholder: 'Поиск: где, что, товар', value: entry.typed ?? f.q, enterkeyhint: 'search',
      'aria-label': 'Поиск по операциям',
      on: { input: (e) => {
        entry.typed = e.target.value;                 // перерисовка во время запроса не вернёт старый текст
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => { f.q = entry.typed; loadOps(entry, nav); }, 350);
      } } }));
  // «Фильтры» — в строке поиска: месяц, «Фильтры» и «Переводы» в один ряд не помещались (ревью, 403 px из 358)
  return h('div', { class: 'toolbar' }, h('div', { class: 'search-row' }, search,
    chip('filters', 'Фильтры', false, () => { entry.sheet = true; nav.focus('sheet'); nav.render(); }, ICONS.filter)),
    h('div', { class: 'chips wrap' },
      h('span', { class: 'chip-month' },
        h('button', { type: 'button', class: 'arrow small-arrow', 'aria-label': 'Прошлый месяц', ...stepKey(-1),
          on: { click: () => { tap(); entry.month = shiftMonth(entry.month, -1); loadOps(entry, nav); } } }, icon(ICONS.left, 16)),
        h('span', {}, monthTitle(entry.month)),
        h('button', { type: 'button', class: 'arrow small-arrow', 'aria-label': 'Следующий месяц', ...stepKey(1),
          disabled: entry.month >= nav.today().slice(0, 7),
          on: { click: () => { tap(); entry.month = shiftMonth(entry.month, 1); loadOps(entry, nav); } } }, icon(ICONS.right, 16))),
      chip('transfers', 'Переводы', f.transfers, () => { f.transfers = !f.transfers; loadOps(entry, nav); }, ICONS.transfer),
      ...active));
}

function sheet(entry, nav) {
  const draft = entry.draft || (entry.draft = { ...entry.f });
  const close = () => { entry.sheet = false; entry.draft = null; nav.focus('filters'); nav.render(); };
  return h('div', { class: 'sheet-back', on: { click: (e) => { if (e.target === e.currentTarget) close(); } } },
    h('div', { class: 'sheet', ...DIALOG, 'aria-label': 'Фильтры' },
      h('div', { class: 'row' }, h('h2', {}, 'Фильтры'),
        h('button', { type: 'button', class: 'link', 'data-focus': 'sheet:reset', on: { click: () => {
          tap(); Object.assign(draft, { account: '', who: '', source: '', flag: false }); nav.render(); } } }, 'Сбросить')),
      ...filters(nav.accounts()).map((g) => h('div', { class: 'stack-s' }, h('span', { class: 'muted small' }, g.label),
        h('div', { class: 'chips wrap' }, ...g.chips.map(([label, v]) => h('button', { type: 'button',
          class: `chip-btn${draft[g.key] === v ? ' on' : ''}`, 'aria-pressed': String(draft[g.key] === v), 'data-focus': `f:${g.key}:${v}`,
          on: { click: () => { tap(); draft[g.key] = v; nav.render(); } } },
        g.key === 'account' && v ? tile(tileOf(v, label), 18) : null, label))))),
      h('label', { class: 'toggle' }, h('span', {}, FLAG),
        h('input', { type: 'checkbox', checked: draft.flag, 'data-focus': 'sheet:flag', on: { change: (e) => { draft.flag = e.target.checked; } } })),
      h('button', { type: 'button', class: 'button', 'data-focus': 'sheet:show', on: { click: () => {
        tap(); entry.f = { ...draft }; entry.sheet = false; entry.draft = null; nav.focus('filters'); loadOps(entry, nav); } } },
      'Показать')));
}

export function offlineBody(kind, entry, nav, retry) {
  // холст 6.2: Мак молчит — «Повторить» и ссылка на снимок «Здоровья» (операций и категорий в снимке нет)
  const o = offline(kind, nav.hasSnap);
  return h('div', { class: 'empty', 'data-say': `${o.title}. ${o.text}` }, h('h2', {}, o.title), h('p', { class: 'muted' }, o.text),
    h('button', { type: 'button', class: 'button', 'data-focus': 'retry', on: { click: () => { tap(); retry(); } } }, 'Повторить'),
    o.link ? h('button', { type: 'button', class: 'link', 'data-focus': 'snapshot', on: { click: () => nav.snapshot() } }, o.link) : null,
    h('p', { class: 'small detail muted' }, entry.error));
}

export function opsScreen(entry, nav) {
  const list = days(entry);
  const last = entry.pages[entry.pages.length - 1];
  let body;
  if (entry.error && !entry.pages.length) {
    body = offlineBody('ops', entry, nav, () => loadOps(entry, nav));
  } else if (!entry.pages.length) {
    body = h('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': 'Загрузка' },
      ...[1, 2, 3].map(() => h('section', { class: 'card', style: { height: '160px' } })));
  } else if (!list.length) {
    body = h('div', { class: 'empty' }, h('h2', {}, emptyText(entry.month, entry.ctx && entry.ctx.title,
      entry.ctx && entry.ctx.period)), h('p', { class: 'muted' }, 'Смените период или фильтры.'));
  } else {
    body = h('div', { class: 'stack' }, ...list.map((d) => h('div', { class: 'day' },
      h('div', { class: 'day-head muted small' }, h('span', {}, dayLabel(d.date)), d.sum ? h('span', {}, money(d.sum)) : null),
      h('section', { class: 'card list' }, ...d.ops.map((op, i) => opLine(opRow(op, { inCategory: !!entry.ctx,
        account: entry.ctx ? '' : entry.f.account }), nav,
        { expanded: entry.expanded, key: `${d.date}:${i}:${op.where}` }))))),
    last && last.next ? h('button', { type: 'button', class: 'more card', disabled: entry.loading, 'data-focus': 'ops-more',
      on: { click: () => { tap(); loadOps(entry, nav, true); } } }, entry.loading ? 'Загружаю…' : 'Показать ещё') : null);
  }
  const top = entry.ctx ? head(entry, nav) : [entry.f.account ? accountHead(entry, nav) : null, toolbar(entry, nav)];
  const screen = h('div', { class: 'screen with-tabs' }, top, body,
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
  const waiting = nav.queued(entry.ref);          // смена ждёт в очереди с прошлого раза (холст card-error)
  if (waiting.length && !entry.notice) entry.notice = { tone: 'warn', text: result({ error: 'down' }, waiting[0]).text };
  nav.render();
}

const names = (card) => {
  const m = new Map((card.change ? card.change.choices : []).map((c) => [c.account, c.name]));
  return (a) => m.get(a) || a.split(':').pop().toLowerCase();
};

async function submit(entry, nav, to) {
  // одно нажатие — одна смена: кнопка «Меняем…» не нажимается, id нажатия защищает и от повтора из очереди
  const p = entry.picker;
  if (!p || p.saving) return;
  p.saving = true;
  nav.render();
  const j = job(entry.data, to, { n: p.item });
  const r = await nav.post(jobPath(j), jobBody(j));
  if (r.error === 'stale' || r.error === 'stranger') return nav.problem(r.error);
  const res = result(r, j, names(entry.data));
  entry.picker = null;
  nav.focus(p.from);
  if (res.kind === 'done') {
    entry.data = r.data.card;
    entry.notice = { tone: 'good', text: res.text };
    if (j.n != null) entry.changed = { n: j.n, text: `${j.from} → ${j.toName}` };
    nav.changed();
  } else if (res.kind === 'queued') {
    const ok = await nav.enqueue(j);
    entry.notice = ok ? { tone: 'warn', text: res.text, cancel: j.id }
      : { tone: 'bad', text: 'Капуста не отвечает, а очередь смен заполнена. Смените, когда Мак проснётся.' };
  } else {
    entry.notice = { tone: res.kind === 'conflict' ? 'warn' : 'bad', text: res.text };
    if (res.kind === 'conflict') return loadCard(entry, nav);
  }
  nav.render();
}

function notice(entry, nav) {
  // холст card-done / card-item-done / card-error: итог смены над карточкой
  const n = entry.notice;
  if (!n) return null;
  const cancel = n.cancel ? h('button', { type: 'button', class: 'link', 'data-focus': 'notice:cancel', on: { click: async () => {
    tap(); await nav.unqueue(n.cancel); entry.notice = null; nav.focus(entry.data.change ? 'recat' : 'title'); nav.render(); } } },
  'Отменить') : null;
  // диктор слышит итог из своей живой зоны (data-say), а не перечитывает экран
  return h('div', { class: `offline notice ${n.tone}`, 'data-say': n.text }, h('span', { class: 'offline-text' }, n.text),
    cancel);
}

function categoryRow(entry, nav) {
  const card = entry.data;
  const waiting = nav.queued(card.ref).find((j) => j.n == null);
  const c = category(card, waiting);
  return h('section', { class: 'card list' }, h('div', { class: 'line' },
    h('span', { class: 'grow' }, h('span', { class: 'muted small' }, 'Категория'),
      h('span', { class: c.queued ? 'muted' : '' }, c.text)),
    c.queued ? h('span', { class: 'mark secret' }, 'в очереди') : null,
    c.can ? h('button', { type: 'button', class: 'link', 'data-focus': 'recat', on: { click: () => {
      tap(); entry.picker = { item: null, q: '', chosen: null, all: false, group: null, from: 'recat' }; nav.focus('sheet');
      nav.render(); } } }, 'Сменить') : null));
}

function pickerSheet(entry, nav) {
  // холст card-picker / card-item: «Часто», поиск, «Все категории», «Сменить на …»; позиция — только она
  const p = entry.picker;
  const card = entry.data;
  const v = picker(card, p);
  const close = () => { entry.picker = null; nav.focus(p.from); nav.render(); };
  const choice = (c) => h('button', { type: 'button', class: `line op choice${c.on ? ' on' : ''}`,
    'aria-pressed': String(c.on), 'data-focus': `cat:${c.account}`, on: { click: () => { tap(); p.chosen = c.account; nav.render(); } } },
  h('span', { class: 'grow' }, h('span', {}, c.name)), c.hint ? h('span', { class: 'muted small' }, c.hint) : null);
  const it = p.item == null ? null : card.receipt.items[p.item];
  // решение 39: «Все категории» — верхние; категория с подкатегориями открывает их, первой — она сама
  const group = (g) => (g.subs ? h('button', { type: 'button', class: `line op choice${g.on ? ' on' : ''}`,
    'aria-label': `${g.name}${g.hint ? `, ${g.hint}` : ''}: подкатегории, ${g.subs + 1}`, 'data-focus': `catg:${g.account}`,
    on: { click: () => { tap(); p.group = g.account; nav.focus('cats-back'); nav.render(); } } },
  h('span', { class: 'grow' }, h('span', {}, g.name), g.hint ? h('span', { class: 'muted small' }, g.hint) : null),
  h('span', { class: 'muted small' }, String(g.subs + 1)), icon(ICONS.right, 16)) : choice(g));
  let lists;
  if (p.group && v.subs) {
    lists = [h('button', { type: 'button', class: 'link back-link', 'data-focus': 'cats-back', on: { click: () => {
      tap(); nav.focus(`catg:${p.group}`); p.group = null; nav.render(); } } },
      icon(ICONS.left, 16), 'Все категории'), h('div', { class: 'muted small' }, v.groupTitle),
    h('section', { class: 'card list' }, ...v.subs.map(choice))];
  } else if (v.often) {
    lists = [h('div', { class: 'muted small' }, 'Часто'), h('section', { class: 'card list' }, ...v.often.map(choice)),
      h('button', { type: 'button', class: 'link', 'aria-expanded': String(p.all), 'data-focus': 'cats-all',
        on: { click: () => { tap(); p.all = !p.all; nav.render(); } } }, v.allLabel),
      p.all ? h('section', { class: 'card list' }, ...v.groups.map(group)) : null];
  } else {
    lists = [v.all.length ? h('section', { class: 'card list' }, ...v.all.map(choice))
      : h('p', { class: 'muted small' }, 'Такой категории нет')];
  }
  // решение 37: в листе позиции сверху — «История цены» (холст card-item)
  const price = it ? h('button', { type: 'button', class: 'line op card price-row', 'data-focus': 'price', on: { click: () => {
    tap(); entry.picker = null; nav.push({ kind: 'price', q: itemPrice(card, p.item) }, p.from); } } },
  h('span', { class: 'grow' }, h('span', {}, 'История цены'), h('span', { class: 'muted small' }, 'по чекам всех сетей')),
  icon(ICONS.right, 16)) : null;
  return h('div', { class: 'sheet-back', on: { click: (e) => { if (e.target === e.currentTarget) close(); } } },
    h('div', { class: 'sheet', ...DIALOG, 'aria-label': v.title },
      h('div', { class: 'row' }, h('h2', {}, v.title),
        h('button', { type: 'button', class: 'link', 'data-focus': 'sheet:cancel', on: { click: () => { tap(); close(); } } }, 'Отмена')),
      it ? h('p', { class: 'muted small' }, [`${money(it.total)} RSD`, card.where, it.kind ? `вид «${it.kind}»` : '']
        .filter(Boolean).join(' · ')) : null,
      price,
      h('label', { class: 'search' }, icon(ICONS.search, 18),
        h('input', { type: 'search', id: 'cat-q', 'data-focus': 'cat-q', placeholder: 'Найти категорию', value: p.q, 'aria-label': 'Найти категорию',
          on: { input: (e) => { p.q = e.target.value; nav.render(); } } })),
      ...lists,
      it ? h('p', { class: 'muted small' },
        'Меняется только эта позиция — и в следующих чеках с ней. Весь чек — «Сменить» в строке «Категория».') : null,
      h('button', { type: 'button', class: 'button', disabled: v.button.disabled || p.saving,
        'data-focus': 'sheet:submit', 'data-focus-alt': 'sheet', on: { click: () => { tap(); submit(entry, nav, p.chosen); } } }, p.saving ? 'Меняем…' : v.button.label)));
}

export function cardScreen(entry, nav) {
  if (!entry.data) {
    return h('div', { class: 'screen' }, entry.error
      ? h('div', { class: 'empty', 'data-say': `Операцию не открыть: ${entry.error}` }, h('h2', {}, 'Операцию не открыть'),
        h('p', { class: 'muted small' }, entry.error))
      : h('section', { class: 'card', style: { height: '220px' }, 'aria-busy': 'true' }));
  }
  const c = cardView(entry.data);
  const r = c.row;
  const [bigNum, bigUnit] = splitSum(r.amount);
  const line = (name, value, sub) => h('div', { class: 'line' },
    h('span', { class: 'grow' }, h('span', {}, name), sub ? h('span', { class: 'muted small' }, sub) : null),
    h('span', { class: 'nowrap' }, value));
  const canItems = !!entry.data.change;
  const waitingItems = new Set(nav.queued(entry.data.ref).filter((j) => j.n != null).map((j) => j.n));
  const item = (it, n) => {
    const changed = entry.changed && entry.changed.n === n;
    const sub = changed ? entry.changed.text : waitingItems.has(n) ? `${it.sub} · в очереди`
      : [it.line, it.sub].filter(Boolean).join(' · ');
    const kids = [h('span', { class: 'grow' }, h('span', {}, it.name),
      h('span', { class: `small ${changed ? 'good' : 'muted'}` }, sub)), h('span', { class: 'nowrap' }, it.value)];
    if (!canItems) {   // сменить нельзя — тап сразу открывает историю цены (решение 37)
      return h('button', { type: 'button', class: 'line op', 'data-focus': `item:${n}`,
        on: { click: () => { tap(); nav.push({ kind: 'price', q: itemPrice(entry.data, n) }); } } }, ...kids);
    }
    return h('button', { type: 'button', class: `line op${changed ? ' changed' : ''}`, 'data-focus': `item:${n}`,
      on: { click: () => { tap(); entry.picker = { item: n, q: '', chosen: null, all: false, group: null, from: `item:${n}` };
        nav.focus('sheet'); nav.render(); } } }, ...kids);
  };
  return h('div', { class: 'screen' },
    notice(entry, nav),
    h('section', { class: 'card pad stack' },
      h('div', { class: 'op-where' }, h('h1', { class: 'card-title', ...TITLE }, c.title),
        ...r.marks.map((m) => h('span', { class: `mark${m === '!' ? ' bad' : m === 'секрет' ? ' secret' : ''}` }, m))),
      c.what ? h('p', { class: 'muted' }, c.what) : null,
      h('div', { class: 'big' }, h('span', { class: `big-num${r.gray ? ' muted' : ''}` }, bigNum),
        bigUnit ? h('span', { class: 'muted' }, bigUnit) : null, r.amountSub ? h('span', { class: 'muted' }, r.amountSub) : null),
      r.note ? h('div', { class: `small ${r.noteTone}` }, r.note) : null,
      h('div', { class: 'muted small' }, `${r.sub ? `${r.sub} · ` : ''}${c.when} · ${c.by}`)),
    entry.data.kind === 'spend' ? categoryRow(entry, nav) : null,
    h('div', { class: 'section-head' }, h('h2', {}, 'Откуда и куда')),   // решение 51: было «Проводки»
    h('section', { class: 'card list' }, ...c.postings.map((p) => line(p.name, p.value))),
    c.receipt ? [h('div', { class: 'section-head' }, h('h2', {}, `Чек · ${c.receipt.shop}`),
      h('span', { class: 'muted small' }, canItems ? 'тап — цена и категория позиции' : 'тап — история цены')),
    h('section', { class: 'card list' }, ...c.receipt.items.map(item),
      h('div', { class: 'line' }, h('b', {}, 'Итого'), h('b', {}, c.receipt.total)),
      c.receipt.url ? h('button', { type: 'button', class: 'more', 'data-focus': 'receipt-url', on: { click: () => {
        tap(); try { tg.openLink(c.receipt.url); } catch { window.open(c.receipt.url, '_blank', 'noopener'); } } } },
      'Чек на сайте налоговой') : null)] : null,
    c.similar.length ? [h('div', { class: 'section-head' }, h('h2', {}, `Ещё в «${c.title}»`)),
      h('section', { class: 'card list' }, ...c.similar.map((s) => h('button', { type: 'button', class: 'line op',
        'data-focus': `op:${s.ref}`, on: { click: () => { tap(); nav.push({ kind: 'card', ref: s.ref }); } } }, h('span', {}, s.label),
      h('span', {}, s.value))))] : null,
    entry.picker ? pickerSheet(entry, nav) : null);
}
