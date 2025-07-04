import { createMinecraftAssistantBot } from "../dist/init_bot.js";
import testBotCfg from "./test_bot_cfg.js";

/*
  Вставьте тестовые данные в файл './test-bot-cfg.js'
  Формат:
  ---
    export default {
      username: "...",
      host: "...",
      auth: "..."
    };
  ---
*/

createMinecraftAssistantBot(testBotCfg);
