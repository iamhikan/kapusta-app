// Фокус и диктор при перерисовке (фаза 15, critique 12.11, P1 № 2). Экран рисуется заново целиком (replaceChildren):
// узел с фокусом пропадает, и фокус уходил в BODY. Теперь фокус возвращается по ключу data-focus — на новую кнопку с
// тем же ключом. Лист — модальный: фокус внутрь, фон inert. Диктор слышит только сообщения (сохранено, ошибка, Мак
// спит) — из маленькой живой зоны вне экрана; экран сам не «живой».
//
// Фокус двигаем, только если он уже «в игре» — стоит на элементе экрана (клавиатура, Android, диктор). Тап на iPhone
// кнопку не фокусирует: там скрипт фокус не трогает, и кольцо само не появляется.

import { pressed } from './dom.js';

const KEY = 'data-focus';
const ALT = 'data-focus-alt';   // кнопка стала неактивной — фокус на соседнюю (стрелка «вперёд» у текущего месяца)

const keyOf = (el) => (el && el.getAttribute ? el.getAttribute(KEY) : null);

function find(root, key) {
  // под листом фон inert: там фокус не встанет
  return [...root.querySelectorAll(`[${KEY}]`)].find((el) => keyOf(el) === key && !el.closest('[inert]')) || null;
}

export function modal(root) {
  // лист — последним в root, поверх всего; остальное — inert (Tab и диктор не уходят под лист)
  const back = root.querySelector('.sheet-back');
  if (!back) return;
  root.append(back);
  for (const el of root.children) if (el !== back) el.setAttribute('inert', '');
}

export function painter(root, doc, live) {
  let memo = null;   // ключ кнопки с фокусом; держится через скелет загрузки, пока кнопка не появится
  let next = null;   // куда поставить фокус после перерисовки: в лист, на кнопку, что открыла лист
  let said = '';
  const inPlay = () => {
    const a = doc.activeElement;
    return Boolean(a && a !== doc.body && root.contains(a));
  };

  function show(...nodes) {
    const a = doc.activeElement;
    let typing = null;
    if (inPlay()) {
      memo = keyOf(a);
      // поле — только пока оно в фокусе: иначе фокус в поле откроет клавиатуру телефона сам
      if (memo && a.tagName === 'INPUT') typing = { start: a.selectionStart, end: a.selectionEnd };
    }
    root.replaceChildren(...nodes);
    modal(root);
    const key = next || memo;
    next = null;
    if (key) place(key, typing);
    say();
  }

  function place(key, typing) {
    let el = find(root, key);
    if (el && el.disabled && el.getAttribute(ALT)) el = find(root, el.getAttribute(ALT));
    // кнопки с ключом на готовом экране нет (строки категории за месяц нет, решение 74) — на заголовок экрана, не в BODY;
    // на скелете загрузки (aria-busy) — ждём кнопку
    if (!el && !root.querySelector('[aria-busy]')) el = find(root, 'title');
    if (!el || el.disabled || (el.tagName === 'INPUT' && !typing)) { memo = key; return; }
    el.focus({ preventScroll: true });
    if (typing && el.setSelectionRange) el.setSelectionRange(typing.start, typing.end);
    memo = keyOf(el);
  }

  function say() {
    // сообщение экрана — data-say; то же сообщение при перерисовке не повторяем, пропало — забываем
    const text = [...root.querySelectorAll('[data-say]')].map((el) => el.getAttribute('data-say')).join(' ').trim();
    if (text === said) return;
    said = text;
    if (live) live.textContent = text;
  }

  return {
    show,
    focus(key) { if (key && inPlay()) next = key; },
    // фокус в поле, а нажали строку (тап на iPhone фокус не переносит) — запоминаем нажатую строку
    current: () => {
      if (!inPlay()) return memo;
      const a = doc.activeElement;
      return a.tagName === 'INPUT' && pressed() ? pressed() : keyOf(a);
    },
  };
}
