// Цвета темы Telegram (R-24, решение 98, ответ 4). Серый (hint_color → --muted) и красный (destructive_text_color →
// --bad) задаёт клиент Telegram. Вариант Б: ниже 4,5:1 на фонах, где стоит текст, — страница подмешивает цвет текста
// ровно до 4,5:1; не ниже — цвет не трогает. Цвета темы — fin раз за открытие (POST /api/theme): замер на телефонах.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fit, legible, note, ratio, reporter, rgb } from '../js/theme.js';

// color-mix(in srgb, a share, b) так, как его отдаёт браузер: color(srgb …)
const cm = (a, b, share) => `color(srgb ${rgb(a).map((x, i) => (x * share + rgb(b)[i] * (1 - share)) / 255).join(' ')})`;
// производные цвета style.css: значение — от текущих цветов (read), как у браузера
const LIGHT_INKS = { '--bad-ink': (r) => cm(r('--bad'), '#000000', 0.7), '--accent-ink': (r) => cm(r('--accent'), '#000000', 0.7) };
const DARK_INKS = { '--bad-ink': (r) => r('--bad'), '--accent-ink': (r) => cm(r('--accent'), '#ffffff', 0.85),
  '--sheet': (r) => r('--card'), '--sheet-card': (r) => cm(r('--fg'), r('--card'), 0.07) };
const STAND = {   // запасные цвета style.css — те же у стенда
  light: { '--fg': '#000000', '--bg': '#efeff4', '--card': '#ffffff', '--sheet': '#efeff4', '--sheet-card': '#ffffff',
    '--muted': '#6d6d72', '--bad': '#d6342c', '--accent': '#2481cc', ...LIGHT_INKS },
  dark: { '--fg': '#ffffff', '--bg': '#000000', '--card': '#1c1c1e', '--muted': '#98989f', '--bad': '#ff5d55',
    '--accent': '#3e88f7', ...DARK_INKS },
};
// предположение ревью (1b-1): светлая тема Telegram iOS по умолчанию
const IOS = { ...STAND.light, '--muted': '#8e8e93', '--bad': '#ff3b30', '--accent': '#007aff' };
// тёмная — стресс: карточка #2c2c2e, серый и красный ниже 4,5:1 (цвета придуманы, настоящие снимет fin)
const DARK_STRESS = { ...STAND.dark, '--bg': '#1c1c1d', '--card': '#2c2c2e', '--muted': '#7e7e85', '--bad': '#eb4d3d' };

const on = (ink, ...backs) => Math.min(...backs.map((b) => ratio(rgb(ink), rgb(b))));

test('цвет CSS: #rgb, #rrggbb, rgb(), rgba() без прозрачности, color(srgb …); прочее — не трогаем', () => {
  assert.deepEqual(rgb('#fff'), [255, 255, 255]);
  assert.deepEqual(rgb(' #6D6D72 '), [109, 109, 114]);
  assert.deepEqual(rgb('rgb(142, 142, 147)'), [142, 142, 147]);
  assert.deepEqual(rgb('rgba(142, 142, 147, 1)'), [142, 142, 147]);
  assert.deepEqual(rgb('color(srgb 1 0 0.5)'), [255, 0, 127.5]);
  for (const v of ['rgba(0, 0, 0, 0.5)', 'color(srgb 1 1 1 / 0.4)', 'transparent', '', null, 'var(--x)', 'red']) {
    assert.equal(rgb(v), null, String(v));
  }
});

test('контраст WCAG: серый стенда на фоне — 4,49:1, белый на чёрном — 21:1', () => {
  assert.equal(ratio(rgb('#6d6d72'), rgb('#efeff4')).toFixed(2), '4.49');
  assert.equal(ratio(rgb('#ffffff'), rgb('#000000')), 21);
});

test('серый стенда #6d6d72 на #efeff4 (4,49:1) — чуть темнее, до 4,5:1; вид почти тот же', () => {
  const got = legible(rgb('#6d6d72'), rgb('#000000'), [rgb('#efeff4'), rgb('#ffffff')]);
  assert.ok(got, 'цвет меняется');
  assert.ok(on(got, '#efeff4', '#ffffff') >= 4.5, `${got} ${on(got, '#efeff4')}`);
  assert.ok(on(got, '#efeff4') < 4.6, `не темнее, чем нужно: ${on(got, '#efeff4')}`);
  assert.ok(rgb(got).every((x, i) => Math.abs(x - [109, 109, 114][i]) <= 2), got);
});

test('серый iOS #8e8e93 (2,84:1 на фоне, 3,26:1 на белом) — до 4,5:1 и на фоне, и на карточке, ровно столько', () => {
  for (const backs of [['#ffffff'], ['#efeff4'], ['#efeff4', '#ffffff']]) {
    const got = legible(rgb('#8e8e93'), rgb('#000000'), backs.map(rgb));
    assert.ok(on(got, ...backs) >= 4.5, `${backs}: ${got}`);
    assert.ok(on(got, ...backs) < 4.6, `${backs}: не темнее, чем нужно — ${on(got, ...backs)}`);
  }
});

test('красный iOS #ff3b30 на белом (3,55:1) — до 4,5:1 и остаётся красным', () => {
  const got = legible(rgb('#ff3b30'), rgb('#000000'), [rgb('#ffffff')]);
  assert.ok(on(got, '#ffffff') >= 4.5 && on(got, '#ffffff') < 4.6, got);
  const [r, g, b] = rgb(got);
  assert.ok(r > 2 * g && r > 2 * b, got);
});

test('не ниже 4,5:1 — цвет не меняется: красный стенда на карточке', () => {
  assert.equal(legible(rgb('#d6342c'), rgb('#000000'), [rgb('#ffffff')]), null);
});

test('подложка цвета самого текста (плашка «нормы нет», «сверх»): фон считается от нового цвета', () => {
  const card = rgb('#ffffff');
  const tint = (c) => c.map((x, i) => x * 0.16 + card[i] * 0.84);
  const got = legible(rgb('#8e8e93'), rgb('#000000'), [tint]);
  assert.ok(ratio(rgb(got), tint(rgb(got))) >= 4.5, got);
});

test('тёмная тема: серый ниже 4,5:1 светлеет к цвету текста', () => {
  const got = legible(rgb('#5a5a60'), rgb('#ffffff'), [rgb('#1c1c1e')]);
  assert.ok(on(got, '#1c1c1e') >= 4.5, got);
  assert.ok(rgb(got)[0] > 0x5a, `светлее: ${got}`);
});

test('цвет непонятен — не трогаем; непонятный фон — считаем по остальным', () => {
  assert.equal(legible(null, rgb('#000000'), [rgb('#ffffff')]), null);
  assert.equal(legible(rgb('#8e8e93'), null, [rgb('#ffffff')]), null);
  assert.equal(legible(rgb('#8e8e93'), rgb('#000000'), [null]), null);
  const got = legible(rgb('#8e8e93'), rgb('#000000'), [null, rgb('#ffffff')]);
  assert.ok(got && on(got, '#ffffff') >= 4.5, got);
});

// :root страницы: свои цвета — в style, остальное — как в теме (read видит свой цвет, пока он стоит)
function page(theme) {
  const own = new Map();
  const root = { style: { setProperty: (k, v) => own.set(k, v), removeProperty: (k) => own.delete(k) } };
  const read = (k) => {
    if (own.has(k)) return own.get(k);
    const v = theme.now[k];
    return typeof v === 'function' ? v(read) : v;
  };
  return { root, read, own, theme };
}
const over = (p, back, of, share) => cm(p.read(of), p.read(back), share);   // подложка: доля цвета над фоном

test('стенд, светлая: серый — свой цвет не ниже 4,5:1 на фоне, карточке и в листе; красный не меняется', () => {
  const p = page({ now: STAND.light });
  const got = fit(p.root, p.read);
  assert.deepEqual(Object.keys(got), ['--muted']);
  assert.equal(p.own.get('--muted'), got['--muted']);
  assert.ok(on(got['--muted'], '#efeff4', '#ffffff') >= 4.5);
  assert.ok(!p.own.has('--bad'));
});

test('цвета iOS, светлая: серый и красный — не ниже 4,5:1 там, где стоят; метки и ссылки не меняются', () => {
  const p = page({ now: IOS });
  assert.deepEqual(Object.keys(fit(p.root, p.read)), ['--muted', '--bad']);
  assert.ok(on(p.own.get('--muted'), '#efeff4', '#ffffff') >= 4.5, p.own.get('--muted'));
  assert.ok(on(p.own.get('--bad'), '#ffffff') >= 4.5, p.own.get('--bad'));
});

test('стенд, тёмная: ни одного своего цвета — серый, красный, метки и ссылки как в теме', () => {
  const p = page({ now: STAND.dark });
  assert.deepEqual(fit(p.root, p.read), {});
});

test('тёмная с карточкой #2c2c2e: серый, красный, «+N» и метка «!» на своей подложке, метка «чек» — не ниже 4,5:1', () => {
  const p = page({ now: DARK_STRESS });
  fit(p.root, p.read);
  const r = (k) => p.read(k);
  const at = (ink, ...backs) => Math.min(...backs.map((b) => ratio(rgb(r(ink)), rgb(b))));
  assert.ok(at('--muted', r('--bg'), r('--card'), r('--sheet-card'), over(p, '--card', '--muted', 0.08)) >= 4.5, r('--muted'));
  assert.ok(rgb(r('--muted'))[0] > 0x7e, 'серый светлеет');
  assert.ok(at('--bad', r('--card'), r('--sheet-card')) >= 4.5, r('--bad'));
  assert.ok(at('--bad-ink', over(p, '--card', '--bad', 0.16), over(p, '--card', '--bad-ink', 0.16)) >= 4.5, r('--bad-ink'));
  assert.ok(at('--accent-ink', r('--card'), over(p, '--card', '--accent', 0.14)) >= 4.5, r('--accent-ink'));
});

test('смена темы при открытой странице: считаем от цвета Telegram, а не от своего; тёмная — без своих цветов', () => {
  const t = { now: IOS };
  const p = page(t);
  const first = fit(p.root, p.read);
  t.now = STAND.dark;
  assert.deepEqual(fit(p.root, p.read), {});
  assert.equal(p.own.size, 0, 'свои цвета сняты');
  t.now = IOS;
  assert.deepEqual(fit(p.root, p.read), first, 'снова светлая — те же цвета, не темнее');
});

test('fin получает цвета темы, схему, платформу и версию — и ничего больше', () => {
  const tg = { themeParams: { bg_color: '#ffffff', hint_color: '#8e8e93', bad: 5 }, colorScheme: 'light',
    platform: 'ios', version: '8.0', initData: 'секрет', initDataUnsafe: { user: { id: 1 } } };
  assert.deepEqual(note(tg), { theme_params: { bg_color: '#ffffff', hint_color: '#8e8e93' },
    color_scheme: 'light', platform: 'ios', version: '8.0' });
  assert.deepEqual(note({}), { theme_params: {}, color_scheme: 'light', platform: '', version: '' });
});

test('тема уходит в fin раз за открытие и снова — только когда тема сменилась', () => {
  const sent = [];
  const tell = reporter((n) => sent.push(n));
  const tg = { themeParams: { hint_color: '#8e8e93' }, colorScheme: 'light', platform: 'ios', version: '8.0' };
  tell(tg);
  tell(tg);                                    // themeChanged без перемены цветов
  assert.equal(sent.length, 1);
  tg.colorScheme = 'dark';
  tg.themeParams = { hint_color: '#98989f' };
  tell(tg);
  assert.deepEqual(sent.map((n) => n.color_scheme), ['light', 'dark']);
});
