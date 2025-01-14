import * as mf from "mineflayer";

export default class Mod_ChatCommands {

  /**
   * @param {Bot} bot 
   */
  constructor(bot) {
    bot.on("chat", (...args) => this.handleMessage(...args));
  }

  /**
   * @type {BotEvents["chat"]}
   */
  async handleMessage(username, message, translate, jsonMsg, matches) {
    console.log(`Получил сообщение: <${username}> ${message}`);
  }
}
