import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { configureSddCommand } from '../configure/sdd.js';
import { initCommand } from '../init.js';
import {
  applyVideoMaker,
  chainBeforeGate,
  hasConflictingVideoMakerFlags,
  planVideoMaker,
  readVideoMakerSection,
  readVideoMakerState,
  restoreVideoMakerSection,
} from '../../utils/video-maker-run.js';

const KIT_DIR = resolve(__dirname, '../../../templates/sdd');

type Runner = (ctx: { args: Record<string, unknown>; rawArgs: string[] }) => Promise<void>;

describe('video-maker: flujos de la CLI', () => {
  let ws: string;
  let lines: string[];

  const toolsPath = () => resolve(ws, 'sdd/tools.json');
  const readTools = () => fs.readJSONSync(toolsPath());

  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-video-flow-'));
    vi.stubEnv('SDD_RTK_SKIP_INSTALL', '1');
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
  });

  const output = () => lines.join('\n');

  describe('applyVideoMaker', () => {
    beforeEach(async () => {
      await fs.copy(KIT_DIR, resolve(ws, 'sdd'));
    });

    it('prende la integración y deja el estado completo', () => {
      expect(readVideoMakerState(ws)).toBe('off');
      expect(applyVideoMaker(ws)).toBe('enabled');
      expect(readVideoMakerState(ws)).toBe('complete');
      expect(readTools().video_maker).toMatchObject({ enabled: true, plugin: true, mcp: true });
      expect(fs.readJSONSync(resolve(ws, '.claude/settings.json')).enabledPlugins['video-maker@video-maker']).toBe(true);
      expect(fs.existsSync(resolve(ws, '.mcp.json'))).toBe(false);
    });

    it('un JSON roto no aborta: avisa con el comando de reintento y deja tools.json intacto', () => {
      fs.outputFileSync(resolve(ws, '.vscode/mcp.json'), '{ nope');
      const before = readFileSync(toolsPath(), 'utf8');
      expect(applyVideoMaker(ws)).toBe('failed');
      expect(readFileSync(toolsPath(), 'utf8')).toBe(before);
      expect(output()).toContain('pnpm sdd:video -- --enable');
    });

    it('sin el script del kit el intento falla sin lanzar', () => {
      fs.removeSync(resolve(ws, 'sdd/scripts/sdd-video.mjs'));
      expect(applyVideoMaker(ws)).toBe('failed');
      expect(readVideoMakerState(ws)).toBe('off');
    });

    it('la sección se lee y se restaura sin tocar el resto de tools.json', () => {
      applyVideoMaker(ws);
      const section = readVideoMakerSection(ws)!;
      expect(section).toMatchObject({ enabled: true });
      const tools = readTools();
      fs.writeJSONSync(toolsPath(), { ...tools, video_maker: { enabled: false } });
      restoreVideoMakerSection(ws, section);
      expect(readTools()).toEqual(tools);
    });
  });

  describe('planVideoMaker', () => {
    beforeEach(async () => {
      await fs.copy(KIT_DIR, resolve(ws, 'sdd'));
    });

    it('sin flag o con --no-video-maker no hace ni dice nada', () => {
      for (const flag of [undefined, false]) {
        const plan = planVideoMaker(flag);
        expect(plan.beforeGate).toBeUndefined();
        plan.report();
      }
      expect(readVideoMakerState(ws)).toBe('off');
      expect(output()).not.toContain('video-maker');
    });

    it('con --video-maker prende antes del gate y reporta al final', () => {
      const plan = planVideoMaker(true);
      plan.beforeGate!(ws);
      expect(readVideoMakerState(ws)).toBe('complete');
      plan.report();
      expect(output()).toContain('video-maker: on (plugin + MCP)');
    });

    it('chainBeforeGate ejecuta los hooks presentes en orden y devuelve undefined si no hay ninguno', async () => {
      expect(chainBeforeGate(undefined, undefined)).toBeUndefined();
      const calls: string[] = [];
      const chained = chainBeforeGate(
        (root) => void calls.push(`a:${root}`),
        undefined,
        async (root) => void calls.push(`b:${root}`),
      );
      await chained!('/x');
      expect(calls).toEqual(['a:/x', 'b:/x']);
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
    });

    it('--video-maker deja la integración prendida y completa tras instalar el kit', async () => {
      await runSdd({ 'video-maker': true });
      expect(readVideoMakerState(ws)).toBe('complete');
      expect(readTools().video_maker.enabled).toBe(true);
      expect(output()).toContain('video-maker: on (plugin + MCP)');
    });

    it('sin flag queda apagado y no dice nada', async () => {
      await runSdd({});
      expect(readVideoMakerState(ws)).toBe('off');
      expect(readTools().video_maker.enabled).toBe(false);
      expect(output()).not.toContain('video-maker');
    });

    it('un segundo configure sdd conserva la sección prendida y sigue completa', async () => {
      await runSdd({ 'video-maker': true });
      const before = readTools().video_maker;
      await runSdd({});
      expect(readVideoMakerState(ws)).toBe('complete');
      expect(readTools().video_maker).toEqual(before);
    });

    it('--no-video-maker no instala nada', async () => {
      await runSdd({ 'video-maker': false });
      expect(readVideoMakerState(ws)).toBe('off');
      expect(JSON.stringify(fs.readJSONSync(resolve(ws, '.claude/settings.json')))).not.toContain('video-maker');
    });

    it('--video-maker y --no-video-maker juntos terminan con error de uso sin instalar nada', async () => {
      vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as never);
      await expect(runSdd({}, ['--video-maker', '--no-video-maker'])).rejects.toThrow('exit:1');
      expect(fs.existsSync(resolve(ws, 'sdd'))).toBe(false);
    });
  });

  describe('flags y ayuda', () => {
    it('init y configure sdd declaran el flag con una línea de efecto', () => {
      for (const command of [initCommand, configureSddCommand]) {
        const flag = (command.args as Record<string, { type: string; description?: string }>)['video-maker'];
        expect(flag.type).toBe('boolean');
        expect(flag.description).toMatch(/video-maker/);
        expect(flag.description).toContain('--no-video-maker');
      }
    });

    it('el conflicto de flags se detecta sobre los argumentos crudos', () => {
      expect(hasConflictingVideoMakerFlags(['--video-maker', '--no-video-maker'])).toBe(true);
      expect(hasConflictingVideoMakerFlags(['--video-maker'])).toBe(false);
    });
  });
});
