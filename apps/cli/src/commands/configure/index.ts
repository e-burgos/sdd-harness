import { defineCommand } from 'citty';
import { configureSddCommand } from './sdd.js';
import { configureMcpCommand } from './mcp.js';
import { configureMemoryCommand } from './memory.js';
import { configureDockerCommand } from './docker.js';

export const configureCommand = defineCommand({
  meta: {
    name: 'configure',
    description: 'Configure workspace features (SDD, MCP, memory, Docker)',
  },
  subCommands: {
    sdd: configureSddCommand,
    mcp: configureMcpCommand,
    memory: configureMemoryCommand,
    docker: configureDockerCommand,
  },
});
