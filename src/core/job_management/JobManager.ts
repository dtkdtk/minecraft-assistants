import { InfLoopFuse } from "../lib/infloop_fuse.js";
import type { ActualityCheckCb, AnyJob } from "./types.js";

const kJobWatermark = Symbol();
const getWatermark = (job: AnyJob) => Reflect.get(job, kJobWatermark);
const resetWatermark = (job: AnyJob) => Reflect.set(job, kJobWatermark, null);
const updateWatermark = (job: AnyJob) => {
  const wm = Symbol();
  Reflect.set(job, kJobWatermark, wm);
  return wm;
}

export class JobManager {
  #queue: AnyJob[] = [];
  #currentExecutor?: Promise<void>;
  #currentJob?: AnyJob;

  add(job: AnyJob): void {
    resetWatermark(job);
    const interrupt = this.#queue.length > 0 && job.priority > this.#queue[0].priority;
    this.#queue.push(job);
    this.#queue.sort((A, B) => B.priority - A.priority);
    this.#initExecution(interrupt);
  }
  async terminate(job: AnyJob): Promise<boolean> {
    if (!this.exists(job)) return false;
    await this.#finalizeJob(job, true);
    return true;
  }
  exists(job: AnyJob): boolean {
    return this.#queue.includes(job);
  }


  #removeFromQueue(job: AnyJob): boolean {
    const index = this.#queue.indexOf(job);
    if (index === -1) return false;
    this.#queue.splice(index, 1);
    return true;
  }

  async #invokeJob(job: AnyJob) {
    this.#currentJob = job;
    const watermark = updateWatermark(job);

    const checkActuality = this.#createCheckerCb(job, watermark);
    let isActual = true, isError = false;
    try {
      let toContinue: boolean;
      toContinue = await job.prepare(checkActuality);
      isActual = checkActuality();
      if (!toContinue) {
        await this.#finalizeJob(job, true);
        this.#currentJob = undefined;
        this.#initExecution();
        return;
      }
      const { fuseIncrement, fuseOk } = new InfLoopFuse(true);
      while (isActual && toContinue && fuseOk()) {
        toContinue = !(await job.execute(checkActuality));
        isActual = checkActuality();
        fuseIncrement();
      }
    }
    catch (error) {
      isError = true;
      this.#removeFromQueue(job);
      job.handleError(error)?.catch(() => {});
    }
    isActual = checkActuality();
    if (!isActual) return;
    if (!isError) await this.#finalizeJob(job, true);
    this.#currentJob = undefined;
    this.#initExecution();
  }

  async #initExecution(interrupt: boolean = false) {
    //new job must be added to queue
    if (this.#queue.length == 0) return;
    if (interrupt && this.#currentJob) {
      //Watermark reset; job execution will be stopped, finalized,
      // but NOT removed from queue
      await this.#finalizeJob(this.#currentJob);
      this.#currentJob = undefined;
    }
    //Because job interruption stops job invocation, the #currentExecutor
    // promise will be resolved and #initExecutor will be re-called (after execution).
    // That's why we don't re-creating #currentExecutor there
    // ((because it is already created))
    if (!this.#currentJob) {
      this.#currentExecutor = new Promise((pReturn) => {
        const job = this.#queue[0];
        this.#invokeJob(job).then(() => pReturn());
      });
      this.#currentExecutor.then(() => this.#currentJob === undefined ? this.#initExecution() : null);
    }
  }

  #createCheckerCb(job: AnyJob, neededWatermark: symbol): ActualityCheckCb {
    return () => {
      return this.#queue.includes(job) && (getWatermark(job) === neededWatermark);
    };
  }
  async #finalizeJob(job: AnyJob, removeFromQueue: boolean = false) {
    resetWatermark(job);
    let error = undefined;
    await Promise.resolve(job.finalize?.())
      .catch(E => error = E);
    if (removeFromQueue || error) this.#removeFromQueue(job);
    if (error) job?.handleError(error)?.catch(() => {})
  }
}

/*
  `Reflect` is used to explicitly add meta-fields and avoid TypeScript errors.
*/
