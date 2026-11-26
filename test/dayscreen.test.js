// Ответ 2 решения 98 (ревью 26.11.2026, R-2): два правила — два имени. «Операции» — «без 🔁📌» (plain, как было).
// «По дням» — «как в „Потрачено“»: перебор 🔁📌 входит, и только у тех, что считает градусник. Экран дня из «По дням»
// пишет в шапке то же число, что клетка (spent fin), — третьего числа нет. Поддельный DOM — fakedom.js. Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, one } from './fakedom.js';
import { opsScreen } from '../js/screens.js';
import { headView } from '../js/ops.js';
import { daysView } from '../js/days.js';

const eye = (el) => (typeof el === 'string' ? el : !el || !el.kids || el.classes.includes('sr') ? '' : el.kids.map(eye).join(''));
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1\u00a0$2');

function navOf() {
  return { pushed: [], today: () => '2026-11-26', accounts: () => [], balanceOf: () => null, queued: () => [], render() {},
    savePeriod() {}, limitOf: () => null, noteOf: () => '', hasSnap: false, marksHidden: () => false, hideMarks() {},
    focus() {}, push() {} };
}
const rent = { ref: 'a:1', date: '2026-11-11', where: 'Хозяин', what: '', kind: 'spend', cats: ['жильё'], src: 'нал Алексея',
  amount: { number: 650, currency: 'EUR' }, rsd: 76460, receipt: false, flag: false, mandatory: 'жильё' };
const dayEntry = (day) => ({ kind: 'ops', month: '2026-11', expanded: new Set(),
  ctx: { title: '11 ноября', days: true, period: { kind: 'custom', from: '2026-11-11', to: '2026-11-11' }, params: {} },
  f: { q: '', transfers: false, account: '', who: '', source: '', flag: false },
  pages: [{ from: '2026-11-11', to: '2026-11-11', count: 9, total: 107763, next: null,
    apart: ['📌 — обязательная трата: у неё своя норма; жильё и кредит РФ в «Потрачено» не идут, коммуналка — только сверх нормы'], days: [{ date: '2026-11-11', ops: [rent], ...day }] }] });

const NOV = { month: '2026-11', days: 30, scope: 'all', norm: 240000, points: [
  { date: '2026-11-11', rsd: 31238, scale: 31238, plan: 8000 }] };

// повтор 2 ревью p48a, находка 3: правило говорит и про «без 🔁📌» «Операций» — у дня там другое число
test('R-2: «По дням» — подпись «как в „Потрачено“», под календарём — правило 🔁📌 (диктору — словами)', () => {
  const v = daysView(NOV, 'sum');
  assert.equal(v.sub, '1–11 ноября · как в «Потрачено»');
  assert.equal(v.rule.text, '🔁📌 — только то, что сверх нормы, в день, когда норму перешли. В «Операциях» «без\u00a0🔁📌» считает день совсем без них.');
  assert.equal(v.rule.say, 'Регулярные и обязательные траты — только то, что сверх нормы, в день, когда норму перешли. В «Операциях» вторая сумма дня считается совсем без них.');
  assert.equal(daysView(NOV, 'plan').rule.text, v.rule.text);
  assert.equal(daysView({ ...NOV, norm: null }, 'sum').rule, null, 'месяц без нормы — правила нет');
});

test('R-2: экран дня из «По дням» — в шапке «в «Потрачено» 31 238», у дня — только сумма, без «без 🔁📌»', () => {
  const v = headView({ title: '11 ноября', days: true, month: '2026-11', period: { kind: 'custom', from: '2026-11-11', to: '2026-11-11' },
    to: '2026-11-11' }, { total: 107763, count: 9, days: [{ date: '2026-11-11', sum: 107763, plain: 31238, spent: 31238 }] });
  assert.equal(v.sum, sp('107 763'));
  assert.equal(v.sub, sp('в «Потрачено» 31 238 · 9 записей · 11 ноября'));
  // прежний сервер без spent — без этой части
  const old = headView({ title: '11 ноября', days: true, month: '2026-11', period: { kind: 'custom', from: '2026-11-11', to: '2026-11-11' },
    to: '2026-11-11' }, { total: 107763, count: 9, days: [{ date: '2026-11-11', sum: 107763, plain: 31238 }] });
  assert.equal(old.sub, '9 записей · 11 ноября');
  const screen = opsScreen(dayEntry({ sum: 107763, plain: 31238, spent: 21828 }), navOf());
  const head = one(screen, 'day-head');
  assert.equal(flat(eye(head)), '11 ноября, ср107 763');
  assert.doesNotMatch(eye(screen), /без\s🔁📌/, 'ни у дня, ни в пояснении (\s — и неразрывный пробел)');
  assert.match(eye(screen), new RegExp(sp('в «Потрачено» 21 828')));
});

test('R-2: клетка «По дням» открывает экран дня с правилом «как в „Потрачено“»', async () => {
  const { daysScreenCellCtx } = await import('../js/more.js');
  const ctx = daysScreenCellCtx({ date: '2026-11-11', aria: '11 ноября: 31 238 RSD' }, false);
  assert.deepEqual([ctx.title, ctx.days, ctx.period], ['11 ноября', true, { kind: 'custom', from: '2026-11-11', to: '2026-11-11' }]);
});

test('R-2, R-3: на экране дня у строки — категория и значок после неё, как в «Операциях» (в категории, лимите, регулярной — без категории)', () => {
  const subs = (screen) => all(screen, 'op-sub').map(eye);
  assert.deepEqual(subs(opsScreen(dayEntry({ sum: 107763, plain: 31238, spent: 31238 }), navOf())), ['жильё 📌 · нал Алексея']);
  const cat = { ...dayEntry({ sum: 107763 }), ctx: { title: 'Жильё', params: { cat: 'Expenses:Family:Rent' } } };
  assert.deepEqual(subs(opsScreen(cat, navOf())), ['📌 · нал Алексея']);
});
