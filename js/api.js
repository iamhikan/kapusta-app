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
// словом на всех экранах (решения 58, 61): «учёба» («Категории») и «образование» («Бюджет»), «курс» и «курсовые разницы»
const WORDS = { неразобранное: 'без категории', 'Raiffeisen Ангелина': 'Райффайзен Ангелины',
  'Opening-Balances': 'начальный остаток', учёба: 'образование', курс: 'обмен валюты', 'курсовые разницы': 'обмен валюты',
  'Регулярные по карте': 'Регулярные платежи' };

export function words(x) {
  if (typeof x === 'string') return Object.hasOwn(WORDS, x) ? WORDS[x] : x;
  if (Array.isArray(x)) return x.map(words);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, words(v)]));
  return x;
}

export const TIMEOUT = 8000;   // решение 31: Мак спит — запрос не висит, через 8 с снимок или «не отвечает»

export async function get(path, { base, initData, fetch = globalThis.fetch, timeout = TIMEOUT }) {
  // detail — причина мелким шрифтом на экране «не отвечает»: по ней видно, где оборвался запрос (без данных)
  const host = base.replace('https://', '');
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeout);
  let r;
  try {
    r = await fetch(base + path, { headers: { Authorization: `tma ${initData}` }, cache: 'no-store', signal: stop.signal });
  } catch (e) {
    if (stop.signal.aborted) return { error: 'down', detail: `сеть: нет ответа за ${timeout / 1000} с · ${host}` };
    return { error: 'down', detail: `сеть: ${e.name}: ${e.message} · ${host}` };
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 401) return { error: 'stale' };
  if (r.status === 403) return { error: 'stranger' };
  if (!r.ok) return { error: 'down', detail: `HTTP ${r.status} · ${host}` };
  return { data: words(await r.json()) };
}

export async function post(path, body, { base, initData, fetch = globalThis.fetch, timeout = TIMEOUT }) {
  // смена категории (этап 6): 409 — запись уже изменили (в ответе — что стоит сейчас), 400/404 — отказ словами
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeout);
  let r;
  try {
    r = await fetch(base + path, { method: 'POST', body: JSON.stringify(body), cache: 'no-store', signal: stop.signal,
      headers: { Authorization: `tma ${initData}`, 'Content-Type': 'application/json' } });
  } catch (e) {
    return { error: 'down', detail: stop.signal.aborted ? `сеть: нет ответа за ${timeout / 1000} с` : `сеть: ${e.name}` };
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 401) return { error: 'stale' };
  if (r.status === 403) return { error: 'stranger' };
  if (r.status === 409) return { error: 'conflict', data: words(await r.json()) };
  if (r.status === 400 || r.status === 404) return { error: 'refused', detail: (await r.json()).error };
  if (!r.ok) return { error: 'down', detail: `HTTP ${r.status}` };
  return { data: words(await r.json()) };
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
};

export function screen(kind) {
  return { retry: false, link: null, ...SCREENS[kind] };
}
