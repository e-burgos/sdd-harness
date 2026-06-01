import { defineCommand, runMain } from 'citty';
import { version } from './version.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add/index.js';
import { configureCommand } from './commands/configure/index.js';
import { infoCommand } from './commands/info.js';

const main = defineCommand({
  meta: {
    name: 'harness',
    version,
    description: 'Bootstrap AI-agent-ready Nx monorepos with SDD methodology',
  },
  subCommands: {
    init: initCommand,
    add: addCommand,
    configure: configureCommand,
    info: infoCommand,
  },
});

runMain(main);
