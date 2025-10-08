import { createMinecraftAssistantBot } from "../../dist/core/init_bot.js";
import testBotCfg from "./test_bot_cfg.js";
import { sep as pathSep } from "path";

if (!process.cwd().endsWith("pen-test") && !process.cwd().endsWith("pen-test" + pathSep))
  throw new Error("pen-test must be launched from 'test/pen-test/' directory");

const config = {
  ...testBotCfg,
  skillsDirPath: "../../dist/skills/",
};

createMinecraftAssistantBot(config);
