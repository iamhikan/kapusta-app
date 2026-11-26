// Цвета темы Telegram (R-24, решение 98, ответ 4). Серый (hint_color → --muted) и красный (destructive_text_color →
// --bad) задаёт клиент Telegram, их контраст страница заранее не знает: на iOS серый, вероятно, #8e8e93 — 2,84:1 на
// фоне. Вариант Б: при теме и её смене страница подмешивает к цвету цвет текста ровно до 4,5:1 на фонах, где этот
// текст стоит. Цвет уже не ниже 4,5:1 — не меняется: вид стенда и тёмной темы тот же. Цвета темы уходят в fin раз за
// открытие (POST /api/theme): по ним после выкладки проверяем замер на настоящих телефонах (`fin theme`).

export const NEED = 4.5;   // WCAG 1.4.3 AA, мелкий текст

// подложка: доля цвета над фоном карточки; of 'ink' — цвет самого текста (color-mix с currentColor)
const tint = (of, share) => ({ over: '--card', of, share });

// где стоит текст этого цвета (замер 1b-1, аудит стенда). Серый — на фоне экрана, карточке, в листе и на плашке
// «нормы нет» (8 % своего цвета). Красный («сверх N», число строки сверх лимита) — на карточке и в листе. Свой красный
// и цвет ссылки меток (--bad-ink, --accent-ink) — на подложке своего цвета: «+N» 16 %, «!» и «чек» 14 %, плашка «сверх»
// 16 % цвета текста. Порядок важен: --bad-ink считается от уже подобранного --bad
export const INKS = [
  ['--muted', ['--bg', '--card', '--sheet', '--sheet-card', tint('ink', 0.08)]],
  ['--bad', ['--card', '--sheet-card']],
  ['--bad-ink', [tint('--bad', 0.16), tint('ink', 0.16)]],
  ['--accent-ink', ['--bg', '--card', '--sheet', '--sheet-card', tint('--accent', 0.14)]],
];

const opaque = (a) => a === undefined || (a.endsWith('%') ? parseFloat(a) >= 100 : parseFloat(a) >= 1);

// цвет CSS -> [r, g, b] (0..255). Браузер отдаёт rgb() или color(srgb …) (color-mix), Telegram — #rrggbb; прозрачный
// или незнакомый вид — null: такой цвет не трогаем
export function rgb(css) {
  const v = String(css ?? '').trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const x = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (m) return opaque(m[4]) ? m.slice(1, 4).map(Number) : null;
  m = v.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/);
  if (m) return opaque(m[4]) ? m.slice(1, 4).map((x) => Number(x) * 255) : null;
  return null;
}

const lin = (x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function ratio(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hex = (c) => `#${c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;

// цвет ink на всех фонах backs не ниже need — null (не трогаем). Ниже — первый цвет на пути от ink к toward (цвету
// текста) шагом 1 %, который держит need на каждом фоне. Не дотянул и сам toward — toward. Фон — цвет или функция
// цвета текста (подложка из него самого); непонятный фон (null) — без него
export function legible(ink, toward, all, need = NEED) {
  const backs = all.filter(Boolean);
  if (!ink || !toward || !backs.length) return null;
  const worst = (c) => Math.min(...backs.map((b) => ratio(c, typeof b === 'function' ? b(c) : b)));
  if (worst(ink) >= need) return null;
  for (let p = 1; p <= 100; p += 1) {
    const c = ink.map((x, i) => Math.round(x + (toward[i] - x) * p / 100));
    if (worst(c) >= need) return hex(c);
  }
  return hex(toward);
}

// свои цвета текста на :root (root.style). Сначала снимаем прошлые: смена темы считается от цвета Telegram, а не от
// своего. read(имя) — цвет переменной так, как его видит браузер. -> {переменная: свой цвет}
const mix = (a, b, share) => a.map((x, i) => x * share + b[i] * (1 - share));

export function fit(root, read) {
  for (const [name] of INKS) root.style.removeProperty(name);
  const fg = rgb(read('--fg'));
  const back = (b) => {
    if (typeof b === 'string') return rgb(read(b));
    const under = rgb(read(b.over));
    if (!under) return null;
    if (b.of === 'ink') return (c) => mix(c, under, b.share);
    const of = rgb(read(b.of));
    return of && mix(of, under, b.share);
  };
  const out = {};
  for (const [name, backs] of INKS) {
    const got = legible(rgb(read(name)), fg, backs.map(back));
    if (got) {
      root.style.setProperty(name, got);
      out[name] = got;
    }
  }
  return out;
}

// цвет переменной глазами браузера: пробный скрытый элемент с фоном var(…) -> rgb() или color(srgb …). Фон, а не
// color: фон не наследуется — цвет, который браузер не понял, читается прозрачным (null), а не цветом текста
export const probe = (doc, view) => (name) => {
  const el = doc.createElement('i');
  el.hidden = true;
  el.style.backgroundColor = `var(${name})`;
  doc.body.append(el);
  const c = view.getComputedStyle(el).backgroundColor;
  el.remove();
  return c;
};

// что уходит в fin: цвета темы, схема, платформа и версия клиента — без initData и данных человека
export function note(tg) {
  const p = (tg && tg.themeParams) || {};
  return { theme_params: Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'string')),
    color_scheme: (tg && tg.colorScheme) || 'light', platform: String((tg && tg.platform) || ''),
    version: String((tg && tg.version) || '') };
}

// раз за открытие; при открытой странице — снова, только если тема сменилась
export function reporter(send) {
  let last = null;
  return (tg) => {
    const n = note(tg);
    const key = JSON.stringify(n);
    if (key === last) return false;
    last = key;
    send(n);
    return true;
  };
}
