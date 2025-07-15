import { Bot } from "mineflayer";
import { type AnyFunction, type BotSkill, DB, debugLog, isAggregateJob, type Job, type JobUnit, type SomeFunction, TypedEventEmitter } from "./index.js";
import { join as joinPath } from "path";
import * as libFs from "fs";

const SKILLS_DIR_PATH = joinPath(".", "skills");

export default class Brain extends TypedEventEmitter<BrainEventsMap> {
  constructor(public bot: Bot) {
    super();
    process.once("SIGINT", async () => await this.exitProcess());
    process.once("exit", wrongExitCallback);
    this.loadSkills();
  }

  warningsQueue: string[] = [];
  jobs: Job[] = [];
  skills: Map<string, BotSkill> = new Map();
  skillsDir?: libFs.Dir;

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
      const interrupt = () => this._jobInterruptionProcess = this._handleJobInterruption(J)
        .then(() => {
          this._jobInterruptionProcess = undefined;
          this.jobs.shift();
          this._startJobExecution();
        });
      if (this._jobInterruptionProcess) this._jobInterruptionProcess.then(interrupt);
      else interrupt();
    }
    else {
      this.jobs.push(J);
      this._startJobExecution();
    }
  }

  async exitProcess(): Promise<never> {
    console.log("\nSaving databases before exit...");
    if (this.skillsDir) await this.skillsDir.close().catch(() => {});
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
  async loadSkills() {
    if (this.skills.size > 0) this.skills.clear();
    if (this.skillsDir) await this.skillsDir.close();
    this.skillsDir = libFs.opendirSync(SKILLS_DIR_PATH);
    for await (const skillEnt of this.skillsDir) {
      if (!skillEnt.isFile() || !skillEnt.name.endsWith(".js")) continue;
      const skill = await import(joinPath(skillEnt.parentPath, skillEnt.name))
        .catch();

    }
  }



  private _jobInterruptionProcess: Promise<void> | undefined;
  private _jobExecutionStatus: boolean = false;
  private _onJobExecutionComplete?: AnyFunction;

  private _startJobExecution() {
    if (this._jobExecutionStatus || this._jobInterruptionProcess) return;
    this._sortJobsQueue();
    this._initJobExecProcess();
  }
  private async _initJobExecProcess() {
    let stopped = false; /* anti race-of-states */
    if (this.jobs.length > 0) this._jobExecutionStatus = true;
    while (this.jobs.length > 0) {
      if (this._jobExecutionStatus == false) {
        stopped = true;
        break;
      }
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
        
      const invocationResult = await this._invokeJob(JU)
        .catch(error => this._handleJobInvocationError(error));
      if (!stopped) {
        if (invocationResult === true || (invocationResult === false && !JU.reExecuteAfterFail))
          this.jobs.shift();
        else if (invocationResult === null)
          this.jobs.shift(); //TODO: Do not remove the job from the queue if it (job) was interrupted
      }
    }
    if (!stopped) {
      this._jobExecutionStatus = false;
      if (this._onJobExecutionComplete) setImmediate(() => this._onJobExecutionComplete!());
    }
  }
  /**
   * @returns `true` if successfully executed, `false` if failed, `null` if interrupted
   */
  private async _invokeJob(J: JobUnit): Promise<boolean | null> {
    if (J.promisePause !== undefined) return null;
    if (J.validate) {
      const isActual = await J.validate();
      if (!isActual) return false;
    }
    let result: boolean = true;
    
    if (J.promisePause !== undefined) return null;
    if (J.prepare) result = await J.prepare()
    if (!result) return (await J.failure?.(), false);
    
    if (J.promisePause !== undefined) return null;
    result = await J.execute();
    if (!result) return (await J.failure?.(), false);
    
    if (J.promisePause !== undefined) return null;
    if (J.finalize) result = await J.finalize();
    if (!result) return (await J.failure?.(), false);
    return true;
  }
  private _handleJobInvocationError(error: any) {
    if (error instanceof BrainIgnoredError) return;
    console.error("Job invocation error:\n", error);
  }
  private _sortJobsQueue() {
    this.jobs.sort((A, B) => B.priority - A.priority);
  }
  /**
   * Will add job to the job queue.
   * @param J interrupting job
   */
  private async _handleJobInterruption(J: Job) {
    const current = this.currentJob();
    this.jobs.unshift(J);
    let unpauseFn: SomeFunction | undefined;
    const promisePause = new Promise<void>((res) => { unpauseFn = res; });

    this._jobExecutionStatus = false;
    if (current !== undefined) {
      current.promisePause = promisePause;
      await current.finalize?.().catch(() => {});
    }
    await this._invokeJob(J).catch(() => this._handleJobInterruption(J));
    if (J.promisePause) await J.promisePause;
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
