import { Bot } from "mineflayer";
import type { Job, JobUnit } from "../types.js";
import { JobPriority } from "../types.js";
import Mod_ChatCommands from "./instincts/chat_commands.js";
import Mod_Eat from "./instincts/eat.js";
import Mod_Sleep from "./instincts/sleep.js";
import Mod_Farm from "./skills/farm.js"

export default class Brain extends TypedEventEmitter<BrainEventsMap> {
  constructor(public bot: Bot) {
    super();
    /* Модули должны быть инициализированы именно в конструкторе,
      ибо при создании поля класса Brain, 'bot' равняется 'undefined' (инициализация полей вызывается раньше конструктора). */
    this.i_ChatCommands = new Mod_ChatCommands(this);
    this.i_Eat = new Mod_Eat(this);
    this.i_Sleep = new Mod_Sleep(this);
    this.i_Farm = new Mod_Farm(this);
    process.once("SIGINT", async () => await this.exitProcess());
    process.once("exit", wrongExitCallback);
  }

  i_ChatCommands;
  i_Eat;
  i_Sleep;
  i_Farm;
  warningsQueue: string[] = [];
  jobs: Job[] = [];

  currentJob(): Job | undefined {
    return this.jobs[0];
  }
  currentJobUnit(): JobUnit | undefined {
    const J = this.currentJob();
    if (isAggregateJob(J)) return J.jobs[J.cursor];
    else return J;
  }
  addJob(J: Job) {
    if (J.jobIdentifier !== null && this.jobs.some(it => it.jobIdentifier === J.jobIdentifier))
      return;
    else if (J.priority > (this.currentJob()?.priority ?? 0))
      this._handleJobInterruption(J).then(() => this._startJobExecution());
    else {
      this.jobs.push(J);
      this._startJobExecution();
    }
  }
  async exitProcess() {
    console.log("Saving databases before exit...");
    for (const [dbName, database] of Object.entries(DB)) {
      database.stopAutocompaction();
      await database.compactDatafileAsync();
      debugLog(`Saved '${dbName}' database`);
    }
    console.log("Database saving completed.");
    process.off("exit", wrongExitCallback);
    process.exit(0);
  }
  warn(message: string) {
    this.warningsQueue.push(message);
    this.emit("newWarning", message);
    console.warn(message);
  }



  /** Процесс прерывания задачи. Резольвится, когда прерывание текущей задачи окончено. */
  private _jobInterruptionProcess: Promise<void> | undefined;
  private _jobExecutionProcess: Promise<void> | undefined;
  private _startJobExecution() {
    if (this._jobExecutionProcess) return;
    this._sortJobsQueue();
    this._jobExecutionProcess = this._initJobExecProcess();
    this._jobExecutionProcess.then(() => this._jobExecutionProcess = undefined);
  }
  private async _initJobExecProcess() {
    while (this.jobs.length > 0) {
      const J = this.currentJobUnit()!;
      await this._invokeJob(J).catch(error => this._handleJobInvocationError(error));
    }
  }
  private async _invokeJob(J: JobUnit) {
    if (J.promisePause !== undefined) return;
    if (J.validate) {
      const isActual = await J.validate();
      if (!isActual) return;
    }
    
    if (J.promisePause !== undefined) return;
    if (J.prepare) await J.prepare();
    
    if (J.promisePause !== undefined) return;
    await J.execute();
    
    if (J.promisePause !== undefined) return;
    if (J.finalize) await J.finalize();
  }
  private _handleJobInvocationError(error: any) {
    if (error instanceof BrainIgnoredError) return;
    console.error("Job invocation error:\n", error);
  }
  private _sortJobsQueue() {
    this.jobs.sort((A, B) => B.priority - A.priority);
  }
  /**
   * Функция сама добавляет задачу в очередь задач.
   * @param J прерывающая задача
   */
  private async _handleJobInterruption(J: Job) {
    const current = this.currentJob();
    this.jobs.unshift(J);
    let unpauseFn, rejectPauseFn;
    const promisePause = new Promise<void>((res, rej) => { unpauseFn = res; rejectPauseFn = rej });
    if (current !== undefined) {
      current.promisePause = promisePause;
      await current.finalize?.().catch(() => {});
    }
    this._startJobExecution();
  }
}

export class BrainIgnoredError extends Error {
  constructor() {
    super();
    this.name = "BrainIgnoredError";
  }
}

function wrongExitCallback() {
  throw new Error("[DEVELOPER WARNING]\nUnsafe 'process.exit()'!\nUse 'await brain.exitProcess()' instead");
}

interface BrainEventsMap {
  newWarning(message: string): any;
}
