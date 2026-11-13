// Карточка «Потрачено» наверху «Здоровья» (DOM): потрачено крупно из нормы, плашка зоны, полоса нормы с чертой плана на
// сегодня, три числа под чертой. Вид — view() из health.js.
import { h } from './dom.js';

export function summary(v) {
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const at = v.bar.plan == null ? null : pct(Math.min(1, v.bar.plan));
  return h('section', { class: 'card pad stack' },
    // решение 49: доля нормы — у «Потрачено»; план на сегодня — подписью у черты; норма — только в «из N»
    h('div', { class: 'row' }, h('span', { class: 'muted small' }, `${v.big.label} · ${v.scale.pct}`),
      h('span', { class: `chip ${v.zone.tone}` }, v.zone.word)),
    h('div', { class: 'big' }, h('span', { class: `big-num ${v.big.tone}` }, v.big.value),
      h('span', { class: 'muted' }, `${v.big.of} RSD`)),
    h('div', { class: 'bar', role: 'img', 'aria-label': v.scale.aria },
      h('span', { class: `fill ${v.zone.tone}`, style: { width: pct(v.bar.fill) } }),
      at == null ? null : h('span', { class: 'plan-mark', style: { left: at } })),
    // подпись сдвинута влево на ту же долю своей ширины: у начала месяца — от черты вправо, у конца — влево
    v.scale.plan && at ? h('div', { class: 'plan-cap muted small', 'aria-hidden': 'true' },
      h('span', { style: { left: at, transform: `translateX(-${at})` } }, v.scale.plan)) : null,
    h('div', { class: 'sep' }),
    h('div', { class: 'stats' }, ...v.stats.map((s) => h('div', {}, h('div', { class: 'muted small' }, s.label),
      h('div', { class: `stat ${s.tone}` }, s.value)))));
}
