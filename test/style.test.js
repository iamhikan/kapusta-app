// Доступность по style.css (фаза 12): контраст своих цветов, кольцо фокуса, область касания 44 px.
// Цвета темы Telegram (--tg-theme-*) задаёт клиент; здесь — их запасные значения из макета «Родной».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const RULES = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
  sels: sel.trim().split(',').map((s) => s.trim()),
  decls: Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(':');
    return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
  })),
}));

// объявления правил с этим селектором, по порядку в файле
const decls = (sel) => Object.assign({}, ...RULES.filter((r) => r.sels.includes(sel)).map((r) => r.decls));
const THEMES = { light: decls(':root'), dark: { ...decls(':root'), ...decls(':root[data-scheme="dark"]') } };

function resolve(value, vars) {
  let v = value;
  for (let i = 0; i < 20 && v.includes('var('); i += 1) {
    v = v.replace(/var\((--[\w-]+)(?:,\s*((?:[^()]|\([^()]*\))*))?\)/, (_, name, fallback) => {
      if (vars[name] != null) return vars[name];
      if (fallback != null) return fallback.trim();
      throw new Error(`нет ${name}`);
    });
  }
  return v;
}

// цвет: [r, g, b, a], r g b — 0..255
function color(v, current) {
  v = v.trim();
  if (v === 'transparent') return [0, 0, 0, 0];
  if (v === 'currentColor') return current;
  if (v.startsWith('#')) {
    const x = v.length === 4 ? [...v.slice(1)].map((c) => c + c).join('') : v.slice(1);
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)).concat(1);
  }
  let m = v.match(/^rgba?\(([^)]*)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  m = v.match(/^color-mix\(in srgb,\s*(.+)\)$/);
  if (m) {
    const parts = split(m[1]).map((s) => {
      const pm = s.match(/^(.*?)\s+(\d+(?:\.\d+)?)%$/);
      return pm ? [color(pm[1], current), Number(pm[2]) / 100] : [color(s, current), null];
    });
    const [[a, pa], [b, pb]] = parts;
    const wa = pa ?? 1 - pb;
    const wb = pb ?? 1 - wa;
    const alpha = a[3] * wa + b[3] * wb;
    if (!alpha) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (a[i] * a[3] * wa + b[i] * b[3] * wb) / alpha).concat(alpha);
  }
  throw new Error(`не цвет: ${v}`);
}

function split(s) {
  // «a, b» с учётом скобок
  const out = [];
  let depth = 0;
  let cur = '';
  for (const c of s) {
    if (c === ',' && !depth) { out.push(cur.trim()); cur = ''; continue; }
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    cur += c;
  }
  return out.concat(cur.trim());
}

const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
const lum = (c) => {
  const [r, g, b] = c.slice(0, 3).map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// стиль элемента по его классам: правила из одних классов («.chip», «.chip.bad»), что подходят, — по числу классов,
// затем по порядку в файле (как каскад для таких селекторов)
function styleOf(classes) {
  const has = new Set(classes.split(/\s+/).filter(Boolean));
  const hits = [];
  RULES.forEach((r, i) => r.sels.forEach((s) => {
    if (!/^(\.[\w-]+)+$/.test(s)) return;
    const need = s.slice(1).split('.');
    if (need.every((c) => has.has(c))) hits.push([need.length, i, r.decls]);
  }));
  return Object.assign({}, ...hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , d]) => d));
}

// контраст текста элемента к его подложке на карточке (--card); подложка — свой фон или фон строки (bgClasses)
function contrast(theme, classes, bgClasses = classes) {
  const vars = THEMES[theme];
  const card = color(resolve('var(--card)', vars));
  const ink = (st) => color(resolve(st.color || 'var(--fg)', vars));
  const fg = ink(styleOf(classes));
  const bgStyle = styleOf(bgClasses);
  const bg = over(color(resolve(bgStyle.background || 'transparent', vars), ink(bgStyle)), card);
  return ratio(over(fg, bg), bg);
}

// мелкий текст своих цветов: метки, значки, плашки, клетки «По дням» (ревью Impeccable 11.11)
const SMALL = [
  ['метка «чек»', 'mark'],
  ['метка «!»', 'mark bad'],
  ['метка «секрет»', 'mark secret'],
  ['значок «+N» у лимита', 'badge'],
  ['значок «+N», покрыто резервом', 'badge calm'],   // решение 63
  ['плашка «в норме»', 'chip good'],
  ['плашка «тратим быстрее плана»', 'chip fast'],
  ['плашка «тратим отложенное»', 'chip warn'],
  ['плашка «сверх»', 'chip bad'],
  ['зелёный текст', 'good', ''],
  ['жёлтый текст', 'fast', ''],
  ['оранжевый текст', 'warn', ''],
  ['новая категория позиции', 'small good', 'line op changed'],
  ['день «в плане»', 'day-cell tone-good'],
  ['день «выше плана»', 'day-cell tone-warn'],
  ['день «вдвое выше»', 'day-cell tone-bad'],
  ['день, который не прошёл', 'day-cell future'],   // серый текста — тема Telegram, подложка — своя
  ...[0, 1, 2, 3, 4].map((n) => [`день по сумме, оттенок ${n}`, `day-cell heat-${n}`]),
  // белый на цвете ссылки Telegram — 4,13 в светлой и 3,46 в тёмной; заливка — своя, темнее (Алексей 12.11, фаза 14)
  ['выбранный чип', 'chip-btn on'],
  ['выбранный сегмент', 'seg on'],
];

for (const theme of ['light', 'dark']) {
  test(`${theme === 'light' ? 'светлая' : 'тёмная'} тема: мелкий текст своих цветов — не ниже 4,5:1`, () => {
    const low = SMALL.map(([name, fg, bg]) => [name, contrast(theme, fg, bg)]).filter(([, r]) => r < 4.5)
      .map(([name, r]) => `${name} ${r.toFixed(2)}:1`);
    assert.deepEqual(low, []);
  });
}

test('кольцо фокуса с клавиатуры — на кнопках, ссылках и полях: цвет --accent, с отступом', () => {
  const ring = RULES.filter((r) => r.sels.some((s) => s.includes(':focus-visible')));
  const covered = ring.flatMap((r) => r.sels);
  for (const el of ['button', 'a', 'input']) {
    assert.ok(covered.some((s) => s === ':focus-visible' || s.startsWith(`${el}:focus-visible`)), el);
  }
  const base = ring.find((r) => /var\(--accent\)/.test(r.decls.outline || ''));
  assert.ok(base, 'outline из --accent');
  assert.ok(base.decls['outline-offset'], 'с отступом');
});

test('поле поиска без своей обводки показывает фокус рамкой поля', () => {
  assert.equal(decls('.search input').outline, 'none');
  assert.match(decls('.search:focus-within').outline || '', /var\(--accent\)/);
});

// область касания: видимый размер (min-height, вместе с рамкой) + невидимая добавка ::after; её inset считается от
// края внутри рамки, поэтому рамку вычитаем. 44 px — минимум Apple
const px = (v) => Number(String(v).replace('px', '')) || 0;
function hit(sel) {
  const d = decls(sel);
  const a = decls(`${sel}::after`);
  const border = px((d.border || '').split(/\s+/)[0]);
  const [t, r = t, b = t, l = r] = (a.inset || '0').split(/\s+/).map((v) => -px(v) - border);
  return { h: px(d['min-height']) + t + b, w: px(d['min-width']) + l + r, y: t, after: a };
}

test('касание: чипы и стрелки месяца в «Операциях», чипы периода и «Шкала / Все траты» — не меньше 44 px', () => {
  assert.ok(hit('.chip-btn').h >= 44, `чип ${hit('.chip-btn').h}`);
  assert.ok(hit('.seg').h >= 44, `шкала / все траты ${hit('.seg').h}`);
  const arrow = hit('.small-arrow');
  assert.ok(arrow.h >= 44 && arrow.w >= 44, `стрелка ${arrow.w}×${arrow.h}`);
  for (const sel of ['.chip-btn', '.seg', '.small-arrow']) {
    assert.equal(decls(sel).position, 'relative', sel);
    assert.equal(hit(sel).after.position, 'absolute', sel);
  }
  // ряд чипов прокручивается вбок и обрезает всё за своим краем: добавка касания — внутри его полей
  assert.ok(px(decls('.chips')['padding-block']) >= hit('.chip-btn').y, 'поля ряда чипов');
  // чипы «Операций» и фильтров переносятся в два ряда: добавки соседних рядов не заходят друг на друга
  assert.ok(px(decls('.chips.wrap')['row-gap']) >= 2 * hit('.chip-btn').y, `зазор рядов ${decls('.chips.wrap')['row-gap']}`);
});

test('слова только для диктора (.sr) не видны на экране и не сдвигают строку', () => {
  const sr = decls('.sr');
  assert.equal(sr.position, 'absolute');
  assert.equal(sr.width, '1px');
  assert.equal(sr.height, '1px');
  assert.equal(sr.overflow, 'hidden');
  assert.match(sr['clip-path'] || '', /inset\(50%\)/);
});

test('тысячи в клетке дня — не мельче 11 px (детектор: 10 px ниже порога)', () => {
  assert.ok(px(decls('.day-k')['font-size']) >= 11, decls('.day-k')['font-size']);
});

test('подсказка в поле поиска — серый темы, а не браузера (серый браузера на тёмной карточке — 3,7:1)', () => {
  assert.equal(decls('.search input::placeholder').color, 'var(--muted)');
  assert.equal(decls('.search input::placeholder').opacity, '1');
});

test('подписи под списками переносятся без висячего слова в последней строке (детектор: «должны.» одно)', () => {
  assert.equal(decls('.note-text')['text-wrap'], 'pretty');
});

test('неактивная стрелка месяца видна, но тише активной (ревью: цвет линии на карточке не видно) — в обеих темах', () => {
  for (const theme of ['light', 'dark']) {
    const vars = THEMES[theme];
    const card = color(resolve('var(--card)', vars));
    const on = ratio(over(color(resolve(decls('.arrow').color, vars)), card), card);
    const off = ratio(over(color(resolve(decls('.arrow:disabled').color, vars)), card), card);
    assert.ok(off >= 1.8 && off < on, `${theme}: неактивная ${off.toFixed(2)}:1, активная ${on.toFixed(2)}:1`);
  }
});

test('три числа под «Потрачено» — на одной линии, подписи — от верха, даже если одна в строку, а другие — в две', () => {
  // «Осталось из нормы» и «Весь доход, осталось» на 390 px — в две строки, «Можно в день» — в одну. Алексей 12.11:
  // числа стояли на разной высоте; после align-items: end (p15a) подпись в одну строку уехала вниз (фаза 15)
  assert.notEqual(decls('.stats')['align-items'], 'end', 'ячейки — во всю высоту ряда');
  const cell = decls('.stats > div');
  assert.equal(cell.display, 'flex');
  assert.equal(cell['flex-direction'], 'column');
  assert.equal(cell['justify-content'], 'space-between', 'подпись — сверху, число — снизу');
});

// фаза 15 (critique 12.11): неактивная основная кнопка — серая; ссылки листа — на его фоне (--bg), не ниже 4,5:1
test('неактивная основная кнопка («Выберите категорию») выглядит неактивной: серая подложка и серый текст', () => {
  const off = decls('.button:disabled');
  assert.ok(off.background && off.background !== decls('.button').background, `подложка ${off.background}`);
  assert.equal(off.color, 'var(--muted)');
  assert.equal(off.cursor, 'default');
});

test('ссылки на листе («Сбросить», «Отмена», «Все категории») — не ниже 4,5:1 на фоне листа в обеих темах', () => {
  for (const theme of ['light', 'dark']) {
    const vars = THEMES[theme];
    const sheet = color(resolve(decls('.sheet').background, vars));
    const ink = color(resolve(decls('.sheet .link').color || decls('.link').color, vars));
    const r = ratio(over(ink, sheet), sheet);
    assert.ok(r >= 4.5, `${theme}: ${r.toFixed(2)}:1`);
  }
});

test('заголовок экрана и лист, куда фокус ставит скрипт, — без кольца (они не кнопки)', () => {
  assert.equal(decls('[tabindex="-1"]:focus').outline, 'none');
});
