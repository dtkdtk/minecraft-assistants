import * as mineflayer from "mineflayer";

//Здесь будет происходить инициализация бота на готовых параметрах.
//Параметры получаются из 'cli.js' или (в будущем) каких-то иных источников.
//Сделано, чтобы бота можно было запускать разными способами (в будущем).

/**
 * @param {import("./main").GeneralOptions} options 
 */
export async function createBotInstance(options) {
  const bot = mineflayer.createBot({ ...options, ...options._mfClientOptionsOverrides });
}
