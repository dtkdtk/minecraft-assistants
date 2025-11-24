import { Bot, BotEvents } from "mineflayer";
import {
  type CompletedGeneralBotOptions,
  DB,
  debugLog,
  SecurityViolation,
  TypedEventEmitter
} from "./index.js";
import { JobManager } from "./job_management/JobManager.js";
import { ResourceManager } from "./resource_manager.js";
import { SkillsHandler } from "./skills_handler/handler.js";


export class Brain extends TypedEventEmitter<BrainEventsMap> {
  isBotSpawned = false;
  warningsQueue: string[] = [];
  res: ResourceManager;
  jobs: JobManager;
  bot: Bot;
  configuration: CompletedGeneralBotOptions;
  #skillsHandler: SkillsHandler;
  static #rootKey: symbol;

  constructor(bot: Bot, configuration: CompletedGeneralBotOptions, rootKey: symbol) {
    super();
    if (Brain.#rootKey && Brain.#rootKey !== rootKey)
      throw new SecurityViolation("You may not to construct Brain class");
    Brain.#rootKey = rootKey;
    this.bot = bot;
    this.configuration = configuration;
    bot.once("spawn", () => { this.isBotSpawned = true });
    bot.once("spawn", (...args) => this.listeners("botSpawn").forEach(fn => fn(...args)));
    process.once("SIGINT", async () => await this.exitProcess());
    process.once("exit", wrongExitCallback);

    this.res = new ResourceManager(rootKey);
    this.jobs = new JobManager();
    this.#skillsHandler = new SkillsHandler(this, rootKey);

    this.#skillsHandler.loadSkillsDirectory();
  }

  async exitProcess(): Promise<never> {
    console.log("\nSaving databases before exit...");
    for (const [dbName, database] of Object.entries(DB)) {
      database.stopAutocompaction();
      await database.compactDatafileAsync();
      debugLog(`Saved '${dbName}' database`);
    }
    console.log("Database saving completed.");
    process.off("exit", wrongExitCallback);
    process.exit(0);
  }
  warn(message: string) {
    this.warningsQueue.push(message);
    this.emit("newWarning", message);
    console.warn(message);
  }
}

export class BrainIgnoredError extends Error {
  constructor() {
    super();
    this.name = "BrainIgnoredError";
  }
}

function wrongExitCallback() {
  throw new Error("[DEVELOPER WARNING]\nUnsafe 'process.exit()'!\nUse 'await brain.exitProcess()' instead");
}

interface BrainEventsMap {
  botSpawn: BotEvents["spawn"];
  newWarning(message: string): any;
}

export default Brain;
