import * as mf from "mineflayer";

export type _NecessaryBotOptions = Pick<mf.BotOptions, "auth" | "host" | "username" | "port">;
/**
* Main parameters.
* Set when the bot starts.
*/
export interface GeneralBotOptions extends _NecessaryBotOptions {
  _mfClientOptionsOverrides?: Partial<mf.BotOptions>;
  /**
   * Interval for writing databases to files.
   * @default 3min
   */
  databaseAutosaveInterval?: number;
  /**
   * Enable debug? (for developers)
   * @default false
   */
  enableDebug?: boolean;
  /**
   * Interactive CLI mode. Permanently blocks I/O
   * @default false
   */
  interactiveCli?: boolean;
}

export type Bot = mf.Bot;
export type BotEvents = mf.BotEvents;

/** Higher priority = better. */
export enum JobPriority {
  /** If the bot hasn't other jobs. */
  Whenever = 1,
  /** In the free time (lunch time / evening time). */
  FreeTime = 2,
  /** Plain job, labor duty. */
  Plain = 3,
  /** "Foreground" jobs need to be completed right now. */
  Foreground = 4,
  /** Interrupt the current minimum unit of work and work on the job. */
  SoftInterrupt = 101,
  /** STOP EVERYTHING and URGENTLY run to execute the job. */
  ForceInterrupt = 102
}

/**
 * Minimal unit of work.
 */
export interface JobUnit {
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
  /**
   * A system promise that resolves when the job is unpaused,
   * and rejects when the job is completely stopped.
   * After the promise resolves (resolve()/reject()), the field value will be 'undefined' again.
   *
   * When creating a job, this field should be omitted (ignored).
   */
  promisePause?: Promise<void> | undefined;
  /** More = better. */
  priority: JobPriority;
  /** Do we still need to execute the job? */
  validate? (): Promise<boolean>;
/**
* Prepare the bot to perform a job. Returns success/failure
*
* Used in two cases:
* - (1) A regular job (`JobUnit`), which takes a very long time to prepare.
* During preparation, the job may become irrelevant (in which case, `prepare()` should return `false`)
* - (2) A complex job (`AggregateJob`), which can be performed "in several passes"
* (interrupted and then resumed) ((only a part of the minimum units of work can be performed, and the rest is left for later)),
* and also requires some SINGLE preparation for the execution of all the minimum units of work.
* For example, `prepare(): "take seeds from the chest"`, and `jobs[i].execute(): "go to the garden bed and plant seeds"`
*/
  prepare? (): Promise<boolean>;
  /** @returns success/failure */
  execute(): Promise<boolean>;
  /** Stop the job execution / after the job execution. @returns success/failure */
  finalize? (): Promise<boolean>;
  /** Failure. Called if the job fails at any stage. */
  failure? (): Promise<void>;
}

/* I always remember the farm. Great for visualizing jobs.

  Aggregate job: Work
  Sub-jobs: Sow wheat (x60, each row = each sub-job)
  
  Aggregate job:
  prepare(): Go to chest, Take seeds from chest, Take hoe
  Only executed when starting an aggregate job (not min.work)
  finalize(): Put seeds and hoe in chest
  Executed when completing an aggregate job (regardless of whether there are min.work remaining)
  
  Sub-jobs:
  validate(): Is the field already sown?
  Note: This is just for logical separation; it is perfectly fine to omit the checks in `execute()`,
  but then `prepare()` will still execute even if the job is already completed.
  execute(): Go here, Take seeds in hand, Use on arable land
*/

/**
 * A set of jobs. Divided into minimal units of work.
 * The set may be heterogeneous (contain different jobs).
 *
 * `.execute()` executes one minimal unit of work.
 */
export interface AggregateJob extends JobUnit {
  /** The index of the currently executing job. */
  cursor: number;
  /** Set of simple jobs. */
  jobs: JobUnit[];
}
export type Job = JobUnit | AggregateJob;

export enum LocationType {
  /** A single point. */
  Point,
  /** A 2D-region (without Y) - rectangle. */
  Area,
  /** A 3D-region - cube. */
  Region,
  /* TODO: AggregateArea (several areas), AggregateRegion (several regions) */
}
/** A single point in the world. */
export interface LocationPoint {
  /** System name of the point. */
  key: string;
  type: LocationType.Point;
  
  x: number;
  y: number;
  z: number;
}
/** Rectangular (2D) region (without Y). */
export interface LocationArea {
  /** System name of the point. */
  key: string;
  type: LocationType.Area;
  
  x1: number;
  z1: number;
  
  x2: number;
  z2: number;
}
/** Cubical (3D) region. */
export interface LocationRegion {
  /** System name of the point. */
  key: string;
  type: LocationType.Region;
  
  x1: number;
  y1: number;
  z1: number;
  
  x2: number;
  y2: number;
  z2: number;
}
export type Location = LocationPoint | LocationArea | LocationRegion;



/** Internal database types. */
export namespace DatabaseTypes {
  export type KnownModuleNames = "Mod_ChatCommands" | "Mod_Eat" | "Mod_Sleep" | "Mod_Farm";
  export type LocationsDatabase = {
    _id: KnownModuleNames; /* module name */
    locations: Location[];
  };
}
