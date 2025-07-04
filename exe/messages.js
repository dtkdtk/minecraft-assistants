export const en = {
  localeKey: "en",
  localeName: "English",
  configFile_General: (cfg, stringifyValue) => ""
    + `; minecraft-assistants configuration file\n`
    + `; NOTE: This file is auto-generated. Unnecessary properties & your comments\n`
    + `; will be automatically deleted\n`
    + `\n`
    + `[General]\n`
    + `\n`
    + `; Do not edit manually!\n`
    + `project_version = ${stringifyValue(cfg.project_version)}\n`
    + `\n`
    + `; Supported languages:\n`
    + `; - 'EN' (English)\n`
    + `; - 'RU' (Russian)\n`
    + `language = ${stringifyValue(cfg.language)}\n`
    + `\n`
    + `; [FOR DEVELOPERS] Enable debug information\n`
    + `enable_debug = ${stringifyValue(cfg.enable_debug)}\n`
    + `\n`
    + `; Server IP-address (e.g. minecraft-server.play or 127.0.0.1:12345)\n`
    + `; Can be set for each bot separately (properties in bots are always more prioritized)\n`
    + `server_ip = ${stringifyValue(cfg.server_ip)}\n`
    + `\n`
    ,
  configFile_Bot: (cfg, sectionTitle, stringifyValue) => ""
    + `\n`
    + `\n`
    + `[${sectionTitle}]\n`
    + `\n`
    + `; Bot's nickname IN GAME\n`
    + `nickname = ${stringifyValue(cfg.nickname)}\n`
    + `\n`
    + `; Authentication method. Supported methods:\n`
    + `; - 'unofficial' (sometimes called 'offline' or 'pirate')\n`
    + `; - <microsoft & mojang are in development>\n`
    + `authentication = ${stringifyValue(cfg.authentication)}\n`
    + `\n`
    + `; See [General] section\n`
    + `; This is AN OPTIONAL override for the 'server_ip' property\n`
    + `; If you want to use value from [General] section, set this property value to 'null'\n`
    + `server_ip = ${stringifyValue(cfg.server_ip)}\n`
    + `\n`
    ,
  yes: "yes",
  no: "no",
  startupMsg: "minecraft-assistants :: Starting the bot...",
  errors: {
    baseForm: (message, errorDetailedInfo) => ""
      + "\u274C ERROR :: " + message + "\n////////////////////"
      + "\nDetailed error information:\n\t" + errorDetailedInfo,
    fs: {
      createConfigFile: (fileName) => `(File System) Cannot create '${fileName}' file in the current directory.`,
      readConfigFile: (fileName) => `(File System) Cannot read '${fileName}' file in the current directory.`,
    },
  },
  questions: {
    General: {
      language: "What's your language?",
    },
    Bot: {
      nickname: "Please enter the bot's nickname:\n    (allowed only A-Z letters, numbers and underscore)",
    },
    General_AND_OR_Bot: {
      server_ip: "Please enter the server IP-address:\n    (e.g. minecraft-server.play or 127.0.0.1:12345)",
    },
  },
};
