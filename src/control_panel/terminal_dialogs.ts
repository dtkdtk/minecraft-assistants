import { Console } from "console";
import { Transform } from "stream";
import { framedTable } from "./terminal_ui.js";

/* Диалоговые окна перехватывают консоль, модифицируя глобальный объект `console`.
  Внутри диалоговых окон можно открывать другие диалоговые окна; они будут помещаться в специальный стек. */

export class DialogWindow {
  onOpen? (): Promise<void> | void;
  onUpdate? (): Promise<void> | void;
  onFinalize?: (() => Promise<void> | void)[];
  updateInterval?: number;

  dialogPromise: Promise<void> | undefined;
  private _breakDialogPromise!: () => void;

  openDialogWindow() {
    this.dialogPromise = new Promise<void>((pReturn, pThrow) => {
      this._breakDialogPromise = () => pReturn();
      DialogWindow.dialogStack.push(this);
      DialogWindow._resetCurrentState();
      DialogWindow._takeControl();
      DialogWindow._applyWindow(this);
    });
  }

  closeDialogWindow() {
    DialogWindow._resetCurrentState();
    process.stdout.write(new DialogWindowCanvas(process.stdout.columns, process.stdout.rows).render()); //clear
    while (true) {
      const dialog = DialogWindow.dialogStack.pop();
      if (dialog === undefined) break;
      dialog.onFinalize?.forEach(f => f());
      DialogWindow._returnControl();
      dialog._breakDialogPromise();
      if (dialog === this) break;
    }
    const topDialog = DialogWindow.dialogStack.at(-1);
    if (topDialog) {
      DialogWindow._applyWindow(topDialog);
    }
  }

  rawDraw(text: string) {
    process.stdout.write(text);
  }

  private static _capturingOutputEvents: string[] = ["resize"];
  private static _capturingInputEvents: string[] = [
    "close", "connect", "connectionAttempt", "connectionAttemptFailed", "connectionAttemptTimeout",
    "data", "drain", "end", "error", "lookup", "ready", "timeout",
    "keypress"
  ];
  /** Перехват контроля над вводом-выводом */
  private static _takeControl() {
    const outputEvents: InputOutputControls["outputEvents"] = {};
    for (const eventName of this._capturingOutputEvents) {
      const listeners = process.stdout.rawListeners(eventName) as AnyFunction[];
      if (listeners.length == 0) continue;
      outputEvents[eventName] = listeners;
      process.stdout.removeAllListeners(eventName);
    }
    const inputEvents: InputOutputControls["inputEvents"] = {};
    for (const eventName of this._capturingInputEvents) {
      const listeners = process.stdin.rawListeners(eventName) as AnyFunction[];
      if (listeners.length == 0) continue;
      inputEvents[eventName] = listeners;
      process.stdin.removeAllListeners(eventName);
    }
    const originalConsole = global.console;
    global.console = DialogWindow._dummyConsole;
    DialogWindow.controlStack.push({
      xConsole: originalConsole,
      outputEvents,
      inputEvents,
      inputRawMode: process.stdin.isRaw,
      inputPause: process.stdin.isPaused()
    });
  }

  /** Возвращение контроля над вводом-выводом предыдущим владельцам */
  private static _returnControl() {
    /* Удалить текущие обработчики */
    this._capturingOutputEvents.forEach(eventName => process.stdout.removeAllListeners(eventName));
    this._capturingInputEvents.forEach(eventName => process.stdin.removeAllListeners(eventName));

    const previousControls = DialogWindow.controlStack.pop()!;
    global.console = previousControls.xConsole;
    for (const eventName of Object.keys(previousControls.outputEvents)) {
      previousControls.outputEvents[eventName].forEach(listener => process.stdout.addListener(eventName, listener));
    }
    for (const eventName of Object.keys(previousControls.inputEvents)) {
      previousControls.inputEvents[eventName].forEach(listener => process.stdin.addListener(eventName, listener));
    }
    process.stdin.setRawMode(previousControls.inputRawMode);
    if (previousControls.inputPause) process.stdin.pause();
    else process.stdin.resume();
  }
  
  private static _resetCurrentState() {
    if (DialogWindow.currentUpdateInterval) {
      clearInterval(DialogWindow.currentUpdateInterval);
      DialogWindow.currentUpdateInterval = undefined;
    }
  }
  private static _applyWindow(dialog: DialogWindow) {
    if (dialog.onOpen) dialog.onOpen();
    if (dialog.onUpdate && dialog.updateInterval)
      DialogWindow.currentUpdateInterval = setInterval(() => dialog.onUpdate?.(), dialog.updateInterval);
  }
  
  private static readonly _dummyConsole: Console = new class extends Console {
    constructor() { super(new Transform({ write(a, b, callback) { callback(undefined) } }), undefined, true) }
    _isDummyConsole = true;
  };
  static dialogStack: DialogWindow[] = [];
  static controlStack: InputOutputControls[] = [];
  static currentUpdateInterval: NodeJS.Timeout | undefined;
}
type InputOutputControls = {
  xConsole: Console;
  outputEvents: Record<string, AnyFunction[]>;
  inputEvents: Record<string, AnyFunction[]>;
  inputRawMode: boolean;
  inputPause: boolean;
};

/* TODO: Добавить авто-прокрутку широких/высоких блоков текста */

export type HorizontalContainer = {
  content: string;
  widthPercent?: number;
};
export type HorizontalRow = HorizontalContainer[] | string;

export class DialogWindowCanvas {
  rows: HorizontalRow[] = [];
  bottomRows: HorizontalRow[] = []; //строки, отображающиеся в конце экрана (align=bottom)

  constructor(public width: number, public height: number) {}

  /** Добавляет строку **после** ранее добавленных */
  append(row: HorizontalRow) {
    this.rows.push(row);
  }
  /** Добавляет строку **перед** ранее добавленными */
  prepend(row: HorizontalRow) {
    this.rows.unshift(row);
  }
  /** Добавляет строку **в конец экрана**, **после** ранее добавленных */
  bottomAppend(row: HorizontalRow) {
    this.bottomRows.push(row);
  }
  /** Добавляет строку **в конец экрана**, **перед** ранее добавленными */
  bottomPrepend(row: HorizontalRow) {
    this.bottomRows.unshift(row);
  }
  clearRows() {
    this.rows = [];
    this.bottomRows = [];
  }
  render(): string {
    const topLines = this._renderLinesFrom(this.rows).slice(0, this.height);
    const bottomLines = this._renderLinesFrom(this.bottomRows).slice(0, this.height - topLines.length);
    const middleSpace = Math.max(0, this.height - topLines.length - bottomLines.length);
    const middleLines = Array(middleSpace).fill('');
    const screenLines = [
      ...topLines,
      ...middleLines,
      ...bottomLines
    ].slice(0, this.height);
    return "\n" + screenLines.join("\n");
  }

  private _renderLinesFrom(rows: HorizontalRow[]): string[] {
    const outputLines: string[] = [];
    for (const row of rows) {
      if (typeof row == "string") {
        outputLines.push(row);
        continue;
      }
      const columnPercents = row.map(c => c.widthPercent || (100 / row.length));
      
      const maxLines = Math.max(...row.map(c => c.content.split("\n").length));
      const columns: string[][] = Array.from({ length: row.length }, () => []);

      for (let i = 0; i < maxLines; i++) {
        for (let j = 0; j < row.length; j++) {
          const container = row[j];
          const line = container.content.split("\n")[i] || "";
          columns[j].push(line);
        }
      }

      const tableLines = framedTable(
        this.width,
        columns.map(col => col.join("\n")),
        columnPercents
      ).split('\n');

      outputLines.push(...tableLines);
    }
    return outputLines;
  }
}
