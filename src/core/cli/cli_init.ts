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
      console.log(`COMMAND LIST:`);
      console.log(` help :: Display command list & info`);
      console.log(` mon :: Open live status monitor`);
      console.log(` stat :: Creating bot's information list`);
      console.log(` quit :: (alias: exit) Stop the bot and close this window`);
    })
  
  cli
    .command(`quit`)
    .alias(`exit`)
    .description(`Stop the bot and close this window.`)
    .action(() => {
      brain.exitProcess();
    })
  
  cli
    .command(`stat`)
    .description(`Creating bot's information list`)
    .action(() => {
      console.log(`– Бать, тебе нормально?`);
      console.log(`– Намальна !`);
    }
    )

  cli
    .command(`mon`)
    .description(`Open live status monitor.`)
    .action(() => {
      console.log(`[ there must be bot's panel ]`);
    })
}