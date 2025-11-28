import { Bot, BotEvents } from "mineflayer";
import type { CoreContext } from "./coreContext.js";
import {
  type CompletedGeneralBotOptions,
  TypedEventEmitter
} from "./index.js";
import { JobManager } from "./job_management/JobManager.js";
import { SkillsHandler } from "./skills_handler/handler.js";


export class Brain extends TypedEventEmitter<BrainEventsMap> {
  isBotSpawned = false;
  warningsQueue: string[] = [];
  jobs: JobManager;
  bot: Bot;
  configuration: CompletedGeneralBotOptions;
  #ctx: CoreContext

  constructor(bot: Bot, configuration: CompletedGeneralBotOptions, ctx: CoreContext) {
    super();
    this.#ctx = ctx;
    this.bot = bot;
    this.configuration = configuration;
    bot.once("spawn", () => { this.isBotSpawned = true });
    bot.once("spawn", (...args) => this.listeners("botSpawn").forEach(fn => fn(...args)));

    this.jobs = new JobManager();
    ctx.skillsHandler = new SkillsHandler(ctx as CoreContext.With<"brain">);
    ctx.skillsHandler.loadSkillsDirectory();
  }
}

interface BrainEventsMap {
  botSpawn: BotEvents["spawn"];
  newWarning(message: string): any;
}

export default Brain;
