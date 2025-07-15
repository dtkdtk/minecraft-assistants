import { default as Nedb } from "@seald-io/nedb";
import * as mf from "mineflayer";
import { pathfinder } from "mineflayer-pathfinder";
import Brain from "./brain.js";
import { setupCommandLineInterface } from "./control_panel/terminal_app.js";
import { DB, Durat, debugLog, type GeneralBotOptions, type _NecessaryBotOptions } from "./index.js";
import { join as joinPath } from "path";

/* Some TypeScript magic */
type _CleanBotOptions = Omit<GeneralBotOptions, keyof _NecessaryBotOptions | "_mfClientOptionsOverrides">;
type _OptionalBotOptions = { [key in keyof _CleanBotOptions]: NonNullable<_CleanBotOptions[key]> };

const defaultOptions: Required<_OptionalBotOptions> = {
  databaseAutosaveInterval: Durat({ min: 3 }),
  databaseDirPath: "./data/",
  skillsDirPath: "./skills/",
  enableDebug: false,
  interactiveCli: false,
};

type Options = GeneralBotOptions & Required<_OptionalBotOptions>;

export async function createMinecraftAssistantBot(inputOptions: GeneralBotOptions) {
  const options: Options = { ...defaultOptions, ...inputOptions };
  debugLog.enableDebug = options.enableDebug;
  initDatabases(options);

  /* for (const database of Object.values(DB))
    database.setAutocompactionInterval(options.databaseAutosaveInterval); */

  const bot = mf.createBot({ ...options, ...inputOptions._mfClientOptionsOverrides });
  bot.once("spawn", () => {
    bot.loadPlugin(pathfinder);
    const brain = new Brain(bot);
    if (inputOptions.interactiveCli) setupCommandLineInterface(brain);
  });
}

function initDatabases(options: Options) {
  const DataStore = Nedb as unknown as typeof Nedb.default;
  DB.common = new DataStore({ filename: joinPath(options.databaseDirPath, "common.db"), autoload: true });
  DB.locations = new DataStore({ filename: joinPath(options.databaseDirPath, "locations.db"), autoload: true });
}
