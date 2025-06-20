import { Console } from "console";
import { Transform } from "stream";
import Brain from "../ai/brain.js";
import type { Job } from "../types.js";

export interface StatusMonitor {
  originalConsole: Console;
  updater: () => void;
  updateCycle: NodeJS.Timeout;
  inputHandler: (data: Buffer) => void;
  finalizers: (() => void)[];
}

const _dummyConsole: Console = new Console(new Transform({ write(a, b, callback) { callback(undefined) } }), undefined, true);

/**
 * Открывает монитор состояния и блокирует текущий цикл событий
 * до тех пор, пока монитор не будет закрыт.
 */
export function listenStatusMonitor(brain: Brain): Promise<void> {
  return new Promise<void>((pReturn, pThrow) => {
    const monitor = openStatusMonitor(brain);
    monitor.finalizers.push(() => pReturn());
  });
}

export function openStatusMonitor(brain: Brain): StatusMonitor {
  const statusMonitor: StatusMonitor = {} as any;
  const originalConsole = global.console;
  global.console = _dummyConsole;
  const updater = () => {
    drawInterface(brain, originalConsole, { width: process.stdout.columns, height: process.stdout.rows });
    originalConsole.log("\n\nPress 'Enter' key to quit from the monitor");
  };
  const inputHandler = (data: Buffer) => {
    /*const input = data.toString("utf-8");
    if (input == "q") {
      closeStatusMonitor(statusMonitor);
      return;
    }*/
    closeStatusMonitor(statusMonitor);
  };
  process.stdin.on("data", inputHandler);

  statusMonitor.originalConsole = originalConsole;
  statusMonitor.inputHandler = inputHandler;
  statusMonitor.updater = updater;
  statusMonitor.updateCycle = setInterval(() => updater(), 500);
  statusMonitor.finalizers = [];
  return statusMonitor;
}

export function closeStatusMonitor(monitor: StatusMonitor) {
  clearInterval(monitor.updateCycle);
  process.stdin.off("data", monitor.inputHandler);
  global.console = monitor.originalConsole;
  console.clear();
  monitor.finalizers.forEach(f => f());
}

/**
 * Рисует псевдографический интерфейс в указанный экземпляр консоли
 */
export function drawInterface(B: Brain, C: Console, size: { width: number, height: number }) {
  const D = getData(B);
  C.clear();
  C.log(centerText(`'${B.bot.player.displayName}' ASSISTANT STATUS MONITOR`, size.width, "_"));
  C.log("");
  C.log(framedTable(size.width, [
    `Health: ${progressBar(Math.round(D.health), 20)}\n` +
    `Food:   ${progressBar(Math.round(D.food), 20)}\n` +
    `Job queue:\n${D.jobsDisplay || "  <empty>"}`,

    `Inventory: (${D.inventory.length})\n` +
    D.inventory.map(([N, name]) => `- ${N}x ${name}`).join("\n")
  ], [60, 40]));
}

export function getData(B: Brain) {
  const inventory: [number, string][] = [];
  ;{
    const counts = new Map<string, number>();
    for (const item of B.bot.inventory.items())
      counts.set(item.displayName, (counts.get(item.displayName) ?? 0) + item.count);
    counts.forEach((count, name) => inventory.push([count, name]));
    inventory.sort().reverse();
  };
  return {
    health: B.bot.health,
    food: B.bot.food,
    inventory,
    jobsDisplay: _displayJobs(B.getJobs(), undefined)
  };
}

function centerText(text: string, width: number, symbol: string = " "): string {
  const textLength = text.length;
  const padding = Math.max(0, Math.floor((width - textLength) / 2));
  return symbol.repeat(padding) + text + symbol.repeat(width - padding - text.length);
}


function progressBar(filled: number, total: number): string {
  filled = filled > total ? total : filled;
  total = total || 1;

  const progressBar = 
    '[' + 
    '▓'.repeat(filled) + 
    '░'.repeat(total - filled) + 
    '] ' + 
    `${Math.round((filled / total * 100))}%`;
  
  return progressBar;
}

function framedTable(maxWidth: number, columns: string[], columnPercents: number[] = []): string {
  const columnLines = columns.map((col) => col.split("\n"));

  const wrapText = (text: string, width: number) => {
    if (text.length <= width) return [text];
    const result = [];
    let currentLine = "";
    for (const word of text.split(/\s+/)) {
      if (currentLine.length + word.length < width) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) result.push(currentLine);
        currentLine = word;
        while (currentLine.length > width) {
          result.push(currentLine.substring(0, width));
          currentLine = currentLine.substring(width);
        }
      }
    }
    if (currentLine) result.push(currentLine);
    return result;
  };

  const totalPadding = columns.length * 3 + 1;
  const contentWidth = maxWidth - totalPadding;

  const columnWidths =
    columnPercents.length === columns.length
      ? columnPercents.map((p) =>
          Math.max(3, Math.floor((contentWidth * p) / 100))
        )
      : columnLines.map((col) => Math.max(3, ...col.map((line) => line.length)));

  const processedColumns = columnLines.map((col, i) =>
    col.flatMap((line) => wrapText(line, columnWidths[i]))
  );

  const maxLines = Math.max(...processedColumns.map((col) => col.length));
  const finalWidths = columnWidths.slice();

  const horizontalBorder =
    "┌" + finalWidths.map((w) => "─".repeat(w + 2)).join("┬") + "┐";
  const bottomBorder =
    "└" + finalWidths.map((w) => "─".repeat(w + 2)).join("┴") + "┘";

  const rows = [];
  for (let i = 0; i < maxLines; i++) {
    let row = "│";
    for (let j = 0; j < processedColumns.length; j++) {
      const cell = (processedColumns[j][i] || "").padEnd(finalWidths[j], " ");
      row += ` ${cell} │`;
    }
    rows.push(row);
  }

  return [horizontalBorder, ...rows, bottomBorder].join("\n");
}

function _displayJobs(jobs: readonly Job[], depth = 1): string {
  const prefix = " ".repeat(depth * 2);
  return jobs.map((j, i) => isAggregateJob(j)
    ? prefix + `@ (${i + 1}) ${j.jobDisplayName} [Done ${j.cursor + 1}/${j.jobs.length}]\n` + _displayJobs(j.jobs, depth + 1)
    : prefix + `- (${i + 1}) ${j.jobDisplayName}`).join("\n");
}