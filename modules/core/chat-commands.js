import * as mf from "mineflayer";
import { EventEmitter } from "events";

export default class Mod_ChatCommands extends EventEmitter{

  /**
   * @param {Bot} bot 
   */
  constructor(bot) {
    super()
    bot.on("chat", (...args) => this.handleMessage(...args));
  }

  /**
   * @type {BotEvents["chat"]}
   */
  async handleMessage(username, message, translate, jsonMsg, matches) {
    console.log(`Получил сообщение: <${username}> ${message}`);

    this.emit("Got_command", { username, message });

  }
}
