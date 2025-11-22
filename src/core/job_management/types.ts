export type ActualityCheckCb = () => boolean;

/**
 * Unit of work. Job.
 */
export interface IJob {
  /**
   * System ID of the job.
   * If NOT 'null' is specified, the job becomes unique, and can only exist in the job queue in a single instance
   * (if a job with this ID already exists in the queue, adding the same one will not cause any problems)
   */
  jobIdentifier: symbol | null;
  /** For display in control panel and debugging */
  jobDisplayName: string;
  /** Time-stamp of creation (Date.now()) */
  createdAt: number;
  /** More = better. */
  priority: number;

  /** @returns {boolean} is actual? */
  prepare(isActual: ActualityCheckCb): Promise<boolean>;
  /** @returns {boolean} repeat more? */
  execute(isActual: ActualityCheckCb): Promise<boolean>;
  /** Must stop job execution & remove side-effects */
  finalize(): void | Promise<void>;
  /** Handle (log/report/...) unexpected job execution error */
  handleError(error: unknown): Promise<void>;
}

/** Higher priority = better. */
export enum JobPriority {
  /** If the bot hasn't other jobs. */
  Whenever = 1,
  /** "In the free time" (lunch time / evening time). */
  FreeTime = 2,
  /** Plain job, labor duty. */
  Plain = 3,
  /** "Foreground" jobs need to be completed right now. */
  Foreground = 4,
  /** Interrupt the current minimum unit of work and work on the job. */
  SoftInterrupt = 101,
  /** "STOP EVERYTHING and URGENTLY run to execute the job." */
  ForceInterrupt = 102
}
