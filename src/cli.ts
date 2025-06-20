import Brain from "./ai/brain.js";
import { listenStatusMonitor } from "./control-panel/statusMonitor.js";

/**
 * Обрабатывает ввод с командной строки.
 * @returns infinity promise
 */
export function setupCommandLineInterface(brain: Brain): Promise<never> {
  return new Promise<never>(() => {
    sendWelcomeMessage(brain);
    sendPrompt();
    process.stdin.on("data", async (raw: Buffer) => {
      const input = raw.toString("utf-8");
      const command = input.split(/\s/)[0];
      if (!command) return sendPrompt();
      switch (command) {
        case "help": {
          console.log(`COMMAND LIST:`);
          console.log(` help :: Display command list & info`);
          console.log(` stat :: (alias: mon) Open live status monitor`);
          console.log(` quit :: (alias: exit) Stop the bot and close this window`);
          return sendPrompt();
        }
        case "mon":
        case "stat": {
          await listenStatusMonitor(brain);
          sendWelcomeMessage(brain);
          return sendPrompt();
        }
        case "exit":
        case "quit": {
          brain.exitProcess();
          return;
        }
        default: {
          console.log("Unknown command. Type 'help' to get command list");
          return sendPrompt();
        }
      }
    });
  });
}

function sendPrompt() {
  process.stdout.write("> ");
}
function sendWelcomeMessage(brain: Brain) {
  console.log(`Welcome to '${brain.bot.player.displayName}' assistant control panel`);
  console.log(`Type 'help' to get full command list & info`);
  console.log(`Type 'stat' or 'mon' to open live status monitor`);
  console.log(`Type 'quit' or 'exit' to stop the bot and close this window`);
}
