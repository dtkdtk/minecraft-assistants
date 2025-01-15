import * as mf from "mineflayer";

export default class Mod_ChatCommands {

  constructor(bot: Bot) {
    bot.on("chat", (...args) => this.handleMessage(...args));
  }

  handleMessage: BotEvents["chat"] = async function(username, message, translate, jsonMsg, matches) {
    console.log(`Получил сообщение: <${username}> ${message}`);
  }
}
