// Строка лимита (DOM): «Лимиты» на «Здоровье» и «Скрытые лимиты». Тап — операции лимита за месяц. Диктор слышит
// строку одной фразой словами — «транспорт: 24 930 из 5 876, сверх на 19 054» (после v3, critique 12.11, P2 № 4: было
// «транспорт +19 054 24 930 / 5 876»), видимые числа от него скрыты; состояние полоски — словами, цвет он не видит.
import { h, icon, ICONS } from './dom.js';

const pct = (x) => `${(x * 100).toFixed(1)}%`;

// фраза диктора: имя, «N из M», сверх на сколько (или состояние полоски), подпись под полоской
export function limitSay(l) {
  return [`${l.name}: ${l.spent} из ${l.limit}`, l.over ? `сверх на ${l.over.replace(/^\+/, '')}` : l.state, l.hint]
    .filter(Boolean).join(', ');
}

// полоска лимита (правка 1, ui-ux-pro-max 13.11): в лимите — доля и черта плана; сверх — сплошная часть до метки
// лимита (limitAt), дальше штриховка того же цвета; черты плана нет — лимит уже пройден. Общая с «Категориями».
export function limitBar(l, plan = null) {
  const color = l.color || 'var(--bar-green)';
  const at = l.limitAt == null ? null : pct(l.limitAt);
  return h('span', { class: 'bar thin', 'aria-hidden': 'true' },
    h('span', { class: `fill${at ? ' to-mark' : ''}`, style: { width: pct(l.fill), background: color } }),
    at ? h('span', { class: 'over', style: { left: at, color } }) : null,
    at ? h('span', { class: 'limit-mark', style: { left: at } }) : null,
    at || plan == null ? null : h('span', { class: 'plan-mark soft', style: { left: pct(plan) } }));
}

// легенда полосок одной строкой под «Лимиты»: цвет — образцом полоски, перерасход — штриховкой, лимит — меткой
export function limitLegend(items) {
  const swatch = (l) => (l.mark ? h('span', { class: 'swatch-mark' })
    : h('span', { class: l.hatch ? 'swatch-hatch' : 'swatch-bar', style: l.hatch ? { color: l.color } : { background: l.color } }));
  return h('div', { class: 'legend limit-legend muted small' },
    ...items.map((l) => h('span', { class: 'legend-item' }, swatch(l), l.text)));
}

// l — строка view().limits или скрытого лимита; plan — доля месяца для черты (null — без черты); open — по тапу
export function limitRow(l, { plan = null, open }) {
  return h('button', { type: 'button', class: 'limit', 'data-focus': `limit:${l.name}`, on: { click: open } },
    h('span', { class: 'limit-body' },
      h('span', { class: 'sr' }, limitSay(l)),
      h('span', { class: 'row', 'aria-hidden': 'true' },
        h('span', { class: 'limit-name' }, h('span', { class: 'ellipsis' }, l.name),
          l.over ? h('span', { class: `badge${l.covered ? ' calm' : ''}` }, l.over) : null),
        // решение 63: перерасход, который покрыл резерв, — без красного; подпись «покрыто резервом» — ниже (hint)
        h('span', { class: 'nowrap' }, h('b', { class: l.over && !l.covered ? 'bad' : '' }, l.spent),
          h('span', { class: 'muted small' }, ` / ${l.limit}`))),
      limitBar(l, plan),
      l.hint ? h('span', { class: 'muted small', 'aria-hidden': 'true' }, l.hint) : null),
    icon(ICONS.right, 16));
}
