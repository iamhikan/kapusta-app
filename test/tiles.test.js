// Плитки счетов (решение 47): банк — буква в цвете банка, остальное — значок; новый счёт — цвет по имени и буква.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileOf } from '../js/tiles.js';

test('банк — буква в цвете банка: два счёта Райффайзена — одна жёлтая «R», кредит РФ — не банк, а значок', () => {
  const rsd = tileOf('Assets:Family:Raiffeisen:RSD', 'Raiffeisen Ангелина');
  assert.deepEqual(tileOf('Assets:Family:Raiffeisen:RUB', 'Райффайзен РФ'), rsd);
  assert.equal(rsd.text, 'R');
  assert.equal(rsd.glyph, undefined);
  assert.notEqual(rsd.fg, '#ffffff');                       // на жёлтом — тёмная буква
  assert.equal(tileOf('Assets:Family:Raiffeisen:Kredit', 'кредит РФ').glyph, 'percent');
  assert.equal(tileOf('Assets:Family:Freedom', 'Freedom').text, 'F');
  assert.equal(tileOf('Assets:Family:ALTA', 'карта ALTA').text, 'A');
});

test('нал обоих — купюра; ПР — портфель, а не банк ALTA; салон — ножницы; Walt, «нам должны», другая карта', () => {
  assert.equal(tileOf('Assets:Family:Cash:Aleksey', 'нал Алексея').glyph, 'cash');
  assert.equal(tileOf('Assets:Family:Cash:Angelina', 'нал Ангелины').glyph, 'cash');
  assert.equal(tileOf('Assets:PR:ALTA', 'ПР Алексея').glyph, 'briefcase');
  assert.equal(tileOf('Assets:Angelina:PR:Bank', 'счёт салона').glyph, 'scissors');
  assert.equal(tileOf('Assets:Family:Walt', 'Walt').glyph, 'wallet');
  assert.equal(tileOf('Assets:Family:Receivable', 'нам должны').glyph, 'inbound');
  assert.equal(tileOf('Assets:Family:OtherCard', 'другая карта').glyph, 'card');
  const tiles = ['Assets:Family:Cash:Aleksey', 'Assets:Family:ALTA', 'Assets:Family:Freedom', 'Assets:Family:Raiffeisen:RSD',
    'Assets:PR:ALTA', 'Assets:Angelina:PR:Bank', 'Assets:Family:Walt'].map((a) => tileOf(a, a).bg);
  assert.equal(new Set(tiles).size, tiles.length);            // у каждого вида — свой цвет
});

test('новый счёт без плитки — первая буква имени и цвет по имени: один и тот же при каждом открытии', () => {
  const t = tileOf('Assets:Family:Revolut', 'Revolut');
  assert.equal(t.text, 'R');
  assert.deepEqual(tileOf('Assets:Family:Revolut', 'Revolut'), t);
  assert.notEqual(tileOf('Assets:Family:Wise', 'wise').bg, t.bg);
  assert.equal(tileOf('Assets:Family:Wise', 'wise').text, 'W');
});
