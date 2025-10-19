import { Bot } from "mineflayer";
import { SkillsHandler } from "./skills_handler/handler.js";
import {
  type AnyFunction,
  type CompletedGeneralBotOptions,
  DB,
  debugLog,
  isAggregateJob,
  type Job,
  type JobUnit,
  type SomeFunction,
  TypedEventEmitter
} from "./index.js";
import { ResourceManager } from "./resource_manager.js";

const kSubjobExecutionStarted = Symbol("executionStarted");
const kBrainFriendKey = Symbol("friendKey_Brain");

export class Brain extends TypedEventEmitter<BrainEventsMap> {
  isBotSpawned = false;
  warningsQueue: string[] = [];
  jobs: Job[] = [];
  res: ResourceManager;
  bot: Bot;
  configuration: CompletedGeneralBotOptions;
  #skillsHandler: SkillsHandler;

  constructor(bot: Bot, configuration: CompletedGeneralBotOptions) {
    super();
    this.bot = bot;
    this.configuration = configuration;
    bot.once("spawn", () => { this.isBotSpawned = true });
    process.once("SIGINT", async () => await this.exitProcess());
    process.once("exit", wrongExitCallback);

    this.res = new ResourceManager(kBrainFriendKey);
    this.#skillsHandler = new SkillsHandler(this, kBrainFriendKey);

    this.#skillsHandler.loadSkillsDirectory();
  }

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
      const interrupt = () => this.#jobInterruptionProcess = this.#handleJobInterruption(J)
        .then(() => {
          this.#jobInterruptionProcess = undefined;
          this.jobs.shift();
          this.#startJobExecution();
        });
      if (this.#jobInterruptionProcess) this.#jobInterruptionProcess.then(interrupt);
      else interrupt();
    }
    else {
      this.jobs.push(J);
      this.#startJobExecution();
    }
  }

  async exitProcess(): Promise<never> {
    console.log("\nSaving databases before exit...");
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
  





  #jobInterruptionProcess: Promise<void> | undefined;
  #jobExecutionStatus: boolean = false;
  #onJobExecutionComplete?: AnyFunction;

  #startJobExecution() {
    if (this.#jobExecutionStatus || this.#jobInterruptionProcess) return;
    this.#sortJobsQueue();
    this.#initJobExecProcess();
  }
  async #initJobExecProcess() {
    let stopped = false; /* anti race-of-states */
    if (this.jobs.length > 0) this.#jobExecutionStatus = true;
    while (this.jobs.length > 0) {
      if (this.#jobExecutionStatus == false) {
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

      let invocationResult;
      /* Firstly, execute the aggregate's methods. Then, start sub-jobs execution. */
      if (kSubjobExecutionStarted in currentJob && currentJob[kSubjobExecutionStarted] == true)
        invocationResult = await this.#invokeJob(JU)
          .catch(error => this.#handleJobInvocationError(error))
          .then(() => currentJob[kSubjobExecutionStarted] = true);
      else
        invocationResult = await this.#invokeJob(currentJob)
          .catch(error => this.#handleJobInvocationError(error));
      
      if (!stopped) {
        if (invocationResult === true || (invocationResult === false && !JU.reExecuteAfterFail))
          this.jobs.shift();
        else if (invocationResult === null)
          this.jobs.shift(); //TODO: Do not remove the job from the queue if it (job) was interrupted
      }
    }
    if (!stopped) {
      this.#jobExecutionStatus = false;
      if (this.#onJobExecutionComplete) setImmediate(() => this.#onJobExecutionComplete!());
    }
  }
  /**
   * @returns `true` if successfully executed, `false` if failed, `null` if interrupted
   */
  async #invokeJob(J: JobUnit): Promise<boolean | null> {
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
  #handleJobInvocationError(error: any) {
    if (error instanceof BrainIgnoredError) return;
    console.error("Job invocation error:\n", error);
  }
  #sortJobsQueue() {
    this.jobs.sort((A, B) => B.priority - A.priority);
  }
  /**
   * Will add job to the job queue.
   * @param J interrupting job
   */
  async #handleJobInterruption(J: Job) {
    const current = this.currentJob();
    this.jobs.unshift(J);
    let unpauseFn: SomeFunction | undefined;
    const promisePause = new Promise<void>((res) => { unpauseFn = res; });

    this.#jobExecutionStatus = false;
    if (current !== undefined) {
      current.promisePause = promisePause;
      await current.finalize?.().catch(() => {});
    }
    await this.#invokeJob(J).catch(() => this.#handleJobInterruption(J));
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
