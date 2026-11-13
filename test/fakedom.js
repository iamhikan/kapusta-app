// Поддельный DOM для тестов вида (правки ui-ux-pro-max, 13.11.2026): элементы, атрибуты, стиль, дети, поиск по
// классу. Ставит globalThis.document, если его ещё нет (a11y.test и words.test ставят свой).
class El {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.kids = []; this.style = {}; this.handlers = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(ev, fn) { this.handlers[ev] = fn; }
  append(...kids) { this.kids.push(...kids); }
  querySelector(sel) { return sel.startsWith('.') ? one(this, sel.slice(1)) : null; }   // только «.класс»
  get classes() { return (this.attrs.class || '').split(/\s+/).filter(Boolean); }
}
if (!globalThis.document) {
  globalThis.document = { createElement: (t) => new El(t), createElementNS: (_, t) => new El(t), body: new El('body') };
}

const walk = (el, fn) => {
  if (!el || typeof el !== 'object' || !el.kids) return;
  fn(el);
  el.kids.forEach((k) => walk(k, fn));
};

// все элементы поддерева с классом cls (или тегом, если cls начинается с «<»)
export function all(tree, cls) {
  const out = [];
  walk(tree, (e) => { if (cls.startsWith('<') ? e.tag === cls.slice(1) : e.classes.includes(cls)) out.push(e); });
  return out;
}
export const one = (tree, cls) => all(tree, cls)[0] || null;

// видимый текст поддерева: без aria-hidden, без .sr
export function seen(el) {
  if (typeof el === 'string') return el;
  if (!el || !el.kids || el.attrs['aria-hidden'] === 'true' || el.classes.includes('sr')) return '';
  return el.kids.map(seen).join('');
}
// что слышит диктор: aria-label или текст без aria-hidden
export function heard(el) {
  if (typeof el === 'string') return el;
  if (!el || !el.kids || el.attrs['aria-hidden'] === 'true') return '';
  return el.attrs['aria-label'] ?? el.kids.map(heard).join(' ');
}
