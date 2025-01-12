import * as mineflayer from "mineflayer";

type _NecessaryOptions = Pick<mineflayer.BotOptions, "auth" | "host" | "username">;

/**
 * Главные параметры.
 * Задаются при запуске бота.
 */
export interface GeneralOptions extends _NecessaryOptions {
  _mfClientOptionsOverrides: mineflayer.BotOptions;
}
