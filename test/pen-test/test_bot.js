import { createMinecraftAssistantBot } from "../../dist/core/init_bot.js";
import testBotCfg from "./test_bot_cfg.js";

const config = {
  ...testBotCfg,
  skillsDirPath: "../dist/skills/",
};

createMinecraftAssistantBot(config);
