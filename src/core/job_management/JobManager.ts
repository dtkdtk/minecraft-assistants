import type { ActualityCheckCb, IJob } from "./types.js";

const kJobWatermark = Symbol();

export default class JobManager {
  #queue: IJob[] = [];
  #currentExecutor?: Promise<IJob>;
  #currentJob?: IJob;

  add(job: IJob): void {
    this.#queue.push(job);
    const interrupt = job.priority > this.#queue[0].priority;
    this.#queue.sort((A, B) => B.priority - A.priority);
    this.#initExecution(interrupt);
  }
  async terminate(job: IJob): Promise<boolean> {
    if (!this.#removeFromQueue(job)) return false;
    await job.finalize()?.catch(() => {});
    return true;
  }
  exists(job: IJob): boolean {
    return this.#queue.includes(job);
  }
  

  #removeFromQueue(job: IJob): boolean {
    const index = this.#queue.indexOf(job);
    if (index === -1) return false;
    this.#queue.splice(index, 1);
    return true;
  }

  async #invokeJob(job: IJob) {
    this.#currentJob = job;
    const watermark = Symbol();
    Reflect.set(job, kJobWatermark, watermark);
    const checkActuality = this.#createCheckerCb(job, watermark);
    try {
      let isActual = true;
      execution: {
        let toContinue: boolean;
        toContinue = await job.prepare(checkActuality);
        if (!(isActual = checkActuality()) || !toContinue) break execution;
        toContinue = await job.execute(checkActuality);
        if (!(isActual = checkActuality()) || !toContinue) break execution;
      }
      await job.finalize();
      if (isActual) {
        this.#removeFromQueue(job);
        this.#currentJob = undefined;
        this.#initExecution();
      }
    }
    catch (E: unknown) {
      this.#removeFromQueue(job);
      job.handleError(E).catch(() => {});
      await job.finalize()?.catch(() => {});
    }
  }

  #initExecution(interrupt: boolean = false) {
    //new job must be added to queue
    if (this.#queue.length == 0) return;
    if (interrupt && this.#currentJob) {
      //Watermark reset; job execution will be stopped, finalized,
      // but NOT removed from queue
      Reflect.set(this.#currentJob, kJobWatermark, null);
      Promise.resolve(this.#currentJob.finalize()).catch(() => {});
      this.#currentJob = undefined;
    }
    //Because job interruption stops job invocation, the #currentExecutor
    // promise will be resolved and #initExecutor will be re-called (after execution).
    // That's why we don't re-creating #currentExecutor there
    // ((because it is already created))
    if (!this.#currentJob) {
      this.#currentExecutor = new Promise((pReturn) => {
        const job = this.#queue[0];
        this.#invokeJob(job).then(() => pReturn(job));
      });
      this.#currentExecutor.then((J) => this.#currentJob === J ? this.#initExecution() : null);
    }
  }

  #createCheckerCb(job: IJob, neededWatermark: symbol): ActualityCheckCb {
    return () => {
      return this.#queue.includes(job) && (Reflect.get(job, kJobWatermark) === neededWatermark);
    };
  }
}

/*
  `Reflect` is used to explicitly add meta-fields and avoid TypeScript errors.
*/
