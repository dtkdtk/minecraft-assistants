import Brain from "../ai/brain.js";
import { StatusMonitor } from "./status_monitor.js";
import { sendWelcomeMessage, sendBasicPrompt } from "./terminal_ui.js";

/**
 * Обрабатывает ввод с командной строки.
 * @returns infinity promise
 */
export function setupCommandLineInterface(brain: Brain): Promise<never> {
  return new Promise<never>(() => {
    process.stdin.setRawMode(false);
    sendWelcomeMessage(brain);
    sendBasicPrompt();
    process.stdin.on("data", async (rawData) => {
      const input = rawData.toString("utf-8");
      const command = input.split(/\s/)[0];
      if (!command) return sendBasicPrompt();
      switch (command) {
        case "help": {
          console.log(`COMMAND LIST:`);
          console.log(` help :: Display command list & info`);
          console.log(` stat :: (alias: mon) Open live status monitor`);
          console.log(` quit :: (alias: exit) Stop the bot and close this window`);
          return sendBasicPrompt();
        }
        case "mon":
        case "stat": {
          const statusMonitor = new StatusMonitor(brain);
          statusMonitor.openDialogWindow();
          await statusMonitor.dialogPromise; //передать контроль над выполнением кода
          sendWelcomeMessage(brain);
          return sendBasicPrompt();
        }
        case "exit":
        case "quit": {
          brain.exitProcess();
          return;
        }
        default: {
          console.log(`Unknown command: '${command}'. Type 'help' to show available commands`);
          return sendBasicPrompt();
        }
      }
    });
  });
}
