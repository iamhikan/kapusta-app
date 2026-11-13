// Вход и запросы к fin api. Страница без данных: цифры приходят только на подписанные Telegram initData
// (заголовок Authorization: tma …). Адрес API — параметр ?api= ссылки кнопки (его ставит бот), не код страницы:
// в публичном репозитории адреса Мака нет. Принимаем только https на *.ts.net (Tailscale Funnel).

const TS_NET = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.ts\.net$/;
const BOT = 'https://t.me/ag_kapusta_bot';

export function apiBase(search) {
  const raw = new URLSearchParams(search).get('api');
  const base = raw ? raw.replace(/\/+$/, '') : '';
  return TS_NET.test(base) ? base : null;
}

// Слова приложения (решение 51; Алексей 11–12.11): сервер и ответы бота говорят по-своему (names.py не трогаем),
// страница подменяет только целое значение — описание, которое написал человек, не меняется. Одно и то же — одним
// словом на всех экранах (решения 58, 61): «учёба» («Категории») и «образование» («Бюджет»), «курс» — «обмен валюты».
// Лимиты — словами сервера (решение 82): key — имя, которое страница шлёт назад в limit=, label — подпись; их не трогаем
const WORDS = { неразобранное: 'без категории', 'Raiffeisen Ангелина': 'Райффайзен Ангелины',
  'Opening-Balances': 'начальный остаток', учёба: 'образование', курс: 'обмен валюты',
  'Регулярные по карте': 'Регулярные платежи' };
const OWN = new Set(['key', 'label']);

// Служебные счета (решение 67): у счёта без своего слова сервер отдаёт последнюю часть имени («cashunrecorded»,
// «DROIT», «USDT») или одно имя на два счёта («кредит РФ»). Подменяем по полному имени счёта — имя проводки или ноги
// (name) и источник операции (src); строку «USDT» саму по себе не трогаем: это и код валюты
const ACCOUNTS = { 'Expenses:Family:CashUnrecorded': 'неучтённый нал', 'Income:PR:DROIT': 'доход ПР (DROIT)',
  'Assets:Family:Walt:USDT': 'Walt', 'Liabilities:RU:Kredit': 'долг по кредиту',
  'Expenses:PR:Porez': 'налог ПР', 'Liabilities:PR:Porez': 'налог к уплате' };   // решение 72: было «Porez»

export function words(x) {
  if (typeof x === 'string') return Object.hasOwn(WORDS, x) ? WORDS[x] : x;
  if (Array.isArray(x)) return x.map(words);
  if (x && typeof x === 'object') {
    const out = Object.fromEntries(Object.entries(x).map(([k, v]) => [k, OWN.has(k) ? v : words(v)]));
    const own = typeof x.account === 'string' && Object.hasOwn(ACCOUNTS, x.account) ? ACCOUNTS[x.account] : null;
    if (own && typeof x.name === 'string') out.name = own;
    if (own && typeof x.src === 'string') out.src = own;
    return out;
  }
  return x;
}

export const TIMEOUT = 8000;   // решение 31: Мак спит — запрос не висит, через 8 с снимок или «не отвечает»

const BROKEN = Symbol('тело не JSON');

// М8: запрос и чтение тела — под одним сроком: тело, которое не пришло за срок, — тайм-аут, как молчание Мака; обрыв
// сети при чтении тела — тоже; тело не JSON — BROKEN, вид решает код ответа. Исключений наружу нет: «Меняем…» не висит
async function ask(url, init, { fetch, timeout, host }) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeout);
  // json() старого WebView может не слушать отмену — срок держим сами
  const late = new Promise((_, reject) => stop.signal.addEventListener('abort', () => reject(new Error('timeout'))));
  late.catch(() => {});
  const down = (e) => ({ down: stop.signal.aborted ? `сеть: нет ответа за ${timeout / 1000} с · ${host}`
    : `сеть: ${e.name}: ${e.message} · ${host}` });
  try {
    let r;
    try {
      r = await Promise.race([fetch(url, { ...init, signal: stop.signal }), late]);
    } catch (e) {
      return down(e);
    }
    try {
      return { r, body: await Promise.race([r.json(), late]) };
    } catch (e) {
      return stop.signal.aborted || e.name !== 'SyntaxError' ? down(e) : { r, body: BROKEN };
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function get(path, { base, initData, fetch = globalThis.fetch, timeout = TIMEOUT }) {
  // detail — причина мелким шрифтом на экране «не отвечает»: по ней видно, где оборвался запрос (без данных)
  const host = base.replace('https://', '');
  const a = await ask(base + path, { headers: { Authorization: `tma ${initData}` }, cache: 'no-store' },
    { fetch, timeout, host });
  if (a.down) return { error: 'down', detail: a.down };
  const { r, body } = a;
  if (r.status === 401) return { error: 'stale' };
  if (r.status === 403) return { error: 'stranger' };
  if (!r.ok) return failure(r.status, body, host);
  if (body === BROKEN) return broken(r.status);
  return { data: words(body) };
}

// fin ответил, но тело не прочитать — ошибка Капусты: Мак на связи, повтор может помочь
const broken = (status) => ({ error: 'fault', detail: `HTTP ${status} · ответ не JSON` });

function failure(status, body, host) {
  // М2: кто ответил — тот и вид. fin отказал (4xx) — его словами; fin ответил ошибкой (5xx) — «Капуста ошиблась», не
  // снимок; ответ без слов fin — прокси Funnel за fin (502: fin serve не запущен или перезапускается) — Мак молчит, как сеть.
  // Слова fin — из тела {"error": "…"} (fin api: Denied и 503); тела нет или не JSON — ответил не fin
  const said = body && body !== BROKEN && typeof body.error === 'string' && body.error ? body.error : null;
  if (status >= 400 && status < 500) return { error: 'refused', status, detail: said || `HTTP ${status}` };
  if (said) return { error: 'fault', detail: `HTTP ${status} · ${said}` };
  return { error: 'down', detail: `HTTP ${status} · ${host}` };
}

export async function post(path, body, { base, initData, fetch = globalThis.fetch, timeout = TIMEOUT }) {
  // смена категории (этап 6): 409 — запись уже изменили (в ответе — что стоит сейчас). Прочее — как у GET (М2): 4xx —
  // отказ словами fin; 5xx со словами fin — «Капуста ошиблась» (Мак на связи, смена не в очередь); сеть, срок и прокси
  // без слов fin — «down»: Мак молчит, смена ждёт в очереди
  const host = base.replace('https://', '');
  const a = await ask(base + path, { method: 'POST', body: JSON.stringify(body), cache: 'no-store',
    headers: { Authorization: `tma ${initData}`, 'Content-Type': 'application/json' } }, { fetch, timeout, host });
  if (a.down) return { error: 'down', detail: a.down };
  const { r, body: got } = a;
  if (r.status === 401) return { error: 'stale' };
  if (r.status === 403) return { error: 'stranger' };
  if (r.status === 409) return got === BROKEN ? broken(409) : { error: 'conflict', data: words(got) };
  if (!r.ok) {
    const f = failure(r.status, got, host);
    return f.error === 'refused' ? { error: 'refused', detail: f.detail } : f;
  }
  if (got === BROKEN) return broken(r.status);
  return { data: words(got) };
}

const SCREENS = {
  outside: { title: 'Капуста открывается из Telegram', icon: 'logo', link: BOT, linkText: 'Открыть в Telegram',
    text: 'Это страница бота семейных финансов. Цифры видны только внутри Telegram, у Алексея и Ангелины.' },
  stale: { title: 'Откройте Капусту заново из чата', icon: 'lock',
    text: 'Вход из Telegram устарел или не подписан. Закройте и откройте Капусту кнопкой в чате.' },
  stranger: { title: 'Капуста вас не знает', icon: 'lock',
    text: 'Этот аккаунт Telegram не в списке семьи. Доступ даёт Алексей.' },
  down: { title: 'Капуста не отвечает', icon: 'warn', retry: true,
    text: 'Мак спит или Капуста перезапускается. Попробуйте ещё раз через минуту.' },
  // М2: fin ответил, но не данными — отказ его словами (текст — из detail) или его ошибка; снимка нет: Мак не спит
  refused: { title: 'Капуста не может это показать', icon: 'warn', retry: true, text: 'Капуста не приняла запрос.' },
  fault: { title: 'Капуста ошиблась', icon: 'warn', retry: true,
    text: 'Мак на связи, но Капуста не смогла ответить. Попробуйте ещё раз через минуту.' },
};

export function screen(kind, detail = null) {
  // detail — причина мелким шрифтом; у отказа это слова fin, и они — сам текст экрана
  const s = { retry: false, link: null, ...SCREENS[kind], detail: detail || null };
  if (kind === 'refused') return { ...s, text: detail ? `${detail.charAt(0).toUpperCase()}${detail.slice(1)}.` : s.text, detail: null };
  return s;
}
