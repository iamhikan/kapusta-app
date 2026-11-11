// Мелочи DOM для экранов: элемент, иконка, вибрация на тап.
const SVG = 'http://www.w3.org/2000/svg';

export const tg = globalThis.Telegram && globalThis.Telegram.WebApp;

export function h(tag, attrs = {}, ...kids) {
  const el = tag.startsWith('svg:') ? document.createElementNS(SVG, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}

export const icon = (d, size = 20) => h('svg:svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  'aria-hidden': 'true' }, ...[].concat(d).map((p) => h('svg:path', { d: p })));

export const tap = () => { try { tg.HapticFeedback.impactOccurred('light'); } catch { /* вне Telegram — без вибрации */ } };

export const ICONS = {
  left: 'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6', down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6',
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  transfer: ['M7 7h12l-3-3', 'M17 17H5l3 3'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  health: ['M3 12h4l3-8 4 16 3-8h4'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  pie: ['M12 3a9 9 0 1 0 9 9h-9z', 'M15 3.5A9 9 0 0 1 20.5 9H15z'],
};
