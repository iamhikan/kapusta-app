// Цвет и значок категории — одни на всех экранах (спека, «Графики»): точка на «Категориях», полоса долей, плитка строки
// «Операций» (правка 4, ui-ux-pro-max 13.11.2026). Ключ — категория первого уровня, как у /api/categories.

export const OTHER = '#a1a1a6';     // «прочее» — серый на любой теме
const COLORS = {
  'Expenses:Family:Food': '#2481cc', 'Expenses:Family:Travel': '#e8833a', 'Expenses:Family:Gifts': '#9b59b6',
  'Expenses:Family:Household': '#2a9d8f', 'Expenses:Family:Pets': '#d4a400', 'Expenses:Family:Health': '#5aa84f',
  'Expenses:Family:Restaurants': '#e05a8a', 'Expenses:Family:Clothes': '#5e60ce', 'Expenses:Family:Rent': '#8d6e63',
  'Expenses:Family:CashSpent': '#607d8b', 'Expenses:Family:Outings': '#00a6c8', 'Expenses:Family:Delivery': '#c0392b',
  'Expenses:Family:Pharmacy': '#7cb342', 'Expenses:Family:Education': '#ad1457', 'Expenses:Family:FX': '#a1887f',
  'Expenses:Family:Entertainment': '#f4511e', 'Expenses:Family:Beauty': '#ec407a', 'Expenses:Family:Transport': '#827717',
  'Expenses:Family:Car': '#455a64', 'Expenses:Family:Home': '#6d4c41', 'Expenses:Family:Electronics': '#3949ab',
  'Expenses:Family:Sport': '#43a047', 'Expenses:Family:Subscriptions': '#8e24aa', 'Expenses:Family:Utilities': '#795548',
  'Expenses:Angelina:PR': '#c2185b', 'Expenses:Family:Other': OTHER,
};
const SPARE = ['#1e88e5', '#fb8c00', '#8e24aa', '#00acc1', '#7cb342', '#e53935', '#5e35b1', '#c0ca33', '#6d4c41'];

export function colorOf(key) {
  if (COLORS[key]) return COLORS[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return SPARE[hash % SPARE.length];
}

// значки — один набор: сетка 24, линия 2,2 (icon() из dom.js), без заливки
const dot = (x, y, r = 1.3) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
export const GLYPHS = {
  Food: ['M3 4h2l2.4 11h10.2L20 8H6.2', dot(9.5, 19.5, 1.5), dot(16.5, 19.5, 1.5)],
  Delivery: ['M6 8h12l-1 12H7z', 'M9 8a3 3 0 0 1 6 0'],
  Outings: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'],
  Restaurants: ['M6 3v5a2 2 0 0 0 4 0V3', 'M8 10v11', 'M17 21V3c-2.2 1.2-3.5 3.6-3.5 6.5V13H17'],
  Transport: ['M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11', 'M3.5 11h17v5.5h-17z', 'M6 16.5V19',
    'M18 16.5V19', dot(7.5, 13.8, 0.6), dot(16.5, 13.8, 0.6)],
  Car: ['M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15', 'M3.5 20h12', 'M5 10h9', 'M14 9l3 2v6a1.5 1.5 0 0 0 3 0V9l-3-3'],
  Travel: ['M2.5 12.5L21 4.5l-5 15.5-3.8-6.4z', 'M12.2 13.6L21 4.5'],
  Health: ['M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z'],
  Pharmacy: ['M10.6 4.4a4.9 4.9 0 0 1 7 7l-6.2 6.2a4.9 4.9 0 0 1-7-7z', 'M7.5 7.5l7 7'],
  Beauty: ['M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z', 'M19 15v5', 'M16.5 17.5h5'],
  Clothes: ['M8.5 4L3.5 7l2 4 2-1v10h9V10l2 1 2-4-5-3a3.5 3.5 0 0 1-7 0z'],
  Home: ['M4 10.5L12 4l8 6.5', 'M6 9v10.5h12V9', 'M10 19.5V14h4v5.5'],
  Electronics: ['M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M11 18h2'],
  Household: ['M4.5 9h15l-2 11h-11z', 'M8 9l4-5 4 5', 'M10 13v4', 'M14 13v4'],
  Pets: ['M12 13.5c-3 0-5 3.2-5 5.2 0 1 .8 1.8 1.8 1.8.9 0 2-.6 3.2-.6s2.3.6 3.2.6c1 0 1.8-.8 1.8-1.8 0-2-2-5.2-5-5.2z',
    dot(5.5, 10.5, 1.6), dot(9.5, 6.5, 1.6), dot(14.5, 6.5, 1.6), dot(18.5, 10.5, 1.6)],
  Sport: ['M6.5 7.5v9', 'M17.5 7.5v9', 'M3.5 10v4', 'M20.5 10v4', 'M6.5 12h11'],
  Supplements: ['M9 3h6', 'M10 3v3L8 9v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9l-2-3V3', 'M8 13h8'],
  Entertainment: ['M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M4 9l1-4.5h14L20 9', 'M9.5 4.5L8.5 9', 'M15.5 4.5L14.5 9'],
  Education: ['M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z', 'M4 20a2 2 0 0 0 2 1h13v-3'],
  Subscriptions: ['M17 2.5l3 3-3 3', 'M20 5.5H8a4 4 0 0 0-4 4v1', 'M7 21.5l-3-3 3-3', 'M4 18.5h12a4 4 0 0 0 4-4v-1'],
  Phone: ['M5 4h3.5l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5l1.5-2.5 5 2V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z'],
  Utilities: ['M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z'],
  Rent: ['M7.5 11.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M10 12.5L19 3.5', 'M16 6.5l2.5 2.5', 'M13.5 9l2 2'],
  Bank: ['M3 10l9-6 9 6', 'M5.5 10v8', 'M10 10v8', 'M14 10v8', 'M18.5 10v8', 'M3 20.5h18'],
  FX: ['M7 7h12l-3-3', 'M17 17H5l3 3'],
  Gifts: ['M4 9h16v4H4z', 'M5.5 13v6.5h13V13', 'M12 9v10.5',
    'M12 9c-1.2-2.8-4.6-3.4-4.6-1.4C7.4 9 10 9 12 9zm0 0c1.2-2.8 4.6-3.4 4.6-1.4C16.6 9 14 9 12 9z'],
  Taxes: ['M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z', 'M10 14l4-6', dot(10, 8.5, 0.9), dot(14, 13.5, 0.9)],
  CashSpent: ['M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  scissors: ['M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M20 4L8.12 15.88',
    'M14.47 14.48L20 20', 'M8.12 8.12L12 12'],
  transfer: ['M7 7h12l-3-3', 'M17 17H5l3 3'],
  income: ['M12 4v12', 'M7 11l5 5 5-5', 'M5 20h14'],
  dots: [dot(6, 12), dot(12, 12), dot(18, 12)],
};

// значок категории по ключу: «Expenses:Family:Transport» и её подкатегории — Transport; салон — ножницы
export function glyphOf(key) {
  if (key.startsWith('Expenses:Angelina:PR')) return 'scissors';
  const name = key.startsWith('Expenses:Family:') ? key.split(':')[2] : '';
  return GLYPHS[name] ? name : 'dots';
}
