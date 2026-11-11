// Плитки счетов (решение 47): банк — буква в цвете банка, остальное — значок; как цветные плитки в настройках
// Telegram и iOS. Настоящих логотипов нет: при 30 px не читаются и не различают два счёта одного банка. Цвета Freedom и
// ALTA — приблизительные: поправить здесь, если на телефоне не похоже.
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
};

const WHITE = '#ffffff';
// порядок важен: кредит РФ — до Райффайзена, ПР на ALTA — до карты ALTA
const TILES = [
  ['Assets:Family:Raiffeisen:Kredit', { bg: '#8e8e93', glyph: 'percent' }],
  ['Assets:Family:Raiffeisen', { bg: '#fff200', fg: '#1c1c1e', text: 'R' }],
  ['Assets:Family:Freedom', { bg: '#00875a', text: 'F' }],
  ['Assets:PR:', { bg: '#5856d6', glyph: 'briefcase' }],
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
  // нал — по виду счёта у обоих: «…:Cash:<кто>»; новый счёт — первая буква имени, цвет по имени
  if (account.includes(':Cash:')) return { bg: '#3f9d5f', fg: WHITE, glyph: 'cash' };
  const hit = TILES.find(([prefix]) => account.startsWith(prefix));
  if (hit) return { fg: WHITE, ...hit[1] };
  return { bg: `hsl(${hue(name)} 42% 40%)`, fg: WHITE, text: name.trim().charAt(0).toUpperCase() };
}

export function tile(t, size = 30) {
  // плитка рядом с именем счёта — украшение: имя уже в тексте строки (aria-hidden)
  const glyph = Math.round(size * 0.6);
  return h('span', { class: 'tile', 'aria-hidden': 'true',
    style: { width: `${size}px`, height: `${size}px`, background: t.bg, color: t.fg, fontSize: `${Math.round(size * 0.5)}px`,
      borderRadius: `${Math.round(size * 0.27)}px` } },
  t.glyph ? icon(GLYPHS[t.glyph], glyph) : t.text);
}
