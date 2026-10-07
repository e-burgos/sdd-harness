#!/usr/bin/env node
// Graba streams reales del Agent SDK en src/engine/__fixtures__/*.jsonl para testear el
// mapeo sin gastar tokens. Necesita `claude` logueado (o ANTHROPIC_API_KEY). Usa haiku/low.
// Uso: pnpm --filter @e-burgos/sdd-studio record-fixtures [escenario]
import { query } from '@anthropic-ai/claude-agent-sdk';
import { cp, mkdir, mkdtemp, readdir, realpath, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(pkg, 'src/engine/__fixtures__');
const kitAgents = path.resolve(pkg, '../cli/templates/sdd/agents');

const SCENARIOS = {
  simple: { prompt: 'Reply with exactly the word OK. Do not use any tool.' },
  subagent: {
    prompt:
      'Use the Agent tool with subagent_type "sdd-planner" and ask it to reply with exactly the word PLANNED without using any tool. Then reply DONE.',
  },
  permission: {
    prompt: 'Use the Write tool to create a file named hello.txt containing the text hi. Do nothing else.',
  },
  interrupt: { prompt: 'Count from 1 to 200, one number per line.', interrupt: true },
};

async function makeWorkspace() {
  const dir = await mkdtemp(path.join(tmpdir(), 'sdd-studio-spike-'));
  await mkdir(path.join(dir, '.claude/agents'), { recursive: true });
  for (const file of await readdir(kitAgents)) {
    await cp(path.join(kitAgents, file), path.join(dir, '.claude/agents', file));
  }
  return dir;
}

/** Removes machine-specific data before a fixture is written (they are committed to the repo). */
async function scrub(lines, cwd) {
  const physicalCwd = await realpath(cwd).catch(() => cwd);
  const replacements = [
    [physicalCwd, '/tmp/workspace'],
    [cwd, '/tmp/workspace'],
    [homedir(), '/Users/user'],
  ].filter(([from]) => from && from !== '/');
  return lines.map((line) => {
    const record = JSON.parse(line);
    const init = record.data;
    if (record.kind === 'message' && init?.type === 'system' && init.subtype === 'init') {
      if (Array.isArray(init.tools)) init.tools = init.tools.filter((tool) => !String(tool).startsWith('mcp__'));
      init.mcp_servers = [];
    }
    let text = JSON.stringify(record);
    for (const [from, to] of replacements) text = text.split(from).join(to).split(from.replaceAll('/', '\\/')).join(to);
    return text;
  });
}

async function record(name, scenario) {
  const cwd = await makeWorkspace();
  const lines = [];
  const log = (kind, data) => lines.push(JSON.stringify({ kind, data }));
  const hook = () => [{ hooks: [async (input) => (log('hook', input), {})] }];
  const q = query({
    prompt: scenario.prompt,
    options: {
      cwd,
      model: 'haiku',
      effort: 'low',
      settingSources: ['project'],
      forwardSubagentText: true,
      permissionMode: 'default',
      maxTurns: 6,
      canUseTool: async (toolName, input, opts) => {
        log('canUseTool', { toolName, input, toolUseID: opts.toolUseID, agentID: opts.agentID ?? null });
        return { behavior: 'deny', message: 'denied by fixture recorder' };
      },
      hooks: { SubagentStart: hook(), SubagentStop: hook(), PreToolUse: hook() },
    },
  });
  let interrupted = false;
  try {
    for await (const msg of q) {
      log('message', msg);
      if (scenario.interrupt && !interrupted && msg.type === 'assistant') {
        interrupted = true;
        await q.interrupt();
      }
    }
  } catch (err) {
    // Spike finding: after interrupt() the SDK iterator can throw instead of ending with a result.
    log('error', { name: err?.name, message: String(err?.message ?? err).slice(0, 500), errorClass: err?.errorClass ?? null });
    if (!scenario.interrupt) throw err;
  }
  const clean = await scrub(lines, cwd);
  await writeFile(path.join(outDir, `${name}.jsonl`), clean.join('\n') + '\n');
  console.log(`${name}: ${lines.length} records (cwd ${cwd})`);
}

await mkdir(outDir, { recursive: true });
const only = process.argv[2];
for (const [name, scenario] of Object.entries(SCENARIOS)) {
  if (!only || only === name) await record(name, scenario);
}
