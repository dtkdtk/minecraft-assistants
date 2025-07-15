import type { Key } from "readline";
import { styleText } from "util";
import type Brain from "../../brain.js";
import { isAggregateJob, type Job } from "../../index.js";
import { DialogWindow, DialogWindowCanvas } from "../terminal_dialogs.js";
import { alignCenter, alignLeft, progressBar } from "../terminal_ui.js";

export class StatusMonitor extends DialogWindow {
  brain: Brain;

  constructor(brain: Brain) {
    super();
    this.brain = brain;
    this.handleKeypress = ((keyRaw: string, K: Key) => {
      if (K.name == "q") {
        this.closeDialogWindow();
        return;
      }
    }).bind(this);
  }

  onOpen() {
    this.onUpdate();
  };
  onUpdate() {
    this.drawInterface();
  }
  updateInterval = 500;
  clearScreenAfterClose = true;

  drawInterface() {
    const W = process.stdout.columns, H = process.stdout.rows;
    const C = new DialogWindowCanvas(W, H);
    const D = getStatusMonitorData(this.brain);
    C.append(alignCenter(`'${this.brain.bot.player.displayName}' ASSISTANT STATUS MONITOR`, W, "_"));
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
    C.bottomAppend(styleText("inverse", alignLeft("Press [Q] to exit the monitor", W)));
    this.rawDraw(C.render());
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
