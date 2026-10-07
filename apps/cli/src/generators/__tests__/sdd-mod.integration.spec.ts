import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import ts from 'typescript';

// The Claude Code mod of the kit: setup-agents exposes it to Claude only, and sdd-mod.mjs is
// the switch in sdd/tools.json. Real scripts over a copy of templates/sdd/.
const KIT_DIR = resolve(__dirname, '../../../templates/sdd');
const MANIFEST = 'sdd-mod/.claude-plugin/plugin.json';

function setupAgents(ws: string) {
  execFileSync('bash', [resolve(ws, 'sdd/scripts/setup-agents.sh')], {
    cwd: ws,
    stdio: 'ignore',
    env: { ...process.env, SDD_RTK_SKIP_INSTALL: '1' },
  });
}

function sddMod(ws: string, ...args: string[]) {
  return spawnSync(process.execPath, [resolve(ws, 'sdd/scripts/sdd-mod.mjs'), ...args], {
    cwd: ws,
    encoding: 'utf8',
  });
}

describe.skipIf(process.platform === 'win32')('sdd-mod (integration)', () => {
  let ws: string;

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-mod-'));
    await fs.copy(KIT_DIR, resolve(ws, 'sdd'));
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  it('el kit lo expone solo a Claude Code, también dentro de un .claude/skills propio', async () => {
    setupAgents(ws);
    expect(fs.existsSync(resolve(ws, '.claude/skills', MANIFEST))).toBe(true);
    expect(fs.existsSync(resolve(ws, '.github/skills/sdd-mod'))).toBe(false);
    expect(fs.existsSync(resolve(ws, '.agents/skills/sdd-mod'))).toBe(false);
    expect(fs.existsSync(resolve(ws, '.github/skills/sdd-steward/SKILL.md'))).toBe(true);

    const own = mkdtempSync(resolve(tmpdir(), 'harness-mod-own-'));
    try {
      await fs.copy(KIT_DIR, resolve(own, 'sdd'));
      await fs.outputFile(resolve(own, '.claude/skills/team-skill/SKILL.md'), 'ours\n');
      setupAgents(own);
      expect(fs.lstatSync(resolve(own, '.claude/skills')).isSymbolicLink()).toBe(false);
      expect(fs.lstatSync(resolve(own, '.claude/skills/sdd-mod')).isSymbolicLink()).toBe(true);
      expect(fs.existsSync(resolve(own, '.claude/skills', MANIFEST))).toBe(true);
    } finally {
      rmSync(own, { recursive: true, force: true });
    }
  });

  it('el tsc del proyecto anfitrión no ve el mod (import de claude-code rompía next build)', () => {
    setupAgents(ws);
    const config = ts.parseJsonConfigFileContent(
      { compilerOptions: { allowJs: true }, include: ['**/*.ts', '**/*.tsx', '**/*.js'] },
      ts.sys,
      ws,
    );
    const modFiles = config.fileNames.filter((f) => f.includes('sdd-mod'));
    expect(modFiles).toEqual([]);
    expect(fs.existsSync(resolve(ws, 'sdd/skills/sdd-mod/hooks/.src/register.tsx'))).toBe(true);
  });

  it('viene apagado; --enable/--disable/--gate escriben sdd/tools.json sin tocar rtk', () => {
    setupAgents(ws);
    const initial = JSON.parse(sddMod(ws, '--status').stdout);
    expect(initial).toEqual({ enabled: false, gate: 'block', kit_files: true, linked: true });

    expect(sddMod(ws, '--enable', '--gate=warn').status).toBe(0);
    const tools = fs.readJSONSync(resolve(ws, 'sdd/tools.json'));
    expect(tools.claude_mod).toEqual({ enabled: true, gate: 'warn' });
    expect(tools.rtk.enabled).toBe(true);

    expect(sddMod(ws, '--disable').status).toBe(0);
    expect(fs.readJSONSync(resolve(ws, 'sdd/tools.json')).claude_mod).toEqual({
      enabled: false,
      gate: 'warn',
    });

    const bad = sddMod(ws, '--gate=strict');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('block or warn');
  });

  it('un tools.json previo sin claude_mod se completa al prenderlo; sin link avisa', () => {
    fs.writeJSONSync(resolve(ws, 'sdd/tools.json'), {
      $schema: './schemas/tools.schema.json',
      rtk: { enabled: false },
    });
    const out = sddMod(ws, '--enable');
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('pnpm setup:agents');
    const tools = fs.readJSONSync(resolve(ws, 'sdd/tools.json'));
    expect(tools).toEqual({
      $schema: './schemas/tools.schema.json',
      rtk: { enabled: false },
      claude_mod: { enabled: true, gate: 'block' },
    });
  });
});
