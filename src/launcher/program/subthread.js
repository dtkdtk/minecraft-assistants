import { existsSync } from "fs";
import { pathToFileURL } from "url";

const bundlePath = process.env.MCA_ENTRY_PATH;
if (!existsSync(bundlePath))
  throw new Error("MCA entry file does not exist (path: '" + bundlePath + "')");

const bundleModule = await import(pathToFileURL(bundlePath));
if (typeof bundleModule?.createMinecraftAssistantBot != "function")
  throw new TypeError("MCA entry file doesn't have exported function 'createMinecraftAssistantBot' (path: '" + bundlePath + "')");

bundleModule.createMinecraftAssistantBot(JSON.parse(process.env.BOT_CONFIGURATION));
