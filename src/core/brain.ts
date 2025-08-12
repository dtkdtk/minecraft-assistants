import * as libFs from "fs";
import { Bot } from "mineflayer";
import { join as joinPath } from "path";
import {
  type AnyFunction,
  type BotSkill,
  type CompletedGeneralBotOptions,
  DB,
  debugLog,
  isAggregateJob,
  type Job,
  type JobUnit,
  type SomeFunction,
  TypedEventEmitter
} from "./index.js";
import { pathToFileURL } from "url";

export class Brain extends TypedEventEmitter<BrainEventsMap> {
  constructor(public bot: Bot, public configuration: CompletedGeneralBotOptions) {
    super();
    bot.once("spawn", () => { this.isBotSpawned = true });
    process.once("SIGINT", async () => await this.exitProcess());
    process.once("exit", wrongExitCallback);
    this.loadSkills();
  }

  isBotSpawned = false;
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
    const dirPath = joinPath(process.cwd(), this.configuration.skillsDirPath!);
    this.skillsDir = libFs.opendirSync(dirPath);
    for await (const skillEnt of this.skillsDir) {
      if (!skillEnt.isFile() || !skillEnt.name.endsWith(".js")) continue;
      debugLog(`Loading skill: '${skillEnt.name}'`);

      const skillPath = pathToFileURL(joinPath(skillEnt.parentPath, skillEnt.name));
      const skill = await import(skillPath.toString())
        .catch(E => (this.warn("Cannot load bot skill (reading phase): " + skillEnt.name + "\nError: " + (E?.message ?? "?")), null));
      if (!skill) continue;

      if (!skill.default) {
        this.warn(`Invalid skill file: '${skillEnt.name}', error: 'No default export'`);
        continue;
      }
      const SkillClass = skill.default as new (brain: Brain) => BotSkill;

      try {
        const skillInstance = new SkillClass(this);
        if (this.isBotSpawned) skillInstance.onGame?.();
        else this.bot.once("spawn", () => skillInstance.onGame?.());
        this.skills.set(skillInstance.moduleName, skillInstance);
      }
      catch (error: any) {
        this.warn("Cannot load bot skill (instance phase): " + skillEnt.name + "\nError: " + (error?.message ?? "?"));
      }
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

export default Brain;
