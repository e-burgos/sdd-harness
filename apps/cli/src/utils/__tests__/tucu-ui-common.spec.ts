import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { resolve, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';

type Entry = { type?: string; command: string; args: string[] };
type Status = {
  enabled: boolean;
  state: string;
  parts: { skill: boolean; mcp: boolean };
  version: string;
  kit_version: string;
  update_available: boolean;
  node_ok: boolean;
  skill: { dir: string; installed: boolean; links: Record<string, string> };
  mcp: Record<string, string>;
  harnesses: Record<string, string>;
  unknown_keys: string[];
  repair?: string;
};
type Common = {
  TUCU_UI_PACKAGE: string;
  TUCU_UI_PINNED_VERSION: string;
  TUCU_UI_INSTALL_DIR: string;
  TUCU_UI_LINK_DIRS: { dir: string; harnesses: string[] }[];
  TUCU_UI_KNOWN_KEYS: string[];
  tucuUiSettings: (tools: unknown) => {
    enabled: boolean;
    skill: boolean;
    mcp: boolean;
    version: string;
    versionDeclared: boolean;
    unknownKeys: string[];
  };
  compareVersions: (a: string, b: string) => number;
  kitTucuEntry: (version: string, target: string) => Entry;
  isKitTucuEntry: (entry: unknown) => boolean;
  desiredTucuEntry: (existing: unknown, version: string, target: string) => Entry;
  isSkillInstallComplete: (root: string) => boolean;
  tucuUiStatus: (root: string, tools?: unknown) => Status;
};

let common: Common;

beforeAll(async () => {
  const file = resolve(__dirname, '../../../templates/sdd/scripts/tucu-ui-common.mjs');
  common = (await import(pathToFileURL(file).href)) as Common;
});

describe('tucu-ui-common constants', () => {
  it('la versión fijada vive en una sola constante y se usa en la entrada canónica', () => {
    expect(common.TUCU_UI_PINNED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(common.kitTucuEntry(common.TUCU_UI_PINNED_VERSION, '.mcp.json')).toEqual({
      command: 'npx',
      args: ['-y', `${common.TUCU_UI_PACKAGE}@${common.TUCU_UI_PINNED_VERSION}`],
    });
    expect(common.TUCU_UI_INSTALL_DIR).toBe('sdd/integrations/skills/tucu-ui-design');
  });

  it('solo .vscode/mcp.json lleva type stdio', () => {
    expect(common.kitTucuEntry('1.2.3', '.vscode/mcp.json')).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', `${common.TUCU_UI_PACKAGE}@1.2.3`],
    });
    expect(common.kitTucuEntry('1.2.3', '.gemini/settings.json').type).toBeUndefined();
  });
});

describe('tucuUiSettings', () => {
  it('apagado por defecto con la clave ausente o tools nulo', () => {
    for (const tools of [null, undefined, {}, { rtk: {} }, { tucu_ui: 3 }, { tucu_ui: [] }]) {
      expect(common.tucuUiSettings(tools)).toMatchObject({
        enabled: false,
        skill: true,
        mcp: true,
        version: common.TUCU_UI_PINNED_VERSION,
        versionDeclared: false,
        unknownKeys: [],
      });
    }
  });

  it('respeta los valores declarados y reporta claves desconocidas', () => {
    const settings = common.tucuUiSettings({
      tucu_ui: { enabled: true, skill: false, mcp: true, version: '0.15.0', extra: 1 },
    });
    expect(settings).toMatchObject({
      enabled: true,
      skill: false,
      mcp: true,
      version: '0.15.0',
      versionDeclared: true,
      unknownKeys: ['extra'],
    });
  });

  it('una versión que no es semver se ignora', () => {
    const settings = common.tucuUiSettings({ tucu_ui: { enabled: true, version: 'latest' } });
    expect(settings.versionDeclared).toBe(false);
    expect(settings.version).toBe(common.TUCU_UI_PINNED_VERSION);
  });
});

describe('isKitTucuEntry', () => {
  const pkg = '@e-burgos/tucu-ui-mcp';
  it('reconoce npx y cmd /c npx', () => {
    expect(common.isKitTucuEntry({ command: 'npx', args: ['-y', `${pkg}@0.16.0`] })).toBe(true);
    expect(common.isKitTucuEntry({ command: 'npx', args: ['-y', pkg] })).toBe(true);
    expect(
      common.isKitTucuEntry({ command: 'cmd', args: ['/c', 'npx', '-y', `${pkg}@0.16.0`] }),
    ).toBe(true);
  });

  it('lo demás es personalizado', () => {
    expect(common.isKitTucuEntry(undefined)).toBe(false);
    expect(common.isKitTucuEntry(null)).toBe(false);
    expect(common.isKitTucuEntry({ command: 'node', args: ['server.js'] })).toBe(false);
    expect(common.isKitTucuEntry({ command: 'npx', args: ['-y', 'other-mcp'] })).toBe(false);
    expect(common.isKitTucuEntry({ command: 'npx' })).toBe(false);
    expect(common.isKitTucuEntry({ command: 'cmd', args: ['/c', 'node', pkg] })).toBe(false);
    expect(common.isKitTucuEntry({ url: 'https://example.com/mcp' })).toBe(false);
  });

  it('un paquete hermano con el mismo prefijo no es del kit', () => {
    expect(common.isKitTucuEntry({ command: 'npx', args: ['-y', `${pkg}-beta@1.0.0`] })).toBe(false);
    expect(common.isKitTucuEntry({ command: 'npx', args: ['-y', `${pkg}x`] })).toBe(false);
    expect(
      common.isKitTucuEntry({ command: 'cmd', args: ['/c', 'npx', '-y', `${pkg}-beta@1.0.0`] }),
    ).toBe(false);
  });
});

describe('desiredTucuEntry', () => {
  const pkg = '@e-burgos/tucu-ui-mcp';
  it('sin entrada previa o personalizada devuelve la canónica', () => {
    expect(common.desiredTucuEntry(undefined, '0.16.0', '.mcp.json')).toEqual(
      common.kitTucuEntry('0.16.0', '.mcp.json'),
    );
  });

  it('con la misma versión conserva el envoltorio cmd /c tal cual', () => {
    const wrapped = { command: 'cmd', args: ['/c', 'npx', '-y', `${pkg}@0.16.0`] };
    expect(common.desiredTucuEntry(wrapped, '0.16.0', '.mcp.json')).toBe(wrapped);
  });

  it('con otra versión reescribe solo el token y conserva el envoltorio', () => {
    const wrapped = { command: 'cmd', args: ['/c', 'npx', '-y', `${pkg}@0.15.0`] };
    expect(common.desiredTucuEntry(wrapped, '0.16.0', '.mcp.json')).toEqual({
      command: 'cmd',
      args: ['/c', 'npx', '-y', `${pkg}@0.16.0`],
    });
  });
});

describe('compareVersions', () => {
  it('compara numéricamente por componente', () => {
    expect(common.compareVersions('0.16.0', '0.16.0')).toBe(0);
    expect(common.compareVersions('0.9.0', '0.16.0')).toBe(-1);
    expect(common.compareVersions('1.0.0', '0.99.99')).toBe(1);
    expect(common.compareVersions('0.16.1', '0.16.0')).toBe(1);
  });
});

describe('tucuUiStatus', () => {
  let root: string;

  const write = (rel: string, content: string) => {
    const file = resolve(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const installSkill = () => {
    for (const f of ['SKILL.md', 'references/checklist.md', 'references/design-guide.md']) {
      write(`${common.TUCU_UI_INSTALL_DIR}/${f}`, 'x\n');
    }
  };
  const link = (dir: string) => {
    const target = resolve(root, common.TUCU_UI_INSTALL_DIR);
    const linkPath = resolve(root, dir, 'tucu-ui-design');
    mkdirSync(dirname(linkPath), { recursive: true });
    if (process.platform === 'win32') symlinkSync(target, linkPath, 'junction');
    else symlinkSync(relative(dirname(linkPath), target), linkPath, 'dir');
  };
  const on = { tucu_ui: { enabled: true, skill: true, mcp: true } };

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-tucu-common-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('con tools.json ausente o anterior reporta off sin escribir nada', () => {
    expect(common.tucuUiStatus(root).state).toBe('off');
    write('sdd/tools.json', JSON.stringify({ rtk: { enabled: true } }));
    const status = common.tucuUiStatus(root);
    expect(status).toMatchObject({ enabled: false, state: 'off', update_available: false });
    expect(status.repair).toBeUndefined();
  });

  it('con tools.json roto trata la integración como apagada', () => {
    write('sdd/tools.json', '{ broken');
    expect(common.tucuUiStatus(root).state).toBe('off');
  });

  it('prendido sin nada instalado es incomplete y trae el comando de reparación', () => {
    const status = common.tucuUiStatus(root, on);
    expect(status.state).toBe('incomplete');
    expect(status.repair).toBe('pnpm sdd:tucu -- --enable');
    expect(status.skill.installed).toBe(false);
    expect(Object.values(status.skill.links)).toEqual(['missing', 'missing', 'missing']);
    expect(Object.values(status.mcp)).toEqual(['no-file', 'no-file', 'no-file']);
    expect(Object.values(status.harnesses)).toEqual(['incomplete', 'incomplete', 'incomplete', 'incomplete']);
  });

  it('complete cuando skill, enlaces y entradas MCP están', () => {
    installSkill();
    for (const { dir } of common.TUCU_UI_LINK_DIRS) link(dir);
    write('.mcp.json', JSON.stringify({ mcpServers: { 'tucu-ui': common.kitTucuEntry('0.16.0', '.mcp.json') } }));
    write('.vscode/mcp.json', JSON.stringify({ servers: { 'tucu-ui': { command: 'mine' } } }));
    write(
      '.gemini/settings.json',
      JSON.stringify({ mcpServers: { 'tucu-ui': common.kitTucuEntry('0.16.0', '.gemini/settings.json') } }),
    );
    const status = common.tucuUiStatus(root, on);
    expect(status.state).toBe('complete');
    expect(status.mcp).toEqual({
      '.mcp.json': 'present',
      '.vscode/mcp.json': 'custom',
      '.gemini/settings.json': 'present',
    });
    expect(status.repair).toBeUndefined();
  });

  it('reporta foreign, broken e invalid-container por lugar y el arnés afectado', () => {
    installSkill();
    link('.claude/skills');
    mkdirSync(resolve(root, '.github/skills/tucu-ui-design'), { recursive: true });
    write('.mcp.json', '{ broken');
    write('.vscode/mcp.json', JSON.stringify({ servers: [] }));
    write('.gemini/settings.json', JSON.stringify({ context: { fileName: ['GEMINI.md'] } }));
    const status = common.tucuUiStatus(root, on);
    expect(status.skill.links).toEqual({
      '.claude/skills': 'linked',
      '.github/skills': 'foreign',
      '.agents/skills': 'missing',
    });
    expect(status.mcp).toEqual({
      '.mcp.json': 'broken',
      '.vscode/mcp.json': 'invalid-container',
      '.gemini/settings.json': 'missing',
    });
    expect(status.harnesses).toEqual({
      claude: 'incomplete',
      copilot: 'incomplete',
      gemini: 'incomplete',
      antigravity: 'incomplete',
    });
    expect(status.state).toBe('incomplete');
  });

  it('una parte deshabilitada es n/a y no define el estado', () => {
    installSkill();
    for (const { dir } of common.TUCU_UI_LINK_DIRS) link(dir);
    const status = common.tucuUiStatus(root, { tucu_ui: { enabled: true, skill: true, mcp: false } });
    expect(status.mcp).toEqual({ '.mcp.json': 'n/a', '.vscode/mcp.json': 'n/a', '.gemini/settings.json': 'n/a' });
    expect(status.state).toBe('complete');
  });

  it('skill y mcp apagados equivalen a off aunque enabled sea true', () => {
    expect(common.tucuUiStatus(root, { tucu_ui: { enabled: true, skill: false, mcp: false } }).state).toBe('off');
  });

  it('update_available solo con una versión declarada menor a la del kit; claves desconocidas listadas', () => {
    const old = common.tucuUiStatus(root, { tucu_ui: { enabled: false, version: '0.1.0', extra: true } });
    expect(old.update_available).toBe(true);
    expect(old.version).toBe('0.1.0');
    expect(old.unknown_keys).toEqual(['extra']);
    expect(common.tucuUiStatus(root, { tucu_ui: { enabled: false } }).update_available).toBe(false);
    expect(
      common.tucuUiStatus(root, { tucu_ui: { enabled: false, version: common.TUCU_UI_PINNED_VERSION } })
        .update_available,
    ).toBe(false);
  });

  it('isSkillInstallComplete exige los tres archivos', () => {
    write(`${common.TUCU_UI_INSTALL_DIR}/SKILL.md`, 'x');
    expect(common.isSkillInstallComplete(root)).toBe(false);
    installSkill();
    expect(common.isSkillInstallComplete(root)).toBe(true);
  });

  it('un enlace colgado hacia la carpeta del kit cuenta como missing', () => {
    installSkill();
    link('.github/skills');
    rmSync(resolve(root, common.TUCU_UI_INSTALL_DIR), { recursive: true, force: true });
    expect(common.tucuUiStatus(root, on).skill.links['.github/skills']).toBe('missing');
  });
});
