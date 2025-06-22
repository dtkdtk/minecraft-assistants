import { Bot } from "mineflayer";
import type { Job, JobUnit } from "../types.js";
import { JobPriority } from "../types.js";
import Mod_ChatCommands from "./instincts/chat_commands.js";
import Mod_Eat from "./instincts/eat.js";
import Mod_Sleep from "./instincts/sleep.js";

export default class Brain extends TypedEventEmitter<BrainEventsMap> {
  constructor(public bot: Bot) {
    super();
    /* Модули должны быть инициализированы именно в конструкторе,
      ибо при создании поля класса Brain, 'bot' равняется 'undefined' (инициализация полей вызывается раньше конструктора). */
    this.i_ChatCommands = new Mod_ChatCommands(this);
    this.i_Eat = new Mod_Eat(this);
    this.i_Sleep = new Mod_Sleep(this);
    process.once("SIGINT", async () => await this.exitProcess());
    process.once("exit", wrongExitCallback);
  }

  i_ChatCommands;
  i_Eat;
  i_Sleep;
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
    if (isInterruption(J)) {
      this._handleJobInterruption(J).then(() => this._startJobExecution());
    }
    else if (J.jobIdentifier !== null && this.jobs.some(it => it.jobIdentifier === J.jobIdentifier)) {
      return;
    }
    else {
      this.jobs.push(J);
      this._sortJobsQueue();
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

  private _sortJobsQueue() {
    this.jobs.sort((A, B) => B.priority - A.priority);
  }
  private _jobExecutionProcess: Promise<void> | undefined;
  /** Возвращение `false` происходит автоматически. */
  private _interruptJobExecution = false;
  private _startJobExecution() {
    if (this._jobExecutionProcess) return;
    this._jobExecutionProcess = this._initJobExecProcess();
    this._jobExecutionProcess.then(() => this._jobExecutionProcess = undefined);
  }
  private async _initJobExecProcess() {
    while (this.jobs.length > 0) {
      const J = this.currentJob()!;
      await this._invokeJob(J).catch(error => this._handleJobInvocationError(error));
      this.jobs.shift();
      if (this._interruptJobExecution) break;
    }
    this._interruptJobExecution = false;
  }
  private async _invokeJob(J: JobUnit) {
    if (this._interruptJobExecution && !isInterruption(J)) return;
    if (J.validate) {
      const isActual = await J.validate();
      if (!isActual) return;
    }
    
    if (this._interruptJobExecution && !isInterruption(J)) return;
    if (J.prepare) await J.prepare();
    
    if (this._interruptJobExecution && !isInterruption(J)) return;
    await J.execute();
    
    if (this._interruptJobExecution && !isInterruption(J)) return;
    if (J.finalize) await J.finalize();
  }
  private _handleJobInvocationError(error: Error) {
    console.error("Job invocation error:\n", error);
  }

  /**
   * @param J прерывающая задача
   */
  private async _handleJobInterruption(J: Job) {
    if (J.priority == JobPriority.ForceInterrupt) {
      this._interruptJobExecution = true;
      this.jobs.unshift(J);
      await this._invokeJob(J);
      this.jobs.shift();
    }
    else if (J.priority == JobPriority.SoftInterrupt) {
      this._interruptJobExecution = true;
      const currentJob = this.currentJobUnit();
      this.jobs.unshift(J);
      await currentJob?.finalize?.();
      await this._invokeJob(J);
      this.jobs.shift();
    }
  }
}

function isInterruption(J: Job): boolean {
  return J.priority == JobPriority.ForceInterrupt || J.priority == JobPriority.SoftInterrupt;
}
function wrongExitCallback() {
  throw new Error("[DEVELOPER WARNING]\nUnsafe 'process.exit()'!\nUse 'await brain.exitProcess()' instead");
}

interface BrainEventsMap {
  newWarning(message: string): any;
}
