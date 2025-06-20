
/* Диалоговые окна перехватывают консоль, модифицируя глобальный объект `console`.
  Внутри диалоговых окон можно открывать другие диалоговые окна; они будут помещаться в специальный стек. */

import { Console } from "console";
import { Transform } from "stream";

export interface DialogWindow {
  consoleInputHandler: (data: Buffer) => Promise<void> | void;
  open: () => Promise<void> | void;
  update?: () => Promise<void> | void;
  updateInterval?: number;
  finalizers?: (() => Promise<void> | void)[];
}

const _dummyConsole: Console = new Console(new Transform({ write(a, b, callback) { callback(undefined) } }), undefined, true);
let _originalConsole: Console | undefined;
const dialogStack: DialogWindow[] = [];
let currentUpdateInterval: NodeJS.Timeout | undefined;
let currentInputHandler: DialogWindow["consoleInputHandler"] | undefined;

/**
 * Открывает диалоговое окно и блокирует текущий цикл событий
 * до тех пор, пока диалог не будет закрыт.
 */
export function openDialogWindow(windowData: DialogWindow): Promise<void> {
  return new Promise<void>((pReturn, pThrow) => {
    _originalConsole ??= global.console;
    global.console = _dummyConsole;
    dialogStack.push(windowData);
    resetCurrentState();
    applyWindow(windowData);
    windowData.finalizers ??= [];
    windowData.finalizers.push(() => pReturn());
  });
}

/**
 * @param windowData должна быть оригинальная ссылка на объект `DialogWindow` (та же, что передана в `openDialogWindow()`)
 */
export function closeDialogWindow(windowData: DialogWindow) {
  resetCurrentState();
  while (true) {
    const dialog = dialogStack.pop();
    if (dialog === undefined) break;
    dialog.finalizers?.forEach(f => f());
    if (dialog === windowData) break;
  }
  const topDialog = dialogStack.at(-1);
  if (topDialog) applyWindow(topDialog);
  else {
    if (_originalConsole) global.console = _originalConsole;
  }
  console.clear();
}

function resetCurrentState() {
  if (currentInputHandler) process.stdin.off("data", currentInputHandler);
  if (currentUpdateInterval) clearInterval(currentUpdateInterval);
}
function applyWindow(windowData: DialogWindow) {
  currentInputHandler = windowData.consoleInputHandler;
  process.stdin.on("data", currentInputHandler);
  windowData.open();
  if (windowData.update && windowData.updateInterval)
  currentUpdateInterval = setInterval(windowData.update, windowData.updateInterval);
}
