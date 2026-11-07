import { defineCommand } from 'citty';
import { connectCommand } from './connect.js';
import { protectCommand } from './protect.js';
import { statusCommand } from './status.js';

export const githubCommand = defineCommand({
  meta: {
    name: 'github',
    description: 'Connect the project to GitHub with the gh CLI (repo, CI workflow, branch protection)',
  },
  subCommands: {
    status: statusCommand,
    connect: connectCommand,
    protect: protectCommand,
  },
});
