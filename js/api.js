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

export async function get(path, { base, initData, fetch = globalThis.fetch }) {
  // detail — причина мелким шрифтом на экране «не отвечает»: по ней видно, где оборвался запрос (без данных)
  const host = base.replace('https://', '');
  let r;
  try {
    r = await fetch(base + path, { headers: { Authorization: `tma ${initData}` }, cache: 'no-store' });
  } catch (e) {
    return { error: 'down', detail: `сеть: ${e.name}: ${e.message} · ${host}` };
  }
  if (r.status === 401) return { error: 'stale' };
  if (r.status === 403) return { error: 'stranger' };
  if (!r.ok) return { error: 'down', detail: `HTTP ${r.status} · ${host}` };
  return { data: await r.json() };
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
