// Вид «Операций» и карточки из ответов /api/tx и /api/tx/{ref}. Числа в тестах придуманы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardView, dayLabel, emptyText, headView, money, monthRange, opRow, txPath } from '../js/ops.js';

const sp = (s) => s.replace(/(\d) (\d{3})/g, '$1 $2');   // разделитель тысяч — неразрывный пробел

test('суммы — с копейками через запятую, целые — без', () => {
  assert.equal(money(2471.35), sp('2 471,35'));
  assert.equal(money(5180), sp('5 180'));
  assert.equal(money(-500), '−500');
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

test('трата: где, метки, категории и откуда; сумма в RSD', () => {
  const r = opRow(LIDL);
  assert.equal(r.where, 'Lidl');
  assert.deepEqual(r.marks, ['чек']);
  assert.equal(r.sub, 'супермаркеты, алкоголь · Freedom');
  assert.equal(r.amount, sp('1 500,50'));
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
  assert.equal(r.amount, '400');
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
  assert.equal(r.amount, sp('1 000'));
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
  assert.deepEqual(c.postings[0], { name: 'Freedom', value: sp('−1 500,50 RSD') });
  assert.equal(c.receipt.items[0].line, '4 × 100');
  assert.equal(c.receipt.items[1].sub, 'сыр твёрдый · супермаркеты');
  assert.equal(c.receipt.items[0].sub, 'алкоголь');
  assert.equal(c.receipt.url, 'https://suf.purs.gov.rs/v/?vl=X');
  assert.deepEqual(c.similar[0], { ref: 'sms:0', label: '3 ноября, вт', value: '900' });
  assert.equal(c.refs, 'sms:1 · rcpt:9');
});

test('пустой месяц: «в ноябре трат … нет» (холст 6.3)', () => {
  assert.equal(emptyText('2026-11', 'Одежда'), 'В ноябре трат «одежда» нет');
  assert.equal(emptyText('2026-05', null), 'В мае операций нет');
});

test('в операциях категории под строкой — только откуда: категория уже в шапке (холст 2.5)', () => {
  assert.equal(opRow({ ...LIDL, rsd: 400, total: 1500.5 }, { inCategory: true }).sub, 'Freedom');
});
