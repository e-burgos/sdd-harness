import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { parseListFlag } from '../../utils/flags.js';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Capa de memoria OPT-IN sobre la base portable del kit (sdd/memory/ — F4 del
 * roadmap hermes). La base en archivos sigue siendo la fuente de verdad
 * versionada; estos proveedores agregan recuperación semántica para quien
 * acepte la dependencia de runtime. Ninguno requiere API key ni servicio pago.
 */
const MEMORY_CATALOG: Record<
  string,
  { label: string; hint: string; config: McpServerConfig; note: string }
> = {
  'basic-memory': {
    label: 'basic-memory',
    hint: 'Markdown + wikilinks, local-first (requires uv)',
    config: {
      command: 'uvx',
      args: ['basic-memory', 'mcp'],
    },
    note: 'Requires uv (https://docs.astral.sh/uv/). Notes are plain Markdown — they can live inside a repo directory.',
  },
  'knowledge-graph': {
    label: 'Knowledge graph (oficial MCP)',
    hint: 'Entity/relation graph in local JSON via npx',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      env: { MEMORY_FILE_PATH: 'sdd/memory/knowledge-graph.json' },
    },
    note: 'Persists at sdd/memory/knowledge-graph.json — travels with git like the rest of the kit memory.',
  },
};

export const configureMemoryCommand = defineCommand({
  meta: {
    name: 'memory',
    description:
      'Opt-in memory providers (MCP) on top of the portable sdd/memory/ base layer',
  },
  args: {
    providers: {
      type: 'string',
      description:
        'Comma-separated memory providers from the catalog — skips the prompt',
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness configure memory ')));

    p.note(
      [
        "The kit's base memory (sdd/memory/: lessons.md + journal/) already works",
        'without any of this — versioned files in git, zero dependencies.',
        'These MCP providers add optional semantic retrieval on top.',
      ].join('\n'),
      'Base layer vs providers',
    );

    const cwd = process.cwd();
    const mcpPath = resolve(cwd, '.mcp.json');

    let existing: { mcpServers?: Record<string, McpServerConfig> } = {};
    if (existsSync(mcpPath)) {
      try {
        existing = JSON.parse(readFileSync(mcpPath, 'utf-8'));
      } catch {
        logger.error('.mcp.json exists but is not valid JSON — fix it first.');
        process.exit(1);
      }
    }
    const existingServers = existing.mcpServers ?? {};

    const providers = args.providers
      ? parseListFlag(args.providers, Object.keys(MEMORY_CATALOG), '--providers')
      : await p.multiselect({
          message: 'Memory providers to configure:',
          options: Object.entries(MEMORY_CATALOG).map(([key, val]) => ({
            value: key,
            label: val.label,
            hint: val.hint,
          })),
          initialValues: Object.keys(existingServers).filter(
            (s) => s in MEMORY_CATALOG,
          ),
          required: false,
        });

    if (p.isCancel(providers)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const selected = providers as string[];

    const mcpServers = { ...existingServers };
    for (const key of Object.keys(MEMORY_CATALOG)) {
      if (selected.includes(key)) {
        mcpServers[key] = MEMORY_CATALOG[key].config;
      } else {
        delete mcpServers[key];
      }
    }

    writeFileSync(
      mcpPath,
      `${JSON.stringify({ ...existing, mcpServers }, null, 2)}\n`,
      'utf-8',
    );
    logger.success(
      selected.length
        ? `.mcp.json updated (${selected.join(', ')}) — other MCP servers preserved`
        : '.mcp.json updated — memory providers removed, other MCP servers preserved',
    );

    for (const key of selected) {
      logger.info(`${MEMORY_CATALOG[key].label}: ${MEMORY_CATALOG[key].note}`);
    }

    p.outro(pc.green('Memory layer configured.'));
  },
});
