import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, lstatSync, readlinkSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

const KIT_DIR = resolve(__dirname, '../../../templates/sdd');
const REPO_ROOT = resolve(__dirname, '../../..');
const SKILL_DIR = 'sdd/integrations/skills/tucu-ui-design';
const PKG = '@e-burgos/tucu-ui-mcp';
const PINNED = (() => {
  const source = readFileSync(resolve(KIT_DIR, 'scripts/tucu-ui-common.mjs'), 'utf8');
  return /TUCU_UI_PINNED_VERSION = '(\d+\.\d+\.\d+)'/.exec(source)?.[1] ?? '';
})();

const STUB = `
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const mode = process.env.TUCU_STUB_MODE ?? 'full';
if (process.env.TUCU_STUB_LOG) appendFileSync(process.env.TUCU_STUB_LOG, process.argv.slice(2).join(' ') + '\\n');
if (mode === 'offline') {
  process.stderr.write('npm error code ENOTFOUND\\nnpm error errno ENOTFOUND\\nnpm error network request failed: getaddrinfo ENOTFOUND registry.npmjs.org\\n');
  process.exit(1);
}
if (mode === 'broken') {
  process.stderr.write('npm error something unexpected\\n');
  process.exit(1);
}
const dir = process.argv[process.argv.indexOf('--dir') + 1];
const base = mode === 'nested' ? join(dir, 'tucu-ui-design') : dir;
mkdirSync(join(base, 'references'), { recursive: true });
writeFileSync(join(base, 'SKILL.md'), '# tucu-ui-design\\n');
writeFileSync(join(base, 'references', 'checklist.md'), 'checklist\\n');
if (mode !== 'incomplete') writeFileSync(join(base, 'references', 'design-guide.md'), 'guide\\n');
`;

const CLAUDE_STUB = `
import { appendFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (process.env.TUCU_STUB_LOG) appendFileSync(process.env.TUCU_STUB_LOG, 'claude ' + args.join(' ') + '\\n');
const forced = Number(process.env.CLAUDE_STUB_EXIT ?? 0);
if (forced) process.exit(forced);
const state = process.env.CLAUDE_STUB_STATE;
if (state && args[1] === 'add') {
  if (existsSync(state)) {
    process.stderr.write('MCP server tucu-ui already exists in local config\\n');
    process.exit(1);
  }
  writeFileSync(state, 'added');
}
if (state && args[1] === 'remove') {
  if (!existsSync(state)) process.exit(1);
  rmSync(state);
}
process.exit(0);
`;

type Run = { status: number | null; stdout: string; stderr: string };

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = resolve(dir, entry.name);
      const key = relative(root, full).split('\\').join('/');
      if (lstatSync(full).isSymbolicLink()) out[key] = `link:${readlinkSync(full)}`;
      else if (entry.isDirectory()) {
        out[key] = 'dir';
        walk(full);
      } else out[key] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(root);
  return out;
}

const isLink = (path: string) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

describe.skipIf(process.platform === 'win32')('sdd:tucu (integration, POSIX)', () => {
  let ws: string;
  let aux: string;
  let stubPath: string;
  let stubLog: string;

  const env = (mode = 'full', extra: Record<string, string> = {}) => ({
    ...process.env,
    SDD_RTK_SKIP_INSTALL: '1',
    SDD_TUCU_NPX: stubPath,
    TUCU_STUB_MODE: mode,
    TUCU_STUB_LOG: stubLog,
    ...extra,
  });

  const tucu = (args: string[], mode = 'full', extra: Record<string, string> = {}, cwd = ws): Run =>
    spawnSync(process.execPath, [resolve(cwd, 'sdd/scripts/sdd-tucu.mjs'), ...args], {
      cwd,
      encoding: 'utf8',
      env: env(mode, extra),
    });

  const setupAgents = (cwd = ws) =>
    execFileSync('bash', [resolve(cwd, 'sdd/scripts/setup-agents.sh')], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: env(),
    });

  const status = (cwd = ws) => JSON.parse(tucu([], 'full', {}, cwd).stdout);
  const toolsPath = () => resolve(ws, 'sdd/tools.json');
  const readTools = () => fs.readJSONSync(toolsPath());
  const stubCalls = () => (fs.existsSync(stubLog) ? fs.readFileSync(stubLog, 'utf8').trim().split('\n').filter(Boolean) : []);
  const writeJson = (rel: string, value: unknown) =>
    fs.outputFileSync(resolve(ws, rel), `${JSON.stringify(value, null, 2)}\n`);
  const readJson = (rel: string) => fs.readJSONSync(resolve(ws, rel));

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-tucu-'));
    aux = mkdtempSync(resolve(tmpdir(), 'harness-tucu-aux-'));
    stubPath = resolve(aux, 'npx-stub.mjs');
    stubLog = resolve(aux, 'calls.log');
    fs.writeFileSync(stubPath, STUB);
    await fs.copy(KIT_DIR, resolve(ws, 'sdd'));
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
    rmSync(aux, { recursive: true, force: true });
  });

  describe('--status', () => {
    it('sin la clave tucu_ui o sin archivo reporta off, sin escribir y con salida 0', () => {
      const toolsBefore = fs.readFileSync(toolsPath(), 'utf8');
      const delta = readTools();
      delete delta.tucu_ui;
      fs.writeJSONSync(toolsPath(), delta);
      const before = snapshot(ws);
      const out = tucu(['--status']);
      expect(out.status).toBe(0);
      const parsed = JSON.parse(out.stdout);
      expect(parsed).toMatchObject({ enabled: false, state: 'off', update_available: false, kit_version: PINNED });
      expect(snapshot(ws)).toEqual(before);

      fs.removeSync(toolsPath());
      expect(JSON.parse(tucu([]).stdout).state).toBe('off');
      expect(fs.existsSync(toolsPath())).toBe(false);
      expect(toolsBefore).toContain('tucu_ui');
    });

    it('un tools.json roto corta con mensaje accionable y sin escribir', () => {
      fs.writeFileSync(toolsPath(), '{ broken');
      const out = tucu(['--status']);
      expect(out.status).toBe(1);
      expect(out.stderr).toContain('sdd/tools.json is not valid JSON');
      expect(fs.readFileSync(toolsPath(), 'utf8')).toBe('{ broken');
    });

    it('prendido a medias reporta incomplete por arnés y el comando que repara', () => {
      const tools = readTools();
      tools.tucu_ui.enabled = true;
      fs.writeJSONSync(toolsPath(), tools);
      const parsed = status();
      expect(parsed.state).toBe('incomplete');
      expect(parsed.repair).toBe('pnpm sdd:tucu -- --enable');
      expect(parsed.harnesses).toEqual({
        claude: 'incomplete',
        copilot: 'incomplete',
        gemini: 'incomplete',
        antigravity: 'incomplete',
      });
    });
  });

  describe('uso inválido', () => {
    it.each([
      [['--bogus']],
      [['--enable', '--disable']],
      [['--enable', '--parts=docs']],
      [['--enable', '--parts=']],
      [['--purge']],
      [['--enable', '--purge']],
      [['--force']],
      [['--disable', '--force']],
      [['--disable', '--parts=skill']],
      [['--status', '--enable']],
    ])('%j sale con 2 y muestra el uso sin escribir', (args) => {
      const before = snapshot(ws);
      const out = tucu(args);
      expect(out.status).toBe(2);
      expect(out.stderr).toContain('Usage: node sdd/scripts/sdd-tucu.mjs');
      expect(snapshot(ws)).toEqual(before);
    });
  });

  describe('--enable', () => {
    const foreignMcp = () => {
      writeJson('.mcp.json', { mcpServers: { other: { command: 'other-mcp', args: ['--x'] } }, extra: { keep: true } });
      writeJson('.vscode/mcp.json', { inputs: [{ id: 'k' }], servers: { mine: { command: 'mine' } } });
    };

    it('instala la skill, enlaza los tres lugares, convierte .claude/skills y escribe los tres archivos MCP', () => {
      setupAgents();
      expect(lstatSync(resolve(ws, '.claude/skills')).isSymbolicLink()).toBe(true);
      foreignMcp();
      const geminiBefore = readJson('.gemini/settings.json');
      const extraBefore = JSON.stringify(readJson('.mcp.json'));

      const out = tucu(['--enable']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('claude: skill linked · mcp .mcp.json created');
      expect(out.stdout).toContain(`${PKG}@${PINNED}`);

      for (const file of ['SKILL.md', 'references/checklist.md', 'references/design-guide.md']) {
        expect(fs.existsSync(resolve(ws, SKILL_DIR, file))).toBe(true);
      }
      expect(fs.readdirSync(resolve(ws, 'sdd/integrations/skills'))).toEqual(['tucu-ui-design']);

      expect(lstatSync(resolve(ws, '.claude/skills')).isSymbolicLink()).toBe(false);
      for (const name of ['sdd-orchestrator', 'sdd-steward', 'sdd-mod']) {
        expect(fs.existsSync(resolve(ws, '.claude/skills', name))).toBe(true);
        expect(isLink(resolve(ws, '.claude/skills', name))).toBe(true);
      }
      expect(fs.existsSync(resolve(ws, '.claude/skills/sdd-mod/.claude-plugin/plugin.json'))).toBe(true);
      expect(fs.existsSync(resolve(ws, 'sdd/skills/tucu-ui-design'))).toBe(false);
      for (const dir of ['.claude/skills', '.github/skills', '.agents/skills']) {
        const link = resolve(ws, dir, 'tucu-ui-design');
        expect(isLink(link)).toBe(true);
        expect(fs.realpathSync(link)).toBe(fs.realpathSync(resolve(ws, SKILL_DIR)));
        expect(fs.existsSync(resolve(link, 'SKILL.md'))).toBe(true);
      }

      const entry = { command: 'npx', args: ['-y', `${PKG}@${PINNED}`] };
      const claude = readJson('.mcp.json');
      expect(Object.keys(claude.mcpServers)).toEqual(['other', 'tucu-ui']);
      expect(claude.mcpServers['tucu-ui']).toEqual(entry);
      expect(claude.extra).toEqual({ keep: true });
      expect(JSON.stringify({ ...claude, mcpServers: { other: claude.mcpServers.other } })).toBe(extraBefore);

      const vscode = readJson('.vscode/mcp.json');
      expect(Object.keys(vscode.servers)).toEqual(['mine', 'tucu-ui']);
      expect(vscode.servers['tucu-ui']).toEqual({ type: 'stdio', ...entry });
      expect(vscode.inputs).toEqual([{ id: 'k' }]);

      const gemini = readJson('.gemini/settings.json');
      expect(gemini.mcpServers['tucu-ui']).toEqual(entry);
      expect(gemini.context).toEqual(geminiBefore.context);
      expect(gemini.hooks).toEqual(geminiBefore.hooks);
      expect(gemini.hooks?.BeforeTool).toBeDefined();

      expect(readTools().tucu_ui).toEqual({ enabled: true, skill: true, mcp: true, version: PINNED });
      expect(readTools().rtk).toEqual({ enabled: true, auto_install: true });
      expect(readTools().claude_mod).toEqual({ enabled: false, gate: 'block' });
      expect(status().state).toBe('complete');
    });

    it('es idempotente: un segundo --enable y un segundo setup-agents no cambian ningún byte', () => {
      setupAgents();
      foreignMcp();
      expect(tucu(['--enable']).status).toBe(0);
      const after = snapshot(ws);
      const again = tucu(['--enable']);
      expect(again.status).toBe(0);
      expect(again.stdout).toContain('tucu_ui: already on and complete');
      expect(snapshot(ws)).toEqual(after);
      setupAgents();
      expect(snapshot(ws)).toEqual(after);
      expect(stubCalls()).toHaveLength(1);
    });

    it('una entrada tucu-ui personalizada y un tucu-ui-design ajeno no se pisan', () => {
      setupAgents();
      writeJson('.vscode/mcp.json', { servers: { 'tucu-ui': { command: 'node', args: ['local-tucu.js'] } } });
      fs.outputFileSync(resolve(ws, '.github/skills/tucu-ui-design/SKILL.md'), 'mine\n');
      const out = tucu(['--enable']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('has your own tucu-ui entry');
      expect(out.stdout).toContain('is not the kit');
      expect(readJson('.vscode/mcp.json').servers['tucu-ui']).toEqual({ command: 'node', args: ['local-tucu.js'] });
      expect(fs.readFileSync(resolve(ws, '.github/skills/tucu-ui-design/SKILL.md'), 'utf8')).toBe('mine\n');
      expect(isLink(resolve(ws, '.github/skills/tucu-ui-design'))).toBe(false);
      expect(status().skill.links['.github/skills']).toBe('foreign');
    });

    it('un .claude/skills propio recibe el enlace dentro sin tocar lo del equipo', () => {
      fs.outputFileSync(resolve(ws, '.claude/skills/team-skill/SKILL.md'), 'ours\n');
      expect(tucu(['--enable']).status).toBe(0);
      expect(fs.readFileSync(resolve(ws, '.claude/skills/team-skill/SKILL.md'), 'utf8')).toBe('ours\n');
      expect(isLink(resolve(ws, '.claude/skills/tucu-ui-design'))).toBe(true);
    });

    it('un MCP roto aborta antes de instalar o enlazar y deja tools.json intacto', () => {
      setupAgents();
      fs.writeFileSync(resolve(ws, '.mcp.json'), '{ nope');
      writeJson('.vscode/mcp.json', { servers: [] });
      const before = snapshot(ws);
      const out = tucu(['--enable']);
      expect(out.status).toBe(1);
      expect(out.stderr).toContain('.mcp.json is not valid JSON');
      expect(out.stderr).toContain('.vscode/mcp.json has a "servers" that is not an object');
      expect(snapshot(ws)).toEqual(before);
      expect(stubCalls()).toEqual([]);
    });

    it('sin red y sin skill falla con la versión y el reintento, sin staging ni carpeta parcial', () => {
      setupAgents();
      const toolsBefore = fs.readFileSync(toolsPath(), 'utf8');
      const before = snapshot(ws);
      const out = tucu(['--enable'], 'offline');
      expect(out.status).toBe(1);
      expect(out.stderr).toContain(`could not download ${PKG}@${PINNED}`);
      expect(out.stderr).toContain('pnpm sdd:tucu -- --enable');
      expect(fs.readFileSync(toolsPath(), 'utf8')).toBe(toolsBefore);
      expect(snapshot(ws)).toEqual(before);
      expect(fs.existsSync(resolve(ws, 'sdd/integrations'))).toBe(false);
    });

    it('con la skill ya instalada funciona sin red: no consulta npx', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      expect(tucu(['--disable']).status).toBe(0);
      expect(stubCalls()).toHaveLength(1);
      const again = tucu(['--enable'], 'offline');
      expect(again.status).toBe(0);
      expect(stubCalls()).toHaveLength(1);
      expect(status().state).toBe('complete');
    });

    it('un npx que falla por otra causa muestra su salida y no deja residuos', () => {
      setupAgents();
      const out = tucu(['--enable'], 'broken');
      expect(out.status).toBe(1);
      expect(out.stderr).toContain('npm error something unexpected');
      expect(fs.existsSync(resolve(ws, 'sdd/integrations'))).toBe(false);
    });

    it('un paquete que no produce la skill completa falla sin carpeta final', () => {
      setupAgents();
      const toolsBefore = fs.readFileSync(toolsPath(), 'utf8');
      const out = tucu(['--enable'], 'incomplete');
      expect(out.status).toBe(1);
      expect(out.stderr).toContain('did not produce the expected skill');
      expect(out.stderr).toContain('references/design-guide.md');
      expect(fs.existsSync(resolve(ws, 'sdd/integrations'))).toBe(false);
      expect(fs.readFileSync(toolsPath(), 'utf8')).toBe(toolsBefore);
    });

    it('acepta la skill en la carpeta padre (staging/tucu-ui-design)', () => {
      setupAgents();
      expect(tucu(['--enable'], 'nested').status).toBe(0);
      expect(fs.readFileSync(resolve(ws, SKILL_DIR, 'SKILL.md'), 'utf8')).toBe('# tucu-ui-design\n');
      expect(fs.existsSync(resolve(ws, SKILL_DIR, 'tucu-ui-design'))).toBe(false);
    });

    it('Node menor a 20 corta antes de escribir', () => {
      setupAgents();
      const before = snapshot(ws);
      const out = tucu(['--enable'], 'full', { SDD_TUCU_NODE_VERSION: '18.19.0' });
      expect(out.status).toBe(1);
      expect(out.stderr).toContain(`${PKG}@${PINNED} needs Node >= 20 (found 18.19.0)`);
      expect(snapshot(ws)).toEqual(before);
    });

    it('--parts=skill fija el conjunto exacto: sin MCP y quita las entradas propias previas', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      expect(readJson('.mcp.json').mcpServers['tucu-ui']).toBeDefined();
      const out = tucu(['--enable', '--parts=skill']);
      expect(out.status).toBe(0);
      expect(readTools().tucu_ui).toMatchObject({ enabled: true, skill: true, mcp: false });
      expect(readJson('.mcp.json').mcpServers).toEqual({});
      expect(readJson('.vscode/mcp.json').servers).toEqual({});
      expect(isLink(resolve(ws, '.github/skills/tucu-ui-design'))).toBe(true);
      expect(status().state).toBe('complete');
      expect(status().mcp).toEqual({ '.mcp.json': 'n/a', '.vscode/mcp.json': 'n/a', '.gemini/settings.json': 'n/a' });
    });

    it('--parts=skill desde cero no crea archivos MCP', () => {
      expect(tucu(['--enable', '--parts=skill']).status).toBe(0);
      expect(fs.existsSync(resolve(ws, '.mcp.json'))).toBe(false);
      expect(fs.existsSync(resolve(ws, '.vscode/mcp.json'))).toBe(false);
    });

    it('--parts=mcp no instala ni enlaza la skill', () => {
      const out = tucu(['--enable', '--parts=mcp']);
      expect(out.status).toBe(0);
      expect(fs.existsSync(resolve(ws, SKILL_DIR))).toBe(false);
      expect(stubCalls()).toEqual([]);
      expect(readJson('.mcp.json').mcpServers['tucu-ui']).toBeDefined();
      expect(readTools().tucu_ui).toMatchObject({ skill: false, mcp: true });
    });

    it('crea tools.json con el default del kit si no existe', () => {
      fs.removeSync(toolsPath());
      expect(tucu(['--enable', '--parts=mcp']).status).toBe(0);
      expect(readTools()).toEqual({
        $schema: './schemas/tools.schema.json',
        rtk: { enabled: true, auto_install: true },
        tucu_ui: { enabled: true, skill: false, mcp: true, version: PINNED },
      });
    });

    it('update_available con una versión vieja; --force la sube y reescribe el token de las entradas propias', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      const tools = readTools();
      tools.tucu_ui.version = '0.1.0';
      fs.writeJSONSync(toolsPath(), tools);
      writeJson('.mcp.json', { mcpServers: { 'tucu-ui': { command: 'cmd', args: ['/c', 'npx', '-y', `${PKG}@0.1.0`] } } });
      expect(status()).toMatchObject({ update_available: true, version: '0.1.0', kit_version: PINNED });

      const plain = tucu(['--enable']);
      expect(plain.status).toBe(0);
      expect(readTools().tucu_ui.version).toBe('0.1.0');
      expect(readJson('.mcp.json').mcpServers['tucu-ui'].args).toEqual(['/c', 'npx', '-y', `${PKG}@0.1.0`]);

      const forced = tucu(['--enable', '--force']);
      expect(forced.status).toBe(0);
      expect(readTools().tucu_ui.version).toBe(PINNED);
      expect(readJson('.mcp.json').mcpServers['tucu-ui']).toEqual({
        command: 'cmd',
        args: ['/c', 'npx', '-y', `${PKG}@${PINNED}`],
      });
      expect(stubCalls()).toHaveLength(2);
      expect(status().update_available).toBe(false);
    });

    it('con el CLI de Claude Code disponible fija el override local cmd /c; si falla imprime el comando exacto', () => {
      setupAgents();
      const claudeStub = resolve(aux, 'claude-stub.mjs');
      fs.writeFileSync(claudeStub, CLAUDE_STUB);
      const state = resolve(aux, 'claude-state');
      const extra = { SDD_TUCU_CLAUDE: claudeStub, CLAUDE_STUB_STATE: state };
      const add = tucu(['--enable'], 'full', extra);
      expect(add.status).toBe(0);
      expect(stubCalls()).toContain(`claude mcp add --scope local tucu-ui -- cmd /c npx -y ${PKG}@${PINNED}`);
      expect(add.stdout).not.toContain('could not');

      const second = tucu(['--enable'], 'full', extra);
      expect(second.status).toBe(0);
      expect(second.stdout).not.toContain('could not');
      expect(second.stdout).toContain('tucu_ui: already on and complete');
      expect(second.stdout).not.toContain('local MCP override');

      const forcedRun = tucu(['--enable', '--force'], 'full', extra);
      expect(forcedRun.status).toBe(0);
      expect(forcedRun.stdout).not.toContain('could not');
      expect(fs.existsSync(state)).toBe(true);

      const failing = tucu(['--enable', '--force'], 'full', { ...extra, CLAUDE_STUB_EXIT: '1' });
      expect(failing.status).toBe(0);
      expect(failing.stdout).toContain(`run: claude mcp add --scope local tucu-ui -- cmd /c npx -y ${PKG}@${PINNED}`);

      const remove = tucu(['--disable'], 'full', extra);
      expect(remove.status).toBe(0);
      expect(stubCalls()).toContain('claude mcp remove --scope local tucu-ui');
      expect(fs.existsSync(state)).toBe(false);
    });

    it('con un tucu-ui propio en .mcp.json no fija el override local', () => {
      setupAgents();
      const claudeStub = resolve(aux, 'claude-stub.mjs');
      fs.writeFileSync(claudeStub, CLAUDE_STUB);
      fs.writeFileSync(
        resolve(ws, '.mcp.json'),
        JSON.stringify({ mcpServers: { 'tucu-ui': { command: 'node', args: ['mine.js'] } } }),
      );
      const run = tucu(['--enable'], 'full', { SDD_TUCU_CLAUDE: claudeStub });
      expect(run.status).toBe(0);
      expect(stubCalls().filter((c) => c.startsWith('claude mcp add'))).toEqual([]);
    });

    it('--parts=skill quita un override local previo de Claude Code sin avisar', () => {
      setupAgents();
      const claudeStub = resolve(aux, 'claude-stub.mjs');
      fs.writeFileSync(claudeStub, CLAUDE_STUB);
      const state = resolve(aux, 'claude-state');
      const extra = { SDD_TUCU_CLAUDE: claudeStub, CLAUDE_STUB_STATE: state };
      expect(tucu(['--enable'], 'full', extra).status).toBe(0);
      expect(fs.existsSync(state)).toBe(true);
      const skillOnly = tucu(['--enable', '--parts=skill'], 'full', extra);
      expect(skillOnly.status).toBe(0);
      expect(skillOnly.stdout).not.toContain('could not');
      expect(fs.existsSync(state)).toBe(false);
      expect(stubCalls().filter((c) => c.startsWith('claude mcp add'))).toHaveLength(1);
    });

    it('no toca sdd/skills ni catalog.json', () => {
      setupAgents();
      const skillsBefore = Object.entries(snapshot(ws)).filter(([k]) => k.startsWith('sdd/skills'));
      const catalogBefore = fs.readFileSync(resolve(ws, 'sdd/catalog.json'), 'utf8');
      expect(tucu(['--enable']).status).toBe(0);
      expect(Object.entries(snapshot(ws)).filter(([k]) => k.startsWith('sdd/skills'))).toEqual(skillsBefore);
      expect(fs.readFileSync(resolve(ws, 'sdd/catalog.json'), 'utf8')).toBe(catalogBefore);
    });
  });

  describe('--disable', () => {
    it('quita solo lo propio y conserva lo ajeno, la carpeta instalada y un re-enable sin red', () => {
      setupAgents();
      writeJson('.mcp.json', { mcpServers: { other: { command: 'other-mcp' } } });
      writeJson('.vscode/mcp.json', { servers: { 'tucu-ui': { command: 'mine' } } });
      fs.outputFileSync(resolve(ws, '.github/skills/tucu-ui-design/SKILL.md'), 'mine\n');
      expect(tucu(['--enable']).status).toBe(0);

      const out = tucu(['--disable']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('tucu_ui: off');
      expect(isLink(resolve(ws, '.claude/skills/tucu-ui-design'))).toBe(false);
      expect(fs.existsSync(resolve(ws, '.claude/skills/tucu-ui-design'))).toBe(false);
      expect(fs.existsSync(resolve(ws, '.agents/skills/tucu-ui-design'))).toBe(false);
      expect(fs.readFileSync(resolve(ws, '.github/skills/tucu-ui-design/SKILL.md'), 'utf8')).toBe('mine\n');
      expect(readJson('.mcp.json')).toEqual({ mcpServers: { other: { command: 'other-mcp' } } });
      expect(readJson('.vscode/mcp.json').servers['tucu-ui']).toEqual({ command: 'mine' });
      expect(readJson('.gemini/settings.json').mcpServers).toEqual({});
      expect(readTools().tucu_ui).toMatchObject({ enabled: false, skill: true, mcp: true });
      expect(fs.existsSync(resolve(ws, SKILL_DIR, 'SKILL.md'))).toBe(true);

      const after = snapshot(ws);
      const second = tucu(['--disable']);
      expect(second.status).toBe(0);
      expect(second.stdout).toContain('tucu_ui: already off');
      expect(snapshot(ws)).toEqual(after);

      expect(tucu(['--enable'], 'offline').status).toBe(0);
      expect(stubCalls()).toHaveLength(1);
    });

    it('--purge borra solo la carpeta de la skill', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      const out = tucu(['--disable', '--purge']);
      expect(out.status).toBe(0);
      expect(fs.existsSync(resolve(ws, SKILL_DIR))).toBe(false);
      expect(fs.existsSync(resolve(ws, 'sdd/integrations'))).toBe(false);
      expect(fs.existsSync(resolve(ws, 'sdd/skills/sdd-steward/SKILL.md'))).toBe(true);
      expect(fs.existsSync(resolve(ws, '.claude/skills/sdd-steward/SKILL.md'))).toBe(true);
    });

    it('funciona sin red, con un MCP roto (lo deja como está) y sin tools.json de la integración', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      fs.writeFileSync(resolve(ws, '.mcp.json'), '{ broken');
      const out = tucu(['--disable'], 'offline');
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('may still contain a tucu-ui entry');
      expect(fs.readFileSync(resolve(ws, '.mcp.json'), 'utf8')).toBe('{ broken');
    });

    it('un tools.json roto es el único motivo para salir con 1', () => {
      fs.writeFileSync(toolsPath(), '{ broken');
      const out = tucu(['--disable']);
      expect(out.status).toBe(1);
      expect(fs.readFileSync(toolsPath(), 'utf8')).toBe('{ broken');
    });

    it('apagado y limpio no escribe nada ni crea la clave', () => {
      fs.removeSync(toolsPath());
      const out = tucu(['--disable']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('tucu_ui: already off');
      expect(fs.existsSync(toolsPath())).toBe(false);
    });
  });

  describe('setup-agents (--sync)', () => {
    it('prendido conserva los enlaces; apagado en tools.json los quita; prendido de nuevo los repone', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      const linked = snapshot(ws);

      const rerun = setupAgents();
      expect(rerun).toContain('kept     symlink : .github/skills/tucu-ui-design');
      expect(snapshot(ws)).toEqual(linked);

      const tools = readTools();
      tools.tucu_ui.enabled = false;
      fs.writeJSONSync(toolsPath(), tools);
      const off = setupAgents();
      expect(off).toContain('removed  symlink : .github/skills/tucu-ui-design');
      for (const dir of ['.claude/skills', '.github/skills', '.agents/skills']) {
        expect(fs.existsSync(resolve(ws, dir, 'tucu-ui-design'))).toBe(false);
      }
      expect(fs.existsSync(resolve(ws, SKILL_DIR, 'SKILL.md'))).toBe(true);

      tools.tucu_ui.enabled = true;
      fs.writeJSONSync(toolsPath(), tools);
      const on = setupAgents();
      expect(on).toContain('created  symlink : .github/skills/tucu-ui-design');
      expect(isLink(resolve(ws, '.agents/skills/tucu-ui-design'))).toBe(true);
    });

    it('un compañero que hace pull de un tools.json prendido recibe los enlaces sin red', async () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      const clone = mkdtempSync(resolve(tmpdir(), 'harness-tucu-clone-'));
      try {
        await fs.copy(resolve(ws, 'sdd'), resolve(clone, 'sdd'), { dereference: false });
        execFileSync('bash', [resolve(clone, 'sdd/scripts/setup-agents.sh')], {
          cwd: clone,
          stdio: 'ignore',
          env: env('offline'),
        });
        expect(isLink(resolve(clone, '.claude/skills/tucu-ui-design'))).toBe(true);
        expect(isLink(resolve(clone, '.github/skills/tucu-ui-design'))).toBe(true);
        expect(fs.existsSync(resolve(clone, '.claude/skills/sdd-steward/SKILL.md'))).toBe(true);
        expect(stubCalls()).toHaveLength(1);
      } finally {
        rmSync(clone, { recursive: true, force: true });
      }
    });

    it('con la parte skill deshabilitada quita los enlaces del kit', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      const tools = readTools();
      tools.tucu_ui.skill = false;
      fs.writeJSONSync(toolsPath(), tools);
      setupAgents();
      expect(fs.existsSync(resolve(ws, '.github/skills/tucu-ui-design'))).toBe(false);
    });

    it('si sdd-tucu.mjs falla o no existe, setup-agents termina igual', () => {
      fs.writeFileSync(resolve(ws, 'sdd/scripts/sdd-tucu.mjs'), 'throw new Error("boom");\n');
      expect(() => setupAgents()).not.toThrow();
      fs.removeSync(resolve(ws, 'sdd/scripts/sdd-tucu.mjs'));
      expect(() => setupAgents()).not.toThrow();
      expect(fs.existsSync(resolve(ws, '.github/skills/sdd-steward'))).toBe(true);
    });

    it('con tucu-ui apagado no aparece ningún enlace ni carpeta de tucu-ui', () => {
      setupAgents();
      const names = Object.keys(snapshot(ws)).filter((k) => k.includes('tucu-ui-design'));
      expect(names).toEqual([]);
      expect(fs.existsSync(resolve(ws, 'sdd/integrations'))).toBe(false);
    });

    it('un enlace colgado del kit (carpeta borrada a mano) se limpia al apagar', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      fs.removeSync(resolve(ws, SKILL_DIR));
      expect(status().skill.links['.github/skills']).toBe('missing');
      expect(tucu(['--disable']).stdout).toContain('removed  symlink : .github/skills/tucu-ui-design');
      expect(isLink(resolve(ws, '.github/skills/tucu-ui-design'))).toBe(false);
    });
  });

  describe('validate-sdd', () => {
    const validate = (): Run => {
      fs.ensureDirSync(resolve(ws, 'node_modules'));
      for (const dep of ['ajv', 'ajv-formats', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'require-from-string']) {
        const src = resolve(REPO_ROOT, 'node_modules', dep);
        const dest = resolve(ws, 'node_modules', dep);
        if (fs.existsSync(src) && !fs.existsSync(dest)) fs.symlinkSync(src, dest);
      }
      const out = spawnSync(process.execPath, [resolve(ws, 'sdd/scripts/validate-sdd.mjs')], { cwd: ws, encoding: 'utf8' });
      return { status: out.status, stdout: out.stdout, stderr: out.stderr };
    };

    it('apagado o con tools.json anterior no emite nada de tucu-ui', () => {
      const off = validate();
      expect(off.status).toBe(0);
      expect(off.stderr).not.toContain('tucu');

      const tools = readTools();
      delete tools.tucu_ui;
      fs.writeJSONSync(toolsPath(), tools);
      const legacy = validate();
      expect(legacy.status).toBe(0);
      expect(legacy.stderr).not.toContain('tucu');
    });

    it('prendido y completo valida sin avisos de tucu-ui', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      const out = validate();
      expect(out.status).toBe(0);
      expect(out.stderr).not.toContain('tucu_ui');
    });

    it('un enlace borrado, un MCP ausente y una versión vieja son warnings con el comando, sin cambiar la salida', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      fs.removeSync(resolve(ws, '.github/skills/tucu-ui-design'));
      fs.removeSync(resolve(ws, '.vscode/mcp.json'));
      fs.writeFileSync(resolve(ws, '.gemini/settings.json'), '{ broken');
      const tools = readTools();
      tools.tucu_ui.version = '0.1.0';
      fs.writeJSONSync(toolsPath(), tools);
      const out = validate();
      expect(out.status).toBe(0);
      expect(out.stderr).toContain('tucu_ui on but .github/skills/tucu-ui-design is not linked (Copilot)');
      expect(out.stderr).toContain('tucu_ui on but .vscode/mcp.json does not exist (Copilot)');
      expect(out.stderr).toContain('tucu_ui on but .gemini/settings.json is not valid JSON');
      expect(out.stderr).toContain('pnpm sdd:tucu -- --enable');
      expect(out.stderr).toContain(`the kit pins ${PINNED}`);
      expect(out.stderr).toContain('pnpm sdd:tucu -- --enable --force');
    });

    it('la carpeta de la skill incompleta se avisa; la parte deshabilitada no se vigila', () => {
      setupAgents();
      expect(tucu(['--enable']).status).toBe(0);
      fs.removeSync(resolve(ws, SKILL_DIR, 'references/design-guide.md'));
      expect(validate().stderr).toContain(`tucu_ui on but ${SKILL_DIR} is missing or incomplete`);
      const tools = readTools();
      tools.tucu_ui.skill = false;
      fs.writeJSONSync(toolsPath(), tools);
      expect(validate().stderr).not.toContain('tucu_ui on');
    });

    it('una clave desconocida valida contra el schema y se avisa aunque esté apagado', () => {
      const tools = readTools();
      tools.tucu_ui.extra = 1;
      fs.writeJSONSync(toolsPath(), tools);
      const out = validate();
      expect(out.status).toBe(0);
      expect(out.stderr).toContain('tucu_ui.extra is not a known setting (enabled, skill, mcp, version) — ignored');
    });

    it('un tipo equivocado dentro de tucu_ui es un error de schema real', () => {
      const tools = readTools();
      tools.tucu_ui.enabled = 'yes';
      fs.writeJSONSync(toolsPath(), tools);
      expect(validate().status).toBe(1);
    });

    it('si el módulo común falta no avisa nada y no rompe', () => {
      fs.removeSync(resolve(ws, 'sdd/scripts/tucu-ui-common.mjs'));
      const tools = readTools();
      tools.tucu_ui.enabled = true;
      fs.writeJSONSync(toolsPath(), tools);
      const out = validate();
      expect(out.status).toBe(0);
      expect(out.stderr).not.toContain('tucu_ui on');
    });
  });
});

describe('setup-agents.sh y setup-agents.ps1 delegan igual en sdd-tucu.mjs --sync', () => {
  it('las dos llamadas existen, están guardadas por la existencia del script y toleran fallos', () => {
    const sh = readFileSync(resolve(KIT_DIR, 'scripts/setup-agents.sh'), 'utf8');
    const ps1 = readFileSync(resolve(KIT_DIR, 'scripts/setup-agents.ps1'), 'utf8');
    expect(sh).toMatch(/sdd-tucu\.mjs" --sync \|\| true/);
    expect(sh).toMatch(/-f "\$ROOT\/sdd\/scripts\/sdd-tucu\.mjs"/);
    expect(ps1).toMatch(/try \{ & node \$tucuScript --sync \} catch/);
    expect(ps1).toMatch(/Test-Path -LiteralPath \$tucuScript/);
    expect(sh.indexOf('setup-rtk.mjs')).toBeLessThan(sh.indexOf('sdd-tucu.mjs'));
    expect(ps1.indexOf('setup-rtk.mjs')).toBeLessThan(ps1.indexOf('sdd-tucu.mjs'));
  });
});
