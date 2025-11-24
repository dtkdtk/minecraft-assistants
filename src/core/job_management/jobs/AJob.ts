import { ActualityCheckCb, AnyJob } from "../types.js";

export abstract class AJob implements AnyJob {
  abstract jobIdentifier: symbol | null;
  /** For display in control panel and debugging */
  abstract jobDisplayName: string;
  /** More = better. */
  abstract priority: number;

  /** Time-stamp of creation (Date.now()) */
  createdAt = Date.now();

  /** @returns {boolean} is actual? */
  abstract prepare(isActual: ActualityCheckCb): Promise<boolean>;
  /** @returns {boolean} repeat more? */
  abstract execute(isActual: ActualityCheckCb): Promise<boolean>;
  /** Must stop job execution & remove side-effects */
  abstract finalize(): void | Promise<void>;
  /** Handle (log/report/...) unexpected job execution error */
  abstract handleError(error: unknown): void | Promise<void>;
}
