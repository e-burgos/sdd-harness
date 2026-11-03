import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildMcpCatalog, configureMcpCommand } from '../configure/mcp.js';
import { configureMemoryCommand } from '../configure/memory.js';
import { syncMcpServers } from '../../utils/mcp-sync.js';
import { loadTucuUiCommon } from '../../utils/kit-scripts.js';

type Runner = (ctx: { args: Record<string, unknown> }) => Promise<void>;
const runMcp = configureMcpCommand.run as unknown as Runner;
const runMemory = configureMemoryCommand.run as unknown as Runner;

describe('configure mcp / memory: merge sobre .mcp.json', () => {
  let dir: string;
  let mcpPath: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'harness-configure-mcp-'));
    mcpPath = resolve(dir, '.mcp.json');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  const read = () => JSON.parse(readFileSync(mcpPath, 'utf-8'));
  const write = (doc: unknown) => writeFileSync(mcpPath, `${JSON.stringify(doc, null, 2)}\n`);

  const exitSpy = () =>
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

  it('el catálogo suma tucu-ui con la entrada canónica y la versión fijada del kit', async () => {
    const catalog = await buildMcpCatalog();
    const common = await loadTucuUiCommon();
    expect(catalog['tucu-ui'].hint).toBe('Design MCP for @e-burgos/tucu-ui (React/Next frontends)');
    expect(catalog['tucu-ui'].config).toEqual({
      command: 'npx',
      args: ['-y', `@e-burgos/tucu-ui-mcp@${common.TUCU_UI_PINNED_VERSION}`],
    });
    expect(Object.keys(catalog)).toEqual(
      expect.arrayContaining(['nx-mcp', 'github', 'playwright', 'figma', 'notion', 'filesystem']),
    );
  });

  it('crea .mcp.json con lo seleccionado y no toca sdd/tools.json', async () => {
    mkdirSync(resolve(dir, 'sdd'));
    const tools = '{ "rtk": { "enabled": true } }\n';
    writeFileSync(resolve(dir, 'sdd/tools.json'), tools);
    await runMcp({ args: { servers: 'tucu-ui,playwright' } });
    expect(Object.keys(read().mcpServers)).toEqual(['playwright', 'tucu-ui']);
    expect(readFileSync(resolve(dir, 'sdd/tools.json'), 'utf-8')).toBe(tools);
  });

  it('conserva servidores ajenos, claves de primer nivel y el orden', async () => {
    write({
      $comment: 'mine',
      mcpServers: { zeta: { command: 'z' }, alpha: { command: 'a', env: { K: '1' } } },
      other: { keep: true },
    });
    await runMcp({ args: { servers: 'tucu-ui' } });
    const doc = read();
    expect(Object.keys(doc.mcpServers)).toEqual(['zeta', 'alpha', 'tucu-ui']);
    expect(doc.mcpServers.alpha).toEqual({ command: 'a', env: { K: '1' } });
    expect(doc.$comment).toBe('mine');
    expect(doc.other).toEqual({ keep: true });
  });

  it('quita lo deseleccionado del catálogo y deja lo que no es del catálogo', async () => {
    const common = await loadTucuUiCommon();
    write({
      mcpServers: {
        github: { command: 'npx', args: ['-y', 'old'] },
        'tucu-ui': common.kitTucuEntry(common.TUCU_UI_PINNED_VERSION, '.mcp.json'),
        mine: { command: 'm' },
      },
    });
    await runMcp({ args: { servers: 'playwright' } });
    expect(Object.keys(read().mcpServers)).toEqual(['mine', 'playwright']);
  });

  it('no quita una entrada tucu-ui personalizada ni la pisa', async () => {
    const custom = { command: 'node', args: ['./my-tucu.js'] };
    write({ mcpServers: { 'tucu-ui': custom } });
    await runMcp({ args: { servers: 'playwright' } });
    expect(read().mcpServers['tucu-ui']).toEqual(custom);
    await runMcp({ args: { servers: 'tucu-ui,playwright' } });
    expect(read().mcpServers['tucu-ui']).toEqual(custom);
  });

  it('una entrada kit con envoltorio cmd /c o de otra versión sobrevive byte a byte', async () => {
    const wrapper = { command: 'cmd', args: ['/c', 'npx', '-y', '@e-burgos/tucu-ui-mcp@0.15.0'] };
    write({ mcpServers: { 'tucu-ui': wrapper } });
    await runMcp({ args: { servers: 'tucu-ui' } });
    expect(read().mcpServers['tucu-ui']).toEqual(wrapper);
    const older = { command: 'npx', args: ['-y', '@e-burgos/tucu-ui-mcp@0.15.0'] };
    write({ mcpServers: { 'tucu-ui': older } });
    const before = readFileSync(mcpPath, 'utf-8');
    await runMcp({ args: { servers: 'tucu-ui' } });
    expect(readFileSync(mcpPath, 'utf-8')).toBe(before);
  });

  it('sin .mcp.json y sin selección se escribe mcpServers vacío', async () => {
    const result = await syncMcpServers({
      mcpPath,
      catalog: { 'knowledge-graph': { command: 'k' } },
      selected: [],
      isOwn: () => true,
    });
    expect(result).toMatchObject({ ok: true, written: true });
    expect(read()).toEqual({ mcpServers: {} });
  });

  it('es idempotente: la segunda corrida no cambia el archivo', async () => {
    await runMcp({ args: { servers: 'tucu-ui,github' } });
    const first = readFileSync(mcpPath, 'utf-8');
    await runMcp({ args: { servers: 'tucu-ui,github' } });
    expect(readFileSync(mcpPath, 'utf-8')).toBe(first);
  });

  it('un .mcp.json roto sale con 1 sin escribir', async () => {
    writeFileSync(mcpPath, '{ not json');
    exitSpy();
    await expect(runMcp({ args: { servers: 'tucu-ui' } })).rejects.toThrow('exit:1');
    expect(readFileSync(mcpPath, 'utf-8')).toBe('{ not json');
  });

  it('un mcpServers que no es objeto sale con 1 sin escribir', async () => {
    write({ mcpServers: [] });
    const before = readFileSync(mcpPath, 'utf-8');
    exitSpy();
    await expect(runMcp({ args: { servers: 'tucu-ui' } })).rejects.toThrow('exit:1');
    expect(readFileSync(mcpPath, 'utf-8')).toBe(before);
  });

  it('configure memory conserva servidores ajenos, incluido tucu-ui', async () => {
    const common = await loadTucuUiCommon();
    const tucu = common.kitTucuEntry(common.TUCU_UI_PINNED_VERSION, '.mcp.json');
    write({ mcpServers: { 'tucu-ui': tucu, mine: { command: 'm' } }, extra: 1 });
    await runMemory({ args: { providers: 'knowledge-graph' } });
    let doc = read();
    expect(Object.keys(doc.mcpServers)).toEqual(['tucu-ui', 'mine', 'knowledge-graph']);
    expect(doc.mcpServers['tucu-ui']).toEqual(tucu);
    expect(doc.extra).toBe(1);

    await runMemory({ args: { providers: 'basic-memory' } });
    doc = read();
    expect(Object.keys(doc.mcpServers)).toEqual(['tucu-ui', 'mine', 'basic-memory']);
  });

  it('configure memory con .mcp.json roto sale con 1 sin escribir', async () => {
    writeFileSync(mcpPath, '[1,');
    exitSpy();
    await expect(runMemory({ args: { providers: 'basic-memory' } })).rejects.toThrow('exit:1');
    expect(readFileSync(mcpPath, 'utf-8')).toBe('[1,');
    expect(existsSync(`${mcpPath}.tmp-${process.pid}`)).toBe(false);
  });
});
