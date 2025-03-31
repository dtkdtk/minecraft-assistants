import Mod_ChatCommands from "./modules/core/chat-commands.js";
/**
 * Инициализирует все необходимые модули бота.
 * Вызывается в главном файле.
 */
export default function initModules(bot: Bot) {
  new Mod_ChatCommands(bot);
}
