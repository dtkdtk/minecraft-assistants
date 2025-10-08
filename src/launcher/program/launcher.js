#!/usr/bin/env node
/* Production code; no minimization / compilation 
This is the entry point for minecraft-assistants application */

import libIni from "ini";
import libFs from "fs";
import libReadline from "readline/promises";
import libChalk from "chalk";
import libCp from "child_process";
import { join as joinPath, parse as parsePath } from "path";
import { format as formatString } from "util";
import * as allLocales from "./messages.js";
import availableMcVersions from "./available-mc-versions.json" with {type:"json"};

const CURRENT_VERSION = "0.3.0";
const CONFIGURATION_FORMAT_VERSIONS = ["0.1.0"]; //Minimum versions with breaking changes in the config format; first = oldest

const rl = libReadline.createInterface({ input: process.stdin, output: process.stdout });
let locale = allLocales.en;

const kAdaptionError = Symbol();
const kNeedReSave = Symbol(); //Need to re-save configuration file

//#region Constants: Paths
const CONFIGURATION_FILE_NAME = process.env.CONFIGURATION_FILE_NAME
  ?? "configuration.conf";

const CONFIGURATION_FILE_PATH = process.env.CONFIGURATION_FILE_PATH
  ?? joinPath(process.cwd(), CONFIGURATION_FILE_NAME);

const SUBTHREAD_PATH = process.env.SUBTHREAD_PATH
  ?? joinPath(process.cwd(), "program", "subthread.js");

const MCA_ENTRY_PATH = process.env.MCA_ENTRY_PATH
  ?? joinPath(process.cwd(), "program", "mca-bundle.cjs");

const INSTALLED_GAME_VERSIONS_STORE_PATH = process.env.INSTALLED_GAME_VERSIONS_STORE_PATH
  ?? joinPath(process.cwd(), "game-versions", "pc");
//#endregion

const BOT_SECTION_PREFIX = "Bot:";
const DEFAULT_BOT_NAME = BOT_SECTION_PREFIX + "Assistant_0";
const DEFAULT_CONFIGURATION_DATA = () => get_Default_Configuration_From_Schema(CURRENT_VERSION);



//#region Configuration schema

const CONFIGURATION_SCHEMES = {
  "0.1.0": () => ({
    section_general: {
      project_version: {
        cast: cast_String,
        value: CURRENT_VERSION,
        required: false, /* if missing, this property will be added automatically.
          We can't ask users for the project version (they don't know). */
        validate: undefined,
        getAvailableOptionsStr: undefined,
      },
      language: {
        cast: cast_String,
        value: "en",
        required: true,
        validate: (A) => Object.keys(allLocales).includes(A),
        getAvailableOptionsStr: undefined, //strange, but Yes.
      },
      enable_debug: {
        cast: cast_Nullable(cast_HumanBoolean),
        value: false,
        required: false,
        validate: undefined,
        getAvailableOptionsStr: undefined,
      },
      installed_game_versions: {
        cast: cast_ArrayOf(cast_String),
        value: [],
        required: false,
        validate: (A) => cast_HumanBoolean(A) !== null,
        getAvailableOptionsStr: undefined,
      },
    },
    section_each_bot: {
      nickname: {
        cast: cast_String,
        value: DEFAULT_BOT_NAME,
        required: true,
        validate: undefined,
        getAvailableOptionsStr: undefined,
      },
    },
    section_any_bot: {
      authentication: {
        cast: cast_Nullable(cast_String),
        value: "unofficial",
        required: false,
        validate: undefined,
        getAvailableOptionsStr: undefined,
      },
      server_ip: {
        cast: cast_Nullable(cast_String),
        value: null,
        required: true,
        validate: undefined,
        getAvailableOptionsStr: undefined,
      },
      game_version: {
        cast: cast_Nullable(cast_String),
        value: null,
        required: true,
        validate: isValidGameVersion,
        getAvailableOptionsStr: () => toColumnsList(getAvailableGameVersions_WithSize().map(X => X.padEnd(40)), 3).join("\n"),
      },
    },
  }),
};

const CONFIGURATION_ADAPTION_MAP = {
  "0.1.0": () => ({
    auth: (cfg, botKey) => {
      let V = cfg[botKey].authentication;
      V = V == "unofficial" ? "offline"
        : kAdaptionError;
      if (V === kAdaptionError) {
        logUnexpectedError(...locale.errors.configAdaption(
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
        logUnexpectedError(...locale.errors.configAdaption(
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
        logUnexpectedError(...locale.errors.configAdaption(
          "server_ip", ip, botKey, stringifyConfigValue
        ));
        process.exit(-1);
      }
      else return V;
    },
    version: (cfg, botKey) => {
      let V = cfg[botKey].game_version;
      return V;
    },
    enableDebug: (cfg) => {
      let V = cfg.General.enable_debug;
      return V;
    },
  }),
};

//#endregion










async function __MAIN__() {
  console.log("minecraft-assistants  Copyright (C) 2025  dtkdtk0 <dtkdtk0.mail@gmail.com>");

  let configuration = await loadConfiguration();
  console.log(locale.startupMsg);

  const allBotKeys = Object.keys(configuration).filter(X => X.startsWith(BOT_SECTION_PREFIX));
  if (allBotKeys.length == 1)
    await startSingleBot(configuration);
  else
    await startMultiBot(configuration);
}










//#region Configuration handling

async function loadConfiguration() {
  let configurationFile;
  if (!libFs.existsSync(CONFIGURATION_FILE_PATH)) {
    const configData = DEFAULT_CONFIGURATION_DATA();
    const selectedLocaleCode = await sendQuestion("language", (answer) => Object.keys(allLocales).includes(answer.toLowerCase()));
    locale = allLocales[selectedLocaleCode.toLowerCase()];
    configData.General.language = selectedLocaleCode.toLowerCase();
    configurationFile = stringifyConfiguration(configData);
    saveConfigFile(configData);
  }
  else configurationFile = readConfigFile();
  

  let configuration = libIni.parse(configurationFile) ?? {}; //does not throw errors
  preHandleConfiguration(configuration);
  configuration = await handleConfiguration(configuration);

  if (configuration === null) //invalid configuration
    configuration = await recreateConfiguration();

  await handleGameVersions(configuration);

  if (configuration[kNeedReSave] === true)
    saveConfigFile(configuration);

  return configuration;
}

function preHandleConfiguration(configuration) {
  const language = configuration.Global?.language;
  if (language && Object.keys(allLocales).includes(language))
    locale = allLocales[language];
  else
    locale = allLocales.en;
}

/** Validate config & cast value types. May ask additional questions */
async function handleConfiguration(rawConfig = {}) {
  const format = {
    "0.1.0": async () => {
      const VERSION = "0.1.0";
      const bakedCfg = {};

      for (const sectionKey of Object.keys(rawConfig)) {
        const section = rawConfig[sectionKey] ?? {};
        bakedCfg[sectionKey] ??= {};
        for (const [propKey, {cast, value: defValue, required, validate, getAvailableOptionsStr}]
          of getSectionPropsSchemaEntries(sectionKey, CONFIGURATION_SCHEMES[VERSION]())
        ) {
          let casted = cast(section[propKey]);
          if (casted === null && required) {
            bakedCfg[kNeedReSave] = true;
            const answer = await sendQuestion(
              propKey,
              (A) => (required ? cast(A) !== null : true) && (validate ? validate(A) : true),
              getAvailableOptionsStr ? [getAvailableOptionsStr()] : [],
              () => (saveConfigFile(bakedCfg), process.exit(0)),
            );
            casted = cast(answer);
          }
          bakedCfg[sectionKey][propKey] = casted === null ? defValue : casted;
        }
        /*for (const [defKey, {cast}]
          of Object.entries(CONFIGURATION_SCHEMES[VERSION]().section_any_bot)
        ) {
          let casted = cast(botCfg[defKey]);
          if (casted === null) continue;
          bakedCfg[botKey][defKey] = casted;
        }*/
      }
      return bakedCfg;
    },
  };
  

  const version = resolveMinimumConfigVersion(rawConfig.General.project_version);
  if (!version || !rawConfig.General.language) return null; //invalid configuration
  const bakedCfg = await format[version]();

  return bakedCfg;
}

async function recreateConfiguration() {
  const answer = (
    await sendQuestion(
      "recreateConfigFile",
      (A) => [locale.yes, locale.no].includes(A.toLocaleLowerCase()),
      [locale.yes, locale.no]
    )
  ).toLocaleLowerCase();

  if (answer == locale.yes) {
    return {...DEFAULT_CONFIGURATION_DATA(), [kNeedReSave]: true};
  }
  else if (answer == locale.no) {
    console.log(locale.errors.abortRecreatingConfigFile);
    process.exit(0);
  }
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

function getSectionPropsSchemaEntries(sectionName, schema) {
  if (sectionName == "General") return Object.entries(schema.section_general);
  else if (sectionName.startsWith(BOT_SECTION_PREFIX))
    return [...Object.entries(schema.section_each_bot), ...Object.entries(schema.section_any_bot)];
  else return [];
}

function get_Default_Configuration_From_Schema(version) {
  const minVersion = resolveMinimumConfigVersion(version);
  const configuration = { General: {}, [DEFAULT_BOT_NAME]: {} };
  for (const [propKey, {value}] of Object.entries(CONFIGURATION_SCHEMES[minVersion]().section_general)) {
    configuration.General[propKey] = value;
  }
  for (const [propKey, {value}] of [
    ...Object.entries(CONFIGURATION_SCHEMES[minVersion]().section_any_bot),
    ...Object.entries(CONFIGURATION_SCHEMES[minVersion]().section_each_bot),
  ]) {
    configuration[DEFAULT_BOT_NAME][propKey] = value;
  }
  return configuration;
}

function adaptedConfigFrom(configuration, botSectionTitle) {
  const minVersion = resolveMinimumConfigVersion(configuration.General.project_version ?? CURRENT_VERSION);
  const adapter = CONFIGURATION_ADAPTION_MAP[minVersion]();
  const adaptedConfig = Object.fromEntries(
    Object.entries(adapter).map(([K, adapt]) => [K, adapt(configuration, botSectionTitle)])
  );
  Object.assign(adaptedConfig, {
    interactiveCli: true,
  });
  return adaptedConfig;
}

function saveConfigFile(configuration) {
  try {
    libFs.writeFileSync(CONFIGURATION_FILE_PATH, stringifyConfiguration(configuration), { encoding: "utf-8" });
  }
  catch (err) {
    logUnexpectedError(locale.errors.fs.createConfigFile(CONFIGURATION_FILE_NAME), err);
    process.exit(-1);
  }
}

function readConfigFile() {
  try {
    return libFs.readFileSync(CONFIGURATION_FILE_PATH, { encoding: "utf-8" });
  }
  catch (err) {
    logUnexpectedError(locale.errors.fs.readConfigFile(CONFIGURATION_FILE_NAME), err);
    process.exit(-1);
  }
}

function resolveMinimumConfigVersion(versionString = undefined) {
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

//#endregion










//#region Game version handling

async function handleGameVersions(configuration) {
  let needInstallVersions = [];
  for (const botKey of Object.keys(configuration).filter(K => K.startsWith(BOT_SECTION_PREFIX))) {
    const botCfg = configuration[botKey] ?? {};
    if (!isValidGameVersion(botCfg.game_version)) {
      logError(locale.questions.error.game_version(botCfg.game_version));
      const newVersion = await sendQuestion(
        "game_version",
        isValidGameVersion,
        [toColumnsList(getAvailableGameVersions_WithSize().map(X => X.padEnd(40)), 3)],
        () => (saveConfigFile(configuration), process.exit(0)),
      );
      needInstallVersions.push(newVersion);
      botCfg.game_version = newVersion;
      saveConfigFile(configuration);
    }
    if (!configuration.General.installed_game_versions.includes(botCfg.game_version))
      needInstallVersions.push(botCfg.game_version);
  }
  if (needInstallVersions.length) {
    configuration.General.installed_game_versions.push(...needInstallVersions);
    await Promise.all(needInstallVersions.map(installGameVersion));
    configuration[kNeedReSave] = true;
  }
}

function _get_Game_Versions_Repository_Path() {
  let path = process.cwd();
  while (parsePath(path).root != path) {
    const maybeRepoPath = joinPath(path, "node_modules", "minecraft-data", "minecraft-data", "data", "pc");
    if (libFs.existsSync(maybeRepoPath)) return maybeRepoPath;
    path = joinPath(path, "..");
  }
  throw new Error("(DEVELOPER ERROR) Cannot find 'minecraft-data' node module!"
    + "\nIt is needed to install game versions (currently, the Internet version of repository is not available)");
}

async function installGameVersion(version, force = false) {
  //TODO: www file downloading
  //TODO: checksum validation
  const destinationDir = joinPath(INSTALLED_GAME_VERSIONS_STORE_PATH, version);
  if (libFs.existsSync(destinationDir) && !force) return;
  else libFs.cpSync(joinPath(_get_Game_Versions_Repository_Path(), version), destinationDir, { recursive: true });
}

function getAvailableGameVersions_WithSize() {
  const versions = [];
  for (let i = 0; i < availableMcVersions.length; i++) {
    const {version, sizeMB} = availableMcVersions[i];
    versions.push(`${version} [${sizeMB} MB]`);
  }
  return versions;
}

function isValidGameVersion(version) {
  return availableMcVersions.some(V => V.version == version);
}

//#endregion










//#region Bootstrap of Core

async function startSingleBot(configuration) {
  const botKey = Object.keys(configuration).filter(X => X.startsWith(BOT_SECTION_PREFIX))[0];
  const adapted = adaptedConfigFrom(configuration, botKey);
  const thread = libCp.fork(
    SUBTHREAD_PATH,
    {
      stdio: "inherit",
      env: {
        BOT_CONFIGURATION: JSON.stringify(adapted),
        MCA_ENTRY_PATH: MCA_ENTRY_PATH,
      },
      execArgv: configuration.General.enable_debug ? [] : ["--no-deprecation"],
    },
  );
  thread.once("exit", () => { process.exit(0) });
}

async function startMultiBot(configuration) {
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

//#endregion










//#region Utility & Auxiliary functions

async function sendQuestion(questionKey, validateFn, promptFormatArgs = [], onAbort = undefined) {
  const questionText = locale.questions.text[questionKey],
    questionPrompt = locale.questions.prompt[questionKey],
    questionError = locale.questions.error[questionKey];
  if (questionText) console.log(questionText);
  if (questionPrompt) console.log(formatString(questionPrompt, ...promptFormatArgs));
  while (true) {
    const answer = (await rl.question("> ").catch(() => onAbort ? onAbort() : process.exit(0)));
    if (validateFn && !validateFn(answer)) {
      if (questionError) logError(questionError(answer));
      if (questionPrompt) console.log(formatString(questionPrompt, ...promptFormatArgs));
    }
    else return answer;
  }
}

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
function cast_ArrayOf(cast_Element) {
  return (X) => (X
    .replace(/(^\[)|(\]$)/g, "")
    .split(/(?<!\\),/)
    .map(A => A.replace(/\\,/g, ","))
    .map(A => A.replace(/\\\\/g, "\\"))
    .map(A => A.trim())
    .filter(A => A != "")
    .map(cast_Element)
  )
}

function stringifyConfigValue(X) {
  if (typeof X == "boolean" || typeof X == "number") {
    return String(X);
  }
  else if (typeof X == "string") {
    return libIni.safe(X);
  }
  else if (Array.isArray(X)) {
    return "[" + X.map(stringifyConfigValue).map(V => V?.replace(/,/g, "\\,")).join(", ") + "]";
  }
  else if (typeof X == "undefined" || X === null) {
    return "null";
  }
  else return String(X); //fallback
}

function toColumnsList(items, columnCount) {
  const colHeight = Math.ceil(items.length / columnCount);
  const output = items.slice(0, colHeight);
  for (let curCol = 2; curCol <= columnCount; curCol++)
    for (let i = 0; i < colHeight; i++)
      output[i] += items[i + colHeight * (curCol - 1)] ?? '';
  return output;
}

function logError(message) {
  console.error(libChalk.redBright(message));
}

function logUnexpectedError(message, errorObjectOrText = undefined) {
  const errorDetailedInfo = (errorObjectOrText instanceof Error)
    ? "Detailed information: (FOR DEVELOPERS)\n  "
      + (errorObjectOrText.stack || errorObjectOrText).split("\n").join("    \n")
    : (errorObjectOrText ?? "")
  logError(locale.errors.unexpected(message, errorDetailedInfo));
}

//#endregion










__MAIN__().then(() => rl.close());
