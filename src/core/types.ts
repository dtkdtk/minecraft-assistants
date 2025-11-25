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

export type Assert<Got, Needed> = Got extends Needed ? Got : never;
export type SomeFunction = () => unknown;
export type AnyFunction = (...args: any[]) => any;
