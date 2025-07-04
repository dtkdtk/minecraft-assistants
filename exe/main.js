/* Production code; no minimization / compilation */
/* This is the entry point for minecraft-assistants application */

import { createMinecraftAssistantBot } from "../dist/init_bot.js";
import libIni from "ini";
import libFs from "fs";
import { styleText } from "util";
import { join as joinPath } from "path";

const CONFIG_FILE_PATH = joinPath(".", "configuration.conf");
const DEFAULT_CONFIGURATION_DATA = "" +
  "; minecraft-assistants configuration file\n" +
  "project-version = 1 ;Do not delete/modify this line!\n" +
  "prop = 123"
;

console.log("minecraft-assistants :: Starting the bot...");



/* CONFIGURATION FILE READING & VALIDATION */

let configurationFile;

try {
  if (!libFs.existsSync(CONFIG_FILE_PATH))
    libFs.writeFileSync(CONFIG_FILE_PATH, DEFAULT_CONFIGURATION_DATA, { encoding: "utf-8" });
}
catch (err) {
  logError("(File System) Cannot create 'configuration.conf' file in the current directory.", err);
  process.exit(-1);
}

try {
  configurationFile = libFs.readFileSync(CONFIG_FILE_PATH, { encoding: "utf-8" });
}
catch (err) {
  logError("(File System) Cannot read 'configuration.conf' file in the current directory.", err);
  process.exit(-1);
}

let configuration = libIni.parse(configurationFile); //does not throw errors

//createMinecraftAssistantBot();



/** Validate config & cast value types */
function handleConfiguration(config) {
  const bakedCfg = {};
  bakedCfg
}



/* UTILITY FUNCTIONS */

function logError(message, errorObject = undefined) {
  const errorDetailedInfo = errorObject ? (errorObject.toString().split("\n").join("\n\t")) : "<no-data>";
  console.error(styleText(["redBright", "bold"],
    "ERROR :: " + message + "\n////////////////////" +
    "\nDetailed error information:\n\t" + errorDetailedInfo
  ));
}
