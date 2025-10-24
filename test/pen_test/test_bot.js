import assert from "assert";
import { existsSync } from "fs";
import { sep as pathSep } from "path";
import { createMinecraftAssistantBot } from "../../dist/core/init_bot.js";
import testBotCfg from "./test_bot_cfg.js";

assert(process.cwd().split(pathSep).at(-1) == "pen_test", "pen-test must be launched from 'test/pen_test/' directory");
assert(existsSync(testBotCfg.skillsDirPath), "Cannot find skills directory. Ensure you executed 'pen_test/build.sh' script.");

const config = {
  ...testBotCfg,
};

createMinecraftAssistantBot(config);
