import * as mf from "mineflayer";
import initModules from "./init-modules.js";

//Здесь будет происходить инициализация бота на готовых параметрах.
//Параметры получаются из 'cli.js' или (в будущем) каких-то иных источников.
//Сделано, чтобы бота можно было запускать разными способами (в будущем).

/**
 * @param {GeneralBotOptions} options 
 */
export default function createMinecraftAssistantBot(options) {
  const bot = mf.createBot({ ...options, ...options._mfClientOptionsOverrides });
  initModules(bot);
}
