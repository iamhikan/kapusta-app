// Что значат 🔁 и 📌 (R-4, R-8; ревью 26.11.2026, решение 98): пояснение над первым днём «Операций» — словами чата
// (поле apart сервера, names.APART_NOTE fin), «Понятно» прячет его на устройстве; в карточке — строка метки с переходом
// на операции регулярной и пояснение. Поддельный DOM — fakedom.js. Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, heard, one, seen } from './fakedom.js';
import { cardScreen, opsScreen } from '../js/screens.js';

// текст для глаз: значки 🔁📌 видны, хоть и скрыты от диктора; .sr — нет
const eye = (el) => (typeof el === 'string' ? el : !el || !el.kids || el.classes.includes('sr') ? '' : el.kids.map(eye).join(''));
const press = (el) => el.handlers.click({ target: el, currentTarget: el });

// строки пояснения fin (names.APART_NOTE; повтор ревью p46a: было «она в норме отдельно», «только перебор»)
const REG = '🔁 — регулярная трата: у неё своя норма, в «Потрачено» идёт только то, что сверх нормы';
const MAN = '📌 — обязательная трата: у неё своя норма, в «Потрачено» идёт только то, что сверх нормы у коммуналки';
const op = (ref, where, extra = {}) => ({ ref, date: '2026-11-13', where, what: '', kind: 'spend', cats: ['банк'], src: 'нал',
  amount: { number: 100, currency: 'RSD' }, rsd: 100, receipt: false, flag: false, by: 'Алексей', ...extra });
const PAGE = { from: '2026-11-01', to: '2026-11-26', count: 2, total: 1433, next: null, apart: [REG, MAN],
  days: [{ date: '2026-11-13', sum: 1433, plain: -3100, ops: [op('a:1', 'Кредит', { mandatory: 'кредит РФ' }),
    op('a:2', 'Anthropic', { regular: 'подписки' })] }] };

function navOf(hidden = false) {
  const nav = { pushed: [], focused: [], today: () => '2026-11-26', accounts: () => [], balanceOf: () => null, queued: () => [],
    render() {}, savePeriod() {}, limitOf: () => null, noteOf: () => '', hasSnap: false, hidden,
    marksHidden: () => nav.hidden, hideMarks: () => { nav.hidden = true; }, focus: (k) => nav.focused.push(k),
    push: (e) => nav.pushed.push(e) };
  return nav;
}
const list = (extra = {}, pages = [PAGE]) => ({ kind: 'ops', month: '2026-11', ctx: null, pages,
  f: { q: '', transfers: false, account: '', who: '', source: '', flag: false }, expanded: new Set(), ...extra });

test('R-4: над первым днём — что значат 🔁 и 📌, словами чата; «без 🔁📌» и минус — словами (R-8)', () => {
  const screen = opsScreen(list(), navOf());
  const note = one(screen, 'marks-note');
  assert.ok(note, 'пояснение есть');
  const text = eye(note);
  assert.ok(text.includes(REG) && text.includes(MAN), text);
  assert.match(text, /«без 🔁📌» — траты дня без них/);
  assert.match(text, /Минус — в этот день вернули больше, чем потратили/);
  assert.doesNotMatch(heard(note), /🔁|📌/, 'значки диктору не читаются — он слышит слова');
  assert.match(heard(note), /регулярная трата/);
  const days = all(screen, 'day');
  assert.ok(days.length && eye(screen).indexOf('регулярная трата') < eye(screen).indexOf('13 ноября'), 'над первым днём');
});

test('R-4: «Понятно» прячет пояснение на этом устройстве, фокус — на заголовок экрана', () => {
  const nav = navOf();
  const ok = all(opsScreen(list(), nav), '<button').find((b) => seen(b) === 'Понятно');
  press(ok);
  assert.equal(nav.hidden, true);
  assert.deepEqual(nav.focused, ['title']);
  assert.equal(one(opsScreen(list(), nav), 'marks-note'), null);
});

test('R-4: меток и минуса нет — пояснения нет; на экране регулярной — тоже (шапка там уже «В норме»)', () => {
  const plain = { ...PAGE, apart: undefined, days: [{ date: '2026-11-12', sum: 500, ops: [op('a:3', 'Пекара')] }] };
  assert.equal(one(opsScreen(list({}, [plain]), navOf()), 'marks-note'), null);
  const minus = { ...plain, days: [{ date: '2026-11-12', sum: -300, ops: [op('a:3', 'Возврат')] }] };
  assert.match(eye(one(opsScreen(list({}, [minus]), navOf()), 'marks-note')), /^Минус — в этот день вернули больше/);
  const regular = list({ ctx: { title: 'Подписки', params: { regular: 'подписки' }, limitWord: 'В норме' } });
  assert.equal(one(opsScreen(regular, navOf()), 'marks-note'), null);
});

test('R-4: карточка — строка метки «🔁 регулярная · подписки» и пояснение; нажатие — операции регулярной за месяц', () => {
  const nav = navOf();
  const card = { ...op('a:2', 'Anthropic', { regular: 'подписки', receipt: { shop: 'Anthropic', total: 100, items: [] } }),
    apart: [REG], refs: ['a:2'], similar: [],
    postings: [{ name: 'нал', number: -100, currency: 'RSD' }, { name: 'подписки', number: 100, currency: 'RSD' }] };
  const screen = cardScreen({ kind: 'card', ref: 'a:2', data: card }, nav);
  assert.match(eye(one(screen, 'card-title')), /Anthropic/);
  const line = all(screen, '<button').find((b) => /регулярная · подписки/.test(eye(b)));
  assert.ok(line, 'строка метки — кнопка');
  assert.match(eye(line), /🔁 регулярная · подписки/);
  assert.match(eye(line), /Регулярная трата: у неё своя норма, в «Потрачено» идёт только то, что сверх нормы\./);
  const head = eye(one(screen, 'op-where'));
  assert.match(head, /чек/);
  assert.doesNotMatch(head, /регулярная/, 'у имени — только «чек», метка — своей строкой');
  press(line);
  assert.equal(nav.pushed.length, 1);
  assert.deepEqual([nav.pushed[0].kind, nav.pushed[0].month, nav.pushed[0].ctx.title, nav.pushed[0].ctx.params,
    nav.pushed[0].ctx.limitWord], ['ops', '2026-11', 'Подписки', { regular: 'подписки' }, 'В норме']);
});

test('R-4: обязательная в карточке — «📌 обязательная · кредит РФ» и пояснение чата', () => {
  const card = { ...op('a:1', 'Кредит', { mandatory: 'кредит РФ' }), apart: [MAN], refs: ['a:1'], similar: [], postings: [] };
  const screen = cardScreen({ kind: 'card', ref: 'a:1', data: card }, navOf());
  const line = all(screen, '<button').find((b) => /обязательная · кредит РФ/.test(eye(b)));
  assert.ok(line);
  assert.match(eye(line), /📌 обязательная · кредит РФ.*Обязательная трата: у неё своя норма, в «Потрачено» идёт только то, что сверх нормы у коммуналки\./s);
});

// повтор 2 ревью p48a, находка 6: значок скрыт от диктора, и он слышал «— регулярная трата…» без начала. Теперь слышит,
// о каком значке строка; на экране — тот же значок
test('находка 6: пояснение меток — диктор слышит «Значок повтора — регулярная трата…», на экране — 🔁', () => {
  const note = one(opsScreen(list(), navOf()), 'marks-note');
  const said = all(note, '<p').map((p) => heard(p).replace(/\s+/g, ' ').trim());
  assert.equal(said[0], `Значок повтора${REG.slice(2)}.`);
  assert.equal(said[1], `Значок канцелярской кнопки${MAN.slice(2)}.`);
  const shown = all(note, '<p').map(eye);
  assert.deepEqual(shown.slice(0, 2), [`${REG}.`, `${MAN}.`], 'на экране — значки, без слов диктора');
});
