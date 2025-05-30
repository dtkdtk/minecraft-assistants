import "./init-globals.js";
import * as mf from "mineflayer";
import { pathfinder } from "mineflayer-pathfinder";
import Brain from "./ai/brain.js";
import { setupCommandLineInterface } from "./cli.js";

//Здесь будет происходить инициализация бота на готовых параметрах.
//Параметры получаются из 'cli.js' или (в будущем) каких-то иных источников.
//Сделано, чтобы бота можно было запускать разными способами (в будущем).

export function createMinecraftAssistantBot(options: GeneralBotOptions) {
  const bot = mf.createBot({ ...options, ...options._mfClientOptionsOverrides });
  bot.once("spawn", () => {
    bot.loadPlugin(pathfinder);
    const brain = new Brain(bot);
    setupCommandLineInterface(brain);
  });
}
