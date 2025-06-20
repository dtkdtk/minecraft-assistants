import type Brain from "../brain.js";

const MODULE_NAME = "Mod_ChatCommands";

export default class Mod_ChatCommands {

  constructor(private readonly B: Brain) {
    B.bot.on("chat", this.handleMessage.bind(this));
  }

  async handleMessage(username: string, message: string) {
    
  }

  private parseBotInstruction(username: string, message: string) {}
}
