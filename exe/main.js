/* Production code; no minimization / compilation */
/* This is the entry point for minecraft-assistants application */

import { createMinecraftAssistantBot } from "../dist/init_bot.js";
import libIni from "ini";
import libFs from "fs";
import libReadline from "readline/promises";
import libChalk from "chalk";
import { join as joinPath } from "path";
import * as allLocales from "./messages.js";
import chalk from "chalk";

const CURRENT_VERSION = "0.1.0";

let locale = allLocales.en;
const rl = libReadline.createInterface({ input: process.stdin, output: process.stdout });

const CONFIGURATION_FILE_NAME = "configuration.conf";
const CONFIGURATION_FILE_PATH = joinPath(".", CONFIGURATION_FILE_NAME);
const DEFAULT_CONFIGURATION_DATA = () => ''
const CONFIGURATION_FORMAT_VERSIONS = ["0.1.0"]; //Minimum versions with major changes in the config format; first = oldest
const CONFIGURATION_DEFAULTS = {
  "0.1.0": () => ({
    section_general: {
      project_version: {
        cast: Cast_String,
        value: CURRENT_VERSION,
        required: false, //if missing, this property will be added automatically
      },
      language: {
        cast: Cast_String,
        value: "en",
        required: true,
      },
      enable_debug: {
        cast: Cast_HumanBoolean,
        value: false,
        required: false,
      },
    },
    section_bot: {
      nickname: {
        cast: Cast_String,
        value: "Assistant",
        required: true,
      },
      authentication: {
        cast: Cast_String,
        value: "unofficial",
        required: false,
      },
    },
    section_general_AND_OR_bot: {
      server_ip: {
        cast: Cast_String,
        value: null,
        required: true,
      },
    },
  }),
};
CONFIGURATION_DEFAULTS.latest = CONFIGURATION_DEFAULTS[CONFIGURATION_FORMAT_VERSIONS.at(-1)];





async function __MAIN__() {

  /* PREPARING */
  console.log("minecraft-assistants :: Preparing...");

  if (!libFs.existsSync(CONFIGURATION_FILE_PATH)) {
    console.log("\n///// LANGUAGE SETUP /////\n" +
      "Welcome to minecraft-assistants!\n" +
      "Please select your language:\n" +
      "- EN (English) [default]\n" +
      "- RU (Русский)"
    );
    while (true) {
      const selectedLocale = (await rl.question("> ")).toLowerCase();
      if (!Object.keys(allLocales).includes(selectedLocale)) {
        console.log(`Language '${selectedLocale}' not found!\n` +
          `Available languages: ` +
          Object.keys(allLocales).map(X => X.toUpperCase()).join(", ") +
          `\nPlease select your language.`
        );
        continue;
      }
      locale = allLocales[selectedLocale];
      break;
    }
  }

  /* CONFIGURATION FILE READING & VALIDATION */
  let configurationFile;

  try {
    if (!libFs.existsSync(CONFIGURATION_FILE_PATH))
      libFs.writeFileSync(CONFIGURATION_FILE_PATH, DEFAULT_CONFIGURATION_DATA(), { encoding: "utf-8" });
  }
  catch (err) {
    logError(locale.errors.fs.createConfigFile(CONFIGURATION_FILE_NAME), err);
    process.exit(-1);
  }

  try {
    configurationFile = libFs.readFileSync(CONFIGURATION_FILE_PATH, { encoding: "utf-8" });
  }
  catch (err) {
    logError(locale.errors.fs.readConfigFile(CONFIGURATION_FILE_NAME), err);
    process.exit(-1);
  }

  let configuration = libIni.parse(configurationFile) ?? {}; //does not throw errors
  configuration = handleConfiguration(configuration);

  console.log(locale.startupMsg);

  console.log(configuration);
  //createMinecraftAssistantBot();
}





/** Validate config & cast value types. May ask additional questions */
async function handleConfiguration(config = {}) {
  const bakedCfg = {};
  const format = {
    "0.1.0": async () => {
      const VERSION = "0.1.0";

      //scope: General
      config.General ??= {};
      for (const [defKey, {cast, value: defValue, required}] of [
        ...Object.entries(CONFIGURATION_DEFAULTS[VERSION]().section_general),
        ...Object.entries(CONFIGURATION_DEFAULTS[VERSION]().section_general_AND_OR_bot)]
      ) {
        let casted = cast(config.General[defKey]);
        while (casted === null && required) {
          casted = await rl.question("\n" +
            (locale.questions.General[defKey]
              ?? locale.questions.General_AND_OR_Bot[defKey]) +
            "\n> "
          );
        }
        bakedCfg[defKey] = casted === null ? defValue : casted;
      }

      //scope: Bot
      for (const botKey of Object.keys(config).filter(K => K.startsWith("Bot:"))) {
        const botCfg = config[botKey] ?? {};
        for (const [defKey, {cast, value: defValue}, required]
          of Object.entries(CONFIGURATION_DEFAULTS[VERSION]().section_bot)
        ) {
          let casted = cast(botCfg[defKey]);
          while (casted === null && required) {
            casted = await rl.question("\n" + locale.questions.Bot[defKey] + "\n> ");
          }
          bakedCfg[defKey] = casted === null ? defValue : casted;
        }
        for (const [defKey, {cast}]
          of Object.entries(CONFIGURATION_DEFAULTS[VERSION]().section_general_AND_OR_bot)
        ) {
          let casted = cast(botCfg[defKey]);
          if (casted === null) continue;
          bakedCfg[defKey] = casted;
        }
        bakedCfg[botKey] = botCfg;
      }
    },
  };
  format.latest = format[CONFIGURATION_FORMAT_VERSIONS.at(-1)];

  const version = resolveMinimumVersion(config.project_version);
  if (!version) return null;

  const selectedLocale = config.language;
  if (!Object.keys(allLocales).includes(selectedLocale))
    locale = allLocales.en;
  else
    locale = allLocales[selectedLocale];

  await format[version]();
  return bakedCfg;
}





/* UTILITY FUNCTIONS */

function Cast_HumanBoolean(X) {
  return (X?.toLowerCase() == "true") ? true : (X?.toLowerCase() == "false") ? false : null;
}
function Cast_String(X) {
  return (X !== undefined && X !== "") ? String(X) : null;
}

class MissingConfigurationPropertyError extends Error {
  constructor(propertyName) {
    super();
  }
}

function logError(message, errorObject = undefined) {
  const errorDetailedInfo = errorObject ? (errorObject.toString().split("\n").join("\n\t")) : "<no-data>";
  console.error(chalk.redBright(locale.errors.baseForm(message, errorDetailedInfo)));
}

function resolveMinimumVersion(versionString = undefined) {
  if (versionString === undefined) return null;
  if (!/^\d+\.\d+\.\d+$/.test(versionString)) return null;
  const version = versionString.split(".");
  for (const cmpVersionString of [...CONFIGURATION_FORMAT_VERSIONS].reverse()) {
    const cmpVersion = cmpVersionString.split(".");
    const matches = cmpVersion.map((_, i) => version[i] > cmpVersion[i] ? 2 : version[i] == cmpVersion[i] ? 1 : 0);

    if (matches[0] > 1
      || (matches[0] == 1 && matches[1] > 1)
      || (matches[0] == 1 && matches[1] == 1 && matches[2] >= 1)
    ) return cmpVersionString;
  }
  return null;
}





__MAIN__();
rl.close();
