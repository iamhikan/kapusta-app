// Доступность по style.css (фаза 12): контраст своих цветов, кольцо фокуса, область касания 44 px.
// Цвета темы Telegram (--tg-theme-*) задаёт клиент; здесь — их запасные значения из макета «Родной».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
// правила по порядку в файле; у правил внутри @media — его условие (media), у прочих — null
const RULES = [];
{
  let media = null;
  for (const m of css.matchAll(/@media([^{]+)\{|([^{}@]+)\{([^{}]*)\}|\}/g)) {
    if (m[1] != null) { media = m[1].trim(); continue; }
    if (m[2] == null) { media = null; continue; }   // конец блока @media
    RULES.push({ media, sels: m[2].trim().split(',').map((s) => s.trim()),
      decls: Object.fromEntries(m[3].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
        const i = d.indexOf(':');
        return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
      })) });
  }
}

// условие @media при ширине окна w (CSS px): только max-width и min-width в px; прочие условия — не выполнены
function fits(media, w) {
  if (media == null) return true;
  const parts = [...media.matchAll(/\((max|min)-width:\s*([\d.]+)px\)/g)];
  if (!parts.length) return false;
  return parts.every(([, side, n]) => (side === 'max' ? w <= Number(n) : w >= Number(n)));
}

// объявления правил с этим селектором, по порядку в файле; w — ширина окна (без неё — только правила вне @media)
const decls = (sel, w = null) => Object.assign({}, ...RULES.filter((r) => r.sels.includes(sel)
  && (w == null ? r.media == null : fits(r.media, w))).map((r) => r.decls));
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
function styleOf(classes, w = null) {
  const has = new Set(classes.split(/\s+/).filter(Boolean));
  const hits = [];
  RULES.forEach((r, i) => r.sels.forEach((s) => {
    if (!/^(\.[\w-]+)+$/.test(s) || !(w == null ? r.media == null : fits(r.media, w))) return;
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
  ['плашка «нормы нет»', 'chip muted'],   // месяц без курса (решение 81); ревью 26.11, R-20: было 4,2:1
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
  assert.equal(decls('.why')['text-wrap'], 'pretty', 'причина у «Категории»: «… в чате с / Капустой»');
  // стенд S2: пояснение меток («… потратили.» одно) и причина «нормы нет» («нет.» одно) — тоже
  assert.equal(decls('.marks-note p')['text-wrap'], 'pretty', 'R-4: пояснение меток');
  assert.equal(decls('.card > p.why-norm')['text-wrap'], 'pretty', 'R-21: причина «нормы нет» и нормы ≤ 0');
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
  assert.notEqual(off.color, decls('.button').color, 'текст не белый, как у активной');
  assert.equal(off.cursor, 'default');
});

test('R-20: текст неактивной кнопки — подсказка, что делать: не ниже 4,5:1 на её подложке в листе, в обеих темах', () => {
  // ревью 26.11: «Выберите категорию» серым темы на серой подложке — 3,53:1
  const off = decls('.button:disabled');
  for (const theme of ['light', 'dark']) {
    const vars = THEMES[theme];
    const sheet = color(resolve(decls('.sheet').background, vars));
    const bg = over(color(resolve(off.background, vars)), sheet);
    const r = ratio(over(color(resolve(off.color, vars)), bg), bg);
    assert.ok(r >= 4.5, `${theme}: ${r.toFixed(2)}:1`);
  }
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

// после v3 (повторный critique 12.11, P2 № 3 и мелочи)
test('строка из одного блока («Категория», которую сменить нельзя) — слева: вправо прижата только вторая часть строки', () => {
  assert.deepEqual(decls('.line > :last-child'), {}, 'одиночный блок строки не прижат вправо');
  assert.equal(decls('.line > :last-child:not(:first-child)')['text-align'], 'right');
});

test('подписи вкладок — не мельче 12 px; стрелки месяца в «Операциях» видны крупнее (critique: 11 px и 32 px)', () => {
  assert.ok(px(decls('.tab')['font-size']) >= 12, decls('.tab')['font-size']);
  assert.ok(px(decls('.small-arrow')['min-width']) >= 40, decls('.small-arrow')['min-width']);
});

test('крупная сумма в шапке карточки не рвётся: «≈ RSD» уходит строкой ниже, а не делит «36 956,10 €» (решение 73)', () => {
  assert.equal(decls('.big')['flex-wrap'], 'wrap');
  assert.equal(decls('.big > span')['white-space'], 'nowrap');
});

test('строка «Категорий» без сравнения — три колонки (решение 76): пустая колонка «к …» не занимает 76 px', () => {
  const tracks = (cls) => styleOf(cls)['grid-template-columns'].split(/\s+(?![^(]*\))/);
  assert.equal(tracks('cat-row').length, 4);
  assert.equal(tracks('cat-row no-cmp').length, 3);
  assert.deepEqual(tracks('cat-row no-cmp'), tracks('cat-row').slice(0, 3), 'имя, сумма и доля — как со сравнением');
});

test('правка 2: итог «Категорий» со сравнением — по краям; полоса долей есть', () => {
  assert.equal(styleOf('cats-hero')['justify-content'], 'space-between', 'итог слева, «к …» справа');
  assert.ok(styleOf('strip').height, 'полоса долей');
});

test('правка 1 (ui-ux-pro-max): перерасход на полоске и в легенде — штриховка, цвет не единственный признак', () => {
  for (const sel of ['.bar .over', '.swatch-hatch']) {
    const d = decls(sel);
    assert.match(d['background-image'] || d.background || '', /repeating-linear-gradient/, sel);
  }
  assert.ok(decls('.limit-mark').width, 'метка лимита');
});

test('правка 4: имя в строке «Операций» — до двух строк, потом многоточие (было: одна строка, «Flying Tiger Sr…»)', () => {
  const d = decls('.op .op-where .ellipsis');
  assert.equal(d['-webkit-line-clamp'], '2');
  assert.equal(d['white-space'], 'normal');
  assert.ok(Number.parseInt(decls('.cat-tile').width, 10) >= 32, 'плитка 32 px');
});

test('правка 6: подписи «По месяцам» — не мельче 12 px (было 10 px)', () => {
  for (const sel of ['.chart.bars .tick', '.chart.bars .bar-value', '.chart.bars .norm-label']) {
    assert.ok(Number.parseInt(decls(sel)['font-size'], 10) >= 12, sel);
  }
});

// правка 7 (ui-ux-pro-max, 13.11.2026): текст ссылок и белый на кнопке — 4,13:1 на запасных цветах темы; нажатие не видно
const LINKS = [['ссылка «Сменить», «Отменить»', 'link', ''], ['«Показать все N»', 'more', ''], ['выбранная вкладка', 'tab on', ''],
  ['выбранный вариант в листе', 'choice on', ''], ['кнопка «Показать»', 'button']];
for (const theme of ['light', 'dark']) {
  test(`правка 7, ${theme === 'light' ? 'светлая' : 'тёмная'} тема: ссылки и кнопки — не ниже 4,5:1`, () => {
    const low = LINKS.map(([name, fg, bg]) => [name, contrast(theme, fg, bg)]).filter(([, r]) => r < 4.5)
      .map(([name, r]) => `${name} ${r.toFixed(2)}:1`);
    assert.deepEqual(low, []);
  });
}

test('правка 7: нажатие видно — подложка у строк, чипов и кнопок, без сдвига; на iOS :active — со слушателем touchstart', () => {
  const pressed = RULES.filter((r) => r.sels.some((s) => s.endsWith(':active')));
  const sels = pressed.flatMap((r) => r.sels);
  for (const el of ['.op:active', '.limit:active', '.cat-row:active', '.more:active', '.chip-btn:active', '.button:active']) {
    assert.ok(sels.includes(el), el);
  }
  for (const r of pressed) assert.ok(!r.decls.transform && !r.decls.margin && !r.decls.padding && !r.decls.border, 'без сдвига');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /addEventListener\('touchstart'/);
});

test('стенд p34a: штриховка текущего месяца не перекрыта заливкой; кошелёк — строкой; «есть / нужно» — на одной высоте', () => {
  assert.equal(decls('.chart.bars .bar-col.partial').fill, 'url(#bars-partial)');
  assert.equal(decls('.line.kv > .grow.kv-val')['flex-direction'], 'row');
  assert.equal(decls('.plan-cols > div')['justify-content'], 'space-between', 'подпись сверху, число снизу');
});

// ——— p43a: доступность и вёрстка по UI/UX-ревью 26.11.2026 (docs/ui-review-2026-11-26.md, решение 98) ———

test('R-29: фокус с клавиатуры не прячется под нижними вкладками — отступ прокрутки снизу выше вкладок (WCAG 2.4.11)', () => {
  // замер ревью: строка «Бюджета» 788–844 px, вкладки с 789 px — видно 1 px из 56
  const pad = decls('html')['scroll-padding-bottom'] || '';
  const tabs = px(decls('.tab')['min-height']) + px((decls('.tabs')['border-top'] || '').split(/\s+/)[0]);
  assert.match(pad, /var\(--tg-safe-area-inset-bottom/, 'вкладки выше на безопасную зону iPhone — отступ тоже');
  const fixed = Number((/(\d+)px/.exec(pad) || [])[1] || 0);
  assert.ok(fixed >= tabs + 8, `отступ ${fixed} px, вкладки ${tabs} px`);
});

test('R-28: лист в тёмной теме отделён от экрана — фон светлее затемнённого экрана, край сверху и ручка', () => {
  // ревью 26.11: лист цвета фона (#000) на затемнении поверх чёрного — края не видно
  const vars = THEMES.dark;
  const sheet = color(resolve(decls('.sheet').background, vars));
  const under = over(color(resolve(decls('.sheet-back').background, vars)), color(resolve('var(--bg)', vars)));
  assert.ok(ratio(sheet, under) >= 1.2, `лист к экрану ${ratio(sheet, under).toFixed(2)}:1`);
  assert.match(decls('.sheet')['border-top'] || '', /^1px solid /, 'край сверху');
  const grip = decls('.sheet::before');
  assert.equal(grip.content, "''");
  assert.equal(`${grip.width}×${grip.height}`, '36px×5px', 'ручка');
});

test('R-28: в листе карточки, поиск и чипы отделены от фона листа; текст на них — не ниже 4,5:1, в обеих темах', () => {
  for (const theme of ['light', 'dark']) {
    const vars = THEMES[theme];
    const sheet = color(resolve(decls('.sheet').background, vars));
    for (const sel of ['.sheet .card', '.sheet .search', '.sheet .toggle', '.sheet .chip-btn:not(.on)']) {
      const inner = color(resolve(decls(sel).background || 'transparent', vars));
      assert.ok(inner[3] && ratio(inner, sheet) >= 1.1, `${theme}, ${sel}: ${ratio(over(inner, sheet), sheet).toFixed(2)}:1 к листу`);
      for (const ink of ['--muted', '--fg', '--accent-ink']) {
        const r = ratio(color(resolve(`var(${ink})`, vars)), inner);
        assert.ok(r >= 4.5, `${theme}, ${sel}, ${ink}: ${r.toFixed(2)}:1`);
      }
    }
  }
});

test('R-3, строки лимитов: плашка «+N» уходит под имя, если рядом не входит (320 px: «комм…» вместо «коммуналка»)', () => {
  const d = decls('.limit-name');
  assert.equal(d['flex-wrap'], 'wrap');
  assert.ok(px(d['row-gap'] ?? (d.gap || '').split(/\s+/)[0]) > 0, 'зазор между именем и плашкой под ним');
});

test('R-33: три числа под «Потрачено» — в ряд до 320 px, при крупном тексте (200 %, окно 195 px) — по одному в строке', () => {
  const st = decls('.stats');
  const m = /^repeat\(auto-fit, minmax\((\d+)px, 1fr\)\)$/.exec(st['grid-template-columns'] || '');
  assert.ok(m, st['grid-template-columns']);
  const min = Number(m[1]);
  const gap = px(st.gap);
  const inner = (w) => w - 2 * 16 - 2 * 16;   // поля экрана и карточки
  assert.ok(3 * min + 2 * gap <= inner(320), '320 px: три в ряд — числа на одной линии (Алексей 12.11)');
  assert.ok(2 * min + gap > inner(195), '195 px: по одному в строке — подписи не налезают');
});

test('R-33: итог дня отделён от даты зазором и уходит строкой ниже, если рядом не входит (200 %: зазор 0 px)', () => {
  const d = decls('.day-head');
  assert.equal(d['flex-wrap'], 'wrap');
  const [row, col = row] = (d.gap || '').split(/\s+/);
  assert.ok(px(col) >= 8 && px(row) > 0, d.gap);
});

test('R-3 (стенд 320 px): значок метки в подписи строки не уходит в многоточие — сжимается сначала «откуда», потом категория', () => {
  const sub = decls('.op-sub.split');
  assert.equal(sub.display, 'flex');
  const cats = decls('.sub-cats');
  const tail = decls('.sub-tail');
  assert.equal(decls('.sub-glyph').flex, 'none', 'значок не сжимается');
  // категория не сжимается вместе с «откуда» (было: доли пикселя — и «банк» становился «ба…»), но и не шире места
  // без значка: длинная — многоточием, значок остаётся
  assert.equal(cats.flex, 'none');
  assert.match(cats['max-width'], /^calc\(100% - [\d.]+em\)$/);
  assert.equal(tail['min-width'], '0');
  assert.equal(cats['text-overflow'], 'ellipsis');
  // «откуда» длиннее строки — переносом по словам, не многоточием (повтор 2 ревью p48a, находка 7; тест ниже)
});

test('R-31 п. 3 (стенд S5): имя на «Категориях» — до двух строк, потом многоточие: «прочие продукты» при 390 px было «прочие продук…»', () => {
  const d = decls('.cat-row .cat-name .ellipsis');
  assert.equal(d['-webkit-line-clamp'], '2');
  assert.equal(d['white-space'], 'normal');
});

test('повтор ревью p46a, п. 12: значок метки в строке лимита — после имени и не уходит в многоточие', () => {
  const t = decls('.limit-title');
  assert.equal(t.display, 'flex');
  assert.equal(t['min-width'], '0', 'длинное имя сжимается многоточием');
  assert.equal(decls('.limit-glyph').flex, 'none', 'значок не сжимается');
});

test('S9C: экран ошибки «Здоровья» с вкладками — низ экрана не под вкладками (как у экранов с вкладками)', () => {
  // .problem занимает всё окно (min-height: 100vh) и центрирует текст: без отступа «Повторить» и причина при низком
  // окне уходят под вкладки
  const pad = decls('.problem.with-tabs')['padding-bottom'] || '';
  assert.equal(pad, decls('.screen.with-tabs')['padding-bottom']);
});

// ——— p48a: вёрстка и фокус по повтору ревью p46a (docs/ui-review-2026-11-26.md, «Новые и оставшиеся находки») ———

test('находка 10: заголовок раздела и подпись справа — с зазором и без легенды (320 px: «ОСТАТКИналичные и карты…»)', () => {
  // зазор был только у заголовка с легендой (.section-head:has(.legend)); легенда давно ушла под заголовок
  const [row, col = row] = (decls('.section-head').gap || '').split(/\s+/);
  assert.ok(px(col) >= 8, `зазор ${decls('.section-head').gap}`);
  // подпись в две строки при 320 px — справа, у своего края, как итог дня (R-33)
  assert.equal(decls('.section-head > span')['text-align'], 'right');
});

// ширина имени в строке «Категорий» при окне w: поля экрана и строки — по 16 px, сумма «153 342» — до 64 px, доля 44 px,
// «к …» 76 px. Имя — первая ячейка строки; в первой строке рядом с ним — колонки, которые оно не занимает
const tracksOf = (cls, w) => styleOf(cls, w)['grid-template-columns'].split(/\s+(?![^(]*\))/);
function nameWidth(w, cls = 'cat-row') {
  const tracks = tracksOf(cls, w);
  const line = (n) => (n < 0 ? tracks.length + 2 + n : n);
  const [a, b = a + 1] = (decls('.cat-row > :first-child', w)['grid-column'] || '1').split('/').map((x) => line(Number(x)));
  const rest = tracks.filter((_, i) => i < a - 1 || i >= b - 1);
  const gap = px(styleOf(cls, w).gap.split(/\s+/).pop());
  return w - 4 * 16 - rest.reduce((s, t) => s + (/^\d+px$/.test(t) ? px(t) : 64), 0) - rest.length * gap;
}

test('находка 1: «Категории» уже 390 px — доля и «к …» строкой под именем, имя не уже 120 px (320 px: было 48 — «жи…»)', () => {
  for (const w of [320, 375]) {
    assert.ok(nameWidth(w) >= 120, `${w} px: имя ${nameWidth(w)} px`);
    assert.ok(nameWidth(w, 'cat-row no-cmp') >= 120, `${w} px без сравнения: имя ${nameWidth(w, 'cat-row no-cmp')} px`);
    for (const cell of ['.cat-row > .cat-share', '.cat-row > .cat-delta']) {
      assert.equal(decls(cell, w)['grid-row'], '2', `${w} px: ${cell} — строкой под именем`);
      assert.equal(decls(cell, w)['text-align'], 'left', `${w} px: ${cell} — от края имени`);
    }
  }
  // 390 px и шире — как было: четыре колонки в одну строку, имени хватает на «образование» (93 px) с точкой
  assert.deepEqual(tracksOf('cat-row', 390), tracksOf('cat-row'));
  assert.ok(nameWidth(390) - 20 >= 93, `390 px: имя ${nameWidth(390)} px`);
  assert.equal(decls('.cat-row > .cat-share', 390)['grid-row'], undefined);
});

test('находка 11: «· откуда» не сжимается до «·» — не входит рядом с категорией и значком, уходит строкой ниже, без точки', () => {
  const sub = decls('.op-sub.split');
  assert.equal(sub['flex-wrap'], 'wrap');
  // точка — ячейка ширины x в начале «откуда». Подпись сдвинута влево на x и обрезана слева на x: в одной строке с
  // категорией точка на месте, в начале новой строки — за краем
  const sep = decls('.sub-sep');
  assert.equal(sep.display, 'inline-block');
  const x = sep.width;
  assert.match(x, /^[\d.]+em$/);
  assert.equal(sub['margin-left'], `-${x}`);
  assert.equal(sub['clip-path'], `inset(0 0 0 ${x})`);
  assert.equal(decls('.op-sub.split > :first-child')['margin-left'], x, 'первая часть подписи — на прежнем месте');
  // значок — в первой строке: категория не шире строки без значка (1,6em) и без сдвига x
  assert.equal(decls('.sub-cats')['max-width'], `calc(100% - ${1.6 + Number.parseFloat(x)}em)`);
  // «откуда» длиннее строки — в своей строке: было многоточием, теперь переносом (повтор 2 ревью p48a, находка 7)
  assert.equal(decls('.sub-tail')['min-width'], '0');
});

// R-33, M-часть (повтор ревью p46a, находка 4, WCAG 1.4.4): текст 200 % — окно 195 px. Было: страница шириной 278 px,
// «тратим быс…», «прогноз 279 2…», от имён лимитов 0–12 px, суммы остатков налезали на имена. Уже 320 px строки
// перестраиваются: подписи и имена — переносом, числа — строкой ниже; 320 px и шире — как было
const NARROW = 195;
const card = (w) => w - 2 * 16 - 2 * 16;   // поля экрана и карточки (строки)

test('находка 4, «Здоровье» при 195 px: плашка зоны — под «Потрачено», подпись темпа — переносом, крупное число входит', () => {
  assert.equal(decls('.row', NARROW)['flex-wrap'], 'wrap', 'плашка «тратим быстрее плана» — строкой ниже, а не за край');
  assert.equal(decls('.chip', NARROW)['white-space'], 'normal');
  // подпись темпа — переносом при любой ширине: при 320 px было «… выше нормы н…», при 195 px — «прогноз 279 2…»
  assert.equal(decls('.curve-head .note')['white-space'], 'normal', '«прогноз 279 846 · выше нормы на 21 871» целиком');
  assert.equal(decls('.curve-head .note')['text-overflow'], undefined);
  // «242 036» — 7 знаков, цифра жирным — до 0,6 em
  assert.ok(7 * 0.6 * px(decls('.big-num', NARROW)['font-size']) <= card(NARROW), decls('.big-num', NARROW)['font-size']);
  assert.ok(7 * 0.6 * px(decls('.cats-total', NARROW)['font-size']) <= card(NARROW), 'итог «Категорий»');
  for (const sel of ['.row', '.chip', '.big-num']) assert.deepEqual(decls(sel, 320), decls(sel), `320 px: ${sel}`);
});

test('находка 4, строки при 195 px: имя — целиком во всю ширину, числа — строкой ниже, справа', () => {
  // лимит: имя переносом (было многоточие и 0 px; .ellipsis — тест ниже), «53 342 / 5 876» — строкой ниже (.row — выше)
  assert.equal(decls('.limit .row > .nowrap', NARROW)['margin-left'], 'auto');
  // плитки счёта и категории — украшение (aria-hidden, имя — в тексте): при 195 px они отнимали у имени 48 px из 131
  for (const sel of ['.line.bal > .tile', '.op:not(.line) > .cat-tile']) assert.equal(decls(sel, NARROW).display, 'none', sel);
  // остаток: имя — во всю ширину, суммы — строкой ниже, справа (было: «Нал Алексея» под «77 780 RSD»)
  assert.equal(decls('.line.bal', NARROW).display, 'grid');
  assert.deepEqual([decls('.line.bal > .bal-amounts', NARROW)['grid-row'], decls('.line.bal > .bal-amounts', NARROW)['justify-self']],
    ['2', 'end']);
  // строка «Операций»: так же — имя и подпись во всю ширину, сумма — под ними, справа
  assert.equal(decls('.op:not(.line)', NARROW).display, 'grid');
  assert.equal(decls('.op:not(.line) > .op-amount', NARROW)['justify-self'], 'end');
  // подпись «план на сегодня 223 578» шире полосы — строкой под полосой, не за край карточки (стояла у черты плана)
  assert.equal(decls('.plan-cap > span', NARROW).position, 'static');
  assert.equal(decls('.plan-cap > span', NARROW).transform, 'none !important');
  // прочие строки (бюджет, карточка): часть справа не входит — строкой ниже, справа
  assert.equal(decls('.line', NARROW)['flex-wrap'], 'wrap');
  assert.equal(decls('.line > .nowrap', NARROW)['margin-left'], 'auto');
  for (const sel of ['.line.bal', '.op:not(.line)', '.line', '.ellipsis', '.plan-cap > span']) assert.deepEqual(decls(sel, 320), decls(sel), `320 px: ${sel}`);
});

test('находка 4, «Категории» при 195 px: имя — первой строкой во всю ширину, сумма — второй, доля и «к …» — третьей', () => {
  assert.equal(decls('.cat-row > :first-child', NARROW)['grid-column'], '1 / -1');
  assert.equal(nameWidth(NARROW) - 20, card(NARROW) - 20, 'имени — вся строка без точки');
  assert.equal(decls('.cat-row > :nth-child(2)', NARROW)['grid-row'], '2');
  for (const cell of ['.cat-row > .cat-share', '.cat-row > .cat-delta']) assert.equal(decls(cell, NARROW)['grid-row'], '3', cell);
  assert.equal(decls('.cats-hero', NARROW)['flex-wrap'], 'wrap', '«−340 367 к 1–26 октября» — под итогом');
  // две колонки: доля и «· к 1–26.10» (68 px) — в одной строке; третья пустая колонка с зазором её резала
  assert.equal(tracksOf('cat-row', NARROW).length, 2);
  assert.equal(tracksOf('cat-row no-cmp', NARROW).length, 2);
  // чипы периода — пять в ряд по 25 px налезали друг на друга («еделМесКварта.»): по два в ряд, с зазором под касание
  const periods = decls('.chips.periods', NARROW);
  assert.equal(periods['grid-template-columns'], 'repeat(2, minmax(0, 1fr))');
  assert.ok(px(periods['row-gap']) >= 2 * hit('.chip-btn').y, `зазор рядов ${periods['row-gap']}`);
  assert.deepEqual(decls('.chips.periods', 320), decls('.chips.periods'));
});

test('находка 4, шапки и «Операции» при 195 px: месяц, имя траты, «чек» и подпись — целиком; стрелки месяца — касание 44 px', () => {
  // «‹ Ноябрь 2026 ›» в ряду с чипами был шире окна (186 px из 163): стрелки уже, касание — прежние 44 px
  const arrow = hit('.small-arrow');
  const narrow = px(decls('.small-arrow', NARROW)['min-width']);
  assert.ok(narrow + arrow.w - px(decls('.small-arrow')['min-width']) >= 44, `стрелка ${narrow} px + добавка`);
  assert.ok(2 * narrow + 96 <= card(NARROW) + 32, 'месяц с двумя стрелками — в ряду чипов');   // ряд — без полей карточки
  // лист «Фильтры»: чип «Райффайзен Ангелины» с плиткой был шире окна (213 px) — имя переносом внутри чипа
  assert.equal(decls('.chips.wrap .chip-btn', NARROW)['white-space'], 'normal');
  assert.equal(decls('.chips.wrap .chip-btn', NARROW)['max-width'], '100%');
  // шапка экрана категории: «Продукты» 20 px и стрелки по 44 px не входят в 131 px — заголовок строкой выше стрелок
  assert.equal(decls('.month', NARROW)['flex-wrap'], 'wrap');
  assert.equal(decls('.month-title', NARROW)['flex-basis'], '100%');
  assert.equal(decls('.month-title', NARROW).order, '-1');
  // строка «Операций»: «чек» — под именем, если рядом не входит; имя и подпись — без многоточия
  assert.equal(decls('.op-where', NARROW)['flex-wrap'], 'wrap');
  assert.equal(decls('.op-sub', NARROW)['white-space'], 'normal');
  assert.equal(decls('.op-sub.split > span', NARROW)['white-space'], 'normal');
  assert.equal(decls('.op .op-where .ellipsis', NARROW)['-webkit-line-clamp'], 'none');
  assert.equal(decls('.cat-row .cat-name .ellipsis', NARROW)['-webkit-line-clamp'], 'none');
  // слово шире строки («SAMOSTALNA TRGOVINSKA», «супермаркеты,» — 95 px из 89) — переносом внутри слова, не за край
  // и любое имя с многоточием (лимит, «Самые дорогие», товары) — целиком, переносом
  for (const sel of ['.ellipsis', '.op-sub']) assert.equal(decls(sel, NARROW)['overflow-wrap'], 'anywhere', sel);
  assert.equal(decls('.ellipsis', NARROW)['white-space'], 'normal');
  // подпись с меткой — обычным текстом: «образование 🔁 · Райффайзен РФ» переносится по словам; значок не обрезан у
  // края (сдвиг на 1em и обрезка слева — только когда подпись в одну строку с переносом «откуда», находка 11)
  const split = decls('.op-sub.split', NARROW);
  assert.deepEqual([split.display, split['margin-left'], split['clip-path']], ['block', '0', 'none']);
  assert.equal(decls('.op-sub.split > :first-child', NARROW)['margin-left'], '0');
  assert.equal(decls('.sub-sep', NARROW).display, 'inline', '« · » — как текст: одна точка строкой не остаётся');
  for (const sel of ['.small-arrow', '.month', '.month-title', '.op-where', '.op-sub', '.op .op-where .ellipsis']) {
    assert.deepEqual(decls(sel, 320), decls(sel), `320 px: ${sel}`);
  }
});

// ——— p50a: вёрстка по повтору 2 ревью p48a (docs/ui-review-2026-11-26.md, «Повтор 2 после правок» → «Новые находки») ———

test('находка 4, текст 200 % (окно 195 px): «план на сегодня 223 578» — переносом под полосой, не за край карточки', () => {
  // было: подпись в одну строку шириной 159 px при карточке 131 px (стенд: 28 px за краем). Число не делится: между
  // тысячами — неразрывный пробел (fmt, health.js)
  assert.equal(decls('.plan-cap > span', NARROW)['white-space'], 'normal');
  assert.equal(decls('.plan-cap > span')['white-space'], 'nowrap', 'у черты плана — одной строкой, как было');
  assert.deepEqual(decls('.plan-cap > span', 320), decls('.plan-cap > span'));
});

test('находка 7, 320 px: имя лимита — до двух строк, потом многоточие («разовые и подар…» было в одну строку)', () => {
  // как имя в «Операциях» и на «Категориях» (правка 4, R-31 п. 3); при крупном тексте (195 px) — целиком
  const d = decls('.limit-name .ellipsis');
  assert.deepEqual([d['white-space'], d.display, d['-webkit-line-clamp'], d['-webkit-box-orient']],
    ['normal', '-webkit-box', '2', 'vertical']);
  assert.equal(decls('.limit-name .ellipsis', NARROW)['-webkit-line-clamp'], 'none');
  assert.deepEqual(decls('.limit-name .ellipsis', 320), d);
});

test('находка 7, 320 px: чипы периода — подпись не касается краёв чипа («Квартал»: 0,8 px), касание не уже 44 px', () => {
  // ширина подписей 13 px на стенде (системный шрифт): Неделя, Месяц, Квартал, Год, Свой
  const LABELS = [47, 41, 51, 22, 32];
  const st = decls('.chips.periods');
  assert.equal(st['grid-template-columns'], 'repeat(5, minmax(min-content, 1fr))', 'колонка не уже своей подписи');
  const chip = decls('.chips.periods .chip-btn');
  const pad = px(chip.padding.split(/\s+/)[1]);
  const border = px((decls('.chip-btn').border || '').split(/\s+/)[0]);
  assert.ok(pad >= 5, `поле подписи ${pad} px`);
  // колонки 1fr: шире подписи — поровну; колонка, которой доли мало, — по своей подписи, остальным — остаток
  function widths(row) {
    const mins = LABELS.map((t) => t + 2 * pad + 2 * border);
    const free = row - (LABELS.length - 1) * px(st.gap);
    const fixed = new Set();
    let fr = 0;
    for (let changed = true; changed;) {
      changed = false;
      fr = (free - [...fixed].reduce((s, i) => s + mins[i], 0)) / (LABELS.length - fixed.size);
      mins.forEach((m, i) => { if (!fixed.has(i) && m > fr) { fixed.add(i); changed = true; } });
    }
    return mins.map((m, i) => (fixed.has(i) ? m : fr));
  }
  for (const w of [320, 375, 390]) {
    const cols = widths(w - 2 * 16);
    assert.ok(cols.reduce((s, c) => s + c, 0) + 4 * px(st.gap) <= w - 2 * 16 + 0.5, `${w} px: ряд шире экрана`);
    assert.ok(Math.min(...cols) >= 44, `${w} px: чип ${Math.min(...cols).toFixed(1)} px`);
  }
  assert.ok(Math.max(...widths(390 - 32)) - Math.min(...widths(390 - 32)) < 0.01, '390 px — чипы одной ширины, как было');
});

test('находка 7: абзацы — без одного слова в последней строке (детектор `straggler`: «минуту.», «октября», «117,61)»)', () => {
  // экран ошибки S9C при 320 px — «минуту.» одна; подпись шапки «Продуктов» — «октября»; описание обмена — «117,61)»
  assert.equal(decls('p')['text-wrap'], 'pretty');
});

test('Q3 и находка 7: «откуда» длиннее строки — переносом по словам в своей строке («Райффайзен Ангел…» при 320 px)', () => {
  // хвост «· откуда» — ячейка: точка шириной x не сжимается, имя счёта — переносом рядом с ней, без многоточия
  const tail = decls('.sub-tail');
  assert.equal(tail.display, 'flex');
  assert.equal(tail['text-overflow'], undefined);
  assert.equal(decls('.sub-sep').flex, 'none', 'точка не сжимается: в начале новой строки она за краем целиком');
  const src = decls('.sub-src');
  assert.deepEqual([src['white-space'], src['min-width']], ['normal', '0']);
  // строка без метки (Q3): категории — во всю строку, места под значок нет; сдвиг подписи — x (находка 11)
  assert.equal(decls('.op-sub.plain > .sub-cats')['max-width'], `calc(100% - ${decls('.sub-sep').width})`);
  // перевод «откуда → куда»: «→ куда» не входит — строкой ниже целиком, стрелка видна (сдвига и обрезки слева нет)
  const flow = decls('.op-sub.flow');
  assert.deepEqual([flow.display, flow['flex-wrap']], ['flex', 'wrap']);
  assert.ok(Number.parseFloat(flow['column-gap']) > 0, 'зазор в строке — вместо пробела; в начале строки его нет');
  assert.equal(flow['margin-left'], undefined);
  assert.equal(decls('.op-sub.flow > span')['white-space'], 'normal');
  // крупный текст (195 px): подпись — обычным текстом, по словам (находка 4 повтора 1)
  assert.equal(decls('.sub-tail', NARROW).display, 'inline');
  for (const sel of ['.sub-tail', '.sub-src', '.op-sub.flow']) assert.deepEqual(decls(sel, 320), decls(sel), `320 px: ${sel}`);
});
