import "./init_globals.js";
import * as mf from "mineflayer";
import { pathfinder } from "mineflayer-pathfinder";
import Brain from "./ai/brain.js";
import { setupCommandLineInterface } from "./control_panel/terminal_app.js";
import type { GeneralBotOptions, _NecessaryBotOptions } from "./types.js";

/* Some TypeScript magic */
type _CleanBotOptions = Omit<GeneralBotOptions, keyof _NecessaryBotOptions | "_mfClientOptionsOverrides">;
type _OptionalBotOptions = { [key in keyof _CleanBotOptions]: NonNullable<_CleanBotOptions[key]> };

const defaultOptions: Required<_OptionalBotOptions> = {
  databaseAutosaveInterval: +Durat.min(3),
  enableDebug: false,
  interactiveCli: false,
};

type Options = GeneralBotOptions & Required<_OptionalBotOptions>;

export async function createMinecraftAssistantBot(inputOptions: GeneralBotOptions) {
  const options: Options = { ...defaultOptions, ...inputOptions };
  initDebugFn(options.enableDebug);
  for (const database of Object.values(DB))
    {}//database.setAutocompactionInterval(options.databaseAutosaveInterval);

  const bot = mf.createBot({ ...options, ...inputOptions._mfClientOptionsOverrides });
  bot.once("spawn", () => {
    bot.loadPlugin(pathfinder);
    const brain = new Brain(bot);
    if (inputOptions.interactiveCli) setupCommandLineInterface(brain);
  });
}

function initDebugFn(enableDebug: boolean) {
  global.debugLog = enableDebug
    ? (message: string) => console.debug(message)
    : () => {};
}
