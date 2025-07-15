import type * as Nedb from "@seald-io/nedb";
import "./lib/actqueue.js";
import "./lib/durat.js";
import "./lib/typed_emitter.js";
import type { AggregateJob, DatabaseTypes, Job } from "./types.js";
type Datastore<Schema = Record<string, any>> = Nedb.default<Schema>;

export function debugLog(message: string): void {
  if (debugLog.enableDebug)
    console.debug(message);
}
debugLog.enableDebug = false;

export function isAggregateJob(job: Job | undefined | null): job is AggregateJob {
  return job ? ("jobs" in job) : false;
}

export function stringifyCoordinates(
  coordsLike: { x?: number, y?: number, z?: number }
    | [x: number, y: number, z: number]
    | [x: number, z: number]
): string {
  if (!Array.isArray(coordsLike))
    return [
      (coordsLike.x !== undefined ? `X=${coordsLike.x}` : ''),
      (coordsLike.y !== undefined ? `Y=${coordsLike.y}` : ''),
      (coordsLike.z !== undefined ? `Z=${coordsLike.z}` : ''),
    ].join(" ");
  else if (Array.isArray(coordsLike)) {
    if (coordsLike.length === 3)
      return `X=${coordsLike[0]} Y=${coordsLike[1]} Z=${coordsLike[2]}`;
    else if (coordsLike.length === 2)
      return `X=${coordsLike[0]} Z=${coordsLike[1]}`;
  }
  return "<incorrect-coordinates>";
}

export const DB: {
  common: Datastore,
  locations: Datastore<DatabaseTypes.LocationsDatabase>,
} = {
  common: undefined!,
  locations: undefined!,
};

export type Assert<Got, Needed> = Got extends Needed ? Got : never;
export type SomeFunction = () => unknown;
export type AnyFunction = (...args: any[]) => any;
