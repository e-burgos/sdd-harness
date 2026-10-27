import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ToolsChange } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyToolsChange, serializeTools } from './kit-tools';

const kitScripts = path.resolve(__dirname, '../../../../sdd/scripts');

const inputs: Record<string, unknown> = {
  'rtk only': { $schema: './schemas/tools.schema.json', rtk: { enabled: true, auto_install: true } },
  'rtk with version': { rtk: { enabled: false, auto_install: false, version: '0.48.0' } },
  'with description': { $schema: './schemas/tools.schema.json', _description: 'x', rtk: { enabled: true } },
  'mod enabled': { rtk: { enabled: true }, claude_mod: { enabled: true, gate: 'block' } },
  'mod partial': { rtk: { enabled: true }, claude_mod: { enabled: false } },
  'mod warn': { rtk: { enabled: true }, claude_mod: { enabled: true, gate: 'warn' } },
};

const cases: Array<{ label: string; change: ToolsChange; script: string; args: string[] }> = [
  { label: 'rtk enable', change: { tool: 'rtk', enabled: true }, script: 'setup-rtk.mjs', args: ['--enable'] },
  { label: 'rtk disable', change: { tool: 'rtk', enabled: false }, script: 'setup-rtk.mjs', args: ['--disable'] },
  { label: 'mod enable', change: { tool: 'mod', enabled: true }, script: 'sdd-mod.mjs', args: ['--enable'] },
  { label: 'mod disable', change: { tool: 'mod', enabled: false }, script: 'sdd-mod.mjs', args: ['--disable'] },
  { label: 'gate warn', change: { tool: 'gate', mode: 'warn' }, script: 'sdd-mod.mjs', args: ['--gate=warn'] },
  { label: 'gate block', change: { tool: 'gate', mode: 'block' }, script: 'sdd-mod.mjs', args: ['--gate=block'] },
];

let repo: string;
beforeEach(async () => {
  repo = await mkdtemp(path.join(os.tmpdir(), 'kit-tools-parity-'));
  await mkdir(path.join(repo, 'sdd', 'scripts'), { recursive: true });
  for (const file of ['setup-rtk.mjs', 'sdd-mod.mjs', 'rtk-common.mjs']) {
    await cp(path.join(kitScripts, file), path.join(repo, 'sdd', 'scripts', file));
  }
});
afterEach(() => rm(repo, { recursive: true, force: true }));

describe('applyToolsChange parity with the kit scripts', () => {
  for (const [inputLabel, input] of Object.entries(inputs)) {
    for (const { label, change, script, args } of cases) {
      it(`${label} on "${inputLabel}" writes the same bytes`, async () => {
        const toolsFile = path.join(repo, 'sdd', 'tools.json');
        await writeFile(toolsFile, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
        execFileSync('node', [path.join(repo, 'sdd', 'scripts', script), ...args], {
          cwd: repo,
          env: { ...process.env, SDD_RTK_SKIP_INSTALL: '1' },
          stdio: 'pipe',
        });
        const fromScript = await readFile(toolsFile, 'utf8');
        expect(serializeTools(applyToolsChange(input as Record<string, unknown>, change))).toBe(fromScript);
      });
    }
  }
});
