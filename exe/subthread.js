import { createMinecraftAssistantBot } from "../dist/lib/init_bot.js";
createMinecraftAssistantBot(JSON.parse(process.env.BOT_CONFIGURATION));
