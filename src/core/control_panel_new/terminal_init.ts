import { Command } from 'commander';
import type Brain from '../brain.js';

export function createCLI(brain: Brain) {

  const cli = new Command();
  cli
    .name(`minecraft-assistants-CLI`)
    .description(`CLI for controlling bots.`)
    .version(`0.0.1`)

  cli
    .command(`help`)
    .description(`Display command list & info`)
    .action(() => {
      console.log(`help :: Display command list & info`);
      console.log(`quit :: (alias: exit) Stop the bot and close this window`);
    })
  
  cli
    .command(`quit`)
    .alias(`exit`)
    .description(`Closing bot's console.`)
    .action(() => {
      brain.exitProcess();
    })
  
  cli
    .command(`mon`)
    .alias(`stat`)
    .description(`Starting bot's stats monitor.`)
    .action(() => {
      console.log(`[ there must be bot's panel ]`);
    })
}