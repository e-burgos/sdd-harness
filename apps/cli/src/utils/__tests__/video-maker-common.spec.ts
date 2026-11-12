import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

type Entry = { type?: string; command: string; args: string[] };
type Status = {
  enabled: boolean;
  state: string;
  parts: { plugin: boolean; mcp: boolean };
  version: string;
  kit_version: string;
  update_available: boolean;
  node_ok: boolean;
  plugin: { file: string; marketplace: string; id: string; state: string };
  mcp: Record<string, string>;
  harnesses: Record<string, string>;
  unknown_keys: string[];
  repair?: string;
};
type Doc = Record<string, unknown>;
type Common = {
  VIDEO_MAKER_PACKAGE: string;
  VIDEO_MAKER_PINNED_VERSION: string;
  VIDEO_MAKER_SERVER_NAME: string;
  VIDEO_MAKER_PLUGIN_ID: string;
  VIDEO_MAKER_KNOWN_KEYS: string[];
  VIDEO_MAKER_MCP_TARGETS: { file: string }[];
  videoMakerSettings: (tools: unknown) => {
    enabled: boolean;
    plugin: boolean;
    mcp: boolean;
    version: string;
    versionDeclared: boolean;
    unknownKeys: string[];
  };
  nodeMeetsMinimum: (version?: string) => boolean;
  kitVideoMakerEntry: (version: string, target: string, platform?: string) => Entry;
  isKitVideoMakerEntry: (entry: unknown) => boolean;
  desiredVideoMakerEntry: (existing: unknown, version: string, target: string, platform?: string) => Entry;
  pluginDeclarationState: (doc: Doc) => string;
  planPluginUpsert: (doc: Doc) => { doc: Doc; outcome: string };
  planPluginRemove: (doc: Doc) => { doc: Doc; outcome: string };
  videoMakerStatus: (root: string, tools?: unknown) => Status;
};

let common: Common;

beforeAll(async () => {
  const file = resolve(__dirname, '../../../templates/sdd/scripts/video-maker-common.mjs');
  common = (await import(pathToFileURL(file).href)) as Common;
});

const MARKET = { source: { source: 'github', repo: 'e-burgos/video-maker' } };

describe('video-maker-common constants', () => {
  it('fija la versión, el servidor y el plugin', () => {
    expect(common.VIDEO_MAKER_PACKAGE).toBe('@e-burgos/video-maker-mcp');
    expect(common.VIDEO_MAKER_PINNED_VERSION).toBe('0.1.0');
    expect(common.VIDEO_MAKER_SERVER_NAME).toBe('video-maker');
    expect(common.VIDEO_MAKER_PLUGIN_ID).toBe('video-maker@video-maker');
    expect(common.VIDEO_MAKER_KNOWN_KEYS).toEqual(['enabled', 'plugin', 'mcp', 'version']);
  });

  it('el MCP solo va a Copilot y Gemini: .mcp.json queda fuera', () => {
    expect(common.VIDEO_MAKER_MCP_TARGETS.map((t) => t.file)).toEqual([
      '.vscode/mcp.json',
      '.gemini/settings.json',
    ]);
  });

  it('Node 22 es el mínimo', () => {
    expect(common.nodeMeetsMinimum('22.0.0')).toBe(true);
    expect(common.nodeMeetsMinimum('24.1.0')).toBe(true);
    expect(common.nodeMeetsMinimum('20.19.0')).toBe(false);
  });
});

describe('videoMakerSettings', () => {
  it('apagado por defecto con la clave ausente o tools nulo', () => {
    for (const tools of [null, undefined, {}, { rtk: {} }, { video_maker: 3 }, { video_maker: [] }]) {
      expect(common.videoMakerSettings(tools)).toMatchObject({
        enabled: false,
        plugin: true,
        mcp: true,
        version: common.VIDEO_MAKER_PINNED_VERSION,
        versionDeclared: false,
        unknownKeys: [],
      });
    }
  });

  it('respeta lo declarado y reporta claves desconocidas', () => {
    expect(
      common.videoMakerSettings({
        video_maker: { enabled: true, plugin: false, mcp: true, version: '0.0.9', extra: 1 },
      }),
    ).toMatchObject({ enabled: true, plugin: false, mcp: true, version: '0.0.9', versionDeclared: true, unknownKeys: ['extra'] });
  });

  it('una versión que no es semver se ignora', () => {
    const settings = common.videoMakerSettings({ video_maker: { enabled: true, version: 'latest' } });
    expect(settings.versionDeclared).toBe(false);
    expect(settings.version).toBe('0.1.0');
  });
});

describe('entrada MCP del kit', () => {
  const pkg = '@e-burgos/video-maker-mcp';

  it('canónica con npx; solo .vscode/mcp.json lleva type stdio', () => {
    expect(common.kitVideoMakerEntry('0.1.0', '.gemini/settings.json', 'linux')).toEqual({
      command: 'npx',
      args: ['-y', `${pkg}@0.1.0`],
    });
    expect(common.kitVideoMakerEntry('0.1.0', '.vscode/mcp.json', 'darwin')).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', `${pkg}@0.1.0`],
    });
  });

  it('en Windows envuelve npx con cmd /c', () => {
    expect(common.kitVideoMakerEntry('0.1.0', '.gemini/settings.json', 'win32')).toEqual({
      command: 'cmd',
      args: ['/c', 'npx', '-y', `${pkg}@0.1.0`],
    });
    expect(common.kitVideoMakerEntry('0.1.0', '.vscode/mcp.json', 'win32')).toEqual({
      type: 'stdio',
      command: 'cmd',
      args: ['/c', 'npx', '-y', `${pkg}@0.1.0`],
    });
  });

  it('reconoce npx y cmd /c npx; lo demás es personalizado', () => {
    expect(common.isKitVideoMakerEntry({ command: 'npx', args: ['-y', `${pkg}@0.1.0`] })).toBe(true);
    expect(common.isKitVideoMakerEntry({ command: 'npx', args: ['-y', pkg] })).toBe(true);
    expect(common.isKitVideoMakerEntry({ command: 'cmd', args: ['/c', 'npx', '-y', `${pkg}@0.1.0`] })).toBe(true);
    expect(common.isKitVideoMakerEntry(undefined)).toBe(false);
    expect(common.isKitVideoMakerEntry({ command: 'node', args: ['server.js'] })).toBe(false);
    expect(common.isKitVideoMakerEntry({ command: 'npx', args: ['-y', `${pkg}-beta@1.0.0`] })).toBe(false);
    expect(common.isKitVideoMakerEntry({ command: 'cmd', args: ['/c', 'node', pkg] })).toBe(false);
    expect(common.isKitVideoMakerEntry({ url: 'https://example.com/mcp' })).toBe(false);
  });

  it('desired: sin entrada o personalizada devuelve la canónica; con la misma versión no toca nada', () => {
    expect(common.desiredVideoMakerEntry(undefined, '0.1.0', '.gemini/settings.json', 'linux')).toEqual(
      common.kitVideoMakerEntry('0.1.0', '.gemini/settings.json', 'linux'),
    );
    const win = { command: 'cmd', args: ['/c', 'npx', '-y', `${pkg}@0.1.0`] };
    expect(common.desiredVideoMakerEntry(win, '0.1.0', '.gemini/settings.json', 'linux')).toBe(win);
  });

  it('desired: sube solo el token de versión y conserva el resto', () => {
    const existing = { type: 'stdio', command: 'npx', args: ['-y', `${pkg}@0.0.9`, '--flag'], env: { A: '1' } };
    expect(common.desiredVideoMakerEntry(existing, '0.1.0', '.vscode/mcp.json')).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', `${pkg}@0.1.0`, '--flag'],
      env: { A: '1' },
    });
  });
});

describe('estado del plugin en .claude/settings.json', () => {
  it('missing con un documento vacío', () => {
    expect(common.pluginDeclarationState({})).toBe('missing');
  });

  it('declared con el marketplace del kit y el plugin en true', () => {
    expect(
      common.pluginDeclarationState({
        extraKnownMarketplaces: { 'video-maker': MARKET },
        enabledPlugins: { 'video-maker@video-maker': true },
      }),
    ).toBe('declared');
  });

  it('missing si solo está la mitad', () => {
    expect(common.pluginDeclarationState({ enabledPlugins: { 'video-maker@video-maker': true } })).toBe('missing');
    expect(common.pluginDeclarationState({ extraKnownMarketplaces: { 'video-maker': MARKET } })).toBe('missing');
  });

  it('disabled si el plugin está en false', () => {
    expect(common.pluginDeclarationState({ enabledPlugins: { 'video-maker@video-maker': false } })).toBe('disabled');
  });

  it('foreign-marketplace si el marketplace apunta a otro repo', () => {
    expect(
      common.pluginDeclarationState({
        extraKnownMarketplaces: { 'video-maker': { source: { source: 'github', repo: 'someone/else' } } },
      }),
    ).toBe('foreign-marketplace');
  });

  it('invalid-container si una sección no es objeto', () => {
    expect(common.pluginDeclarationState({ enabledPlugins: [] })).toBe('invalid-container');
    expect(common.pluginDeclarationState({ extraKnownMarketplaces: 'x' })).toBe('invalid-container');
  });

  it('upsert agrega las dos claves sin tocar las ajenas y es idempotente', () => {
    const doc = { model: 'opus', enabledPlugins: { other: true }, extraKnownMarketplaces: { other: { x: 1 } } };
    const first = common.planPluginUpsert(doc);
    expect(first.outcome).toBe('created');
    expect(first.doc).toEqual({
      model: 'opus',
      enabledPlugins: { other: true, 'video-maker@video-maker': true },
      extraKnownMarketplaces: { other: { x: 1 }, 'video-maker': MARKET },
    });
    expect(common.planPluginUpsert(first.doc).outcome).toBe('unchanged');
  });

  it('upsert respeta un plugin desactivado y un marketplace ajeno', () => {
    const disabled = { enabledPlugins: { 'video-maker@video-maker': false } };
    expect(common.planPluginUpsert(disabled)).toEqual({ doc: disabled, outcome: 'disabled' });
    const foreign = { extraKnownMarketplaces: { 'video-maker': { source: { source: 'github', repo: 'a/b' } } } };
    expect(common.planPluginUpsert(foreign)).toEqual({ doc: foreign, outcome: 'foreign-marketplace' });
  });

  it('remove quita solo lo del kit y limpia los contenedores vacíos', () => {
    const doc = {
      model: 'opus',
      enabledPlugins: { other: true, 'video-maker@video-maker': true },
      extraKnownMarketplaces: { 'video-maker': MARKET },
    };
    const removed = common.planPluginRemove(doc);
    expect(removed.outcome).toBe('removed');
    expect(removed.doc).toEqual({ model: 'opus', enabledPlugins: { other: true } });
    expect(common.planPluginRemove(removed.doc).outcome).toBe('absent');
  });

  it('remove deja el marketplace ajeno y el plugin en false', () => {
    const foreign = {
      enabledPlugins: { 'video-maker@video-maker': false },
      extraKnownMarketplaces: { 'video-maker': { source: { source: 'github', repo: 'a/b' } } },
    };
    expect(common.planPluginRemove(foreign)).toEqual({ doc: foreign, outcome: 'foreign-marketplace' });
  });
});

describe('videoMakerStatus', () => {
  let root: string;
  const write = (rel: string, value: unknown) => {
    const file = resolve(root, rel);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  };
  const kitEntry = (target: string) => common.kitVideoMakerEntry('0.1.0', target, 'linux');
  const wireAll = () => {
    write('.claude/settings.json', {
      extraKnownMarketplaces: { 'video-maker': MARKET },
      enabledPlugins: { 'video-maker@video-maker': true },
    });
    write('.vscode/mcp.json', { servers: { 'video-maker': kitEntry('.vscode/mcp.json') } });
    write('.gemini/settings.json', { mcpServers: { 'video-maker': kitEntry('.gemini/settings.json') } });
  };

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'video-maker-common-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('off cuando no está prendido, con la forma completa', () => {
    const status = common.videoMakerStatus(root, {});
    expect(status).toEqual({
      enabled: false,
      state: 'off',
      parts: { plugin: true, mcp: true },
      version: '0.1.0',
      kit_version: '0.1.0',
      update_available: false,
      node_ok: status.node_ok,
      plugin: { file: '.claude/settings.json', marketplace: 'video-maker', id: 'video-maker@video-maker', state: 'no-file' },
      mcp: { '.vscode/mcp.json': 'no-file', '.gemini/settings.json': 'no-file' },
      harnesses: {
        claude: 'incomplete',
        copilot: 'incomplete',
        gemini: 'incomplete',
        antigravity: 'incomplete',
      },
      unknown_keys: [],
    });
    expect(typeof status.node_ok).toBe('boolean');
  });

  it('incomplete con repair cuando está prendido y falta todo', () => {
    const status = common.videoMakerStatus(root, { video_maker: { enabled: true } });
    expect(status.state).toBe('incomplete');
    expect(status.repair).toBe('pnpm sdd:video -- --enable');
  });

  it('complete con plugin y las dos entradas MCP', () => {
    wireAll();
    const status = common.videoMakerStatus(root, { video_maker: { enabled: true, version: '0.1.0' } });
    expect(status.state).toBe('complete');
    expect(status.repair).toBeUndefined();
    expect(status.plugin.state).toBe('declared');
    expect(status.mcp).toEqual({ '.vscode/mcp.json': 'present', '.gemini/settings.json': 'present' });
    expect(Object.values(status.harnesses)).toEqual(['complete', 'complete', 'complete', 'complete']);
    expect(status.mcp).not.toHaveProperty('.mcp.json');
  });

  it('una entrada propia cuenta como completa; plugin desactivado también', () => {
    wireAll();
    write('.vscode/mcp.json', { servers: { 'video-maker': { command: 'node', args: ['mine.js'] } } });
    write('.claude/settings.json', { enabledPlugins: { 'video-maker@video-maker': false } });
    const status = common.videoMakerStatus(root, { video_maker: { enabled: true } });
    expect(status.mcp['.vscode/mcp.json']).toBe('custom');
    expect(status.plugin.state).toBe('disabled');
    expect(status.state).toBe('complete');
  });

  it('solo Claude queda incompleto si falta el plugin', () => {
    wireAll();
    write('.claude/settings.json', {});
    const status = common.videoMakerStatus(root, { video_maker: { enabled: true } });
    expect(status.harnesses).toEqual({
      claude: 'incomplete',
      copilot: 'complete',
      gemini: 'complete',
      antigravity: 'complete',
    });
  });

  it('con parts apagadas reporta n/a y no exige esa parte', () => {
    wireAll();
    write('.claude/settings.json', {});
    const status = common.videoMakerStatus(root, { video_maker: { enabled: true, plugin: false } });
    expect(status.plugin.state).toBe('n/a');
    expect(status.state).toBe('complete');
    const mcpOff = common.videoMakerStatus(root, { video_maker: { enabled: true, plugin: false, mcp: false } });
    expect(mcpOff.state).toBe('off');
    expect(mcpOff.mcp).toEqual({ '.vscode/mcp.json': 'n/a', '.gemini/settings.json': 'n/a' });
  });

  it('detecta broken, invalid-container y missing', () => {
    write('.vscode/mcp.json', '{ not json');
    write('.gemini/settings.json', { mcpServers: [] });
    write('.claude/settings.json', '{ nope');
    const status = common.videoMakerStatus(root, { video_maker: { enabled: true } });
    expect(status.mcp).toEqual({ '.vscode/mcp.json': 'broken', '.gemini/settings.json': 'invalid-container' });
    expect(status.plugin.state).toBe('broken');
    write('.gemini/settings.json', { mcpServers: {} });
    expect(common.videoMakerStatus(root, { video_maker: { enabled: true } }).mcp['.gemini/settings.json']).toBe('missing');
  });

  it('update_available cuando la versión declarada es menor que la del kit', () => {
    const status = common.videoMakerStatus(root, { video_maker: { enabled: true, version: '0.0.9' } });
    expect(status.update_available).toBe(true);
    expect(status.version).toBe('0.0.9');
  });

  it('lee sdd/tools.json cuando no se pasa tools', () => {
    write('sdd/tools.json', { rtk: {}, video_maker: { enabled: true, bogus: true } });
    const status = common.videoMakerStatus(root);
    expect(status.enabled).toBe(true);
    expect(status.unknown_keys).toEqual(['bogus']);
  });
});
