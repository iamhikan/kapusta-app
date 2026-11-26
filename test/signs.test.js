// Повтор 2 ревью p48a (находки 1 и 2; Алексей 26.11: «Да исправляй все как рекомендуешь»). Одно значение — одна
// кодировка, цвет — не единственный знак (WCAG 1.4.1):
// - перерасход — словом «сверх N» на красной плашке и штриховкой полосы за меткой лимита; число «потрачено» — без
//   красного (было трижды: плашка «+N», красное число, штриховка);
// - «+N» — только выигрыш: зелёным и со словом («выигрыш на обмене», «вернули больше, чем потратили»);
// - потеря на обмене — «−N» со словом «потеря».
// Было: «банк +406» — красная плашка перерасхода, а «обмен валюты +189» на том же экране — выигрыш без цвета; день
// обмена «25 ноября −3 888» над строками «выигрыш на обмене +346», «+3 542». Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, heard, one } from './fakedom.js';
import { view } from '../js/health.js';
import { limitRow } from '../js/limitrow.js';
import { budgetView } from '../js/budget.js';

const flat = (s) => s.replace(/\s+/g, ' ').trim();
// что видят глаза: строка для глаз (aria-hidden) — да, текст только для диктора (.sr) — нет
const eyes = (el) => (typeof el === 'string' ? el : !el ? '' : el.classes.includes('sr') ? '' : el.kids.map(eyes).join(' '));
const shown = (el) => flat(eyes(el));
const said = (el) => flat(heard(el));
const classesOf = (tree) => {
  const out = [];
  const walk = (e) => { if (e && e.kids) { out.push(...e.classes); e.kids.forEach(walk); } };
  walk(tree);
  return out;
};

const L = (key, spent, limit, state, extra = {}) =>
  ({ key, name: key, label: key, state, spent, limit, over: Math.max(0, spent - limit), ...extra });
const REG = (key, spent, norm, kind = 'regular') => ({ key, label: key, kind, basis: 'обычно за месяц', spent, limit: norm,
  norm, carry: 0, over: Math.max(0, spent - norm) });

const HEALTH = {
  month: '2026-11', date: '2026-11-26', day: 26, days: 30, closed: false, zone: { status: 'fast', word: 'тратим быстрее плана' },
  norm: 250000, spent: 211000, left: 39000, plan_today: 200000, per_day: 9750, regular: 30000, oneoff: 0,
  limits: [L('красота', 9000, 5000, 'over'), L('питомцы', 6000, 4000, 'covered'), L('продукты', 30000, 60000, 'ok')],
  regulars: [REG('банк', 2941, 2535), REG('коммуналка', 13491, 12045, 'mandatory')],
  balances: [], empty: [], balances_total: 0, curve: [[1, 0], [26, 211000]], forecast: 243462,
  fresh: { last: '2026-11-26 08:11', now: '2026-11-26T15:00' },
};
const rowOf = (v, name) => limitRow(v.limits.find((l) => l.name === name), { plan: v.plan, open() {} });

test('«Здоровье»: лимит сверх — плашка «сверх 4 000» и штриховка; число «потрачено» не красное, «+» нет', () => {
  const row = rowOf(view(HEALTH), 'красота');
  assert.equal(shown(one(row, 'badge')), 'сверх 4 000');
  assert.equal(shown(row), 'красота сверх 4 000 9 000 / 5 000');
  assert.ok(!classesOf(one(row, 'row')).includes('bad'), 'число «потрачено» — без красного');
  assert.equal(one(row, 'over').style.color, 'var(--bad)');   // штриховка за меткой лимита — красная
  assert.ok(one(row, 'limit-mark'));
  assert.equal(said(row), 'красота: 9 000 из 5 000, сверх на 4 000');
  assert.doesNotMatch(shown(row), /\+/);
});

test('«Здоровье»: перерасход покрыл резерв — та же плашка словами, спокойным цветом; красного нет', () => {
  const row = rowOf(view(HEALTH), 'питомцы');
  assert.equal(shown(one(row, 'badge')), 'сверх 2 000');
  assert.ok(one(row, 'badge').classes.includes('calm'));
  assert.ok(!classesOf(row).includes('bad'));
  assert.equal(said(row), 'питомцы: 6 000 из 4 000, сверх на 2 000, покрыто резервом');
});

test('«Здоровье»: регулярная сверх нормы — «банк 🔁 сверх 406», подпись без числа — слова пояснения 🔁 чата', () => {
  const v = view(HEALTH);
  const bank = rowOf(v, 'банк');
  assert.equal(shown(one(bank, 'limit-name')), 'банк 🔁 сверх 406');
  assert.equal(shown(bank), 'банк 🔁 сверх 406 2 941 / 2 535 в «Потрачено» идёт только то, что сверх нормы');
  assert.ok(!classesOf(one(bank, 'row')).includes('bad'));
  assert.equal(said(bank), 'банк: 2 941 из 2 535, сверх на 406, в «Потрачено» идёт только то, что сверх нормы');
  assert.equal(shown(one(rowOf(v, 'коммуналка'), 'badge')), 'сверх 1 446');
  for (const l of v.limits) assert.doesNotMatch(shown(rowOf(v, l.name)), /\+/, l.name);
});

const ENV = (key, spent, norm, extra = {}) => ({ ...REG(key, spent, norm), ...extra });
const BUDGET = { month: '2026-11', income: null, norm: 257975, savings: null, plan: null, free: null,
  limits: { rsd: 0, rows: [] },
  groups: [{ name: 'Регулярные по карте', rsd: 17445, avg_months: null, rows: [{ name: 'образование', rsd: 14322, note: '' },
    { name: 'банк', rsd: 2535, note: '' }, { name: 'обмен валюты', rsd: 588, note: '(5 €)' }] }] };
const BUDGET_HEALTH = { month: '2026-11', closed: false, envelopes: [ENV('образование', 15684, 14322),
  ENV('банк', 2941, 2535), ENV('обмен валюты', -189, 588, { basis: '5 EUR в месяц' })] };

test('«Бюджет»: регулярная сверх нормы — как на «Здоровье»: «сверх 1 362», штриховка, число без красного', () => {
  const rows = budgetView(BUDGET, BUDGET_HEALTH).groups[0].rows;
  const edu = limitRow(rows[0].gauge, { open() {} });
  assert.equal(shown(one(edu, 'badge')), 'сверх 1 362');
  assert.equal(shown(edu), 'образование сверх 1 362 15 684 / 14 322 в «Потрачено» идёт только то, что сверх нормы');
  assert.ok(!classesOf(one(edu, 'row')).includes('bad'));
  assert.equal(one(edu, 'over').style.color, 'var(--bad)');
  assert.equal(said(edu), 'образование: 15 684 из 14 322, сверх на 1 362, в «Потрачено» идёт только то, что сверх нормы');
  assert.equal(all(edu, 'badge').length, 1);
});

// находка 2: по умолчанию все 6 строк — сверх, а вывода нет; строка резерва — арифметика без вывода. Стало: одна строка
// итога над лимитами и вывод в конце строки резерва. Числа — копия данных 26.11 (Ангелина видит те же лимиты).
const NOV = {
  ...HEALTH, norm: 257975, spent: 244303, left: 13672,
  limits: [L('красота', 53342, 5876, 'over'), L('транспорт', 26273, 5876, 'over'), L('питомцы', 9726, 4113, 'over'),
    L('здоровье', 31144, 14103, 'over'), L('дом и хозяйство', 14398, 11752, 'over'),
    L('резерв', 62886, 62886, 'fast', { eaten: 51892 }), L('разовые и подарки', 22983, 23505, 'fast'),
    L('путешествия', 15804, 17629, 'fast'), L('продукты', 38884, 52886, 'ok'), L('спорт', 3649, 8814, 'ok'),
    L('еда вне дома', 10691, 29381, 'ok'), L('развлечения', 1500, 5876, 'ok'), L('одежда', 0, 15278, 'ok')],
  regulars: [REG('банк', 4641, 2535), REG('коммуналка', 13491, 12045, 'mandatory'), REG('образование', 15684, 14322)],
};
const ANGELINA = (({ available, ...rest }) => rest)(NOV);

test('«Здоровье»: над лимитами — одна строка итога: сколько сверх, на сколько, что с резервом и сколько сверх своей нормы', () => {
  for (const h of [NOV, ANGELINA]) {
    assert.equal(flat(view(h).overview),
      'Сверх лимита — 5 из 13, перерасход 93 163; резерв кончился. Сверх своей нормы — 3 траты, всего 4 914.');
  }
  // резерв покрыл весь перерасход — так и сказано, без тревоги
  const calm = { ...HEALTH, regulars: [], limits: [L('питомцы', 6000, 4000, 'covered'), L('продукты', 1000, 9000, 'ok'),
    L('резерв', 2500, 30000, 'ok', { eaten: 2000 })] };
  assert.equal(flat(view(calm).overview), 'Сверх лимита — 1 из 3, перерасход 2 000; всё покрыл резерв.');
  // только регулярные — без строки о лимитах; ничего сверх — строки нет
  const reg = { ...HEALTH, limits: [L('продукты', 1000, 9000, 'ok')], regulars: [REG('банк', 2941, 2535)] };
  assert.equal(flat(view(reg).overview), 'Сверх своей нормы — 1 трата, всего 406.');
  assert.equal(view({ ...reg, regulars: [] }).overview, '');
  // резерва строкой нет (прежний сервер) — без слов о резерве
  assert.equal(flat(view({ ...HEALTH, regulars: [] }).overview), 'Сверх лимита — 2 из 3, перерасход 6 000.');
});

test('«Здоровье»: итог — абзацем над легендой и строками лимитов, обычным текстом (не только цветом)', async () => {
  const { limitsSummary } = await import('../js/limitrow.js');
  const p = limitsSummary(view(NOV).overview);
  assert.equal(p.tag, 'p');
  assert.ok(p.classes.includes('limits-sum'));
  assert.ok(!p.classes.includes('bad') && !p.classes.includes('muted'));
  assert.equal(limitsSummary(''), null);
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const at = (s) => app.indexOf(s);
  assert.ok(at('limitsSummary(v.overview)') > at("h('h2', {}, 'Лимиты')") && at('limitsSummary(v.overview)') < at('limitLegend(v.legend)'));
});

test('строка резерва кончается выводом: «Не покрыто 41 271: на столько меньше осталось другим лимитам.»', () => {
  const res = view(NOV).limits.find((l) => l.name === 'резерв');
  assert.equal(flat(res.hint), 'свои 10 994 + перерасход других 51 892 из 93 163 — «красота», «транспорт», «питомцы», '
    + '«здоровье», «дом и хозяйство». Не покрыто 41 271: на столько меньше осталось другим лимитам.');
  assert.match(res.hint, /из 93/);   // «из» и число не рвутся
  assert.match(res.hint, /Не\u00a0покрыто\u00a041/);   // стенд, 320 px: «Не» оставалось в конце строки
  assert.match(view(NOV).overview, /перерасход\u00a093\u00a0163;.*всего\u00a04\u00a0914\.$/u);
  // сервер сказал «кончился», а округлённые суммы сошлись — непокрытого нуля не пишем
  const even = { ...HEALTH, limits: [L('питомцы', 6000, 4000, 'over'), L('резерв', 2500, 2500, 'fast', { eaten: 2000 })] };
  assert.doesNotMatch(view(even).limits.find((l) => l.name === 'резерв').hint, /Не покрыто/);
  // резерв не кончился — вывод уже есть: кого покрыл
  const calm = { ...HEALTH, limits: [L('питомцы', 6000, 4000, 'covered'), L('резерв', 2500, 30000, 'ok', { eaten: 2000 })] };
  assert.equal(flat(view(calm).limits.find((l) => l.name === 'резерв').hint), 'свои 500 + перерасход других 2 000 — покрыл «питомцы».');
});

// находка 1, «Бюджет»: «обмен валюты +189» стоял без цвета рядом с красной «банк +406». Стало: выигрыш — зелёный «+N»
// со словом, потеря на обмене — «−N» со словом «потеря» (как в строках «Операций»), разница договорного платежа —
// словами, без знака: «на 70 больше нормы»
import { moreScreen } from '../js/more.js';
import { dealOf } from '../js/regular.js';

const budgetOf = (rows) => ({ ...BUDGET, groups: [{ ...BUDGET.groups[0], rows }] });
const fxHealth = (spent, extra = {}) => ({ month: '2026-11', closed: false,
  envelopes: [ENV('обмен валюты', spent, 588, { basis: '5 EUR в месяц', ...extra }), ENV('подписки', -540, 20684)] });
const FX_ROWS = [{ name: 'обмен валюты', rsd: 588, note: '(5 €)' }, { name: 'подписки', rsd: 20684, note: '' }];
const lineOf = (screen, name) => all(screen, '<button').find((b) => b.getAttribute('data-focus') === `regular:${name}`);
const sumOf = (line) => all(line, 'nowrap').at(-1);
const budgetScreen = (health) => moreScreen({ kind: 'budget', month: '2026-11', data: budgetOf(FX_ROWS) },
  { health: () => health });

test('«Бюджет»: выигрыш на обмене и возврат — зелёный «+N» со словом', () => {
  const rows = budgetView(budgetOf(FX_ROWS), fxHealth(-189)).groups[0].rows;
  assert.deepEqual([rows[0].sum, rows[0].tone, rows[0].note], ['+189', 'good', 'выигрыш на обмене · в норме 5 €']);
  assert.deepEqual([rows[1].sum, rows[1].tone, rows[1].note], ['+540', 'good', 'вернули больше, чем потратили']);
  const screen = budgetScreen(fxHealth(-189));
  assert.equal(shown(lineOf(screen, 'обмен валюты')), 'обмен валюты выигрыш на обмене · в норме 5 € +189');
  assert.ok(sumOf(lineOf(screen, 'обмен валюты')).classes.includes('good'));
  assert.ok(sumOf(lineOf(screen, 'подписки')).classes.includes('good'));
});

test('«Бюджет»: потеря на обмене в пределах нормы — «−36» и «потеря на обмене», без полосы; сверх нормы — как регулярная', () => {
  const rows = budgetView(budgetOf(FX_ROWS), fxHealth(36)).groups[0].rows;
  assert.deepEqual([rows[0].sum, rows[0].tone, rows[0].note, rows[0].gauge], ['−36', 'warn', 'потеря на обмене · в норме 5 €', undefined]);
  const screen = budgetScreen(fxHealth(36));
  assert.equal(shown(lineOf(screen, 'обмен валюты')), 'обмен валюты потеря на обмене · в норме 5 € −36');
  assert.ok(sumOf(lineOf(screen, 'обмен валюты')).classes.includes('warn'));
  // потеря больше нормы: в «Потрачено» идёт то, что сверх, — строка, как у других регулярных
  const over = budgetView(budgetOf(FX_ROWS), fxHealth(700)).groups[0].rows[0];
  assert.deepEqual([over.gauge.over, over.gauge.hint], ['сверх 112', 'в «Потрачено» идёт только то, что сверх нормы']);
});

const deal = (spent, norm, paid, basis) => ({ key: 'жильё', label: 'жильё', kind: 'mandatory', contract: true, basis, spent,
  limit: norm, norm, carry: 0, over: Math.max(0, spent - norm), due: { number: 650, currency: 'EUR' },
  paid: { number: paid, currency: 'EUR' }, paid_on: ['2026-11-11'] });

test('договорный платёж: разница с нормой — словами «на 70 больше нормы», «на 846 меньше нормы», без «+» и «−»', () => {
  assert.equal(flat(dealOf(deal(76460, 76390, 650, 'по договору 650 €')).rate),
    'на 70 больше нормы: курс дня оплаты, в «Потрачено» не идёт');
  assert.equal(flat(dealOf(deal(32009, 32855, 640, 'по договору 650 €')).rate),
    'на 846 меньше нормы: курс дня оплаты и сумма платежа, в «Потрачено» не идёт');
  assert.match(dealOf(deal(76460, 76390, 650, 'по договору 650 €')).rate, /^на 70 больше/);   // число не отрывается
});

// находка 1, экран «Обмен валюты»: шапка дня «25 ноября −3 888» стояла над строками «выигрыш на обмене +346», «+3 542».
// Стало: день говорит выигрышем или потерей, как строки: «выигрыш +3 888» зелёным, «потеря −3 961» — как «потеря на
// обмене −3 961». Шапка месяца с потерей — «−36» и «потеря на обмене», как с выигрышем — «+189 выигрыш на обмене»
import { newOps, opsScreen } from '../js/screens.js';

const FX_DAYS = [{ date: '2026-11-25', sum: -3888, ops: [] }, { date: '2026-11-12', sum: 520, ops: [] },
  { date: '2026-11-06', sum: 3961, ops: [] }];
function regularScreen(key, health, days, total) {
  const nav = { today: () => '2026-11-26', health: () => health, budget: () => null, limitOf: () => null, noteOf: () => '',
    accounts: () => [], balanceOf: () => null, marksHidden: () => true };
  const entry = newOps('2026-11', { title: key, params: { regular: key }, limitWord: 'В норме' });
  entry.pages = [{ days, total, count: 5, next: null }];
  return opsScreen(entry, nav);
}
// день выигрыша или потери — класс дня (gain, loss): цвет итога даёт style.css
const dayHeads = (tree) => all(tree, 'day').map((d) => [flat(eyes(one(d, 'day-head'))), d.classes.filter((c) => c !== 'day').join(' ')]);
const head = (tree) => {
  const big = one(all(tree, 'card')[0], 'big');
  return [shown(big.kids[0]), big.kids[0].classes.join(' '), shown(big.kids[1]), big.kids[1].classes.join(' ').trim()];
};

test('«Обмен валюты»: день — «выигрыш +3 888» зелёным и «потеря −3 961», а не «−3 888» над выигрышами', async () => {
  const screen = regularScreen('обмен валюты', fxHealth(-189), FX_DAYS, -189);
  assert.deepEqual(dayHeads(screen), [['25 ноября, ср выигрыш +3 888', 'gain'], ['12 ноября, чт потеря −520', 'loss'],
    ['6 ноября, пт потеря −3 961', 'loss']]);
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.day\.gain > \.day-head > span \+ span \{ color: var\(--good\); \}/);
  assert.match(css, /\.day\.loss > \.day-head > span \+ span \{ color: var\(--warn\); \}/);
  assert.deepEqual(head(screen), ['+189', 'big-num good', 'выигрыш на обмене', 'muted']);
  // у других регулярных день — как был: сумма трат дня без знака и цвета
  const bank = regularScreen('банк', { month: '2026-11', envelopes: [ENV('банк', 1580, 2535)] },
    [{ date: '2026-11-25', sum: 1580, ops: [] }], 1580);
  assert.deepEqual(dayHeads(bank), [['25 ноября, ср 1 580', '']]);
});

test('«Обмен валюты»: месяц с потерей — «−36» и «потеря на обмене»; потеря больше нормы — «сверх 112» красным', () => {
  const loss = regularScreen('обмен валюты', fxHealth(36), [{ date: '2026-11-14', sum: 36, ops: [] }], 36);
  assert.deepEqual(head(loss), ['−36', 'big-num', 'потеря на обмене', 'warn']);
  assert.ok(one(all(loss, 'card')[0], 'bar'), 'полоса — сколько нормы на потери ушло');
  const over = regularScreen('обмен валюты', fxHealth(700), [{ date: '2026-11-14', sum: 700, ops: [] }], 700);
  assert.deepEqual(head(over), ['−700', 'big-num bad', 'потеря на обмене, сверх 112', 'muted bad']);
});
