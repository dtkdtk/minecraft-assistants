import "./init-globals.js";
import * as mf from "mineflayer";
import initModules from "./init-modules.js";
import { pathfinder } from "mineflayer-pathfinder";
import { mineflayer as mfViewer } from "prismarine-viewer";

//Здесь будет происходить инициализация бота на готовых параметрах.
//Параметры получаются из 'cli.js' или (в будущем) каких-то иных источников.
//Сделано, чтобы бота можно было запускать разными способами (в будущем).

export function createMinecraftAssistantBot(options: GeneralBotOptions) {
  const bot = mf.createBot({ ...options, ...options._mfClientOptionsOverrides });
  bot.loadPlugin(pathfinder);

  

  initModules(bot);
}
