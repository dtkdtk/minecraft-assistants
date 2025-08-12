import { createMinecraftAssistantBot } from "../dist/core/init_bot.js";
createMinecraftAssistantBot(JSON.parse(process.env.BOT_CONFIGURATION));
