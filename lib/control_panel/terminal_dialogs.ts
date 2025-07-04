import { Console } from "console";
import { Transform } from "stream";
import { framedTable } from "./terminal_ui.js";
import { Key } from "readline";
import { rl } from "./terminal_app.js";

/* Диалоговые окна перехватывают консоль, модифицируя глобальный объект `console`.
  Внутри диалоговых окон можно открывать другие диалоговые окна; они будут помещаться в специальный стек. */

export class DialogWindow {
  onOpen? (): Promise<void> | void;
  onUpdate? (): Promise<void> | void;
  onFinalize?: (() => Promise<void> | void)[];
  updateInterval?: number;
  clearScreenAfterClose?: boolean;
  handleLine? (line: string): Promise<void> | void;
  handleKeypress? (raw: string, keyData: Key): Promise<void> | void;

  dialogPromise: Promise<void> | undefined;
  private _breakDialogPromise!: () => void;

  openDialogWindow() {
    this.dialogPromise = new Promise<void>((pReturn, pThrow) => {
      this._breakDialogPromise = () => pReturn();
      DialogWindow.dialogStack.push(this);
      DialogWindow._resetCurrentState();
      DialogWindow._takeControl(this);
      DialogWindow._applyWindow(this);
    });
  }

  closeDialogWindow() {
    DialogWindow._resetCurrentState();
    if (this.clearScreenAfterClose)
      this.rawDraw(new DialogWindowCanvas(process.stdout.columns, process.stdout.rows).render()); //clear
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
    process.stdout.cursorTo(0, 0);
    process.stdout.write(text);
  }



  /** Перехват контроля над вводом-выводом */
  private static _takeControl(controls: Pick<InputOutputControls, "handleKeypress" | "handleLine">) {
    const previousControls = DialogWindow.controlStack.at(-1);
    this._dropControls(previousControls);
    
    const originalConsole = global.console;
    global.console = DialogWindow._dummyConsole;

    const currentControls = {
      xConsole: originalConsole,
      ...controls
    };
    this._applyControls(currentControls);
    DialogWindow.controlStack.push(currentControls);
  }

  /** Возвращение контроля над вводом-выводом предыдущим владельцам */
  private static _returnControl() {
    const currentControls = DialogWindow.controlStack.pop();
    this._dropControls(currentControls);
    const previousControls = DialogWindow.controlStack.at(-1);
    this._applyControls(previousControls);
  }

  private static _dropControls(controls: InputOutputControls | undefined) {
    if (!controls) return;
    if (controls.handleKeypress)
      process.stdin.removeListener("keypress", controls.handleKeypress);
    if (controls.handleLine)
      rl().removeListener("line", controls.handleLine);
    rl().emit("line"); /* Подразумевается, что кроме управляемых (диалоговыми окнами)
      обработчиков событий, других у нас нет */
  }
  private static _applyControls(controls: InputOutputControls | undefined) {
    if (!controls) return;
    global.console = controls.xConsole;
    if (controls.handleKeypress)
      process.stdin.addListener("keypress", controls.handleKeypress);
    if (controls.handleLine)
      rl().addListener("line", controls.handleLine);
    
    if (controls.handleKeypress && process.stdin.isTTY)
      process.stdin.setRawMode(true);
    else if (!controls.handleKeypress)
      process.stdin.setRawMode(false);
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
  handleLine?: (line: string) => any;
  handleKeypress?: (raw: string, keyData: Key) => any;
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
  append(row: HorizontalRow): this {
    this.rows.push(row);
    return this;
  }
  /** Добавляет строку **перед** ранее добавленными */
  prepend(row: HorizontalRow): this {
    this.rows.unshift(row);
    return this;
  }
  /** Добавляет строку **в конец экрана**, **после** ранее добавленных */
  bottomAppend(row: HorizontalRow): this {
    this.bottomRows.push(row);
    return this;
  }
  /** Добавляет строку **в конец экрана**, **перед** ранее добавленными */
  bottomPrepend(row: HorizontalRow): this {
    this.bottomRows.unshift(row);
    return this;
  }
  clearRows(): this {
    this.rows = [];
    this.bottomRows = [];
    return this;
  }
  /**
   * Примечание: Ответственность за наличие перевода строки на предыдущей
   * линии текста консоли несёте вы.
   */
  render(): string {
    const topLines = this._renderLinesFrom(this.rows)
      .slice(0, this.height).map(it => it.padEnd(this.width, " "));
    const bottomLines = this._renderLinesFrom(this.bottomRows)
      .slice(0, this.height - topLines.length).map(it => it.padEnd(this.width, " "));
    const middleSpace = Math.max(0, this.height - topLines.length - bottomLines.length);
    const middleLines = Array(middleSpace).fill("".padEnd(this.width, " "));
    const screenLines = [
      ...topLines,
      ...middleLines,
      ...bottomLines
    ].slice(0, this.height);
    return screenLines.join("\n");
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
