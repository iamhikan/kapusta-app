// Первый экран по адресу кнопки «Открыть в Капусте» под ответом бота (решение 74): параметры screen, month, cat после
// ?api=. fin spent и fin compare — «Категории» месяца (с cat — её подкатегории), fin last — «Операции», fin limits и
// fin plan — «Бюджет» над «Здоровьем». Нет параметров или они неверные — «Здоровье», как было.
import { newOps } from './screens.js';
import { newCats } from './catscreen.js';
import { periodOf } from './period.js';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const CAT = /^Expenses(:[A-Za-z]+)+$/;
const HEALTH = { stack: [{ kind: 'health' }], month: null };

// -> { stack: экраны снизу вверх (низ — вкладка), month: месяц «Здоровья» или null — текущий }
export function startAt(search, today) {
  const q = new URLSearchParams(search);
  const now = today.slice(0, 7);
  const screen = q.get('screen');
  if (screen === 'ops') return { stack: [newOps(now)], month: null };
  const month = q.get('month') || '';
  if (!MONTH.test(month) || month > now) return HEALTH;
  if (screen === 'budget') return { stack: [{ kind: 'health', focus: 'budget' }, { kind: 'budget', month }], month };
  if (screen !== 'cats') return HEALTH;
  const period = periodOf('month', `${month}-01`);
  const root = newCats(period);
  const cat = q.get('cat') || '';
  if (!CAT.test(cat)) return { stack: [root], month: null };
  // «Назад» с подкатегорий — на строку этой категории, как после тапа по ней
  root.focus = `cat:${cat}`;
  return { stack: [root, newCats({ ...period }, cat, '')], month: null };
}
