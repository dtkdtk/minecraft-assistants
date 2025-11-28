import type { AnyFunction, Brain } from "./index.js";
import { Logger } from "./lib/logger.js";
import { ResourceManager } from "./resource_manager/ResourceManager.js";
import type { SkillsHandler } from "./skills_handler/handler.js";

/**
 * MCA Core Context. Global context for the entire Core.
 * Must not be passed to skills.
 */
export class CoreContext {
  trustKey = Symbol();
  coreLogger: Logger;
  resources: ResourceManager;
  brain?: Brain;
  skillsHandler?: SkillsHandler;
  isDebug = false;
  _wrongExitCallback?: AnyFunction;
  static #hasInstance = false;

  /** allows to get access to the physically private fields/methods */
  restrictedProps = {
    ResourceManager: {
      skills: ResourceManager.DK_skills as typeof ResourceManager.DK_skills,
      querySkillData: ResourceManager.DK_querySkillData as typeof ResourceManager.DK_querySkillData,
    }
  }

  constructor() {
    if (CoreContext.#hasInstance) throw new Error("CoreContext already has an instance");
    CoreContext.#hasInstance = true;
    this.coreLogger = new Logger();
    this.resources = new ResourceManager(this);
  }

  coreAssert(condition: unknown, errMessage?: string): asserts condition {
    if (condition) return;
    const error = new Error();
    this.coreLogger.logFatal(`Assertion failed! ${errMessage}`, {
      stack: error.stack!
    });
    this.exitProcess();
  }
  async exitProcess(): Promise<never> {
    this.coreLogger.logInfo("Saving databases before exit...");
    /*for (const [dbName, database] of Object.entries(DB)) {
      database.stopAutocompaction();
      await database.compactDatafileAsync();
      debugLog(`Saved '${dbName}' database`);
    }*/
    this.coreLogger.logInfo("Database saving completed.");
    if (this._wrongExitCallback) process.off("exit", this._wrongExitCallback);
    process.exit(0);
  }
}
// eslint-disable-next-line no-redeclare
export namespace CoreContext {
  export type With<Keys extends keyof CoreContext> = CoreContext & { [K in Keys]: Exclude<CoreContext[K], undefined> }
}
