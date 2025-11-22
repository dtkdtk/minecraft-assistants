import type * as mf from "mineflayer";

export type _NecessaryBotOptions = Pick<mf.BotOptions, "auth" | "username" | "host" | "port">;

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
   * `data/` directory path.
   * @default "./data"
   */
  databaseDirPath?: string;
  /**
   * `skills/` directory path.
   * @default "./skills"
   */
  skillsDirPath?: string;
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
  /**
   * Server game version. Used in game data pre-loading.
   */
  gameVersion?: string;
}
type _CleanBotOptions = Omit<GeneralBotOptions, keyof _NecessaryBotOptions | "_mfClientOptionsOverrides" | "gameVersion">;
export type OptionalBotOptions = { [key in keyof _CleanBotOptions]: NonNullable<_CleanBotOptions[key]> };
export type CompletedGeneralBotOptions = GeneralBotOptions & Required<OptionalBotOptions>;

export type Bot = mf.Bot;
export type BotEvents = mf.BotEvents;

/* I always remember the farm. Great for visualizing jobs.

  Aggregate job: Work
  Sub-jobs: Sow wheat (x60, each block = each sub-job)
  
  Aggregate job:
  prepare(): Go to chest, Take seeds from chest, Take hoe
  Only executed when starting an aggregate job (not min.un.work)
  finalize(): Put seeds and hoe in chest
  Executed when completing an aggregate job (regardless of whether there are min.un.work remaining)
  
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



export class SecurityViolation extends Error {
  constructor(details?: string) {
    super("The program detected internal security violation."
      + (details ? "\nDetails: " + details : ''));
  }
}
export class RestrictedAccessViolation extends SecurityViolation {
  constructor(className: string, memberName: string) {
    super(`${className}.${memberName} requires a friendKey to grant access`);
  }
}
export class AccessDeniedError extends SecurityViolation {
  constructor(message: string,
    public resource?: string,
    public request?: string,
  ) {
    super(message);
  }
}
