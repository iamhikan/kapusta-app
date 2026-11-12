// «Назад» Telegram: что закрывает нажатие. Сначала верх экрана — лист фильтров, группа и выбор категории, потом сам
// экран. Лист открывается и на корневой вкладке: там кнопка видна и закрывает его (critique 12.11).
export function backStep(stack) {
  const top = stack[stack.length - 1];
  if (top.sheet) return 'sheet';
  if (top.picker && top.picker.group && !top.picker.saving) return 'group';
  if (top.picker && !top.picker.saving) return 'picker';
  return stack.length > 1 ? 'pop' : null;
}

export const showBack = (stack) => {
  const top = stack[stack.length - 1];
  return stack.length > 1 || Boolean(top.sheet || top.picker);
};

// Escape (клавиатура) закрывает только листы — лист, группу, выбор категории; экраны закрывает «Назад» Telegram
export const escapes = (stack) => ['sheet', 'group', 'picker'].includes(backStep(stack));

// куда вернуть фокус после «Назад» и Escape (фаза 15): на кнопку, которая открыла закрытое
export function returnTo(stack) {
  const top = stack[stack.length - 1];
  const step = backStep(stack);
  if (step === 'sheet') return top.kind === 'cats' ? 'period:custom' : 'filters';
  if (step === 'group') return `catg:${top.picker.group}`;
  if (step === 'picker') return top.picker.from || 'recat';
  if (step === 'pop') return stack[stack.length - 2].focus || null;
  return null;
}
