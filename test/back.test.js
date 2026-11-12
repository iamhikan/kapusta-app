// «Назад» Telegram: кнопка видна — значит, нажатие что-то закрывает (critique 12.11: на вкладке «Операции» лист
// «Фильтры» показывал кнопку, а нажатие ничего не делало — лист закрывался только тапом по фону).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backStep, showBack } from '../js/back.js';

test('лист «Фильтры» на корневой вкладке «Операции» закрывается кнопкой «Назад»', () => {
  const stack = [{ kind: 'ops', sheet: true }];
  assert.equal(showBack(stack), true);
  assert.equal(backStep(stack), 'sheet');
});

test('порядок: лист, группа выбора категории, выбор категории, потом экран под ним', () => {
  const card = { kind: 'card' };
  assert.equal(backStep([{ kind: 'ops' }, { ...card, picker: { group: 'еда' } }]), 'group');
  assert.equal(backStep([{ kind: 'ops' }, { ...card, picker: {} }]), 'picker');
  assert.equal(backStep([{ kind: 'ops' }, card]), 'pop');
  assert.equal(backStep([{ kind: 'ops', sheet: true }, card]), 'pop');      // лист под карточкой — не верхний
});

test('на корне без листа кнопки нет и нажатие ничего не делает', () => {
  for (const kind of ['health', 'ops', 'cats']) {
    assert.equal(showBack([{ kind }]), false, kind);
    assert.equal(backStep([{ kind }]), null, kind);
  }
});

test('кнопка видна — нажатие что-то закрывает (кроме выбора категории, пока он сохраняет)', () => {
  const tops = [{ sheet: true }, { picker: { group: 'g' } }, { picker: {} }, {}];
  for (const depth of [1, 2]) {
    for (const top of tops) {
      const stack = [...Array(depth - 1).fill({ kind: 'ops' }), { kind: 'ops', ...top }];
      if (showBack(stack)) assert.notEqual(backStep(stack), null, JSON.stringify(stack));
    }
  }
});
