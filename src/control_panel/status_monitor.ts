import { createInterface as createReadlineInterface, emitKeypressEvents, Key, type Interface as ReadlineInterface } from "readline";
import type Brain from "../ai/brain.js";
import type { Job } from "../types.js";
import { DialogWindow, DialogWindowCanvas } from "./terminal_dialogs.js";
import { centerText, progressBar } from "./terminal_ui.js";

export class StatusMonitor extends DialogWindow {
  brain: Brain;
  readline: ReadlineInterface | undefined
  currentPrompt: string = "";
  latestResponse: string = "Type 'exit' to close the monitor, 'help' to show available commands";

  constructor(brain: Brain) {
    super();
    this.brain = brain;
    this._keypressEventHandler = ((keyRaw: string, K: Key) => {
      /* Обрабатываем нажатие клавиш */
      this._handleSpecialKeypress(K);
      if (K.name == "return") {
        this._handleCommand();
        this.currentPrompt = "";
      }
      else {
        this.currentPrompt += K.sequence;
      }
      this.onUpdate();
    }).bind(this);
  }

  onOpen() {
    this.readline = createReadlineInterface({ input: process.stdin });
    process.stdin.setRawMode(true); /* для перехвата ввода до нажатия Enter.
      Вернётся в прежнее состояние после закрытия данного диалога. */
    emitKeypressEvents(process.stdin, this.readline);
    process.stdin.on("keypress", this._keypressEventHandler);
    this.readline.resume();
    this.onUpdate();
  };
  onUpdate() {
    this.drawInterface();
  }
  updateInterval = 500;
  onFinalize = [() => {
    process.stdin.removeListener("keypress", this._keypressEventHandler);
    this.readline!.close();
    this.readline = undefined;
  }];

  drawInterface() {
    const width = process.stdout.columns, height = process.stdout.rows;
    const C = new DialogWindowCanvas(width, height);
    const D = getStatusMonitorData(this.brain);
    C.append(centerText(`'${this.brain.bot.player.displayName}' ASSISTANT STATUS MONITOR`, width, "_"));
    C.append("");
    C.append([
      {widthPercent: 60, content:
        `Health: ${progressBar(Math.round(D.health), 20)}\n` +
        `Food:   ${progressBar(Math.round(D.food), 20)}\n` +
        `Job queue:\n${D.jobsDisplay || "  <empty>"}`
      },
      {widthPercent: 40, content:
        `Inventory: (${D.inventory.length})\n` +
        D.inventory.map(([N, name]) => `- ${N}x ${name}`).join("\n")
      }
    ]);
    C.bottomAppend("////////////////////");
    C.bottomAppend(this.latestResponse);
    C.bottomAppend("////////////////////");
    C.bottomAppend("> " + this.currentPrompt);
    this.rawDraw(C.render());
  }

  private _keypressEventHandler;
  private _handleSpecialKeypress(K: Key) {
    /* TODO: Добавить поддержку клавиш стрелок и проч. спец.кнопок */
    switch (K.name) {
      case "backspace": {
        this.currentPrompt = this.currentPrompt.slice(0, -1);
        break;
      }
      case "escape": {
        this.currentPrompt = "";
        break;
      }
      default: break;
    }
  }
  private _handleCommand() {
    switch (this.currentPrompt) {
      case "help": {
        this.latestResponse = "Commands: 'exit'/'quit' to exit this monitor";
        break;
      }
      case "exit":
      case "quit": {
        this.closeDialogWindow();
        return;
      }
      default: {
        this.latestResponse = `(!) Unknown command: '${this.currentPrompt}'. Type 'help' to show available commands`;
        break;
      }
    }
  }
}

export function getStatusMonitorData(B: Brain) {
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
