import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

const MCP_CATALOG: Record<
  string,
  { label: string; hint: string; config: McpServerConfig }
> = {
  'nx-mcp': {
    label: 'Nx MCP',
    hint: 'Nx workspace tools',
    config: {
      command: 'npx',
      args: ['nx-mcp'],
    },
  },
  github: {
    label: 'GitHub',
    hint: 'Issues, PRs, repos',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
    },
  },
  playwright: {
    label: 'Playwright',
    hint: 'Browser automation',
    config: {
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest'],
    },
  },
  figma: {
    label: 'Figma',
    hint: 'Design file access',
    config: {
      command: 'npx',
      args: ['-y', '@anthropic/mcp-server-figma'],
      env: { FIGMA_ACCESS_TOKEN: '${FIGMA_TOKEN}' },
    },
  },
  notion: {
    label: 'Notion',
    hint: 'Notion pages & databases',
    config: {
      command: 'npx',
      args: ['-y', '@notionhq/mcp-server'],
      env: { NOTION_TOKEN: '${NOTION_TOKEN}' },
    },
  },
  filesystem: {
    label: 'Filesystem',
    hint: 'File read/write ops',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    },
  },
};

export const configureMcpCommand = defineCommand({
  meta: {
    name: 'mcp',
    description: 'Configure MCP servers for agent integration',
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(' harness configure mcp ')));

    const cwd = process.cwd();

    // Leer config existente
    const mcpPath = resolve(cwd, '.mcp.json');
    let existingServers: string[] = [];
    if (existsSync(mcpPath)) {
      try {
        const existing = JSON.parse(readFileSync(mcpPath, 'utf-8'));
        existingServers = Object.keys(
          existing.mcpServers || existing.servers || {},
        );
      } catch {
        // ignorar si no se puede parsear
      }
    }

    const servers = await p.multiselect({
      message: 'Select MCP servers to configure:',
      options: Object.entries(MCP_CATALOG).map(([key, val]) => ({
        value: key,
        label: val.label,
        hint: val.hint,
      })),
      initialValues: existingServers.filter((s) => s in MCP_CATALOG),
      required: true,
    });

    if (p.isCancel(servers)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Generar .mcp.json
    const mcpConfig: { mcpServers: Record<string, McpServerConfig> } = {
      mcpServers: {},
    };

    for (const server of servers as string[]) {
      const def = MCP_CATALOG[server];
      if (def) {
        mcpConfig.mcpServers[server] = def.config;
      }
    }

    writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf-8');
    logger.success('.mcp.json generated');

    p.outro(pc.green('MCP configured.'));
  },
});
