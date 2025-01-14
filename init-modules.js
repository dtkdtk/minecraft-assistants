import Mod_ChatCommands from "./modules/core/chat-commands.js";

/**
 * Инициализирует все необходимые модули бота.
 * Вызывается в главном файле.
 * @param {Bot} bot 
 */
export default function initModules(bot) {
  new Mod_ChatCommands(bot);
}
