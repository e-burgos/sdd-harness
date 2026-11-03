import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync, lstatSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { configureSddCommand } from '../configure/sdd.js';
import { configureMcpCommand } from '../configure/mcp.js';
import { initCommand } from '../init.js';
import { hasConflictingTucuUiFlags } from '../../utils/tucu-ui-offer.js';
import { applyTucuUi, readTucuUiState, runTucuUiOffer } from '../../utils/tucu-ui-run.js';

const KIT_DIR = resolve(__dirname, '../../../templates/sdd');

const STUB = `
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
if (process.env.TUCU_STUB_MODE === 'offline') {
  process.stderr.write('getaddrinfo ENOTFOUND registry.npmjs.org\\n');
  process.exit(1);
}
const dir = process.argv[process.argv.indexOf('--dir') + 1];
mkdirSync(join(dir, 'references'), { recursive: true });
writeFileSync(join(dir, 'SKILL.md'), '# tucu-ui-design\\n');
writeFileSync(join(dir, 'references', 'checklist.md'), 'checklist\\n');
writeFileSync(join(dir, 'references', 'design-guide.md'), 'guide\\n');
`;

type Runner = (ctx: { args: Record<string, unknown>; rawArgs: string[] }) => Promise<void>;

describe.skipIf(process.platform === 'win32')('tucu-ui: flujos de la CLI con npx simulado', () => {
  let ws: string;
  let aux: string;
  let lines: string[];

  const toolsPath = () => resolve(ws, 'sdd/tools.json');
  const readTools = () => fs.readJSONSync(toolsPath());
  const hasLink = (dir: string) => {
    try {
      return lstatSync(resolve(ws, dir, 'tucu-ui-design')).isSymbolicLink();
    } catch {
      return false;
    }
  };

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-tucu-flow-'));
    aux = mkdtempSync(resolve(tmpdir(), 'harness-tucu-flow-aux-'));
    fs.writeFileSync(resolve(aux, 'npx-stub.mjs'), STUB);
    vi.stubEnv('SDD_TUCU_NPX', resolve(aux, 'npx-stub.mjs'));
    vi.stubEnv('SDD_RTK_SKIP_INSTALL', '1');
    vi.stubEnv('TUCU_STUB_MODE', 'full');
    lines = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
      lines.push(parts.join(' '));
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(ws, { recursive: true, force: true });
    rmSync(aux, { recursive: true, force: true });
  });

  const installKit = async () => {
    await fs.copy(KIT_DIR, resolve(ws, 'sdd'));
  };

  const output = () => lines.join('\n');

  describe('runTucuUiOffer', () => {
    beforeEach(installKit);

    it('--tucu-ui sin preguntar: instala, enlaza, escribe el MCP y deja el estado completo', async () => {
      expect(readTucuUiState(ws)).toBe('off');
      const outcome = await runTucuUiOffer(ws, {
        flag: true,
        hasFrontend: false,
        interactive: false,
        current: 'off',
      });
      expect(outcome).toBe('enabled');
      expect(readTucuUiState(ws)).toBe('complete');
      expect(readTools().tucu_ui).toMatchObject({ enabled: true, skill: true, mcp: true });
      expect(Object.keys(fs.readJSONSync(resolve(ws, '.mcp.json')).mcpServers)).toContain('tucu-ui');
      expect(fs.readJSONSync(resolve(ws, '.vscode/mcp.json')).servers['tucu-ui'].type).toBe('stdio');
      expect(Object.keys(fs.readJSONSync(resolve(ws, '.gemini/settings.json')).mcpServers)).toContain('tucu-ui');
      for (const dir of ['.claude/skills', '.github/skills', '.agents/skills']) expect(hasLink(dir)).toBe(true);
      expect(output()).toContain('tucu-ui: on (skill + MCP)');
    });

    it('sin red: no aborta, deja tools.json intacto y muestra el comando de reintento', async () => {
      vi.stubEnv('TUCU_STUB_MODE', 'offline');
      const before = readFileSync(toolsPath(), 'utf8');
      const outcome = await runTucuUiOffer(ws, {
        flag: true,
        hasFrontend: true,
        interactive: false,
        current: 'off',
      });
      expect(outcome).toBe('failed');
      expect(readFileSync(toolsPath(), 'utf8')).toBe(before);
      expect(readTucuUiState(ws)).toBe('off');
      expect(output()).toContain('pnpm sdd:tucu -- --enable');
      expect(output()).toContain('no network');
    });

    it('--no-tucu-ui no instala ni menciona nada', async () => {
      const outcome = await runTucuUiOffer(ws, {
        flag: false,
        hasFrontend: true,
        interactive: true,
        current: 'off',
      });
      expect(outcome).toBe('skipped');
      expect(readTucuUiState(ws)).toBe('off');
      expect(output()).not.toContain('tucu-ui');
    });

    it('con frontend, sin terminal y sin flags queda apagado y dice cómo prenderlo', async () => {
      const outcome = await runTucuUiOffer(ws, {
        flag: undefined,
        hasFrontend: true,
        interactive: false,
        current: 'off',
      });
      expect(outcome).toBe('declined');
      expect(readTucuUiState(ws)).toBe('off');
      expect(output()).toContain('tucu-ui: off — pnpm sdd:tucu -- --enable');
    });

    it('ya completo no pregunta ni reinstala; incompleto no ofrece sin terminal', async () => {
      expect(applyTucuUi(ws)).toBe('enabled');
      expect(
        await runTucuUiOffer(ws, {
          flag: undefined,
          hasFrontend: true,
          interactive: true,
          current: readTucuUiState(ws),
        }),
      ).toBe('skipped');

      fs.removeSync(resolve(ws, '.github/skills/tucu-ui-design'));
      const current = readTucuUiState(ws);
      expect(current).toBe('incomplete');
      expect(
        await runTucuUiOffer(ws, { flag: undefined, hasFrontend: true, interactive: false, current }),
      ).toBe('skipped');
    });

    it('sin el script del kit el intento falla sin lanzar', async () => {
      fs.removeSync(resolve(ws, 'sdd/scripts/sdd-tucu.mjs'));
      expect(applyTucuUi(ws)).toBe('failed');
      expect(readTucuUiState(ws)).toBe('off');
    });
  });

  describe('harness configure sdd', () => {
    const runSdd = (args: Record<string, unknown>, rawArgs: string[] = []) => {
      vi.spyOn(process, 'cwd').mockReturnValue(ws);
      return (configureSddCommand.run as unknown as Runner)({
        args: { name: 'flow-app', description: 'flow', yes: true, ...args },
        rawArgs,
      });
    };

    beforeEach(async () => {
      await fs.writeJSON(resolve(ws, 'package.json'), { name: 'flow-app', version: '1.0.0', private: true });
      await fs.writeFile(resolve(ws, 'vite.config.ts'), '');
    });

    it('--tucu-ui deja la integración prendida y completa tras instalar el kit', async () => {
      await runSdd({ 'tucu-ui': true });
      expect(readTucuUiState(ws)).toBe('complete');
      expect(readTools().tucu_ui.enabled).toBe(true);
    });

    it('un segundo configure sdd sin flag y sin terminal deja la integración prendida y completa', async () => {
      await runSdd({ 'tucu-ui': true });
      const before = readTools().tucu_ui;
      await runSdd({});
      expect(readTucuUiState(ws)).toBe('complete');
      expect(readTools().tucu_ui).toMatchObject({ enabled: true, version: before.version });
      for (const dir of ['.claude/skills', '.github/skills', '.agents/skills']) expect(hasLink(dir)).toBe(true);
      expect(Object.keys(fs.readJSONSync(resolve(ws, '.mcp.json')).mcpServers)).toContain('tucu-ui');
    });

    it('--no-tucu-ui con frontend detectado no instala ni pregunta', async () => {
      await runSdd({ 'tucu-ui': false });
      expect(readTucuUiState(ws)).toBe('off');
      expect(fs.existsSync(resolve(ws, 'sdd/integrations'))).toBe(false);
      expect(output()).not.toContain('tucu-ui: off');
    });

    it('con frontend y sin terminal (--yes) queda apagado con el aviso de cómo prenderlo', async () => {
      await runSdd({});
      expect(readTucuUiState(ws)).toBe('off');
      expect(output()).toContain('tucu-ui: off — pnpm sdd:tucu -- --enable');
    });

    it('sin frontend detectado no menciona tucu-ui', async () => {
      await fs.remove(resolve(ws, 'vite.config.ts'));
      await runSdd({});
      expect(readTucuUiState(ws)).toBe('off');
      expect(output()).not.toContain('tucu-ui');
    });

    it('--tucu-ui y --no-tucu-ui juntos terminan con error de uso sin instalar nada', async () => {
      vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as never);
      await expect(runSdd({}, ['--tucu-ui', '--no-tucu-ui'])).rejects.toThrow('exit:1');
      expect(fs.existsSync(resolve(ws, 'sdd'))).toBe(false);
    });
  });

  describe('flags y ayuda', () => {
    it('init y configure sdd declaran el flag con una línea de efecto', () => {
      for (const command of [initCommand, configureSddCommand]) {
        const flag = (command.args as Record<string, { type: string; description?: string }>)['tucu-ui'];
        expect(flag.type).toBe('boolean');
        expect(flag.description).toMatch(/tucu-ui/);
        expect(flag.description).toContain('--no-tucu-ui');
      }
    });

    it('el conflicto de flags se detecta sobre los argumentos crudos', () => {
      expect(hasConflictingTucuUiFlags(['--tucu-ui', '--no-tucu-ui'])).toBe(true);
    });
  });

  describe('configure mcp frente al interruptor', () => {
    beforeEach(installKit);

    it('quitar tucu-ui con configure mcp no cambia tools.json y el validador avisa', async () => {
      expect(applyTucuUi(ws)).toBe('enabled');
      const before = readFileSync(toolsPath(), 'utf8');
      vi.spyOn(process, 'cwd').mockReturnValue(ws);
      await (configureMcpCommand.run as unknown as Runner)({
        args: { servers: 'playwright' },
        rawArgs: [],
      });
      expect(readFileSync(toolsPath(), 'utf8')).toBe(before);
      expect(
        Object.keys(fs.readJSONSync(resolve(ws, '.mcp.json')).mcpServers).includes('tucu-ui'),
      ).toBe(false);
      expect(readTucuUiState(ws)).toBe('incomplete');
    });
  });
});
