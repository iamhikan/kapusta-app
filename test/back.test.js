// «Назад» Telegram: кнопка видна — значит, нажатие что-то закрывает (critique 12.11: на вкладке «Операции» лист
// «Фильтры» показывал кнопку, а нажатие ничего не делало — лист закрывался только тапом по фону).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backStep, escapes, returnTo, showBack } from '../js/back.js';

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

// фаза 15 (critique 12.11, P1 № 2): Escape закрывает то же, что «Назад», но только листы; фокус — туда, откуда открыли
test('Escape закрывает лист, группу и выбор категории — но не экран (экран закрывает «Назад» Telegram)', () => {
  const card = { kind: 'card' };
  assert.equal(escapes([{ kind: 'ops', sheet: true }]), true);
  assert.equal(escapes([{ kind: 'cats', sheet: true }]), true);
  assert.equal(escapes([{ kind: 'ops' }, { ...card, picker: { group: 'Expenses:Family:Food' } }]), true);
  assert.equal(escapes([{ kind: 'ops' }, { ...card, picker: {} }]), true);
  assert.equal(escapes([{ kind: 'ops' }, card]), false);
  assert.equal(escapes([{ kind: 'ops' }, { ...card, picker: { saving: true } }]), false);   // смена уже ушла
  assert.equal(escapes([{ kind: 'health' }]), false);
});

test('после «Назад» и Escape фокус — на кнопку, которая открыла закрытое', () => {
  assert.equal(returnTo([{ kind: 'ops', sheet: true }]), 'filters');
  assert.equal(returnTo([{ kind: 'cats', sheet: true }]), 'period:custom');
  const card = { kind: 'card' };
  assert.equal(returnTo([{ kind: 'ops' }, { ...card, picker: { group: 'Expenses:Family:Food', from: 'recat' } }]),
    'catg:Expenses:Family:Food');
  assert.equal(returnTo([{ kind: 'ops' }, { ...card, picker: { from: 'item:2' } }]), 'item:2');
  assert.equal(returnTo([{ kind: 'ops', focus: 'op:sms:1' }, card]), 'op:sms:1');
  assert.equal(returnTo([{ kind: 'ops' }, card]), null);
  assert.equal(returnTo([{ kind: 'health' }]), null);
});
