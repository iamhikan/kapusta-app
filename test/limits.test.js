// Лимиты — словами и цветом сервера (решение 82; ревью Б6, М3, М5; фаза 6 рефакторинга 11.2026): подпись строки —
// label из ответа, цвет полоски и слово диктору — по state (ok, fast, over, covered), в «Операции» уходит key — имя
// budget.yaml, а не слово приложения (причина 400 от 13.11). Путь — как в приложении: fetch -> get -> вид -> экран.
// Ответы — в форме /api/health и /api/budget fin (fin/tests/golden/files/api). Поддельный DOM — fakedom.js. Числа придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, heard, one, seen } from './fakedom.js';
import { get } from '../js/api.js';
import { view } from '../js/health.js';
import { limitRow } from '../js/limitrow.js';
import { loadOps, newOps } from '../js/screens.js';
import { moreScreen } from '../js/more.js';

const BASE = 'https://mac.tail0.ts.net';

// ответ fin так, как его видит страница: через get() со словами приложения
async function served(body) {
  const fetch = async () => ({ status: 200, ok: true, json: async () => body });
  const r = await get('/api/x', { base: BASE, initData: 'x', fetch });
  return r.data;
}

const limit = (key, label, state, spent, lim, extra = {}) =>
  ({ key, name: key, label, state, spent, limit: lim, over: Math.max(0, spent - lim), ...extra });

// 13 ноября: план на сегодня — 13/30 ≈ 43 % лимита
const HEALTH = {
  month: '2026-11', date: '2026-11-13', day: 13, days: 30, closed: false,
  zone: { status: 'ok', word: 'в норме' }, norm: 300000, spent: 90000, left: 210000, plan_today: 130000, per_day: 12000,
  regular: 0, oneoff: 0,
  limits: [
    // резерв — нераспределённая часть нормы, своей строки нет: перерасход покрыт, а строки с eaten в ответе нет
    limit('подарки', 'подарки', 'covered', 8000, 5000),
    // 85 % при плане 43 % — своё правило страницы дало бы жёлтую; сервер считает на свой день — в плане
    limit('еда вне дома', 'еда вне дома', 'ok', 5000, 5860),
    // 25 % при плане 43 % — своё правило дало бы зелёную; сервер — выше плана
    limit('продукты', 'продукты', 'fast', 10000, 40000),
    limit('курсовые разницы', 'обмен валюты', 'ok', 120, 5000),
    limit('банк', 'банк и страховки', 'ok', 600, 5000),
  ],
  hidden: [{ key: 'курсовые разницы', name: 'курсовые разницы', label: 'обмен валюты', spent: 120, limit: 5000, hot: 80 }],
  balances: [], empty: [], balances_total: 0, curve: [[1, 0], [13, 90000]], forecast: 207692,
  fresh: { last: '2026-11-13 08:11', now: '2026-11-13T11:13' },
};

test('решение 82: подпись строки лимита — label из ответа (и у скрытых), а не имя budget.yaml и не слово страницы', async () => {
  const v = view(await served(HEALTH));
  const name = (row) => seen(one(one(row, 'limit-name'), 'ellipsis'));
  const names = v.limits.map((l) => name(limitRow(l, { open() {} })));
  assert.deepEqual(names, ['подарки', 'еда вне дома', 'продукты', 'обмен валюты', 'банк и страховки']);
  assert.match(heard(limitRow(v.limits[4], { open() {} })), /^банк и страховки: /);
  assert.deepEqual(v.hidden.rows.map((r) => name(limitRow(r, { open() {} }))), ['обмен валюты']);
});

test('решение 82: key и label лимита — как прислал сервер, даже когда совпали со словом приложения («учёба»)', async () => {
  const study = limit('учёба', 'учёба', 'ok', 1000, 20000);
  const v = view(await served({ ...HEALTH, limits: [study], hidden: [] }));
  assert.deepEqual([v.limits[0].name, v.limits[0].ops.limit], ['учёба', 'учёба']);
});

test('решение 82: цвет полоски и слово диктору — по state сервера, даже когда свои пороги страницы дали бы другое', async () => {
  const v = view(await served(HEALTH));
  const row = (label) => v.limits.find((l) => l.name === label);
  const color = (label) => one(limitRow(row(label), { plan: v.plan, open() {} }), 'fill').style.background;
  assert.equal(color('подарки'), 'var(--bar-orange)');          // covered: своё правило без строки резерва — красная
  assert.equal(color('еда вне дома'), 'var(--bar-green)');       // ok: свои пороги — жёлтая
  assert.equal(color('продукты'), 'var(--bar-yellow)');          // fast: свои пороги — зелёная
  const gifts = limitRow(row('подарки'), { plan: v.plan, open() {} });
  assert.equal(heard(gifts).replace(/\s+/g, ' ').trim(), 'подарки: 8 000 из 5 000, сверх на 3 000, покрыто резервом');
  assert.ok(!all(gifts, 'bad').length, 'покрытый перерасход — без красного');
  assert.match(heard(limitRow(row('еда вне дома'), { open() {} })), /в плане\s*$/);
  assert.match(heard(limitRow(row('продукты'), { open() {} })), /выше плана\s*$/);
  // легенда — из цветов, которые дал state
  assert.deepEqual(v.legend.filter((l) => !l.mark).map((l) => l.text), ['в плане', 'выше плана', 'покрыто резервом']);
});

test('решение 82: резерв покрыл не всё — «частично» и красная, только когда сервер сказал over; суммы страница не сверяет', async () => {
  // суммы сервера округлены по одной: 2 000 + 1 001 против «покрыл 3 000» — своё правило страницы сказало бы «кончился»
  const res = limit('разовые и подарки', 'разовые и подарки', 'fast', 3000, 3000, { eaten: 3000 });
  const covered = { ...HEALTH, limits: [limit('подарки', 'подарки', 'covered', 7000, 5000), res,
    limit('банк', 'банк и страховки', 'covered', 6001, 5000)] };
  const v = view(await served(covered));
  assert.equal(v.reserve, 'Резерв: свои 0 + перерасход других 3 000 — покрыл «подарки», «банк и страховки».');
  assert.equal(v.limits.find((l) => l.note).note, 'перерасход «подарки», «банк и страховки» · резерв покрыл 3 000');
  assert.deepEqual(v.limits.filter((l) => l.over).map((l) => l.color), ['var(--bar-orange)', 'var(--bar-orange)']);
  const short = { ...covered, limits: covered.limits.map((l) => (l.state === 'covered' ? { ...l, state: 'over' } : l)) };
  const s = view(await served(short));
  assert.match(s.reserve, /«банк и страховки» частично\.$/);
  assert.deepEqual(s.limits.filter((l) => l.over).map((l) => l.color), ['var(--bad)', 'var(--bad)']);
});

// сервер, который запоминает пути запросов «Операций»
function navOf(health) {
  const asked = [];
  const nav = { today: () => '2026-11-13', accounts: () => [], balanceOf: () => null, queued: () => [], savePeriod() {},
    focus() {}, render() {}, limitOf: () => null, noteOf: () => '', healthView: () => view(health), pushed: [],
    get: async (path) => { asked.push(path); return { data: { days: [], count: 0, total: 0, next: null } }; } };
  nav.push = (entry) => nav.pushed.push(entry);
  nav.asked = asked;
  return nav;
}
const limitOf = (path) => new URLSearchParams(path.split('?')[1]).get('limit');
const click = (tree, focus) => all(tree, '<button').find((b) => b.getAttribute('data-focus') === focus).handlers.click({});

test('решение 82: строка лимита на «Здоровье» открывает «Операции» с limit=<key>, не со словом приложения', async () => {
  const health = await served(HEALTH);
  const nav = navOf(health);
  const fx = view(health).limits.find((l) => l.name === 'обмен валюты');
  await loadOps(newOps('2026-11', { title: 'Обмен валюты', params: fx.ops }), nav);
  assert.equal(limitOf(nav.asked[0]), 'курсовые разницы');
});

test('решение 82: «Скрытые лимиты» и «Бюджет» открывают «Операции» с limit=<key>; подпись строки — слово человека', async () => {
  const health = await served(HEALTH);
  const nav = navOf(health);
  const hidden = moreScreen({ kind: 'hidden', month: '2026-11' }, nav);
  assert.match(heard(hidden), /обмен валюты: 120 из/);
  click(hidden, 'limit:обмен валюты');
  await loadOps(nav.pushed.at(-1), nav);
  assert.equal(limitOf(nav.asked.at(-1)), 'курсовые разницы');

  // /api/budget label не шлёт (решение 82 — только /api/health): строка — словом человека, в запрос — имя budget.yaml
  const budget = await served({ month: '2026-11', groups: [], savings: null, norm: 300000, free: 0,
    limits: { rsd: 5000, eur: 0, rows: [{ name: 'курсовые разницы', rsd: 5000, set: null, hot: 80, off_norm: true }] } });
  const screen = moreScreen({ kind: 'budget', month: '2026-11', data: budget }, nav);
  assert.match(seen(screen), /обмен валюты/);
  assert.doesNotMatch(seen(screen), /курсовые разницы/);
  click(screen, all(screen, '<button').map((b) => b.getAttribute('data-focus')).find((k) => k && k.startsWith('limit:')));
  await loadOps(nav.pushed.at(-1), nav);
  assert.equal(limitOf(nav.asked.at(-1)), 'курсовые разницы');
  assert.equal(nav.pushed.at(-1).ctx.title, 'Обмен валюты');
});
