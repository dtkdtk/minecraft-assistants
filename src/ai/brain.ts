import Mod_Eat from "./instincts/eat.js";
import Mod_ChatCommands from "./instincts/chat-commands.js";

export default class Brain {
  constructor(public bot: Bot) {
    /* Модули должны быть инициализированы именно в конструкторе, ибо при инициализации
        при создании поля класса Brain, 'bot' равняется 'undefined' (инициализация полей вызывается раньше конструктора). */
    this.i_Eat = new Mod_Eat(this);
    this.i_ChatCommands = new Mod_ChatCommands(this);
  }

  i_Eat;
  i_ChatCommands;

  private readonly jobs: Job[] = [];
  getJobs(): readonly Job[] {
    return this.jobs;
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
    if (isInterruption(J)) {
      this.handleJobInterruption(J).then(() => this.startJobExecution());
    }
    else {
      this.jobs.push(J);
      this.sortJobsQueue();
      this.startJobExecution();
    }
  }

  private sortJobsQueue() {
    this.jobs.sort((A, B) => B.priority - A.priority);
  }
  private jobExecutionProcess: Promise<void> | undefined;
  /** Возвращение `false` происходит автоматически. */
  private interruptJobExecution = false;
  private startJobExecution() {
    if (this.jobExecutionProcess) return;
    this.jobExecutionProcess = this._initJobExecProcess();
    this.jobExecutionProcess.then(() => this.jobExecutionProcess = undefined);
  }
  private async _initJobExecProcess() {
    while (this.jobs.length > 0) {
      const J = this.currentJob()!;
      await this.invokeJob(J).catch(error => this.handleJobInvocationError(error));
      this.jobs.shift();
      if (this.interruptJobExecution) break;
    }
    this.interruptJobExecution = false;
  }
  private async invokeJob(J: JobUnit) {
    if (this.interruptJobExecution && !isInterruption(J)) return;
    if (J.validate) {
      const isActual = await J.validate();
      if (!isActual) return;
    }
    
    if (this.interruptJobExecution && !isInterruption(J)) return;
    if (J.prepare) await J.prepare();
    
    if (this.interruptJobExecution && !isInterruption(J)) return;
    await J.execute();
    
    if (this.interruptJobExecution && !isInterruption(J)) return;
    if (J.finalize) await J.finalize();
  }
  private handleJobInvocationError(error: Error) {
    console.error("Job invocation error:\n", error);
  }

  /**
   * @param J прерывающая задача
   */
  private async handleJobInterruption(J: Job) {
    if (J.priority == JobPriority.ForceInterrupt) {
      this.interruptJobExecution = true;
      this.jobs.unshift(J);
      await this.invokeJob(J);
      this.jobs.shift();
    }
    else if (J.priority == JobPriority.SoftInterrupt) {
      this.interruptJobExecution = true;
      const currentJob = this.currentJobUnit();
      this.jobs.unshift(J);
      await currentJob?.finalize?.();
      await this.invokeJob(J);
      this.jobs.shift();
    }
  }
}

function isInterruption(J: Job): boolean {
  return J.priority == JobPriority.ForceInterrupt || J.priority == JobPriority.SoftInterrupt;
}
