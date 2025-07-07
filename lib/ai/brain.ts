import { Bot } from "mineflayer";
import type { Job, JobUnit } from "../types.js";
import Mod_ChatCommands from "./instincts/chat_commands.js";
import Mod_Eat from "./instincts/eat.js";
import Mod_Sleep from "./instincts/sleep.js";
import Mod_Farm from "./skills/farm.js";

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
    else if (this.jobs.length > 0 && J.priority > (this.currentJob()?.priority ?? 0)) {
      const interrupt = () => this._handleJobInterruption(J);
      if (this._jobInterruptionProcess) this._jobInterruptionProcess.then(interrupt);
      else interrupt();
    }
    else {
      this.jobs.push(J);
      this._startJobExecution();
    }
  }
  async exitProcess(): Promise<never> {
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
    if (this._jobExecutionProcess && !this._jobInterruptionProcess) return;
    this._sortJobsQueue();
    this._jobExecutionProcess = this._initJobExecProcess();
    this._jobExecutionProcess.then(() => this._jobExecutionProcess = undefined);
  }
  private async _initJobExecProcess() {
    while (this.jobs.length > 0) {
      let JU: JobUnit;
      const currentJob = this.currentJob()!;
      if (isAggregateJob(currentJob)) {
        if (currentJob.cursor == (currentJob.jobs.length - 1)) {
          this.jobs.shift();
          continue;
        }
        else JU = currentJob.jobs[currentJob.cursor++];
      }
      else JU = currentJob;
        
      await this._invokeJob(JU).catch(error => this._handleJobInvocationError(error));
    }
  }
  private async _invokeJob(J: JobUnit): Promise<void> {
    if (J.promisePause !== undefined) return;
    if (J.validate) {
      const isActual = await J.validate();
      if (!isActual) return;
    }
    let result: boolean = true;
    
    if (J.promisePause !== undefined) return;
    if (J.prepare) result = await J.prepare()
    if (!result) return await J.failure?.();
    
    if (J.promisePause !== undefined) return;
    result = await J.execute();
    if (!result) return await J.failure?.();
    
    if (J.promisePause !== undefined) return;
    if (J.finalize) result = await J.finalize();
    if (!result) return await J.failure?.();
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
    let unpauseFn: SomeFunction | undefined, rejectPauseFn: SomeFunction | undefined;
    const promisePause = new Promise<void>((res, rej) => { unpauseFn = res; rejectPauseFn = rej });
    if (current !== undefined) {
      current.promisePause = promisePause;
      await current.finalize?.().catch(() => {});
    }
    this._jobInterruptionProcess = undefined;
    this._startJobExecution();
    unpauseFn?.();
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
