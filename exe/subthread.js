import { createMinecraftAssistantBot } from "../dist/init_bot.js";
createMinecraftAssistantBot(JSON.parse(process.env.BOT_CONFIGURATION));
