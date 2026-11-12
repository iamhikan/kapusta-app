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

// Решение 67 (Алексей 12.11, долг «служебные имена счетов»): у счёта без своего слова сервер отдаёт последнюю часть
// имени (names.where: «cashunrecorded», «DROIT», «USDT») или одно имя на два счёта («кредит РФ»). Страница называет
// такие счета по полному имени счёта — в «Откуда и куда», в строке операции и в списке; код валюты не трогает
test('решение 67: служебные счета — словами человека по имени счёта, валюта и описание — как были', async () => {
  const { cardView, opRow } = await import('../js/ops.js');
  const found = cardView(words({ ref: 'add:1', date: '2026-11-03', where: 'Поправка остатка', what: 'нашёл 5 € налом',
    kind: 'other', cats: [], src: 'нал Алексея', account: 'Assets:Family:Cash:Aleksey:EUR', amount: { number: 600, currency: 'RSD' },
    rsd: 600, receipt: null, postings: [
      { account: 'Assets:Family:Cash:Aleksey:EUR', name: 'нал Алексея', number: 5, currency: 'EUR', rsd: 600 },
      { account: 'Expenses:Family:CashUnrecorded', name: 'cashunrecorded', number: -5, currency: 'EUR', rsd: -600 }] }));
  assert.deepEqual(found.flow.map((s) => [s.label, s.lines.map((l) => l.name)]),
    [['Откуда', ['неучтённый нал']], ['Куда', ['нал Алексея']]]);

  const pay = words({ ref: 'walt:1', date: '2026-11-04', where: 'Walt', what: 'Пополнение USDT (Tron)', kind: 'income',
    cats: [], src: 'USDT', account: 'Assets:Family:Walt:USDT', amount: { number: 1200, currency: 'USDT' }, rsd: 130000,
    receipt: null, postings: [
      { account: 'Assets:Family:Walt:USDT', name: 'USDT', number: 1200, currency: 'USDT', rsd: 130000 },
      { account: 'Income:PR:DROIT', name: 'DROIT', number: -1200, currency: 'USDT', rsd: -130000 }] });
  const c = cardView(pay);
  assert.deepEqual(c.flow.map((s) => [s.label, s.lines.map((l) => `${l.name} ${l.value}`)]),
    [['Откуда', [sp('доход ПР (DROIT) 1 200 USDT')]], ['Куда', [sp('Walt 1 200 USDT')]]]);
  assert.equal(c.row.sub, 'Walt');                       // строка под заголовком: кошелёк, как плитка в остатках
  assert.equal(pay.amount.currency, 'USDT');             // код валюты — не имя счёта
  assert.equal(pay.what, 'Пополнение USDT (Tron)');      // описание человека и банка не меняется

  const swap = opRow(words({ ref: 'add:2', where: 'Обмен', kind: 'exchange', src: 'USDT', account: 'Assets:Family:Walt:USDT',
    legs: [{ name: 'USDT', account: 'Assets:Family:Walt:USDT', number: -110, currency: 'USDT' },
      { name: 'нал Алексея', account: 'Assets:Family:Cash:Aleksey:EUR', number: 100, currency: 'EUR' }] }));
  assert.equal(swap.sub, 'Walt');                        // список «Операций»: обмен с кошелька Walt

  const loan = cardView(words({ ref: 'kredit:1', date: '2026-10-13', where: 'Райффайзен', what: 'Кредит РФ: платёж по графику',
    kind: 'spend', cats: ['банк'], src: 'кредит РФ', account: 'Assets:Family:Raiffeisen:Kredit',
    amount: { number: 300, currency: 'RUB' }, rsd: 400, receipt: null, postings: [
      { account: 'Assets:Family:Raiffeisen:Kredit', name: 'кредит РФ', number: -2000, currency: 'RUB', rsd: -2600 },
      { account: 'Liabilities:RU:Kredit', name: 'кредит РФ', number: 1700, currency: 'RUB', rsd: 2200 },
      { account: 'Expenses:Family:Bank', name: 'банк', number: 300, currency: 'RUB', rsd: 400 }] }));
  assert.deepEqual(loan.flow.map((s) => [s.label, s.lines.map((l) => l.name)]),
    [['Откуда', ['кредит РФ']], ['Куда', ['долг по кредиту', 'банк']]]);   // счёт кредита — как плитка, долг — свой
});
