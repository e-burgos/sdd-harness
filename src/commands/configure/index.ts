import { defineCommand } from 'citty';
import { configureSddCommand } from './sdd.js';
import { configureMcpCommand } from './mcp.js';
import { configureDockerCommand } from './docker.js';

export const configureCommand = defineCommand({
  meta: {
    name: 'configure',
    description: 'Configure workspace features (SDD, MCP, Docker)',
  },
  subCommands: {
    sdd: configureSddCommand,
    mcp: configureMcpCommand,
    docker: configureDockerCommand,
  },
});
