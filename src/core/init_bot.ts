import { default as Nedb } from "@seald-io/nedb";
import * as mf from "mineflayer";
import { pathfinder } from "mineflayer-pathfinder";
import { join as joinPath } from "path";
import { setupCommandLineInterface } from "./control_panel/terminal_app.js";
import { Brain, DB, debugLog, Durat, type CompletedGeneralBotOptions, type GeneralBotOptions, type OptionalBotOptions } from "./index.js";

const defaultOptions: Required<OptionalBotOptions> = {
  databaseAutosaveInterval: Durat({ min: 3 }),
  databaseDirPath: "./data/",
  skillsDirPath: "./skills/",
  enableDebug: false,
  interactiveCli: false,
};


export async function createMinecraftAssistantBot(inputOptions: GeneralBotOptions) {
  const options: CompletedGeneralBotOptions = { ...defaultOptions, ...inputOptions };
  debugLog.enableDebug = options.enableDebug;
  initDatabases(options);

  /* for (const database of Object.values(DB))
    database.setAutocompactionInterval(options.databaseAutosaveInterval); */

  const bot = mf.createBot({ ...options, ...inputOptions._mfClientOptionsOverrides });
  bot.once("spawn", () => {
    bot.loadPlugin(pathfinder);
    const brain = new Brain(bot, options);
    if (inputOptions.interactiveCli) setupCommandLineInterface(brain);
  });
}

function initDatabases(options: CompletedGeneralBotOptions) {
  const DataStore = Nedb as unknown as typeof Nedb.default;
  DB.common = new DataStore({ filename: joinPath(options.databaseDirPath, "common.db"), autoload: true });
  DB.locations = new DataStore({ filename: joinPath(options.databaseDirPath, "locations.db"), autoload: true });
}
