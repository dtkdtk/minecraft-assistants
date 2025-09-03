import { createMinecraftAssistantBot } from "../dist/lib/init_bot.js";
import testBotCfg from "./test_bot_cfg.js";

const config = {
  ...testBotCfg,
  skillsDirPath: "../dist/skills/",
};

createMinecraftAssistantBot(config);
