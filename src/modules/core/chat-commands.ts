export default class Mod_ChatCommands {

  constructor(bot: Bot) {
    bot.on("chat", this.handleMessage.bind(this));
  }

  async handleMessage(username: string, message: string) {
    console.log(`Получил сообщение: <${username}> ${message}`);
  }
}
