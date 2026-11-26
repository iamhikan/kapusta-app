// Плитки счетов (решение 47): банк — буква в цвете банка, остальное — значок; как цветные плитки в настройках
// Telegram и iOS. Настоящих логотипов нет: при 30 px не читаются и не различают два счёта одного банка. Цвета Freedom и
// ALTA — приблизительные: поправить здесь, если на телефоне не похоже. UniCredit — красный сайта и логотипа банка.
// Счёт ПР Алексея — плитка его банка и значок портфеля в углу (Алексей 20.11): карта и счёт ПР одного банка рядом.
// Нал — цвет и значок, не буква: «Алексей» и «Ангелина» — обе на «А» (Алексей 26.11: «3 одинаковые, тратишь время на
// понимание»). Нал Алексея — купюра на зелёном, нал Ангелины — купюра на фиолетовом (iOS purple), нал дома — домик на
// коричневом (iOS brown). Белый значок на каждом — не ниже 3:1 (WCAG 1.4.11): 3,39 / 4,13 / 4,94.
import { h, icon } from './dom.js';

const GLYPHS = {
  cash: ['M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
    'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 'M6.5 12h.01', 'M17.5 12h.01'],
  briefcase: ['M5 8h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
    'M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M4 13h16'],
  scissors: ['M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M20 4L8.12 15.88',
    'M14.47 14.48L20 20', 'M8.12 8.12L12 12'],
  wallet: ['M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2',
    'M3 6v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3'],
  percent: ['M19 5L5 19', 'M6.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 'M17.5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  inbound: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  card: ['M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M3 10h18'],
  home: ['M4 10.5L12 4l8 6.5', 'M6 9v10.5h12V9', 'M10 19.5V14h4v5.5'],   // домик — как у категории «дом» (catcolor.js)
};

const WHITE = '#ffffff';
// нал по месту: RSD и EUR одного места — одна плитка; новый счёт нала — купюра на зелёном, как у Алексея
const CASH = [
  [/:Cash:Angelina(:|$)/, { bg: '#af52de', glyph: 'cash' }],
  [/:Cash:Home(:|$)/, { bg: '#8b6a46', glyph: 'home' }],   // шкаф, решение 99
];
const CASH_DEFAULT = { bg: '#3f9d5f', glyph: 'cash' };
// порядок важен: кредит РФ — до Райффайзена
const TILES = [
  ['Assets:Family:Raiffeisen:Kredit', { bg: '#8e8e93', glyph: 'percent' }],
  ['Assets:Family:Raiffeisen', { bg: '#fff200', fg: '#1c1c1e', text: 'R' }],
  ['Assets:Family:Freedom', { bg: '#00875a', text: 'F' }],
  ['Assets:Family:UniCredit', { bg: '#e2001a', text: 'U' }],   // долг 18.11: была «новым счётом» — зелёная по имени
  ['Assets:Family:ALTA', { bg: '#1f3a68', text: 'A' }],
  ['Assets:Angelina:PR', { bg: '#e0245e', glyph: 'scissors' }],
  ['Assets:Family:Walt', { bg: '#0088cc', glyph: 'wallet' }],
  ['Assets:Family:Receivable', { bg: '#1b7f99', glyph: 'inbound' }],
  ['Assets:Family:OtherCard', { bg: '#636366', glyph: 'card' }],
];

function hue(s) {
  let x = 0;
  for (const c of s) x = (x * 31 + c.codePointAt(0)) % 360;
  return x;
}

export function tileOf(account, name) {
  // нал — по виду счёта у обоих: «…:Cash:<кто>», цвет и значок — по месту (CASH); новый счёт — первая буква имени,
  // цвет по имени
  if (account.includes(':Cash:')) {
    const cash = CASH.find(([re]) => re.test(account));
    return { fg: WHITE, ...(cash ? cash[1] : CASH_DEFAULT) };
  }
  // счёт ПР «Assets:PR:<банк>[:валюта]» — буква банка и портфель в углу; банк без плитки — портфель, как раньше
  const pr = /^Assets:PR:([^:]+)/.exec(account);
  if (pr) {
    const bank = TILES.find(([prefix]) => prefix === `Assets:Family:${pr[1]}`);
    return bank && bank[1].text ? { fg: WHITE, ...bank[1], badge: 'briefcase' } : { bg: '#5856d6', fg: WHITE, glyph: 'briefcase' };
  }
  const hit = TILES.find(([prefix]) => account.startsWith(prefix));
  if (hit) return { fg: WHITE, ...hit[1] };
  return { bg: `hsl(${hue(name)} 42% 40%)`, fg: WHITE, text: name.trim().charAt(0).toUpperCase() };
}

export function tile(t, size = 30) {
  // плитка рядом с именем счёта — украшение: имя уже в тексте строки (aria-hidden); значок — кружок в правом нижнем углу
  const glyph = Math.round(size * 0.6);
  const badge = Math.round(size * 0.44);
  const off = `${-Math.round(size * 0.17)}px`;
  return h('span', { class: 'tile', 'aria-hidden': 'true',
    style: { width: `${size}px`, height: `${size}px`, background: t.bg, color: t.fg, fontSize: `${Math.round(size * 0.5)}px`,
      borderRadius: `${Math.round(size * 0.27)}px` } },
  t.glyph ? icon(GLYPHS[t.glyph], glyph) : t.text,
  t.badge ? h('span', { class: 'tile-badge', style: { width: `${badge}px`, height: `${badge}px`, right: off, bottom: off } },
    icon(GLYPHS[t.badge], Math.round(badge * 0.72))) : null);
}
