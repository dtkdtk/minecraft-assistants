import { Console } from "console";
import { Transform } from "stream";
import Brain from "../ai/brain.js";
import type { Job } from "../types.js";
import { centerText, framedTable, progressBar } from "./terminal_ui.js";

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
    jobsDisplay: _displayJobs(B.jobs, undefined)
  };
}



function _displayJobs(jobs: readonly Job[], depth = 1): string {
  const prefix = " ".repeat(depth * 2);
  return jobs.map((j, i) => isAggregateJob(j)
    ? prefix + `@ (${i + 1}) ${j.jobDisplayName} [Done ${j.cursor + 1}/${j.jobs.length}]\n` + _displayJobs(j.jobs, depth + 1)
    : prefix + `- (${i + 1}) ${j.jobDisplayName}`).join("\n");
}