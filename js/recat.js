// Смена категории из карточки (этап 6, решения 12, 18, 33–36): вся операция или одна позиция чека. Страница шлёт
// прежнюю категорию, которую видела, новую и id нажатия: сервер (fin api) сверяет прежнюю, правит ledger от зрителя и
// пишет обоим в чат. Мак молчит — смена ждёт в очереди CloudStorage и уходит при следующем открытии (решение 18).

export const QUEUE = 'recat_queue';   // не health_*: снимок «Здоровья» ищет свои ключи по префиксу
const LIMIT = 4096;
const OFTEN = 5;

const nameOf = (card) => {
  const names = new Map((card.change ? card.change.choices : []).map((c) => [c.account, c.name]));
  return (a) => names.get(a) || a.split(':').pop().toLowerCase();
};

const words = (card, accounts) => [...new Set(accounts.map(nameOf(card)))].join(', ');

// сменить нельзя (сервер не дал `change`, fin.recat._can) — почему и где можно (critique 12.11, P2 № 3)
function why(card) {
  const cause = card.secret ? 'Секрет' : (card.refs || []).length > 1 ? 'Из нескольких записей'
    : (card.cats || []).length > 1 ? 'Разнесено по категориям' : '';
  return `${cause ? `${cause}: с` : 'С'}менить можно в чате с Капустой`;
}

export function category(card, waiting = null) {
  // строка «Категория» карточки: сейчас словами; смена в очереди — «было → стало», серым
  const now = card.change ? words(card, card.change.accounts) : card.cats.join(', ');
  if (waiting && waiting.n == null) return { text: `${now} → ${waiting.toName}`, can: true, queued: true, why: '' };
  return { text: now, can: !!card.change, queued: false, why: card.change ? '' : why(card) };
}

const parentOf = (account) => account.split(':').slice(0, -1).join(':');

export function picker(card, { q = '', chosen = null, item = null, group = null } = {}) {
  // лист выбора (холст card-picker): «Часто» — первые 5 (сервер ставит частые сверху), «сейчас» — текущая;
  // «Все категории» — в два уровня (решение 39): верхние, у категории — её подкатегории, первой — она сама;
  // поиск — по всем категориям ветки, и по подкатегориям
  const current = item == null ? card.change.accounts : [card.receipt.items[item].account];
  const mark = (c) => ({ ...c, hint: current.includes(c.account) ? 'сейчас' : '', on: c.account === chosen,
    current: current.includes(c.account) });
  const all = card.change.choices.map(mark);
  const known = new Set(all.map((c) => c.account));
  const subsOf = (a) => all.filter((c) => parentOf(c.account) === a);
  const tops = all.filter((c) => !known.has(parentOf(c.account)));
  const needle = q.trim().toLowerCase();
  const pick = all.find((c) => c.on);
  const groups = needle ? null : tops.map((c) => {
    const subs = subsOf(c.account);
    const cur = subs.find((x) => x.current);
    return { ...c, subs: subs.length, hint: c.current ? 'сейчас' : cur ? `сейчас: ${cur.name}` : '',
      on: c.on || subs.some((x) => x.on) };
  });
  const top = group && all.find((c) => c.account === group);
  return {
    title: item == null ? `Категория для ${card.where}` : card.receipt.items[item].name,
    often: needle ? null : [...all.filter((c) => c.current), ...all.filter((c) => !c.current)].slice(0, OFTEN),
    all: needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : all,
    groups,
    groupTitle: top ? top.name.charAt(0).toUpperCase() + top.name.slice(1) : '',
    subs: top ? [{ ...top, name: `${top.name} — без подкатегории` }, ...subsOf(top.account)] : null,
    allLabel: `Все категории — ${tops.length}`,
    button: pick && !pick.current ? { label: `Сменить на «${pick.name}»`, disabled: false }
      : { label: 'Выберите категорию', disabled: true },
  };
}

const newId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function job(card, to, { id = newId(), n = null, now = new Date().toISOString().slice(0, 19) } = {}) {
  // одна смена: прежние — что видели в карточке (сервер сверит), новая, id нажатия (повтор не применится дважды)
  const name = nameOf(card);
  const it = n == null ? null : card.receipt.items[n];
  return { id, ref: card.ref, n, was: it ? it.account : card.change.accounts, to,
    from: it ? name(it.account) : words(card, card.change.accounts), toName: name(to),
    what: it ? it.name : card.where, at: now };
}

export const path = (j) => `/api/tx/${encodeURIComponent(j.ref)}${j.n == null ? '' : `/items/${j.n}`}/category`;
export const body = (j) => ({ was: j.was, to: j.to, id: j.id });

export function result(r, j, names = (a) => a.split(':').pop().toLowerCase()) {
  // ответ сервера -> что сказать на карточке (холст card-done, card-item-done, card-error)
  if (r.data && !r.error) {
    return { kind: 'done', text: j.n == null ? `Сменили на «${j.toName}». Капуста написала в чат.`
      : `${j.what} → «${j.toName}». Остальной чек не тронут, следующие такие чеки — тоже «${j.toName}». Капуста написала в чат.` };
  }
  if (r.error === 'conflict') {
    const now = [].concat(r.data.now).map(names).join(', ');
    return { kind: 'conflict', text: `Запись уже изменили: сейчас «${now}». Капуста спросила вас в чате, что оставить.` };
  }
  if (r.error === 'down') {
    return { kind: 'queued',
      text: 'Капуста не отвечает. Смена в очереди: уйдёт, когда вы откроете приложение и Капуста ответит.' };
  }
  if (r.error === 'refused') return { kind: 'refused', text: `Не сменили: ${r.detail}.` };
  // fin ответил ошибкой или телом, которое не прочитать (М2, М8): Мак на связи — повтор может помочь; код — не диктору
  if (r.error === 'fault') return { kind: 'fault', text: 'Не сменили: Капуста ошиблась. Мак на связи — попробуйте ещё раз через минуту.' };
  return { kind: r.error, text: '' };
}

const call = (fn) => new Promise((resolve) => {
  try { fn((err, value) => resolve(err ? null : value)); } catch { resolve(null); }
});

export const queue = {
  async load(cs) {
    if (!cs) return [];
    try { return JSON.parse((await call((cb) => cs.getItem(QUEUE, cb))) || '[]'); } catch { return []; }
  },
  async store(cs, jobs) {
    const raw = JSON.stringify(jobs);
    if (!cs || raw.length > LIMIT) return false;
    return (await call((cb) => cs.setItem(QUEUE, raw, cb))) === true;
  },
  async add(cs, j) {
    // та же запись (и позиция) — остаётся последняя смена: сервер получит одну
    const rest = (await queue.load(cs)).filter((x) => !(x.ref === j.ref && x.n === j.n));
    return queue.store(cs, [...rest, j]);
  },
  async drop(cs, id) {
    return queue.store(cs, (await queue.load(cs)).filter((x) => x.id !== id));
  },
};

export async function flush(cs, send) {
  // при открытии: очередь по порядку; ответил — из очереди (конфликт Капуста спросит в чате); Мак молчит — ждём.
  // Капуста ошиблась (fault) — смена остаётся до следующего открытия, остальные уходят
  const out = { done: 0, conflicts: 0, left: 0 };
  const jobs = await queue.load(cs);
  const kept = [];
  for (let i = 0; i < jobs.length; i += 1) {
    const r = await send(jobs[i]);
    const kind = result(r, jobs[i]).kind;
    if (kind === 'queued' || kind === 'stale' || kind === 'stranger') {
      out.left = kept.length + jobs.length - i;
      await queue.store(cs, [...kept, ...jobs.slice(i)]);
      return out;
    }
    if (kind === 'fault') kept.push(jobs[i]);
    if (kind === 'done') out.done += 1;
    if (kind === 'conflict') out.conflicts += 1;
  }
  out.left = kept.length;
  if (jobs.length) await queue.store(cs, kept);
  return out;
}
