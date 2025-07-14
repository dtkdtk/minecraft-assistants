/* Production code; no minimization / compilation 
  This is the entry point for minecraft-assistants application */

import { createMinecraftAssistantBot } from "../dist/init_bot.js";
import libIni from "ini";
import libFs from "fs";
import libReadline from "readline/promises";
import libChalk from "chalk";
import libCp from "child_process";
import { join as joinPath } from "path";
import * as allLocales from "./messages.js";

const CURRENT_VERSION = "0.2.0";

let locale = allLocales.en;
const rl = libReadline.createInterface({ input: process.stdin, output: process.stdout });

const CONFIGURATION_FILE_NAME = "configuration.conf";
const CONFIGURATION_FILE_PATH = joinPath(".", CONFIGURATION_FILE_NAME);
const DEFAULT_CONFIGURATION_DATA = () => stringifyConfiguration(get_Default_Configuration_From_Schema(CURRENT_VERSION));
const CONFIGURATION_FORMAT_VERSIONS = ["0.1.0"]; //Minimum versions with major changes in the config format; first = oldest
const CONFIGURATION_SCHEMES = {
  "0.1.0": () => ({
    section_general: {
      project_version: {
        cast: cast_String,
        value: CURRENT_VERSION,
        required: false, /* if missing, this property will be added automatically.
          We can't ask users for the project version (they don't know). */
      },
      language: {
        cast: cast_String,
        value: "en",
        required: true,
      },
      enable_debug: {
        cast: cast_Nullable(cast_HumanBoolean),
        value: false,
        required: false,
      },
    },
    section_each_bot: {
      nickname: {
        cast: cast_String,
        value: "Assistant_0",
        required: true,
      },
    },
    section_any_bot: {
      authentication: {
        cast: cast_Nullable(cast_String),
        value: "unofficial",
        required: false,
      },
      server_ip: {
        cast: cast_Nullable(cast_String),
        value: null,
        required: true,
      },
    },
  }),
};
CONFIGURATION_SCHEMES.latest = CONFIGURATION_SCHEMES[CONFIGURATION_FORMAT_VERSIONS.at(-1)];
const kAdaptionError = Symbol();
const CONFIGURATION_ADAPTION_MAP = {
  "0.1.0": () => ({
    auth: (cfg, botKey) => {
      let V = cfg[botKey].authentication;
      V = V == "unofficial" ? "offline"
        : kAdaptionError;
      if (V === kAdaptionError) {
        logError(...locale.errors.configAdaption(
          "authentication", cfg[botKey].authentication, botKey, stringifyConfigValue
        ));
        process.exit(-1);
      }
      else return V;
    },
    username: (cfg, botKey) => {
      let V = cfg[botKey].nickname;
      return V;
    },
    host: (cfg, botKey) => {
      let V = cfg[botKey].server_ip;
      V = (V ?? "").split(":")[0];
      if (V == "") {
        logError(...locale.errors.configAdaption(
          "server_ip", cfg[botKey].server_ip, botKey, stringifyConfigValue
        ));
        process.exit(-1);
      }
      else return V;
    },
    port: (cfg, botKey) => {
      let ip = cfg[botKey].server_ip;
      let rawPort = (ip ?? "").split(":")[1];
      let V = Number(rawPort ?? 25565);
      if (isNaN(V)) {
        logError(...locale.errors.configAdaption(
          "server_ip", ip, botKey, stringifyConfigValue
        ));
        process.exit(-1);
      }
      else return V;
    },
    enableDebug: (cfg, botKey) => {
      let V = cfg.General.enable_debug;
      return V;
    },
  }),
};
CONFIGURATION_ADAPTION_MAP.latest = CONFIGURATION_ADAPTION_MAP[
  CONFIGURATION_FORMAT_VERSIONS.at(-1)
];
const BOT_SECTION_PREFIX = "Bot:";





async function __MAIN__() {

  /* PREPARING */
  console.log("minecraft-assistants :: Preparing...");

  if (!libFs.existsSync(CONFIGURATION_FILE_PATH))
    await setupLanguage();

  let configuration = await handleConfiguration();
  console.log(locale.startupMsg);

  /* STARTING THE BOT PROCESS */
  const allBotKeys = Object.keys(configuration).filter(X => X.startsWith(BOT_SECTION_PREFIX));
  if (allBotKeys.length == 1) {
    /* Single-bot mode.
      Stdio + window: inherit
      Multi-bot management: off  
    */
    const botKey = allBotKeys[0];
    const adapted = adaptedConfigFrom(configuration, botKey);
    const thread = libCp.fork(
      joinPath(".", "subthread.js"),
      { stdio: "inherit", env: { BOT_CONFIGURATION: JSON.stringify(adapted) } },
    );
    thread.once("exit", (exitCode) => { process.exit(0) });
  }
  else {
    /* Multi-bot mode.
      Stdio + window: separate for each bot
      Multi-bot management: on (but WIP)  
    */
    for (const botKey of allBotKeys) {
      /*const adapted = adaptedConfigFrom(configuration, botKey);
      const thread = libCp.exec("node ./subthread.js", {
        env: { BOT_CONFIGURATION: JSON.stringify(adapted) },
        shell: true
      });

      thread.on("error", (error) => {
        //TODO
      });*/
    }
  }
}





async function setupLanguage() {
  console.log("\n///// LANGUAGE SETUP /////\n"
    + "Welcome to minecraft-assistants!\n"
    + "Please select your language:\n"
    + getAvailableLocales()
  );
  while (true) {
    const selectedLocale = (await rl.question("> ").catch(() => process.exit(0))).toLowerCase();
    if (!Object.keys(allLocales).includes(selectedLocale)) {
      console.log(`\nLanguage '${selectedLocale}' not found!\n`
        + "Available languages: \n"
        + getAvailableLocales()
        + "\nPlease select your language."
      );
      continue;
    }
    locale = allLocales[selectedLocale];
    break;
  }
}

const kNeedReSave = Symbol("kNeedReSave"); //Need to re-save configuration file

async function handleConfiguration() {
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
  configuration = await parseConfiguration(configuration);

  if (configuration === null) {
    console.log(locale.errors.recreatingConfigFile);
    while (true) {
      const answer = (await rl.question(locale.enterYesOrNo + "\n> ")
        .catch(() => process.exit(0))).toLowerCase();
      if (answer == "yes") {
        try {
          libFs.writeFileSync(CONFIGURATION_FILE_PATH, DEFAULT_CONFIGURATION_DATA(), { encoding: "utf-8" });
        }
        catch (err) {
          logError(locale.errors.fs.createConfigFile(CONFIGURATION_FILE_NAME), err);
          process.exit(-1);
        }
        return await handleConfiguration();
      }
      else if (answer == "no") {
        console.log(locale.errors.abortRecreatingConfigFile);
        process.exit(0);
      }
      else continue;
    }
  }
  else if (configuration[kNeedReSave] === true) {
    try {
      libFs.writeFileSync(CONFIGURATION_FILE_PATH, stringifyConfiguration(configuration), { encoding: "utf-8" });
    }
    catch (err) {
      logError(locale.errors.fs.createConfigFile(CONFIGURATION_FILE_NAME), err);
      process.exit(-1);
    }
  }



  return configuration;
}

/** Validate config & cast value types. May ask additional questions */
async function parseConfiguration(config = {}) {
  const bakedCfg = {};
  const format = {
    "0.1.0": async () => {
      const VERSION = "0.1.0";

      //scope: Bot
      for (const botKey of Object.keys(config).filter(K => K.startsWith(BOT_SECTION_PREFIX))) {
        const botCfg = config[botKey] ?? {};
        bakedCfg[botKey] ??= {};
        for (const [defKey, {cast, value: defValue, required}] of [
          ...Object.entries(CONFIGURATION_SCHEMES[VERSION]().section_any_bot),
          ...Object.entries(CONFIGURATION_SCHEMES[VERSION]().section_each_bot),
        ]) {
          let casted = cast(botCfg[defKey]);
          while (casted === null && required) {
            bakedCfg[kNeedReSave] = true;
            casted = cast(await rl.question("\n"
              + (locale.questions.EachBot[defKey] ?? locale.questions.AnyBot[defKey])
              + "\n> "
            ).catch(() => process.exit(0)));
          }
          bakedCfg[botKey][defKey] = casted === null ? defValue : casted;
        }
        /*for (const [defKey, {cast}]
          of Object.entries(CONFIGURATION_SCHEMES[VERSION]().section_any_bot)
        ) {
          let casted = cast(botCfg[defKey]);
          if (casted === null) continue;
          bakedCfg[botKey][defKey] = casted;
        }*/
      }

      //scope: General
      config.General ??= {};
      bakedCfg.General ??= {};
      for (const [defKey, {cast, value: defValue, required}]
        of Object.entries(CONFIGURATION_SCHEMES[VERSION]().section_general)
      ) {
        let casted = cast(config.General[defKey]);
        while (casted === null && required) {
          bakedCfg[kNeedReSave] = true;
          casted = cast(await rl.question("\n" + locale.questions.General[defKey] + "\n> ")
            .catch(() => process.exit(0)));
        }
        bakedCfg.General[defKey] = casted === null ? defValue : casted;
      }
    },
  };
  format.latest = format[CONFIGURATION_FORMAT_VERSIONS.at(-1)];

  const version = resolveMinimumVersion(config.General.project_version);
  if (!version) return null;

  const selectedLocale = config.General.language;
  if (!Object.keys(allLocales).includes(selectedLocale))
    locale = allLocales.en;
  else
    locale = allLocales[selectedLocale];

  await format[version]();
  return bakedCfg;
}

function stringifyConfiguration(configuration) {
  const general = locale.configFile.General(configuration.General, stringifyConfigValue);
  const bots = [];
  for (const [key, section]
    of Object.entries(configuration).filter(([X]) => X.startsWith(BOT_SECTION_PREFIX))
  ) {
    bots.push(locale.configFile.EachBot(section, key, stringifyConfigValue));
  }
  return general + bots.join("\n");
}

function get_Default_Configuration_From_Schema(version) {
  const minVersion = resolveMinimumVersion(version);
  const configuration = { General: {}, ["Bot:Assistant_0"]: {} };
  for (const [defKey, {value}] of Object.entries(CONFIGURATION_SCHEMES[minVersion]().section_general)) {
    configuration.General[defKey] = value;
  }
  for (const [defKey, {value}] of [
    ...Object.entries(CONFIGURATION_SCHEMES[minVersion]().section_any_bot),
    ...Object.entries(CONFIGURATION_SCHEMES[minVersion]().section_each_bot),
  ]) {
    configuration["Bot:Assistant_0"][defKey] = value;
  }
  return configuration;
}

function adaptedConfigFrom(configuration, botSectionTitle) {
  const minVersion = resolveMinimumVersion(configuration.General.project_version ?? CURRENT_VERSION);
  const adapter = CONFIGURATION_ADAPTION_MAP[minVersion]();
  const adaptedConfig = Object.fromEntries(
    Object.entries(adapter).map(([K, adapt]) => [K, adapt(configuration, botSectionTitle)])
  );
  Object.assign(adaptedConfig, {
    interactiveCli: true,
  });
  return adaptedConfig;
}





/* UTILITY FUNCTIONS */

function cast_HumanBoolean(X) {
  X = String(X);
  return (X?.toLowerCase() == "true") ? true
    : (X?.toLowerCase() == "false") ? false
    : null;
}
function cast_String(X) {
  return (X !== undefined && X !== "") ? String(X) : null;
}
function cast_Nullable(cast_NonNullable) {
  return (X) => (X === "null" || X === null)
    ? null
    : cast_NonNullable(X);
}

function stringifyConfigValue(X) {
  if (typeof X == "boolean" || typeof X == "number") {
    return String(X);
  }
  else if (typeof X == "string") {
    return libIni.safe(X);
  }
  else if (typeof X == "undefined" || X === null) {
    return "null";
  }
  else return String(X); //fallback
}

function logError(message, errorDetails = undefined) {
  const errorDetailedInfo = (errorDetails instanceof Error)
    ? "Detailed information: (FOR DEVELOPERS)\n  "
      + (errorDetails.stack || errorDetails).split("\n").join("    \n")
    : (errorDetails ?? "")
  console.error(libChalk.redBright(locale.errors.baseForm(message, errorDetailedInfo)));
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

function getAvailableLocales() {
  return Object.values(allLocales).map(L => `  - ${L.localeKey.toUpperCase()} (${L.localeName})`).join("\n");
}





await __MAIN__();
rl.close();
