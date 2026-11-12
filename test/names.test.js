// Один словарь имён (critique 12.11, P2 № 5; решения 58–61): одно и то же — одним словом на всех экранах, два итога
// денег — одним именем с датой, слова ledger — словами человека. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { words } from '../js/api.js';
import { budgetView } from '../js/budget.js';
import { daysView } from '../js/days.js';
import { view } from '../js/health.js';
import { FLAG, filters } from '../js/ops.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1 $2');

test('решение 58: «учёба» — «образование», «курс» и «курсовые разницы» — «обмен валюты» на всех экранах', () => {
  const cats = words({ cats: [{ name: 'учёба', rsd: 4000 }, { name: 'курс', rsd: 300 }, { name: 'английский', rsd: 900 }] });
  assert.deepEqual(cats.cats.map((c) => c.name), ['образование', 'обмен валюты', 'английский']);
  assert.equal(words({ name: 'курсовые разницы' }).name, 'обмен валюты');
  // описание, которое написал человек, не меняется: подменяется только значение целиком
  assert.equal(words({ what: 'курс английского' }).what, 'курс английского');
});

const BUDGET = {
  month: '2026-11', income: { rsd: 500000, set: '4 300 €' },
  groups: [{ name: 'Обязательные', rsd: 9100, avg_months: null, rows: [{ name: 'коммуналка', rsd: 9100, note: '(в ср. с 05.2026)' }] },
    { name: 'Регулярные по карте', rsd: 3000, avg_months: 3, rows: [{ name: 'связь', rsd: 3000, note: null }] },
    { name: 'ПР', rsd: 700, avg_months: null, rows: [{ name: 'ПР банк', rsd: 700, note: '(в ср.)' }] }],
  savings: null, norm: 240000,
  limits: { rsd: 200000, eur: 1600, rows: [{ name: 'продукты', rsd: 50000, set: '430 €', hot: null, off_norm: false }] },
  free: 40000,
  plan: { have_rsd: 300000, have: { RSD: 280000, EUR: 170 }, need: 250000, parts: [{ name: 'жильё', rsd: 90000 }],
    transfer: 0, spare: 50000, transfer_eur: null, salary: null },
};

test('решение 59: резерв в «Бюджете» — тем же словом, что на «Здоровье»; норма подписана одинаково', () => {
  const v = budgetView(BUDGET);
  assert.deepEqual(v.free, { text: sp('Резерв (норма без лимитов): 40 000'), tone: '' });
  assert.equal(v.norm.name, 'Норма — переменные траты');
  assert.equal(v.alloc[0].name, 'Норма — переменные траты');
});

test('решение 60: итог денег — одно имя с датой: «сейчас» на «Здоровье», «на 1 ноября» в «Бюджете»', () => {
  assert.equal(budgetView(BUDGET).plan.have, sp('Наличные и карты на 1 ноября ≈ 300 000 RSD'));
  const h = view({ month: '2026-11', date: '2026-11-11', day: 11, days: 30, norm: 100, spent: 10, left: 90, per_day: 5,
    plan_today: 37, zone: { status: 'ok', word: 'в норме' }, closed: false, regular: 0, oneoff: 0, limits: [], curve: [], empty: [],
    fresh: { last: '2026-11-11 08:11', now: '2026-11-11T11:13' }, available: null,
    balances: [{ account: 'Assets:Family:Cash:Aleksey', name: 'нал Алексея', amounts: { RSD: 150000 }, group: 'cash', rsd: 150000 }],
    balances_total: 150000 });
  assert.equal(h.balTotal, sp('наличные и карты сейчас ≈ 150 000 RSD'));
});

test('решение 61: слова ledger — словами человека: источник, «!», «в среднем», группа регулярных, план дня', () => {
  const source = filters()[2];
  assert.deepEqual(source.chips, [['все', ''], ['чек', 'receipt'], ['словами', 'words'], ['из банка', 'bank'],
    ['выписка РФ', 'raif']]);   // решение 64: не как имя счёта «Райффайзен РФ»
  assert.equal(FLAG, 'Только с «!» — надо уточнить');
  const v = budgetView({ ...BUDGET, groups: words(BUDGET.groups) });
  assert.deepEqual(v.groups.map((g) => g.name), ['Обязательные', 'Регулярные платежи', 'ПР']);
  assert.equal(v.groups[0].rows[0].note, 'в среднем с мая 2026');
  assert.equal(v.groups[2].rows[0].note, 'в среднем');
  assert.equal(v.alloc.find((a) => a.name === 'Регулярные платежи').color, '#e8833a');   // цвет доли — как был
  const days = daysView({ month: '2026-11', days: 30, scope: 'scale', norm: 240000,
    points: [{ date: '2026-11-01', rsd: 20000, scale: 20000, plan: 8000 }] }, 'plan');
  assert.equal(days.note, 'Вдвое выше плана: 1.11. План дня — «Можно в день» на утро этого дня. Тап по дню — операции дня.');
});
