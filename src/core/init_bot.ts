import { default as loadMinecraftData } from "minecraft-data";
import * as mf from "mineflayer";
import { pathfinder } from "mineflayer-pathfinder";
import { setupCommandLineInterface } from "./control_panel/terminal_app.js";
import { CoreContext } from "./coreContext.js";
import {
  Brain, Durat, type CompletedGeneralBotOptions,
  type GeneralBotOptions, type OptionalBotOptions
} from "./index.js";

const defaultOptions: Required<OptionalBotOptions> = {
  databaseAutosaveInterval: Durat({ min: 3 }),
  databaseDirPath: "./data/",
  skillsDirPath: "./skills/",
  enableDebug: false,
  interactiveCli: false,
};
let ctx: CoreContext;


export async function createMinecraftAssistantBot(inputOptions: GeneralBotOptions) {
  ctx = new CoreContext();
  ctx.coreLogger.logInfo("Loading MCA core...");
  initProcessExitHandlers();
  
  const options: CompletedGeneralBotOptions = { ...defaultOptions, ...inputOptions };
  ctx.isDebug = options.enableDebug;
  let preloadingProcess: Promise<void> | undefined;
  if (options.gameVersion) preloadingProcess = preloadGameVersion(options.gameVersion);
  initDatabases(options);

  /* for (const database of Object.values(DB))
    database.setAutocompactionInterval(options.databaseAutosaveInterval); */

  await preloadingProcess;
  const bot = mf.createBot({ ...options, ...inputOptions._mfClientOptionsOverrides });
  ctx.brain = new Brain(bot, options, ctx);
  bot.once("spawn", () => {
    bot.loadPlugin(pathfinder);
    if (inputOptions.interactiveCli) setupCommandLineInterface(ctx.brain!);
  });
}

function initDatabases(options: CompletedGeneralBotOptions) {
  //TODO
}

function preloadGameVersion(version: string) {
  ctx.coreLogger.logDebug(`Preloading [%s] version`, {}, [version])
  return new Promise<void>((pReturn) => {
    loadMinecraftData(version);
    pReturn();
  });
}

function initProcessExitHandlers() {
  async function exit() {
    process.off("exit", exit);
    await ctx.exitProcess();
  }
  function exitWithWarn() {
    const error = new Error();
    ctx.coreLogger.logDevWarn("Wrong exit! Use [coreCtx.exitProcess()] instead of [process.exit()]",
      { stack: error.stack ?? null });
    exit();
  }
  process.once("SIGINT", exit);
  process.once("exit", exitWithWarn);
}
