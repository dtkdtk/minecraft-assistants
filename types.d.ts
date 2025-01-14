import * as mf from "mineflayer";

type _NecessaryOptions = Pick<mf.BotOptions, "auth" | "host" | "username" | "port">;

declare global {
  /**
   * Главные параметры.
   * Задаются при запуске бота.
   */
  export interface GeneralBotOptions extends _NecessaryOptions {
    _mfClientOptionsOverrides?: Partial<mf.BotOptions>;
  }

  export type Bot = mf.Bot;
  export type BotEvents = mf.BotEvents;
}

export {}
