import Mod_ChatCommands from "./modules/core/chat-commands.js";
import Mod_Farmer from "./modules/core/farmer.js";

/**
 * Инициализирует все необходимые модули бота.
 * Вызывается в главном файле.
 */
export default function initModules(bot: Bot) {
  new Mod_ChatCommands(bot);
  new Mod_Farmer(bot);
}
