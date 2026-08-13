import { defineCommand, runMain } from 'citty';
import { version } from './version.js';
import { initCommand } from './commands/init.js';
import { ideaCommand } from './commands/idea.js';
import { addCommand } from './commands/add/index.js';
import { configureCommand } from './commands/configure/index.js';
import { configCommand } from './commands/config/index.js';
import { updateCommand } from './commands/update/index.js';
import { infoCommand } from './commands/info.js';

const main = defineCommand({
  meta: {
    name: 'harness',
    version,
    description: 'Bootstrap AI-agent-ready Nx monorepos with SDD methodology',
  },
  subCommands: {
    init: initCommand,
    idea: ideaCommand,
    add: addCommand,
    configure: configureCommand,
    config: configCommand,
    update: updateCommand,
    info: infoCommand,
  },
});

runMain(main);
