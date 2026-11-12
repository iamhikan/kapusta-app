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
