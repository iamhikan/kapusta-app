// Строка лимита (DOM): «Лимиты» на «Здоровье» и «Скрытые лимиты». Тап — операции лимита за месяц. Диктор читает
// строку как она видна (имя, «+N», потрачено / лимит) и состояние полоски словами — цвет он не видит (фаза 12).
import { h, icon, ICONS } from './dom.js';

const pct = (x) => `${(x * 100).toFixed(1)}%`;

// l — строка view().limits или скрытого лимита; plan — доля месяца для черты (null — без черты); open — по тапу
export function limitRow(l, { plan = null, open }) {
  return h('button', { type: 'button', class: 'limit', 'data-focus': `limit:${l.name}`, on: { click: open } },
    h('span', { class: 'limit-body' },
      h('span', { class: 'row' },
        h('span', { class: 'limit-name' }, h('span', { class: 'ellipsis' }, l.name),
          l.over ? h('span', { class: `badge${l.covered ? ' calm' : ''}` }, l.over) : null),
        // решение 63: перерасход, который покрыл резерв, — без красного; подпись «покрыто резервом» — ниже (hint)
        h('span', { class: 'nowrap' }, h('b', { class: l.over && !l.covered ? 'bad' : '' }, l.spent),
          h('span', { class: 'muted small' }, ` / ${l.limit}`), l.state ? h('span', { class: 'sr' }, `, ${l.state}`) : null)),
      h('span', { class: 'bar thin' }, h('span', { class: 'fill', style: { width: pct(l.fill), background: l.color || 'var(--bar-green)' } }),
        plan == null ? null : h('span', { class: 'plan-mark soft', style: { left: pct(plan) } })),
      l.hint ? h('span', { class: 'muted small' }, l.hint) : null),
    icon(ICONS.right, 16));
}
