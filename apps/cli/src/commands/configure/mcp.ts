import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { parseListFlag } from '../../utils/flags.js';
import { loadTucuUiCommon, type McpEntry } from '../../utils/kit-scripts.js';
import { readMcpServerNames, syncMcpServers } from '../../utils/mcp-sync.js';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpCatalogEntry {
  label: string;
  hint: string;
  config: McpServerConfig;
}

const BASE_MCP_CATALOG: Record<string, McpCatalogEntry> = {
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

export async function buildMcpCatalog(): Promise<Record<string, McpCatalogEntry>> {
  const tucu = await loadTucuUiCommon();
  return {
    ...BASE_MCP_CATALOG,
    'tucu-ui': {
      label: 'tucu-ui',
      hint: 'Design MCP for @e-burgos/tucu-ui (React/Next frontends)',
      config: tucu.kitTucuEntry(tucu.TUCU_UI_PINNED_VERSION, '.mcp.json') as unknown as McpServerConfig,
    },
  };
}

export const configureMcpCommand = defineCommand({
  meta: {
    name: 'mcp',
    description: 'Configure MCP servers for agent integration',
  },
  args: {
    servers: {
      type: 'string',
      description:
        'Comma-separated MCP servers from the catalog — skips the prompt',
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness configure mcp ')));

    const cwd = process.cwd();

    const catalog = await buildMcpCatalog();
    const tucu = await loadTucuUiCommon();
    const mcpPath = resolve(cwd, '.mcp.json');

    const existing = await readMcpServerNames(mcpPath);
    if (!existing.ok) {
      logger.error(existing.error);
      process.exit(1);
    }

    const servers = args.servers
      ? parseListFlag(args.servers, Object.keys(catalog), '--servers')
      : await p.multiselect({
          message: 'Select MCP servers to configure:',
          options: Object.entries(catalog).map(([key, val]) => ({
            value: key,
            label: val.label,
            hint: val.hint,
          })),
          initialValues: existing.names.filter((s) => s in catalog),
          required: true,
        });

    if (p.isCancel(servers)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const result = await syncMcpServers({
      mcpPath,
      catalog: Object.fromEntries(
        Object.entries(catalog).map(([key, val]) => [key, val.config as McpEntry]),
      ),
      selected: servers as string[],
      isOwn: (name, entry) => name !== 'tucu-ui' || tucu.isKitTucuEntry(entry),
      keepOwn: (name, entry) => name === 'tucu-ui' && tucu.isKitTucuEntry(entry),
    });
    if (!result.ok) {
      logger.error(result.error);
      process.exit(1);
    }

    if (result.outcomes['tucu-ui'] === 'custom') {
      logger.info('tucu-ui: your own entry was kept as is');
    }
    logger.success(result.written ? '.mcp.json updated — servers outside the catalog preserved' : '.mcp.json already up to date');

    p.outro(pc.green('MCP configured.'));
  },
});
