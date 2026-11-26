// Плитки счетов (решение 47): банк — буква в цвете банка, остальное — значок; новый счёт — цвет по имени и буква.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, one } from './fakedom.js';
import { tile, tileOf } from '../js/tiles.js';

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

test('UniCredit — банк: белая «U» на красном, как в логотипе банка; у счетов RSD и EUR — одна плитка', () => {
  // долг 18.11: плитка была «новым счётом» — зелёная по имени, рядом с зелёными Freedom и налом
  const uc = tileOf('Assets:Family:UniCredit', 'UniCredit');
  assert.equal(uc.text, 'U');
  assert.equal(uc.glyph, undefined);
  assert.equal(uc.fg, '#ffffff');
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(uc.bg.slice(i, i + 2), 16));
  assert.ok(uc.bg.startsWith('#') && r > 200 && g < 40 && b < 40, `красный: ${uc.bg}`);
  assert.deepEqual(tileOf('Assets:Family:UniCredit:RSD', 'UniCredit'), uc);   // кошелёк в карточке — счёт с валютой
  assert.deepEqual(tileOf('Assets:Family:UniCredit:EUR', 'UniCredit'), uc);
  assert.notEqual(uc.bg, tileOf('Assets:Angelina:PR:Bank', 'счёт салона').bg);
});

test('счёт ПР — плитка своего банка и значок портфеля в углу: рядом с картой того же банка видно, где ПР', () => {
  // Алексей 20.11: «оставь с наименованием банка, только иконку … поменять, чем синий портфель» —
  // было: оба счёта ПР — синий портфель, банк не виден
  const card = tileOf('Assets:Family:UniCredit', 'UniCredit');
  const pr = tileOf('Assets:PR:UniCredit', 'ПР Алексея · UniCredit');
  assert.deepEqual([pr.text, pr.bg, pr.fg, pr.glyph], [card.text, card.bg, card.fg, undefined]);   // красная «U»
  assert.equal(pr.badge, 'briefcase');
  assert.equal(card.badge, undefined);
  assert.deepEqual(tileOf('Assets:PR:UniCredit:EUR', 'ПР Алексея · UniCredit'), pr);   // кошелёк в карточке — с валютой
  const alta = tileOf('Assets:PR:ALTA', 'ПР Алексея · ALTA');
  const altaCard = tileOf('Assets:Family:ALTA', 'карта ALTA');
  assert.deepEqual([alta.text, alta.bg, alta.fg, alta.badge], [altaCard.text, altaCard.bg, altaCard.fg, 'briefcase']);
  assert.equal(altaCard.badge, undefined);

  // на экране: у счёта ПР — буква банка и значок портфеля в углу; у карты — только буква
  const [prEl, cardEl] = [tile(pr), tile(card)];
  assert.ok(prEl.kids.includes('U') && cardEl.kids.includes('U'));
  const badge = one(prEl, 'tile-badge');
  assert.ok(badge, 'значок ПР в углу плитки');
  assert.equal(all(badge, '<svg').length, 1);
  assert.equal(one(cardEl, 'tile-badge'), null);
  assert.equal(prEl.getAttribute('aria-hidden'), 'true');                     // имя «ПР Алексея · …» — в тексте строки

  // ПР в банке без своей плитки — портфель, как раньше; салон Ангелины — ножницы, без значка
  assert.equal(tileOf('Assets:PR:Revolut', 'ПР Алексея · Revolut').glyph, 'briefcase');
  assert.equal(tileOf('Assets:Angelina:PR:Bank', 'счёт салона').badge, undefined);
});

test('нал обоих — купюра; салон — ножницы; Walt, «нам должны», другая карта', () => {
  assert.equal(tileOf('Assets:Family:Cash:Aleksey', 'нал Алексея').glyph, 'cash');
  assert.equal(tileOf('Assets:Family:Cash:Angelina', 'нал Ангелины').glyph, 'cash');
  assert.equal(tileOf('Assets:Angelina:PR:Bank', 'счёт салона').glyph, 'scissors');
  assert.equal(tileOf('Assets:Family:Walt', 'Walt').glyph, 'wallet');
  assert.equal(tileOf('Assets:Family:Receivable', 'нам должны').glyph, 'inbound');
  assert.equal(tileOf('Assets:Family:OtherCard', 'другая карта').glyph, 'card');
  const tiles = ['Assets:Family:Cash:Aleksey', 'Assets:Family:ALTA', 'Assets:Family:Freedom', 'Assets:Family:UniCredit',
    'Assets:Family:Raiffeisen:RSD', 'Assets:Angelina:PR:Bank', 'Assets:Family:Walt'].map((a) => tileOf(a, a).bg);
  assert.equal(new Set(tiles).size, tiles.length);            // у каждого вида — свой цвет (ПР — цвет банка и значок)
});

test('нал дома (решение 99) — зелёная плитка нала со значком домика: в «Наличных» видно, где кошельки, а где шкаф', () => {
  const home = tileOf('Assets:Family:Cash:Home', 'нал дома');
  const wallet = tileOf('Assets:Family:Cash:Aleksey', 'нал Алексея');
  assert.equal(home.glyph, 'home');
  assert.deepEqual([home.bg, home.fg], [wallet.bg, wallet.fg]);                // тот же цвет нала
  assert.deepEqual(tileOf('Assets:Family:Cash:Home:EUR', 'нал дома'), home);   // кошелёк в карточке — счёт с валютой
  const el = tile(home);
  assert.equal(all(el, '<svg').length, 1);
  assert.ok(all(el, '<path').length >= 2, 'домик нарисован');
  assert.equal(el.getAttribute('aria-hidden'), 'true');                        // имя «нал дома» — в тексте строки
});

test('новый счёт без плитки — первая буква имени и цвет по имени: один и тот же при каждом открытии', () => {
  const t = tileOf('Assets:Family:Revolut', 'Revolut');
  assert.equal(t.text, 'R');
  assert.deepEqual(tileOf('Assets:Family:Revolut', 'Revolut'), t);
  assert.notEqual(tileOf('Assets:Family:Wise', 'wise').bg, t.bg);
  assert.equal(tileOf('Assets:Family:Wise', 'wise').text, 'W');
});
