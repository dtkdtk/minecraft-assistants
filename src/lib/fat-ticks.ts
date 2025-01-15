
type Action = () => unknown;

const _EverySecondActions = new Set<Action>();

/**
 * Выполняет указанное действие каждую секунду.
 * Выполнение действия можно отменить с помощью функции {@link removeEverySecondAction()}.
 */
export function everySecond(action: Action) {
  _EverySecondActions.add(action);
}

/**
 * Внимание! Не забываем, что в `_EverySecondActions` хранятся ССЫЛКИ на функции.
 * Данная функция требует именно ту функцию (действие, коллбэк), что мы зациклили с помощью {@link everySecond()}
 * (ту же ссылку).
 * @returns удалось ли удалить?
 */
export function removeEverySecondAction(action: Action): boolean {
  return _EverySecondActions.delete(action);
}

setInterval(() => {}, +Durat().sec(1));
