const _EverySecondActions = new Set<SomeFunction>();

/**
 * Выполняет указанное действие каждую секунду.
 * Выполнение действия можно отменить с помощью функции {@link removeEverySecondAction()}.
 */
export function everySecond(action: SomeFunction) {
  _EverySecondActions.add(action);
}

/**
 * Внимание! Не забываем, что в `_EverySecondActions` хранятся ССЫЛКИ на функции.
 * Данная функция требует именно ту функцию (действие, коллбэк), что мы зациклили с помощью {@link everySecond()}
 * (ту же ссылку).
 * @returns удалось ли удалить?
 */
export function removeEverySecondAction(action: SomeFunction): boolean {
  return _EverySecondActions.delete(action);
}

setInterval(() => {
  for (const action of _EverySecondActions)
    action();
}, +Durat().sec(1));



const _Every30SecondsActions = new Set<SomeFunction>();

/**
 * Выполняет указанное действие каждые `30` секунд.
 * Выполнение действия можно отменить с помощью функции {@link removeEvery30SecondsAction()}.
 */
export function every30Seconds(action: SomeFunction) {
  _Every30SecondsActions.add(action);
}

/**
 * Внимание! Не забываем, что в `_Every30SecondsActions` хранятся ССЫЛКИ на функции.
 * Данная функция требует именно ту функцию (действие, коллбэк), что мы зациклили с помощью {@link every30Seconds()}
 * (ту же ссылку).
 * @returns удалось ли удалить?
 */
export function removeEvery30SecondsAction(action: SomeFunction): boolean {
  return _Every30SecondsActions.delete(action);
}

setInterval(() => {
  for (const action of _Every30SecondsActions)
    action();
}, +Durat().sec(30));
