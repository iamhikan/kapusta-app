// Вид «Операций» и карточки из ответов /api/tx и /api/tx/{ref}. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountView, cardView, dayLabel, emptyText, filters, headView, money, monthRange, opRow, txPath } from '../js/ops.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1 $2');   // разделитель тысяч — неразрывный пробел

test('суммы — с копейками через запятую, целые — без', () => {
  assert.equal(money(2471.35), sp('2 471,35'));
  assert.equal(money(5180), sp('5 180'));
  assert.equal(money(-500), '−500');
  assert.equal(money(-0.29), '−0,29');   // меньше единицы — минус не теряется (critique 12.11: «0,29 KZT»)
  assert.equal(money(-1.5), '−1,50');
});

test('день — число, месяц и день недели', () => {
  assert.equal(dayLabel('2026-11-10'), '10 ноября, вт');
  assert.equal(dayLabel('2026-11-01'), '1 ноября, вс');
});

test('месяц: с 1-го по сегодня или по последний день', () => {
  assert.deepEqual(monthRange('2026-11', '2026-11-11'), { from: '2026-11-01', to: '2026-11-11' });
  assert.deepEqual(monthRange('2026-10', '2026-11-11'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(monthRange('2026-02', '2026-11-11'), { from: '2026-02-01', to: '2026-02-28' });
});

test('запрос: только заданные фильтры, по-русски — в кодировке адреса', () => {
  assert.equal(txPath({ from: '2026-11-01', to: '2026-11-11', limit: 'питомцы', q: '', cursor: null }),
    '/api/tx?from=2026-11-01&to=2026-11-11&limit=%D0%BF%D0%B8%D1%82%D0%BE%D0%BC%D1%86%D1%8B');
  assert.equal(txPath({ from: '2026-11-01', to: '2026-11-11', transfers: true, cursor: '50' }),
    '/api/tx?from=2026-11-01&to=2026-11-11&transfers=1&cursor=50');
});

const LIDL = { ref: 'sms:1', date: '2026-11-10', where: 'Lidl', what: 'чек', kind: 'spend',
  cats: ['супермаркеты', 'алкоголь'], src: 'Freedom', amount: { number: 1500.5, currency: 'RSD' }, rsd: 1500.5,
  receipt: true, flag: false, by: 'Алексей' };

test('трата: где, метки, категории и откуда; сумма — с RSD (ревью: без валюты не понять)', () => {
  const r = opRow(LIDL);
  assert.equal(r.where, 'Lidl');
  assert.deepEqual(r.marks, ['чек']);
  assert.equal(r.sub, 'супермаркеты, алкоголь · Freedom');
  assert.equal(r.amount, sp('1 500,50 RSD'));
  assert.equal(r.amountSub, '');
  assert.equal(r.gray, false);
  assert.equal(r.ref, 'sms:1');
});

test('трата в валюте — валюта операции и RSD; «!» и «секрет» — метками', () => {
  const r = opRow({ ...LIDL, receipt: false, flag: true, secret: true, amount: { number: 30, currency: 'EUR' },
    rsd: 3516 });
  assert.equal(r.amount, '30 €');
  assert.equal(r.amountSub, sp('3 516 RSD'));
  assert.deepEqual(r.marks, ['!', 'секрет']);
});

test('доля в категории — «из» всей операции (решение 23); найденная позиция чека — подписью', () => {
  const r = opRow({ ...LIDL, rsd: 400, total: 1500.5, hit: 'сыр твёрдый: SIR — 300' });
  assert.equal(r.amount, '400 RSD');
  assert.equal(r.amountSub, sp('из 1 500,50'));
  assert.equal(r.note, 'сыр твёрдый: SIR — 300');
});

test('одинаковые записи дня — одной строкой с числом записей (решение 21)', () => {
  const r = opRow({ ...LIDL, ref: null, receipt: false, where: 'Рынок', cats: ['рынок'], src: 'нал Алексея', rsd: 1000,
    count: 3, group: [{ ...LIDL, ref: 'add:1', rsd: 500 }, { ...LIDL, ref: 'add:2', rsd: 300 },
      { ...LIDL, ref: 'add:3', rsd: 200 }] });
  assert.equal(r.where, 'Рынок · 3 записи');
  assert.equal(r.sub, 'рынок · нал Алексея');
  assert.equal(r.group.length, 3);
  assert.equal(r.group[0].ref, 'add:1');
});

test('перелив — серым: откуда → куда', () => {
  const r = opRow({ ref: 'add:p', date: '2026-11-08', where: 'Перелив', what: 'дал', kind: 'transfer', cats: [],
    src: 'нал Алексея', rsd: 1000, receipt: false, flag: false,
    legs: [{ name: 'нал Алексея', number: -1000, currency: 'RSD' }, { name: 'нал Ангелины', number: 1000, currency: 'RSD' }] });
  assert.equal(r.gray, true);
  assert.equal(r.sub, 'нал Алексея → нал Ангелины');
  assert.equal(r.amount, sp('1 000 RSD'));
});

test('приход на счёт без «откуда» (начальный остаток) — «на счёт», сумма по НБС, а не «Freedom → Freedom 0,01 $»', () => {
  const r = opRow({ ref: 'add:o', date: '2026-11-11', where: 'Freedom', what: 'остаток', kind: 'transfer', cats: [],
    src: 'Freedom', rsd: 10814.4, receipt: false, flag: false,
    legs: [{ name: 'Freedom', number: 0.01, currency: 'USD' }, { name: 'Freedom', number: 48.58, currency: 'EUR' },
      { name: 'Freedom', number: 5098.86, currency: 'RSD' }] });
  assert.equal(r.gray, true);
  assert.equal(r.sub, 'на Freedom');
  assert.equal(r.amount, sp('10 814,40 RSD'));
  assert.equal(r.amountSub, '');
});

test('доход — плюсом и с валютой', () => {
  const r = opRow({ ref: 'add:i', date: '2026-11-05', where: 'Клиент', what: 'маникюр', kind: 'income', cats: [],
    src: 'счёт салона', amount: { number: 3000, currency: 'RSD' }, rsd: 3000, receipt: false, flag: false });
  assert.equal(r.amount, sp('+3 000 RSD'));
});

test('обмен — отдали и получили, курс сделки и НБС, выигрыш или потеря к НБС (решение 10)', () => {
  const ex = { ref: 'add:x', date: '2026-11-09', where: 'Обмен', what: 'евро', kind: 'exchange', cats: [],
    src: 'нал Алексея', rsd: -525, fx: 525, receipt: false, flag: false,
    rate: { deal: 117.6, nbs: 117.25, currency: 'EUR' },
    legs: [{ name: 'нал Алексея', number: -1500, currency: 'EUR' }, { name: 'нал Алексея', number: 176400, currency: 'RSD' }] };
  const r = opRow(ex);
  assert.equal(r.gray, true);
  assert.equal(r.amount, sp('1 500 €'));
  assert.equal(r.amountSub, sp('→ 176 400 RSD'));
  assert.equal(r.sub, 'нал Алексея · по 117,60, НБС 117,25');
  assert.deepEqual([r.note, r.noteTone], ['выигрыш +525 к курсу НБС', 'good']);
  const loss = opRow({ ...ex, fx: -40 });
  assert.deepEqual([loss.note, loss.noteTone], ['потеря −40 к курсу НБС', 'warn']);
});

test('теневая запись у Ангелины — «Без описания», без ref: карточки нет (решение 24)', () => {
  const r = opRow({ ...LIDL, ref: null, where: 'Без описания', what: 'Без описания', cats: ['прочее'], receipt: false });
  assert.equal(r.ref, null);
  assert.deepEqual(r.marks, []);
});

test('шапка лимита: сумма, «из» лимита или «сверх», число записей и период', () => {
  const h = headView({ title: 'Питомцы', limit: 4000, month: '2026-11', to: '2026-11-11' }, { total: 6000, count: 4 });
  assert.equal(h.title, 'Питомцы');
  assert.equal(h.period, 'Ноябрь 2026');
  assert.equal(h.sum, sp('6 000'));
  assert.deepEqual([h.note, h.tone], [sp('сверх 2 000'), 'bad']);
  assert.equal(h.fill, 1);
  assert.equal(h.sub, sp('Лимит 4 000 · 4 записи · 1–11 ноября'));
  const calm = headView({ title: 'Курс', month: '2026-10', to: '2026-10-31' }, { total: 300, count: 1 });
  assert.deepEqual([calm.note, calm.fill, calm.sub], ['', null, '1 запись · 1–31 октября']);
});

test('карточка: проводки, кто и когда, позиции чека с видом и категорией, ссылка налоговой', () => {
  const c = cardView({ ...LIDL, at: '2026-11-10 18:40', refs: ['sms:1', 'rcpt:9'],
    postings: [{ name: 'Freedom', number: -1500.5, currency: 'RSD' }, { name: 'супермаркеты', number: 1100.5, currency: 'RSD' },
      { name: 'алкоголь', number: 400, currency: 'RSD' }],
    receipt: { shop: 'Lidl', at: '2026-11-10 18:39', total: 1500.5, url: 'https://suf.purs.gov.rs/v/?vl=X', by: 'Алексей',
      items: [{ name: 'PIVO 0,5L', kind: null, qty: 4, unit: 'шт', price: 100, total: 400, cat: 'алкоголь' },
        { name: 'SIR 400G', kind: 'сыр твёрдый', qty: 1, unit: 'шт', price: 1100.5, total: 1100.5, cat: 'супермаркеты' }] },
    similar: [{ ref: 'sms:0', date: '2026-11-03', rsd: 900 }] });
  assert.equal(c.title, 'Lidl');
  assert.equal(c.when, '10 ноября, вт · 18:40');
  assert.equal(c.by, 'записал Алексей');
  assert.deepEqual(c.flow[0], { label: 'Откуда', lines: [{ name: 'Freedom', value: sp('1 500,50 RSD'), more: '' }] });
  assert.equal(c.receipt.items[0].line, '4 × 100');
  assert.equal(c.receipt.items[1].sub, 'сыр твёрдый · супермаркеты');
  assert.equal(c.receipt.items[0].sub, 'алкоголь');
  assert.equal(c.receipt.url, 'https://suf.purs.gov.rs/v/?vl=X');
  assert.deepEqual(c.similar[0], { ref: 'sms:0', label: '3 ноября, вт', value: '900', sub: '' });   // прежний сервер
  assert.equal(c.refs, undefined);                              // решение 51: ref в карточке не показываем
  assert.equal(c.row.amount, sp('1 500,50 RSD'));
});

const flowOf = (postings) => cardView({ ...LIDL, receipt: null, postings });

test('«Откуда и куда» — две части без знаков (решение 65): трата, перенос между категориями, обмен', () => {
  const spend = flowOf([{ name: 'сладкое', number: 120, currency: 'RSD' },
    { name: 'нал Ангелины', number: -470, currency: 'RSD' }, { name: 'вода', number: 350, currency: 'RSD' }]);
  assert.deepEqual(spend.flow, [
    { label: 'Откуда', lines: [{ name: 'нал Ангелины', value: '470 RSD', more: '' }] },
    { label: 'Куда', lines: [{ name: 'сладкое', value: '120 RSD', more: '' }, { name: 'вода', value: '350 RSD', more: '' }] },
  ]);
  const move = flowOf([{ name: 'питомцы', number: 55.5, currency: 'RSD' },
    { name: 'супермаркеты', number: -55.5, currency: 'RSD' }]);
  assert.deepEqual(move.flow.map((s) => [s.label, s.lines.map((l) => `${l.name} ${l.value}`)]),
    [['Откуда', ['супермаркеты 55,50 RSD']], ['Куда', ['питомцы 55,50 RSD']]]);
  const fx = flowOf([{ name: 'нал Алексея', number: 11800, currency: 'RSD' },
    { name: 'нал Алексея', number: -100, currency: 'EUR' }]);
  assert.deepEqual(fx.flow.map((s) => s.lines[0].value), ['100 €', sp('11 800 RSD')]);
});

test('«Откуда и куда»: счёт в нескольких валютах — одной строкой, RSD сверху (начальный остаток — 2 строки, а не 8)', () => {
  const c = flowOf([
    { name: 'Freedom', number: 2400.25, currency: 'RSD' }, { name: 'начальный остаток', number: -2400.25, currency: 'RSD' },
    { name: 'Freedom', number: 31, currency: 'EUR' }, { name: 'начальный остаток', number: -31, currency: 'EUR' },
    { name: 'Freedom', number: 0.02, currency: 'USD' }, { name: 'начальный остаток', number: -0.02, currency: 'USD' },
    { name: 'Freedom', number: 0.15, currency: 'KZT' }, { name: 'начальный остаток', number: -0.15, currency: 'KZT' }]);
  assert.deepEqual(c.flow, [
    { label: 'Откуда', lines: [{ name: 'начальный остаток', value: sp('2 400,25 RSD'), more: '31 € · 0,02 $ · 0,15 KZT' }] },
    { label: 'Куда', lines: [{ name: 'Freedom', value: sp('2 400,25 RSD'), more: '31 € · 0,02 $ · 0,15 KZT' }] },
  ]);
  // без динаров — первая валюта сверху; строк нет — частей нет
  const eur = flowOf([{ name: 'Freedom', number: -7, currency: 'EUR' }, { name: 'Freedom', number: -2, currency: 'USD' },
    { name: 'сервисы', number: 7, currency: 'EUR' }, { name: 'сервисы', number: 2, currency: 'USD' }]);
  assert.deepEqual(eur.flow[0].lines, [{ name: 'Freedom', value: '7 €', more: '2 $' }]);
  assert.deepEqual(flowOf([]).flow, []);
});

test('пустой месяц: «в ноябре трат … нет» (холст 6.3)', () => {
  assert.equal(emptyText('2026-11', 'Одежда'), 'В ноябре трат «одежда» нет');
  assert.equal(emptyText('2026-05', null), 'В мае операций нет');
});

test('в операциях категории под строкой — только откуда: категория уже в шапке (холст 2.5)', () => {
  assert.equal(opRow({ ...LIDL, rsd: 400, total: 1500.5 }, { inCategory: true }).sub, 'Freedom');
});

test('шапка резерва: своя подпись вместо «из лимита», без полоски', () => {
  const h = headView({ title: 'Резерв', limit: 30000, note: 'перевалы «питомцы» · резерв покрыл 2 000', month: '2026-11',
    to: '2026-11-11' }, { total: 6000, count: 4 });
  assert.deepEqual([h.sum, h.note, h.tone, h.fill], [sp('6 000'), 'перевалы «питомцы» · резерв покрыл 2 000', '', null]);
  assert.equal(h.sub, '4 записи · 1–11 ноября');
});

test('шапка категории за любой период: название периода и дни по сегодня (холст 2.6)', () => {
  const h = headView({ title: 'Питомцы', limit: 12000, period: { kind: 'quarter', from: '2026-10-01', to: '2026-12-31' },
    to: '2026-11-11' }, { total: 6000, count: 4 });
  assert.equal(h.period, 'IV квартал 2026');
  assert.equal(h.sub, sp('Лимит 12 000 · 4 записи · 1 октября — 11 ноября'));
  assert.equal(emptyText(null, 'Одежда', { kind: 'week', from: '2026-11-09', to: '2026-11-15' }),
    'За 9–15 ноября 2026 трат «одежда» нет');
});

test('фильтр «Кошелёк или счёт» — счета зрителя из остатков «Здоровья» (решение 38); нет остатков — прежний список', () => {
  const f = filters([['нал Алексея', 'Assets:Family:Cash:Aleksey'], ['Freedom', 'Assets:Family:Freedom']]);
  assert.deepEqual(f.map((g) => g.key), ['account', 'who', 'source']);
  assert.deepEqual(f[0].chips, [['все', ''], ['нал Алексея', 'Assets:Family:Cash:Aleksey'], ['Freedom', 'Assets:Family:Freedom']]);
  assert.ok(filters([])[0].chips.length > 2 && filters()[0].chips[0][0] === 'все');
});

test('операции счёта (тап по остатку): под строкой нет этого счёта — он в шапке (решение 48)', () => {
  const op = { ...LIDL, account: 'Assets:Family:Freedom:EUR' };
  assert.equal(opRow(op, { account: 'Assets:Family:Freedom' }).sub, 'супермаркеты, алкоголь');
  assert.equal(opRow(op, { account: 'Assets:Family:Cash:Aleksey' }).sub, 'супермаркеты, алкоголь · Freedom');
});

test('шапка счёта: плитка, имя, остаток в две строки, пришло и ушло за месяц (решение 48)', () => {
  const bal = { name: 'Нал Алексея', lines: [sp('150 000 RSD'), sp('1 000 €')], tile: { bg: '#3f9d5f', glyph: 'cash' } };
  const v = accountView(bal, { flow: { in: 5000, out: 12500.4 }, count: 7 }, '2026-11');
  assert.deepEqual(v, { title: 'Нал Алексея', tile: bal.tile, lines: bal.lines, label: 'остаток сейчас',
    flow: [['пришло', sp('+5 000')], ['ушло', sp('−12 500')]], sub: 'ноябрь · 7 записей' });
  const bare = accountView({ name: 'Walt', lines: [], tile: { text: 'W' } }, { count: 0 }, '2026-10');
  assert.deepEqual([bare.lines, bare.label, bare.flow], [[], '', []]);       // остатка и потока нет — без строк
});

test('время в карточке — из at любого вида: «ЧЧ:ММ» (Walt) и «ГГГГ-ММ-ДД ЧЧ:ММ» (решение 68: было «· ·»)', () => {
  const when = (at) => cardView({ ...LIDL, receipt: null, postings: [], at }).when;
  assert.equal(when('15:35'), '10 ноября, вт · 15:35');
  assert.equal(when('2026-11-10 18:40'), '10 ноября, вт · 18:40');
  assert.equal(when(null), '10 ноября, вт');
});

test('«Ещё в …» — сумма как в списке «Операций» (решение 68): пополнение, начальный остаток, трата', () => {
  const c = cardView({ ...LIDL, receipt: null, postings: [], similar: [
    { ref: 'walt:2', date: '2026-11-06', where: 'Walt', kind: 'income', cats: [], src: 'Walt',
      amount: { number: 1000, currency: 'USDT' }, rsd: 104500, receipt: false, flag: false },
    { ref: 'walt:1', date: '2026-11-02', where: 'Walt', kind: 'transfer', cats: [], src: 'Walt', rsd: 2090.5,
      opening: 'start', receipt: false, flag: false, legs: [{ name: 'Walt', number: 20, currency: 'USDT' }] },
    { ...LIDL, ref: 'sms:0', date: '2026-11-03', rsd: 900 }] });
  assert.deepEqual(c.similar.map((s) => [s.ref, s.label, s.value, s.sub]), [
    ['walt:2', '6 ноября, пт', sp('+1 000 USDT'), sp('104 500 RSD')],
    ['walt:1', '2 ноября, пн', sp('2 090,50 RSD'), ''],
    ['sms:0', '3 ноября, вт', '900 RSD', '']]);
});

const CHECK = { ref: 'add:c', date: '2026-11-11', at: '2026-11-11 21:46', where: 'Freedom', what: 'остаток по экрану',
  kind: 'transfer', cats: [], src: 'Freedom', rsd: 9000, receipt: null, flag: false, by: 'Алексей', opening: 'check',
  after: { lines: [{ number: 30.5, currency: 'EUR' }, { number: 0.2, currency: 'USD' }], rsd: 3600.6 },
  legs: [{ name: 'Freedom', number: 0.2, currency: 'USD' }, { name: 'Freedom', number: 30.5, currency: 'EUR' },
    { name: 'Freedom', number: 5000, currency: 'RSD' }],
  postings: [{ account: 'Assets:Family:Freedom:EUR', name: 'Freedom', number: 5000, currency: 'RSD' },
    { account: 'Equity:Opening-Balances', name: 'начальный остаток', number: -5000, currency: 'RSD' },
    { account: 'Assets:Family:Freedom:EUR', name: 'Freedom', number: 30.5, currency: 'EUR' },
    { account: 'Equity:Opening-Balances', name: 'начальный остаток', number: -30.5, currency: 'EUR' }] };

test('сверка остатка в списке — «сверка остатка» и остаток после неё, а не сумма поступлений (решение 68)', () => {
  const r = opRow(CHECK);
  assert.equal(r.gray, true);
  assert.equal(r.sub, 'сверка остатка');
  assert.equal(r.amount, '30,50 €');
  assert.equal(r.amountSub, 'остаток');
});

test('сверка в карточке: крупно — остаток, рядом ≈ RSD, ниже — другие валюты; «Откуда» — «сверка остатка»', () => {
  const c = cardView(CHECK);
  assert.equal(c.row.amount, '30,50 €');
  assert.equal(c.row.amountSub, sp('≈ 3 601 RSD'));
  assert.equal(c.row.note, '0,20 $');
  assert.equal(c.row.sub, 'остаток после сверки');
  assert.deepEqual(c.flow.map((s) => [s.label, s.lines.map((l) => l.name)]), [['Откуда', ['сверка остатка']],
    ['Куда', ['Freedom']]]);
  const rsdOnly = cardView({ ...CHECK, after: { lines: [{ number: 12000, currency: 'RSD' }], rsd: 12000 } });
  assert.deepEqual([rsdOnly.row.amount, rsdOnly.row.amountSub, rsdOnly.row.note], [sp('12 000 RSD'), '', '']);
  const zero = cardView({ ...CHECK, after: { lines: [], rsd: 0 } });
  assert.equal(zero.row.amount, '0 RSD');
});

test('начальный остаток — как был: «на счёт», сумма по курсу НБС, «Откуда» — «начальный остаток»', () => {
  const c = cardView({ ...CHECK, opening: 'start', after: undefined });
  assert.equal(c.row.sub, 'на Freedom');
  assert.equal(c.row.amount, sp('9 000 RSD'));
  assert.equal(c.flow[0].lines[0].name, 'начальный остаток');
});

test('сверка нала (нет экрана банка, сервер без after) — «сверка остатка» и найденное по курсу (решение 68)', () => {
  const found = { ...CHECK, after: undefined };
  assert.deepEqual([opRow(found).sub, opRow(found).amount], ['сверка остатка', sp('9 000 RSD')]);
  const c = cardView(found);
  assert.deepEqual([c.row.sub, c.row.amount, c.flow[0].lines[0].name], ['сверка остатка', sp('9 000 RSD'), 'сверка остатка']);
});
