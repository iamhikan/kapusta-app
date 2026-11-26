// Повтор ревью p46a (critique: «язык человека» 3 → 2). В строках, которые читает и Ангелина, были слова финансиста:
// «перебор», «к курсу НБС». Стало — слова человека, одно понятие — одно слово на всех экранах и в чате:
// «сверх нормы» (как строка градусника «🔁 Регулярные сверх нормы» и «у неё своя норма» в пояснении меток fin),
// «выигрыш на обмене» и «потеря на обмене». Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { view } from '../js/health.js';
import { budgetView } from '../js/budget.js';
import { headView, opRow } from '../js/ops.js';
import { daysView } from '../js/days.js';

const plain = (x) => JSON.stringify(x).replace(/ /g, ' ');
const OLD = /перебор|к курсу НБС|на потери к курсу|в норме отдельно/;

const HEALTH = {
  month: '2026-11', date: '2026-11-26', day: 26, days: 30, closed: false, zone: { status: 'ok', word: 'в норме' },
  norm: 250000, spent: 211000, left: 39000, plan_today: 200000, per_day: 9750, regular: 30000, oneoff: 0,
  limits: [{ key: 'красота', name: 'красота', label: 'красота', state: 'over', spent: 9000, limit: 5000, over: 4000 }],
  regulars: [
    { key: 'банк', label: 'банк', kind: 'regular', spent: 2941, limit: 2535, norm: 2535, carry: 0, over: 406 },
    { key: 'коммуналка', label: 'коммуналка', kind: 'mandatory', spent: 13491, limit: 12045, norm: 12045, carry: 0, over: 1446 },
    { key: 'связь', label: 'связь', kind: 'regular', spent: 5000, limit: 4272, norm: 4272, carry: 0, over: 728 },
  ],
  balances: [], empty: [], balances_total: 0, curve: [[1, 0], [26, 211000]], forecast: 243462,
  fresh: { last: '2026-11-26 08:11', now: '2026-11-26T15:00' },
};

test('«Здоровье»: строка сверх нормы — «в «Потрачено» идёт только то, что сверх нормы: +406»; кнопка — «3 траты сверх нормы»', () => {
  const v = view(HEALTH);
  const bank = v.limits.find((l) => l.name === 'банк');
  assert.equal(bank.hint, 'в «Потрачено» идёт только то, что сверх нормы: +406');   // число не отрывается от слов
  assert.equal(v.limits.find((l) => l.name === 'коммуналка').hint, 'в «Потрачено» идёт только то, что сверх нормы: +1 446');
  assert.equal(v.moreLabel, 'Показать все: 1 лимит и 3 траты сверх нормы');
  const one = view({ ...HEALTH, regulars: HEALTH.regulars.slice(0, 1) });
  assert.equal(one.moreLabel, 'Показать все: 1 лимит и 1 трата сверх нормы');
  const many = view({ ...HEALTH, regulars: [...HEALTH.regulars, { ...HEALTH.regulars[2], key: 'подписки', label: 'подписки' },
    { ...HEALTH.regulars[2], key: 'спортпит', label: 'спортпит' }] });
  assert.equal(many.moreLabel, 'Показать все: 1 лимит и 5 трат сверх нормы');
  assert.doesNotMatch(plain(v), OLD);
});

const ENV = (key, spent, norm, extra = {}) => ({ key, label: key, kind: 'regular', basis: 'обычно за месяц', spent,
  limit: norm, norm, carry: 0, over: Math.max(0, spent - norm), ...extra });

test('«Бюджет»: подпись сверх нормы — как на «Здоровье»; обмен с выигрышем — «выигрыш на обмене»', () => {
  const b = { month: '2026-11', income: null, norm: 257975, savings: null, plan: null, free: null,
    limits: { rsd: 0, rows: [] },
    groups: [{ name: 'Регулярные по карте', rsd: 3123, avg_months: null, rows: [{ name: 'банк', rsd: 2535, note: '(обычно за месяц)' },
      { name: 'обмен валюты', rsd: 588, note: '(5 €)' }] }] };
  const health = { month: '2026-11', closed: false, envelopes: [ENV('банк', 2941, 2535), ENV('обмен валюты', -189, 588)] };
  const rows = budgetView(b, health).groups[0].rows;
  assert.equal(rows[0].gauge.hint, 'в «Потрачено» идёт только то, что сверх нормы: +406');
  assert.deepEqual([rows[1].sum, rows[1].note], ['+189', 'выигрыш на обмене · в норме 5 €']);
  assert.doesNotMatch(plain(rows), OLD);
});

const EXCHANGE = { ref: 'add:x', date: '2026-11-25', where: 'Обмен', what: '', kind: 'exchange', cats: [], src: 'нал Алексея',
  rsd: -782, fx: 782, receipt: false, flag: false, rate: { deal: 118, nbs: 117.61, currency: 'EUR' },
  legs: [{ name: 'нал Алексея', number: -2000, currency: 'EUR' }, { name: 'нал Алексея', number: 236000, currency: 'RSD' }] };

// стенд S9B, 320 px: подпись обмена — в две строки; число держится за «обмене», значок — за числом (одни не уходят)
test('«Операции»: у обмена — «выигрыш на обмене +782» и «потеря на обмене −40»; курс сделки и НБС — в подписи, как был', () => {
  const win = opRow(EXCHANGE);
  assert.deepEqual([win.note, win.noteTone, win.sub], ['выигрыш на обмене\u00a0+782', 'good', 'нал Алексея · по 118, НБС 117,61']);
  assert.deepEqual([opRow({ ...EXCHANGE, fx: -40 }).note, opRow({ ...EXCHANGE, fx: -40 }).noteTone], ['потеря на обмене\u00a0−40', 'warn']);
  assert.equal(opRow({ ...EXCHANGE, regular: 'обмен валюты' }).note, 'выигрыш на обмене\u00a0+782\u00a0🔁');
  assert.equal(opRow({ ...EXCHANGE, fx: 0 }).note, 'по курсу НБС');   // разницы нет — так и есть
});

test('экран «Обмена валюты»: «В норме 588 на потери при обмене», выигрыш месяца — «выигрыш на обмене»', () => {
  const ctx = { title: 'Обмен валюты', month: '2026-11', to: '2026-11-26', limit: 588, limitWord: 'В норме', fx: true };
  const v = headView(ctx, { total: -189, count: 5 });
  assert.deepEqual([v.sum, v.note, v.tone], ['+189', 'выигрыш на обмене', 'good']);
  assert.equal(v.sub.replace(/ /g, ' '), 'В норме 588 на потери при обмене · 5 записей · 1–26 ноября');
  const loss = headView(ctx, { total: 300, count: 2 });
  assert.match(loss.sub.replace(/ /g, ' '), /^В норме 588 на потери при обмене · /);
  assert.doesNotMatch(plain([v, loss]), OLD);
});

test('«По дням»: правило под календарём — «только то, что сверх нормы, в день, когда норму перешли»', () => {
  const v = daysView({ month: '2026-11', days: 30, scope: 'all', norm: 240000,
    points: [{ date: '2026-11-25', rsd: -1344, scale: -1344, plan: 8000 }] }, 'sum');
  assert.equal(v.rule.text, '🔁📌 — только то, что сверх нормы, в день, когда норму перешли.');
  assert.equal(v.rule.say, 'Регулярные и обязательные траты — только то, что сверх нормы, в день, когда норму перешли.');
  assert.doesNotMatch(plain(v), OLD);
});
