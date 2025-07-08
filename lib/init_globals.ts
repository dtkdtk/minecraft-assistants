/*
  Initializes all currently known files that contain
  global variables / functions / classes (entities).
*/
import { default as Nedb } from "@seald-io/nedb";
import "./lib/actqueue.js";
import "./lib/durat.js";
import "./lib/typed_emitter.js";
import type { AggregateJob, DatabaseTypes, Job } from "./types.js";
type Datastore<Schema = Record<string, any>> = Nedb.default<Schema>;
const Datastore = Nedb as unknown as typeof Nedb.default;

declare global {
  export function debugLog(message: string): void;
  export function isAggregateJob(job: Job | undefined | null): job is AggregateJob;
  export function stringifyCoordinates(coordsLike: { x?: number, y?: number, z?: number }): string;
  export function stringifyCoordinates(coordsLike: [x: number, y: number, z: number]): string;
  export function stringifyCoordinates(coordsLike: [x: number, z: number]): string;
  export const DB: Readonly<{
    common: Datastore,
    locations: Datastore<DatabaseTypes.LocationsDatabase>,
  }>;
  export type Assert<Got, Needed> = Got extends Needed ? Got : never;
  export type SomeFunction = () => unknown;
  export type AnyFunction = (...args: any[]) => any;
}

Object.defineProperties(global, {
  debugLog: {
    value: undefined,
    writable: true
  },
  isAggregateJob: {
    value: function(job: Job): job is AggregateJob {
      return job && ("jobs" in job);
    }
  },
  stringifyCoordinates: {
    value: function(coordsLike: any): string {
      if (typeof coordsLike == "object")
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
  },
  DB: {
    value: {
      /* The path is relative to the CWD (Current Working Directory) */
      common: new Datastore({ filename: "./data/common.db", autoload: true }),
      locations: new Datastore({ filename: "./data/locations.db", autoload: true }),
    }
  }
});
