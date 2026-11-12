// Периоды «Категорий» (спека, «Периоды»): неделя с понедельника, месяц, квартал, год, свой; ‹ › — на длину периода.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barsRange, canNext, periodEnd, periodOf, periodSub, periodTitle, rangeText, shiftPeriod } from '../js/period.js';

const pick = (p) => [p.kind, p.from, p.to];

test('период по дню: неделя — с понедельника, месяц, квартал, год', () => {
  assert.deepEqual(pick(periodOf('week', '2026-11-11')), ['week', '2026-11-09', '2026-11-15']);
  assert.deepEqual(pick(periodOf('week', '2026-11-09')), ['week', '2026-11-09', '2026-11-15']);
  assert.deepEqual(pick(periodOf('week', '2026-11-15')), ['week', '2026-11-09', '2026-11-15']);
  assert.deepEqual(pick(periodOf('month', '2026-02-11')), ['month', '2026-02-01', '2026-02-28']);
  assert.deepEqual(pick(periodOf('quarter', '2026-11-11')), ['quarter', '2026-10-01', '2026-12-31']);
  assert.deepEqual(pick(periodOf('year', '2026-11-11')), ['year', '2026-01-01', '2026-12-31']);
  assert.deepEqual(pick(periodOf('custom', '2026-10-10', '2026-10-14')), ['custom', '2026-10-10', '2026-10-14']);
});

test('‹ › сдвигают на длину периода', () => {
  assert.deepEqual(pick(shiftPeriod(periodOf('week', '2026-11-11'), -1)), ['week', '2026-11-02', '2026-11-08']);
  assert.deepEqual(pick(shiftPeriod(periodOf('month', '2026-03-31'), -1)), ['month', '2026-02-01', '2026-02-28']);
  assert.deepEqual(pick(shiftPeriod(periodOf('quarter', '2026-01-05'), -1)), ['quarter', '2025-10-01', '2025-12-31']);
  assert.deepEqual(pick(shiftPeriod(periodOf('year', '2026-11-11'), 1)), ['year', '2027-01-01', '2027-12-31']);
  assert.deepEqual(pick(shiftPeriod(periodOf('custom', '2026-10-10', '2026-10-14'), -1)),
    ['custom', '2026-10-05', '2026-10-09']);
});

test('вперёд — только пока следующий период начался', () => {
  assert.equal(canNext(periodOf('month', '2026-11-11'), '2026-11-11'), false);
  assert.equal(canNext(periodOf('month', '2026-10-11'), '2026-11-11'), true);
  assert.equal(canNext(periodOf('week', '2026-11-04'), '2026-11-09'), true);
});

test('название и подпись: дни периода по сегодня и прошлый период на те же дни', () => {
  const nov = periodOf('month', '2026-11-11');
  assert.equal(periodTitle(nov), 'Ноябрь 2026');
  assert.equal(periodEnd(nov, '2026-11-11'), '2026-11-11');
  assert.equal(periodSub(nov, '2026-11-11', { from: '2026-10-01', to: '2026-10-11' }), '1–11 ноября, к 1–11 октября');
  assert.equal(periodSub(nov, '2026-11-11', null), '1–11 ноября');
  assert.equal(periodTitle(periodOf('quarter', '2026-11-11')), 'IV квартал 2026');
  assert.equal(periodTitle(periodOf('year', '2026-11-11')), '2026 год');
  assert.equal(periodTitle(periodOf('week', '2026-11-11')), '9–15 ноября 2026');
  assert.equal(periodTitle(periodOf('week', '2026-10-01')), '28 сентября — 4 октября 2026');
  assert.equal(periodTitle(periodOf('custom', '2025-12-29', '2026-01-04')), '29 декабря 2025 — 4 января 2026');
});

test('отрезок дат словами', () => {
  assert.equal(rangeText('2026-11-01', '2026-11-11'), '1–11 ноября');
  assert.equal(rangeText('2026-11-11', '2026-11-11'), '11 ноября');
  assert.equal(rangeText('2026-10-01', '2026-11-11'), '1 октября — 11 ноября');
});

test('столбцы: 7 месяцев по месяц периода, у года — его 12 месяцев', () => {
  assert.deepEqual(barsRange(periodOf('month', '2026-11-11')), { from: '2026-05-01', to: '2026-11-30' });
  assert.deepEqual(barsRange(periodOf('week', '2026-03-02')), { from: '2025-09-01', to: '2026-03-31' });
  assert.deepEqual(barsRange(periodOf('year', '2025-06-01')), { from: '2025-01-01', to: '2025-12-31' });
});

test('подпись: год прошлого периода, если он другой (долг 12.11)', () => {
  assert.equal(periodSub(periodOf('year', '2026-11-12'), '2026-11-12', { from: '2025-01-01', to: '2025-11-12' }),
    '1 января — 12 ноября, к 1 января — 12 ноября 2025');
  assert.equal(periodSub(periodOf('month', '2026-01-11'), '2026-01-11', { from: '2025-12-01', to: '2025-12-11' }),
    '1–11 января, к 1–11 декабря 2025');
  assert.equal(periodSub(periodOf('quarter', '2026-11-12'), '2026-11-12', { from: '2026-07-01', to: '2026-08-12' }),
    '1 октября — 12 ноября, к 1 июля — 12 августа');
  assert.equal(periodSub(periodOf('custom', '2025-12-29', '2026-01-04'), '2026-01-04', { from: '2025-12-22', to: '2025-12-28' }),
    '29 декабря 2025 — 4 января 2026, к 22–28 декабря');
});
