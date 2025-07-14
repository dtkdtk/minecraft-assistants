const configFile_supportedLanguages = ""
  + `; - 'EN' (English)\n`
  + `; - 'RU' (Русский)\n`
;

export const en = {
  localeKey: "en",
  localeName: "English",
  configFile: {
    General: (sect, stringifyValue) => ""
      + `; minecraft-assistants configuration file\n`
      + `; NOTE: This file is auto-generated. Unnecessary properties & your comments\n`
      + `; will be automatically deleted\n`
      + `\n`
      + `[General]\n`
      + `\n`
      + `; Do not edit manually!\n`
      + `project_version = ${stringifyValue(sect.project_version)}\n`
      + `\n`
      + `; Supported languages:\n`
      + configFile_supportedLanguages
      + `language = ${stringifyValue(sect.language)}\n`
      + `\n`
      + `; [FOR DEVELOPERS] Enable debug information\n`
      + `enable_debug = ${stringifyValue(sect.enable_debug)}\n`
      + `\n`
      ,
    EachBot: (sect, sectionTitle, stringifyValue) => ""
      + `\n`
      + `\n`
      + `[${sectionTitle}]\n`
      + `\n`
      + `; Bot's nickname IN GAME\n`
      + `nickname = ${stringifyValue(sect.nickname)}\n`
      + `\n`
      + `; Authentication method. Supported methods:\n`
      + `; - 'unofficial' (sometimes called 'offline' or 'pirate')\n`
      + `; - <microsoft & mojang are in development>\n`
      + `authentication = ${stringifyValue(sect.authentication)}\n`
      + `\n`
      + `; Server IP-address (e.g. minecraft-server.play or 127.0.0.1:12345)\n`
      + `server_ip = ${stringifyValue(sect.server_ip)}\n`
      + `\n`
      ,
    //Currently, AnyBot is not supported in the official build.
    /* AnyBot: (sect, sectionTitle, stringifyValue) => ""
      + `\n`
      + `\n`
      + `; Default settings for ALL bots. Can be overridden for each bot separately.\n`
      + `[${sectionTitle}]\n`
      + `\n`
      + `; Authentication method. Supported methods:\n`
      + `; - 'unofficial' (sometimes called 'offline' or 'pirate')\n`
      + `; - <microsoft & mojang are in development>\n`
      + `authentication = ${stringifyValue(sect.authentication)}\n`
      + `\n`
      + `; See [General] section\n`
      + `; This is AN OPTIONAL override for the 'server_ip' property\n`
      + `; If you want to use value from [General] section, set this property value to 'null'\n`
      + `server_ip = ${stringifyValue(sect.server_ip)}\n`
      + `\n`
      ,
    */
  },
  yes: "yes",
  no: "no",
  enterYesOrNo: "Please enter YES or NO.",
  startupMsg: "minecraft-assistants :: Starting the bot...",
  errors: {
    baseForm: (message, errorDetailedInfo) => ""
      + "\u274C ERROR :: " + message + "\n////////////////////\n"
      + errorDetailedInfo,
    fs: {
      createConfigFile: (fileName) => `(File System) Cannot create '${fileName}' file in the current directory.`,
      readConfigFile: (fileName) => `(File System) Cannot read '${fileName}' file in the current directory.`,
    },
    recreatingConfigFile: "\u26A0\uFE0F  'configuration.conf' file contains INI-syntax errors,\n"
      + "or the 'project_version' property is missing.\n"
      + "Delete the configuration file and recreate it with default settings?",
    abortRecreatingConfigFile: "You aborted recreation of the 'configuration.conf' file.\n"
      + "Fix errors by yourself and re-launch the bot again.",
    configAdaption: (propName, propRawValue, sectName, stringifyValue) => [
      "Invalid configuration property value!",
      `  Section name: [${sectName}]\n`
      + `  Property:\n`
      + `    ${propName} = ${stringifyValue(propRawValue)}\n`
      + `  Please make sure you have set the correct property value.`
    ],
  },
  questions: {
    General: {
      language: "What's your language?",
    },
    EachBot: {
      nickname: "Please enter the bot's nickname:\n    (allowed only A-Z letters, numbers and underscore)",
    },
    AnyBot: {
      server_ip: "Please enter the server IP-address:\n    (e.g. minecraft-server.play or 127.0.0.1:12345)",
    },
  },
};
