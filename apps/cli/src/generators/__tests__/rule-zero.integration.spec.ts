import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

const KIT_DIR = resolve(__dirname, '../../../templates/sdd');
const REPO_ROOT = resolve(__dirname, '../../..');
const START = '<!-- regla-cero:start -->';
const END = '<!-- regla-cero:end -->';

function node(ws: string, script: string, args: string[] = [], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [resolve(ws, 'sdd/scripts', script), ...args], {
    cwd: ws,
    encoding: 'utf8',
    env: { ...process.env, SDD_RTK_SKIP_INSTALL: '1', CLAUDE_PROJECT_DIR: '', ...env },
  });
}

describe('regla cero en el kit', () => {
  it.each(['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'])('%s abre con el bloque regla-cero antes del chequeo de sesión', (name) => {
    const text = readFileSync(resolve(KIT_DIR, 'dual-harness', name), 'utf8');
    const start = text.indexOf(START);
    const end = text.indexOf(END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(text.indexOf('AL INICIAR SESIÓN')).toBeGreaterThan(end);
    expect(text.slice(start, end)).toContain('Regla cero → tier:');
  });

  it('todos los prompts del kit mencionan la regla cero', () => {
    const dir = resolve(KIT_DIR, 'prompts');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.prompt.md'))) {
      expect(readFileSync(resolve(dir, file), 'utf8'), file).toContain('Regla cero');
    }
  });
});

describe.skipIf(process.platform === 'win32')('rule-zero-hook y setup (integration)', () => {
  let ws: string;

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-rz-'));
    await fs.copy(KIT_DIR, resolve(ws, 'sdd'));
    await fs.copy(resolve(KIT_DIR, 'dual-harness/CLAUDE.md'), resolve(ws, 'CLAUDE.md'));
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  it('emite el bloque como additionalContext de SessionStart para claude', () => {
    const res = node(ws, 'rule-zero-hook.mjs', ['claude']);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(out.hookSpecificOutput.additionalContext).toContain('REGLA CERO');
    expect(out.hookSpecificOutput.additionalContext).not.toContain(START);
  });

  it('no imprime nada y sale 0 si faltan los marcadores o el archivo', async () => {
    await fs.writeFile(resolve(ws, 'CLAUDE.md'), '# sin marcadores\n');
    await fs.remove(resolve(ws, 'sdd/dual-harness'));
    const noMarkers = node(ws, 'rule-zero-hook.mjs', ['claude']);
    expect(noMarkers.status).toBe(0);
    expect(noMarkers.stdout).toBe('');

    await fs.remove(resolve(ws, 'CLAUDE.md'));
    const noFile = node(ws, 'rule-zero-hook.mjs', ['claude']);
    expect(noFile.status).toBe(0);
    expect(noFile.stdout).toBe('');

    const unknown = node(ws, 'rule-zero-hook.mjs', ['otro']);
    expect(unknown.status).toBe(0);
    expect(unknown.stdout).toBe('');
  });

  it('setup-rtk instala SessionStart idempotente, conserva hooks del usuario y funciona con rtk apagado', async () => {
    await fs.ensureDir(resolve(ws, '.claude'));
    await fs.writeJSON(resolve(ws, '.claude/settings.json'), {
      hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'echo mine' }] }] },
    });
    await fs.writeJSON(resolve(ws, 'sdd/tools.json'), { rtk: { enabled: false, auto_install: false } });

    expect(node(ws, 'setup-rtk.mjs').status).toBe(0);
    expect(node(ws, 'setup-rtk.mjs').status).toBe(0);

    const settings = await fs.readJSON(resolve(ws, '.claude/settings.json'));
    const list = settings.hooks.SessionStart as Array<{ matcher: string; hooks: Array<{ command: string }> }>;
    expect(list).toHaveLength(2);
    expect(list[0].hooks[0].command).toBe('echo mine');
    expect(list[1].matcher).toBe('startup|resume|clear|compact');
    expect(list[1].hooks[0].command).toBe('node "$CLAUDE_PROJECT_DIR/sdd/scripts/rule-zero-hook.mjs" claude');
    expect(settings.hooks.PreToolUse).toHaveLength(1);
  });

  it('el validador avisa (sin fallar) si faltan marcadores o el hook', async () => {
    for (const dep of ['ajv', 'ajv-formats', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'require-from-string']) {
      const src = resolve(REPO_ROOT, 'node_modules', dep);
      if (fs.existsSync(src)) await fs.ensureSymlink(src, resolve(ws, 'node_modules', dep));
    }
    await fs.writeFile(resolve(ws, 'CLAUDE.md'), '# sin marcadores\n');
    await fs.ensureDir(resolve(ws, '.claude'));
    const res = node(ws, 'validate-sdd.mjs');
    const output = `${res.stdout}${res.stderr}`;
    expect(output).toContain('rule-zero block');
    expect(output).toContain('SessionStart hook for rule zero is missing');
    expect(output).not.toMatch(/rule[- ]zero[^\n]*(✗|ERROR)/i);
  });
});
