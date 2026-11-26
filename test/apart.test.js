// Ответ 3 решения 98 (ревью 26.11.2026, R-3, R-6). Метка регулярной и обязательной в строке «Операций» —
// только значок после категории, как в `fin last` («образование 🔁 · Райффайзен»); слово — в карточке и в пояснении;
// диктор слышит слова. На экране самой регулярной метки нет. У обмена 🔁 стоит у строки выигрыша или потери, а не у
// суммы обмена.
// Поддельный DOM — fakedom.js. Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, heard, one } from './fakedom.js';
import { cardScreen, opsScreen } from '../js/screens.js';
import { opRow } from '../js/ops.js';

const eye = (el) => (typeof el === 'string' ? el : !el || !el.kids || el.classes.includes('sr') ? '' : el.kids.map(eye).join(''));
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1 $2');

const spend = (ref, where, extra = {}) => ({ ref, date: '2026-11-25', where, what: '', kind: 'spend', cats: ['образование'],
  src: 'Райффайзен РФ', amount: { number: 8400, currency: 'RUB' }, rsd: 11041, receipt: false, flag: false, by: 'Алексей', ...extra });
const EXCHANGE = { ref: 'add:x', date: '2026-11-25', where: 'Обмен', what: '', kind: 'exchange', cats: [], src: 'нал Алексея',
  rsd: -782, fx: 782, receipt: false, flag: false, regular: 'обмен валюты', rate: { deal: 118, nbs: 117.61, currency: 'EUR' },
  legs: [{ name: 'нал Алексея', number: -2000, currency: 'EUR' }, { name: 'нал Алексея', number: 236000, currency: 'RSD' }] };

function navOf() {
  const nav = { pushed: [], focused: [], today: () => '2026-11-26', accounts: () => [], balanceOf: () => null, queued: () => [],
    render() {}, savePeriod() {}, limitOf: () => null, noteOf: () => '', hasSnap: false, marksHidden: () => false,
    hideMarks() {}, focus: (k) => nav.focused.push(k), push: (e) => nav.pushed.push(e) };
  return nav;
}
const list = (ops, extra = {}, day = {}) => ({ kind: 'ops', month: '2026-11', ctx: null, expanded: new Set(),
  f: { q: '', transfers: false, account: '', who: '', source: '', flag: false },
  pages: [{ from: '2026-11-01', to: '2026-11-26', count: ops.length, total: 12621, next: null,
    days: [{ date: '2026-11-25', sum: 12621, plain: 0, ...day, ops }] }], ...extra });
const rowOf = (screen, ref) => all(screen, '<button').find((b) => b.attrs['data-focus'] === `op:${ref}`);

// ——— R-3: метка — значком после категории ———

test('R-3: регулярная — «образование 🔁 · Райффайзен РФ», обязательная — «жильё 📌 · нал Алексея»; слов у имени нет', () => {
  const reg = opRow(spend('a:1', 'Английский', { regular: 'образование' }));
  assert.equal(reg.sub, 'образование 🔁 · Райффайзен РФ');
  assert.deepEqual(reg.marks, []);
  const rent = opRow(spend('a:2', 'Хозяин', { cats: ['жильё'], src: 'нал Алексея', mandatory: 'жильё' }));
  assert.equal(rent.sub, 'жильё 📌 · нал Алексея');
  assert.deepEqual(rent.marks, []);
  // «чек», «!», «секрет» — как были, метками у имени
  assert.deepEqual(opRow(spend('a:3', 'Lidl', { regular: 'подписки', receipt: true, flag: true })).marks, ['чек', '!']);
  assert.equal(opRow(spend('a:4', 'Пекара')).sub, 'образование · Райффайзен РФ');
});

test('R-3: в категории значок без её имени — «🔁 · Райффайзен РФ»; на экране самой регулярной метки нет', () => {
  const op = spend('a:1', 'Английский', { regular: 'образование' });
  assert.equal(opRow(op, { inCategory: true }).sub, '🔁 · Райффайзен РФ');
  assert.equal(opRow(op, { inCategory: true, bare: true }).sub, 'Райффайзен РФ');
});

test('R-3: строка списка — имя целиком, значок после категории; диктор слышит «регулярная трата» один раз, без значка', () => {
  const screen = opsScreen(list([spend('a:1', 'Английский', { regular: 'образование' }),
    spend('a:2', 'Хозяин', { cats: ['жильё'], src: 'нал Алексея', mandatory: 'жильё', rsd: 1580 })]), navOf());
  const row = rowOf(screen, 'a:1');
  assert.match(eye(row), /^Английскийобразование 🔁 · Райффайзен РФ/);
  assert.doesNotMatch(eye(row), /регулярная/, 'слова «регулярная» в строке нет — оно в карточке и в пояснении');
  assert.equal(heard(row).match(/регулярная трата/g).length, 1);
  assert.doesNotMatch(heard(row), /🔁/);
  const rent = rowOf(screen, 'a:2');
  assert.match(eye(rent), /жильё 📌 · нал Алексея/);
  assert.match(heard(rent), /обязательная трата/);
  assert.doesNotMatch(heard(rent), /📌/);
  assert.equal(one(rent, 'mark'), null, 'чипа метки у имени нет');
});

test('R-3: экран регулярной (regular=) — без значка в строках', () => {
  const screen = opsScreen(list([spend('a:1', 'Английский', { regular: 'образование' })],
    { ctx: { title: 'Образование', params: { regular: 'образование' }, limitWord: 'В норме' } }), navOf());
  const row = rowOf(screen, 'a:1');
  assert.doesNotMatch(eye(row), /🔁/);
  assert.doesNotMatch(heard(row), /регулярная/);
});

test('R-3: карточка — слово у строки метки, у шапки и суммы значка нет', () => {
  const card = { ...spend('a:1', 'Английский', { regular: 'образование' }), apart: ['🔁 — регулярная трата: у неё своя норма, в «Потрачено» идёт только то, что сверх нормы'],
    refs: ['a:1'], similar: [], postings: [] };
  const screen = cardScreen({ kind: 'card', ref: 'a:1', data: card }, navOf());
  assert.match(eye(one(screen, 'card-title')), /^Английский$/);
  const line = all(screen, '<button').find((b) => b.attrs['data-focus'] === 'apart:regular');
  assert.match(eye(line), /🔁 регулярная · образование/);
});

// ——— R-6: у обмена 🔁 — у строки выигрыша или потери; повтор ревью (п. 12): после неё, как значок в строке ———

test('R-6: обмен — «выигрыш на обмене +782 🔁», у имени метки нет; на экране «Обмена валюты» и в карточке — без значка', () => {
  const r = opRow(EXCHANGE);
  assert.equal(r.where, 'Обмен');
  assert.deepEqual(r.marks, []);
  assert.equal(r.note, 'выигрыш на обмене\u00a0+782\u00a0🔁');
  assert.equal(r.sub, 'нал Алексея · по 118, НБС 117,61');
  assert.equal(opRow({ ...EXCHANGE, fx: -40 }).note, 'потеря на обмене\u00a0−40\u00a0🔁');
  assert.equal(opRow(EXCHANGE, { inCategory: true, bare: true }).note, 'выигрыш на обмене\u00a0+782');
  assert.equal(opRow({ ...EXCHANGE, regular: undefined }).note, 'выигрыш на обмене\u00a0+782');
  const row = rowOf(opsScreen(list([EXCHANGE]), navOf()), 'add:x');
  assert.match(eye(row), /выигрыш на обмене\s\+782\s🔁/);
  assert.match(flat(heard(row)), /выигрыш на обмене\s\+782\s*регулярная трата/);
  const card = cardScreen({ kind: 'card', ref: 'add:x', data: { ...EXCHANGE, refs: ['add:x'], similar: [], postings: [],
    apart: ['🔁 — регулярная трата: у неё своя норма, в «Потрачено» идёт только то, что сверх нормы'] } }, navOf());
  const notes = all(card, 'good').map(eye);
  assert.ok(notes.includes('выигрыш на обмене\u00a0+782'), notes.join(' | '));
});

test('R-3 (стенд 320 px): подпись с меткой — три части: категория, значок, «· откуда»; без метки — одной строкой, как была', () => {
  const screen = opsScreen(list([spend('a:1', 'Английский', { regular: 'образование' }), spend('a:2', 'Пекара')]), navOf());
  const sub = one(rowOf(screen, 'a:1'), 'op-sub');
  assert.ok(sub.classes.includes('split'));
  assert.equal(eye(one(sub, 'sub-cats')), 'образование');
  assert.equal(eye(one(sub, 'sub-glyph')), ' 🔁');
  assert.equal(eye(one(sub, 'sub-tail')), ' · Райффайзен РФ');
  assert.equal(eye(sub), 'образование 🔁 · Райффайзен РФ');
  const plain = one(rowOf(screen, 'a:2'), 'op-sub');
  assert.ok(!plain.classes.includes('split'));
  assert.equal(eye(plain), 'образование · Райффайзен РФ');
  const bare = one(rowOf(opsScreen(list([spend('a:1', 'Английский', { regular: 'образование', cats: [] })], {
    ctx: { title: 'Лимит', params: { limit: 'x' } } }), navOf()), 'a:1'), 'op-sub');
  assert.equal(eye(bare), '🔁 · Райффайзен РФ');
});

// повтор ревью p46a, находка 11: при 320 px «· откуда» сжималось до «·» — счёт строки не виден. Теперь «откуда» не
// сжимается, а уходит строкой ниже (style.css); точка — своя ячейка: в начале новой строки её не видно
test('находка 11: «· откуда» — точка и счёт отдельно: узкий экран переносит счёт строкой ниже, без точки в начале', () => {
  const screen = opsScreen(list([spend('a:1', 'Английский', { regular: 'образование' })]), navOf());
  const tail = one(one(rowOf(screen, 'a:1'), 'op-sub'), 'sub-tail');
  assert.equal(eye(one(tail, 'sub-sep')), ' · ');
  assert.deepEqual(tail.kids.slice(1), ['Райффайзен РФ'], 'счёт — после точки, целиком');
  assert.equal(eye(tail), ' · Райффайзен РФ');
  assert.match(flat(heard(rowOf(screen, 'a:1'))), /регулярная трата · Райффайзен РФ/, 'диктор слышит то же');
});
