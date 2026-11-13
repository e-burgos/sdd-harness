import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

const KIT_DIR = resolve(__dirname, '../../../templates/sdd');
const REPO_ROOT = resolve(__dirname, '../../..');
const PKG = '@e-burgos/video-maker-mcp';
const MARKET = { source: { source: 'github', repo: 'e-burgos/video-maker' } };

type Run = { status: number | null; stdout: string; stderr: string };

describe('sdd:video (integration)', () => {
  let ws: string;

  const video = (args: string[] = [], extra: Record<string, string> = {}): Run =>
    spawnSync(process.execPath, [resolve(ws, 'sdd/scripts/sdd-video.mjs'), ...args], {
      cwd: ws,
      encoding: 'utf8',
      env: { ...process.env, ...extra },
    });

  const status = () => JSON.parse(video().stdout);
  const readJson = (rel: string) => fs.readJSONSync(resolve(ws, rel));
  const writeJson = (rel: string, value: unknown) =>
    fs.outputFileSync(resolve(ws, rel), `${JSON.stringify(value, null, 2)}\n`);
  const raw = (rel: string) => readFileSync(resolve(ws, rel), 'utf8');

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-video-'));
    await fs.copy(KIT_DIR, resolve(ws, 'sdd'));
  });

  afterEach(() => rmSync(ws, { recursive: true, force: true }));

  describe('--status', () => {
    it('apagado de fábrica y de solo lectura', () => {
      const before = raw('sdd/tools.json');
      const out = video();
      expect(out.status).toBe(0);
      const parsed = JSON.parse(out.stdout);
      expect(parsed.state).toBe('off');
      expect(parsed.enabled).toBe(false);
      expect(raw('sdd/tools.json')).toBe(before);
      expect(existsSync(resolve(ws, '.claude'))).toBe(false);
      expect(existsSync(resolve(ws, '.vscode'))).toBe(false);
      expect(existsSync(resolve(ws, '.gemini'))).toBe(false);
    });

    it('argumento desconocido o modos combinados salen con código 2', () => {
      expect(video(['--nope']).status).toBe(2);
      const both = video(['--enable', '--disable']);
      expect(both.status).toBe(2);
      expect(both.stderr).toContain('Usage: node sdd/scripts/sdd-video.mjs');
      expect(video(['--force']).status).toBe(2);
      expect(video(['--parts=bogus', '--enable']).status).toBe(2);
    });
  });

  describe('--enable', () => {
    it('declara el plugin, escribe el MCP fijado y prende tools.json', () => {
      const out = video(['--enable']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('video_maker: on');

      expect(readJson('.claude/settings.json')).toEqual({
        extraKnownMarketplaces: { 'video-maker': MARKET },
        enabledPlugins: { 'video-maker@video-maker': true },
      });
      const vscode = readJson('.vscode/mcp.json').servers['video-maker'];
      expect(vscode).toMatchObject({ type: 'stdio' });
      expect(JSON.stringify(vscode)).toContain(`${PKG}@0.1.0`);
      expect(JSON.stringify(readJson('.gemini/settings.json').mcpServers['video-maker'])).toContain(`${PKG}@0.1.0`);
      expect(existsSync(resolve(ws, '.mcp.json'))).toBe(false);

      expect(readJson('sdd/tools.json').video_maker).toEqual({ enabled: true, plugin: true, mcp: true, version: '0.1.0' });
      const parsed = status();
      expect(parsed.state).toBe('complete');
      expect(Object.values(parsed.harnesses)).toEqual(['complete', 'complete', 'complete', 'complete']);
    });

    it('es idempotente: la segunda corrida no cambia nada', () => {
      video(['--enable']);
      const files = ['.claude/settings.json', '.vscode/mcp.json', '.gemini/settings.json', 'sdd/tools.json'];
      const before = files.map(raw);
      const again = video(['--enable']);
      expect(again.status).toBe(0);
      expect(again.stdout).toContain('already on and complete');
      expect(files.map(raw)).toEqual(before);
    });

    it('conserva las claves ajenas de .claude/settings.json, .vscode/mcp.json y .gemini/settings.json', () => {
      writeJson('.claude/settings.json', {
        model: 'opus',
        hooks: { SessionStart: [] },
        enabledPlugins: { 'other@market': true },
        extraKnownMarketplaces: { other: { source: { source: 'github', repo: 'a/b' } } },
      });
      writeJson('.vscode/mcp.json', { servers: { mine: { command: 'node', args: ['x.js'] } }, inputs: [] });
      writeJson('.gemini/settings.json', { theme: 'dark', mcpServers: { mine: { command: 'node' } } });
      expect(video(['--enable']).status).toBe(0);

      const claude = readJson('.claude/settings.json');
      expect(claude.model).toBe('opus');
      expect(claude.hooks).toEqual({ SessionStart: [] });
      expect(claude.enabledPlugins).toEqual({ 'other@market': true, 'video-maker@video-maker': true });
      expect(Object.keys(claude.extraKnownMarketplaces)).toEqual(['other', 'video-maker']);
      expect(Object.keys(readJson('.vscode/mcp.json').servers)).toEqual(['mine', 'video-maker']);
      expect(readJson('.vscode/mcp.json').inputs).toEqual([]);
      expect(readJson('.gemini/settings.json').theme).toBe('dark');
      expect(Object.keys(readJson('.gemini/settings.json').mcpServers)).toEqual(['mine', 'video-maker']);
    });

    it('respeta una entrada MCP propia llamada video-maker', () => {
      const mine = { command: 'node', args: ['mine.js'] };
      writeJson('.gemini/settings.json', { mcpServers: { 'video-maker': mine } });
      const out = video(['--enable']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('your own video-maker entry');
      expect(readJson('.gemini/settings.json').mcpServers['video-maker']).toEqual(mine);
      expect(status().mcp['.gemini/settings.json']).toBe('custom');
    });

    it('respeta un marketplace video-maker ajeno y un plugin desactivado', () => {
      const foreign = { 'video-maker': { source: { source: 'github', repo: 'someone/else' } } };
      writeJson('.claude/settings.json', { extraKnownMarketplaces: foreign });
      const out = video(['--enable']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('your own "video-maker" marketplace');
      expect(readJson('.claude/settings.json')).toEqual({ extraKnownMarketplaces: foreign });
      expect(status().plugin.state).toBe('foreign-marketplace');

      writeJson('.claude/settings.json', { enabledPlugins: { 'video-maker@video-maker': false } });
      expect(video(['--enable']).stdout).toContain('set to false');
      expect(readJson('.claude/settings.json')).toEqual({ enabledPlugins: { 'video-maker@video-maker': false } });
    });

    it('--parts=mcp no toca .claude/settings.json y quita el plugin que el kit había declarado', () => {
      video(['--enable']);
      expect(video(['--enable', '--parts=mcp']).status).toBe(0);
      expect(readJson('.claude/settings.json')).toEqual({});
      expect(readJson('sdd/tools.json').video_maker).toMatchObject({ plugin: false, mcp: true });
      expect(status().plugin.state).toBe('n/a');
      expect(status().state).toBe('complete');
    });

    it('--parts=plugin quita las entradas MCP del kit', () => {
      video(['--enable']);
      expect(video(['--enable', '--parts=plugin']).status).toBe(0);
      expect(readJson('.vscode/mcp.json').servers).toEqual({});
      expect(readJson('.gemini/settings.json').mcpServers).toEqual({});
      expect(status().mcp).toEqual({ '.vscode/mcp.json': 'n/a', '.gemini/settings.json': 'n/a' });
    });

    it('un JSON roto aborta sin tocar nada', () => {
      fs.outputFileSync(resolve(ws, '.vscode/mcp.json'), '{ not json');
      const before = raw('sdd/tools.json');
      const out = video(['--enable']);
      expect(out.status).toBe(1);
      expect(out.stderr).toContain('nothing was changed');
      expect(out.stderr).toContain('pnpm sdd:video -- --enable');
      expect(raw('sdd/tools.json')).toBe(before);
      expect(existsSync(resolve(ws, '.claude/settings.json'))).toBe(false);
    });

    it('un contenedor que no es objeto aborta sin tocar nada', () => {
      writeJson('.claude/settings.json', { enabledPlugins: [] });
      const out = video(['--enable']);
      expect(out.status).toBe(1);
      expect(out.stderr).toContain('not an object');
      expect(existsSync(resolve(ws, '.vscode/mcp.json'))).toBe(false);
    });

    it('Node menor a 22 avisa pero no falla', () => {
      const out = video(['--enable'], { SDD_VIDEO_NODE_VERSION: '20.11.0' });
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('needs Node >= 22 (found 20.11.0)');
      expect(readJson('sdd/tools.json').video_maker.enabled).toBe(true);
    });

    it('--force sube una versión declarada vieja; sin --force la respeta', () => {
      const tools = readJson('sdd/tools.json');
      writeJson('sdd/tools.json', { ...tools, video_maker: { enabled: true, plugin: true, mcp: true, version: '0.0.9' } });
      video(['--enable']);
      expect(readJson('sdd/tools.json').video_maker.version).toBe('0.0.9');
      expect(JSON.stringify(readJson('.gemini/settings.json'))).toContain(`${PKG}@0.0.9`);
      expect(status().update_available).toBe(true);
      video(['--enable', '--force']);
      expect(readJson('sdd/tools.json').video_maker.version).toBe('0.1.0');
      expect(JSON.stringify(readJson('.gemini/settings.json'))).toContain(`${PKG}@0.1.0`);
      expect(status().update_available).toBe(false);
    });

    it('sin sdd/tools.json lo crea con rtk por defecto', () => {
      fs.removeSync(resolve(ws, 'sdd/tools.json'));
      expect(video(['--enable']).status).toBe(0);
      const tools = readJson('sdd/tools.json');
      expect(tools.rtk).toEqual({ enabled: true, auto_install: true });
      expect(tools.video_maker.enabled).toBe(true);
    });

    it('preserva las otras secciones y claves desconocidas de tools.json', () => {
      const tools = readJson('sdd/tools.json');
      writeJson('sdd/tools.json', { ...tools, tucu_ui: { enabled: false, skill: true, mcp: true }, video_maker: { enabled: false, note: 'keep' } });
      video(['--enable']);
      const after = readJson('sdd/tools.json');
      expect(after.tucu_ui).toEqual({ enabled: false, skill: true, mcp: true });
      expect(after.video_maker.note).toBe('keep');
      expect(status().unknown_keys).toEqual(['note']);
    });
  });

  describe('--disable', () => {
    it('quita lo del kit y apaga tools.json', () => {
      video(['--enable']);
      const out = video(['--disable']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('video_maker: off');
      expect(readJson('.claude/settings.json')).toEqual({});
      expect(readJson('.vscode/mcp.json').servers).toEqual({});
      expect(readJson('.gemini/settings.json').mcpServers).toEqual({});
      expect(readJson('sdd/tools.json').video_maker.enabled).toBe(false);
      expect(status().state).toBe('off');
    });

    it('es idempotente', () => {
      video(['--enable']);
      video(['--disable']);
      const files = ['.claude/settings.json', '.vscode/mcp.json', '.gemini/settings.json', 'sdd/tools.json'];
      const before = files.map(raw);
      const again = video(['--disable']);
      expect(again.status).toBe(0);
      expect(again.stdout).toContain('already off');
      expect(files.map(raw)).toEqual(before);
    });

    it('nunca toca lo ajeno', () => {
      const foreignMarket = { 'video-maker': { source: { source: 'github', repo: 'someone/else' } } };
      writeJson('.claude/settings.json', {
        model: 'opus',
        extraKnownMarketplaces: foreignMarket,
        enabledPlugins: { 'other@market': true, 'video-maker@video-maker': false },
      });
      const mine = { command: 'node', args: ['mine.js'] };
      writeJson('.gemini/settings.json', { theme: 'dark', mcpServers: { 'video-maker': mine, keep: { command: 'x' } } });
      writeJson('.vscode/mcp.json', { servers: { keep: { command: 'y' } } });
      const claudeBefore = raw('.claude/settings.json');
      video(['--disable']);
      expect(raw('.claude/settings.json')).toBe(claudeBefore);
      expect(readJson('.gemini/settings.json')).toEqual({ theme: 'dark', mcpServers: { 'video-maker': mine, keep: { command: 'x' } } });
      expect(readJson('.vscode/mcp.json')).toEqual({ servers: { keep: { command: 'y' } } });
    });

    it('conserva las claves ajenas junto a las del kit', () => {
      writeJson('.claude/settings.json', {
        model: 'opus',
        enabledPlugins: { 'other@market': true },
        extraKnownMarketplaces: { other: { source: { source: 'github', repo: 'a/b' } } },
      });
      writeJson('.gemini/settings.json', { theme: 'dark', mcpServers: { keep: { command: 'x' } } });
      video(['--enable']);
      video(['--disable']);
      expect(readJson('.claude/settings.json')).toEqual({
        model: 'opus',
        enabledPlugins: { 'other@market': true },
        extraKnownMarketplaces: { other: { source: { source: 'github', repo: 'a/b' } } },
      });
      expect(readJson('.gemini/settings.json')).toEqual({ theme: 'dark', mcpServers: { keep: { command: 'x' } } });
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
    const setTools = (patch: Record<string, unknown>) => {
      const tools = readJson('sdd/tools.json');
      writeJson('sdd/tools.json', { ...tools, video_maker: { ...tools.video_maker, ...patch } });
    };

    it('apagado o con tools.json anterior no emite nada de video-maker', () => {
      const off = validate();
      expect(off.status).toBe(0);
      expect(off.stderr).not.toContain('video_maker');
      const tools = readJson('sdd/tools.json');
      delete tools.video_maker;
      writeJson('sdd/tools.json', tools);
      const legacy = validate();
      expect(legacy.status).toBe(0);
      expect(legacy.stderr).not.toContain('video_maker');
    });

    it('prendido y completo valida sin avisos', () => {
      expect(video(['--enable']).status).toBe(0);
      const out = validate();
      expect(out.status).toBe(0);
      expect(out.stderr).not.toContain('video_maker');
    });

    it('un plugin sin declarar, un MCP ausente y una versión vieja son warnings con el comando, sin cambiar la salida', () => {
      expect(video(['--enable']).status).toBe(0);
      writeJson('.claude/settings.json', {});
      fs.removeSync(resolve(ws, '.vscode/mcp.json'));
      fs.writeFileSync(resolve(ws, '.gemini/settings.json'), '{ broken');
      setTools({ version: '0.0.1' });
      const out = validate();
      expect(out.status).toBe(0);
      expect(out.stderr).toContain('video_maker on but .claude/settings.json has no video-maker entry (Claude Code plugin)');
      expect(out.stderr).toContain('video_maker on but .vscode/mcp.json does not exist (Copilot)');
      expect(out.stderr).toContain('video_maker on but .gemini/settings.json is not valid JSON');
      expect(out.stderr).toContain('pnpm sdd:video -- --enable');
      expect(out.stderr).toContain('the kit pins 0.1.0');
      expect(out.stderr).toContain('pnpm sdd:video -- --enable --force');
    });

    it('la parte deshabilitada no se vigila', () => {
      expect(video(['--enable']).status).toBe(0);
      writeJson('.claude/settings.json', {});
      setTools({ plugin: false });
      expect(validate().stderr).not.toContain('video_maker on');
    });

    it('una clave desconocida valida contra el schema y se avisa aunque esté apagado', () => {
      setTools({ extra: 1 });
      const out = validate();
      expect(out.status).toBe(0);
      expect(out.stderr).toContain('video_maker.extra is not a known setting (enabled, plugin, mcp, version) — ignored');
    });

    it('un tipo equivocado dentro de video_maker es un error de schema real', () => {
      setTools({ enabled: 'yes' });
      expect(validate().status).toBe(1);
    });

    it('si el módulo común falta no avisa nada y no rompe', () => {
      fs.removeSync(resolve(ws, 'sdd/scripts/video-maker-common.mjs'));
      setTools({ enabled: true });
      const out = validate();
      expect(out.status).toBe(0);
      expect(out.stderr).not.toContain('video_maker on');
    });
  });
});
