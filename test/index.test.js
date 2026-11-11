// Кэш Telegram на телефоне: каждый файл страницы — с номером версии, иначе после выкладки смешаются старые и новые модули.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('стиль, вход и все модули js/ — с одной версией ?v=', () => {
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const v = html.match(/href="style\.css\?v=(\w+)"/)[1];
  assert.match(html, new RegExp(`src="js/app\\.js\\?v=${v}"`));
  for (const f of readdirSync(new URL('../js/', import.meta.url))) {
    if (f === 'app.js') continue;
    assert.equal(map[`./js/${f}`], `./js/${f}?v=${v}`, f);
  }
});

test('у каждого графика SVG — класс chart: подписи берут цвет темы, на тёмном фоне не чёрные', () => {
  for (const f of readdirSync(new URL('../js/', import.meta.url))) {
    const src = readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/h\('svg:svg', \{[^}]*role: 'img'[^}]*\}/g)) {
      assert.match(m[0], /class: '[^']*\bchart\b/, `${f}: ${m[0].slice(0, 60)}`);
    }
  }
});
