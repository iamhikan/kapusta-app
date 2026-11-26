// Снимок «Здоровья» в Telegram CloudStorage (этап 5, решения 6, 31, 32). После каждого удачного /api/health страница
// кладёт ответ под ключом месяца; Мак молчит — показывает его с пометкой «данные на …». Снимок — ответ сервера этому
// человеку (у Ангелины — без «Весь доход»), хранилище у каждого своё. Операций и категорий в снимке нет.

export const LIMIT = 4096;           // CloudStorage: значение до 4096 знаков
const PREFIX = 'health_';

export const key = (month) => PREFIX + month;

const text = (h) => JSON.stringify(h);

function halve(curve) {
  // каждая вторая точка кривой, первая и последняя остаются
  return curve.filter((_, i) => i % 2 === 0 || i === curve.length - 1);
}

export function pack(full, max = LIMIT) {
  // решение 32: не влезло — каждая вторая точка кривой, потом кривая целиком, потом пустые счета; лимиты и остатки —
  // всегда целиком. И так не влезло — null: снимка нет, остаётся прошлый.
  // E10: envelopes (все регулярные месяца) — только для шапки «Операций» регулярной, операций в снимке нет
  const { envelopes, ...h } = full;
  const steps = [h, { ...h, curve: halve(h.curve) }, { ...h, curve: [] }, { ...h, curve: [], empty: [] }];
  for (const s of steps) {
    const raw = text(s);
    if (raw.length <= max) return raw;
  }
  return null;
}

export function unpack(raw) {
  try {
    const h = JSON.parse(raw);
    const ok = h && typeof h.month === 'string' && Array.isArray(h.limits) && Array.isArray(h.balances)
      && Array.isArray(h.curve) && h.fresh && h.fresh.now;
    return ok ? h : null;
  } catch {
    return null;
  }
}

export function pickKey(keys, month) {
  // свой месяц, иначе самый поздний снимок (1-го числа — итог прошлого месяца)
  const ours = keys.filter((k) => /^health_\d{4}-\d{2}$/.test(k)).sort();
  if (month && ours.includes(key(month))) return key(month);
  return ours.at(-1) || null;
}

const call = (fn) => new Promise((resolve) => {
  // методы CloudStorage — с колбэком (err, value); старый клиент бросает «not supported»
  try { fn((err, value) => resolve(err ? null : value)); } catch { resolve(null); }
});

export async function save(cs, h) {
  const raw = cs && pack(h);
  if (!raw) return false;
  return (await call((cb) => cs.setItem(key(h.month), raw, cb))) === true;
}

export async function restore(cs, month) {
  if (!cs) return null;
  const keys = await call((cb) => cs.getKeys(cb));
  const k = keys && pickKey(keys, month);
  if (!k) return null;
  return unpack(await call((cb) => cs.getItem(k, cb)));
}

// S9C (остаток R-22): вид зрителя (view «Здоровья»: all — Алексей, family — Ангелина) — своим ключом. При первом
// открытии ответа ещё нет, а ошибке надо знать, кому показать техническую строку. Ключа нет (до p48a) — вид из
// последнего снимка (S2 кладёт view в ответ)
const VIEW = 'view';
const VIEWS = new Set(['all', 'family']);

export async function keepView(cs, view) {
  if (!cs || !VIEWS.has(view)) return false;
  return (await call((cb) => cs.setItem(VIEW, view, cb))) === true;
}

export async function viewOf(cs) {
  if (!cs) return null;
  const v = await call((cb) => cs.getItem(VIEW, cb));
  if (VIEWS.has(v)) return v;
  const s = await restore(cs, null);
  return s && VIEWS.has(s.view) ? s.view : null;
}

// вида нет — слова для семьи: техническая строка («HTTP 503 · …») — только тому, про кого известно, что он Алексей
export const familyWords = (view) => view !== 'all';

function when(now) {
  // «2026-11-11T23:40:12» -> «11.11 в 23:40»
  const [day, time] = String(now).split(/[ T]/);
  const [, m, d] = day.split('-');
  return `${d}.${m} в ${time.slice(0, 5)}`;
}

export function snapView(h) {
  const at = when(h.fresh.now);
  return { banner: 'Капуста не отвечает.', when: `Данные на ${at}.`,
    fresh: `снимок из Telegram от ${at} · операций и категорий в снимке нет` };
}

// имя экрана со своим глаголом: «Бюджет приходит», остальные — «приходят» (было: «Бюджет приходят с Мака»)
const WHAT = { ops: 'Операции приходят', cats: 'Категории приходят', price: 'Цены приходят', basket: 'Покупки приходят',
  budget: 'Бюджет приходит', days: 'Траты по дням приходят', card: 'Операция приходит' };   // R-22: карточка — одна операция

export function offline(kind, hasSnap) {
  // холст 6.2: экран без Мака на «Операциях» и «Категориях» — «Повторить» и, если есть снимок, ссылка на него
  return { title: 'Капуста не отвечает',
    text: `${WHAT[kind]} с Мака. Мак спит или Капуста перезапускается.${hasSnap ? ' Снимок есть только у «Здоровья».' : ''}`,
    link: hasSnap ? 'Открыть снимок «Здоровья»' : null };
}
