import libReadline from "readline";
import type Brain from "../brain.js";
import { StatusMonitor } from "./pages/status_monitor.js";
import { sendBasicPrompt, sendWelcomeMessage } from "./terminal_ui.js";
import { DialogWindow } from "./terminal_dialogs.js";

const createReadline = () => libReadline.createInterface({ input: process.stdin, output: process.stdout });

let __rl: libReadline.Interface;
export const rl = () => __rl ?? (__rl = createReadline());

/**
 * Handles command line input.
 * @returns infinity promise
 */
export function setupCommandLineInterface(brain: Brain): Promise<never> {
  return new Promise<never>(() => {
    libReadline.emitKeypressEvents(process.stdin, rl());
    process.stdin.resume();
    if (process.stdin.isTTY) process.stdin.setRawMode(false);

    const baseWindow = new DialogWindow();
    baseWindow.onOpen = () => {
      sendWelcomeMessage(brain);
      sendBasicPrompt();
    };
    baseWindow.handleLine = async (input) => {
      const command = input.split(/\s/)[0];
      if (!command) return sendBasicPrompt();
      switch (command) {
        case "help": {
          console.log(`COMMAND LIST:`);
          console.log(` help :: Display command list & info`);
          console.log(` mon :: Open live status monitor`);
          console.log(` quit :: (alias: exit) Stop the bot and close this window`);
          return sendBasicPrompt();
        }
        case "mon": {
          const statusMonitor = new StatusMonitor(brain);
          statusMonitor.openDialogWindow();
          await statusMonitor.dialogPromise; //transfer control over code execution
          return;
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
    };
    baseWindow.openDialogWindow();
  });
}
