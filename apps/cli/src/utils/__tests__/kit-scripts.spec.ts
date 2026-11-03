import { describe, it, expect } from 'vitest';
import { loadMcpConfig, loadTucuUiCommon } from '../kit-scripts.js';

describe('kit-scripts', () => {
  it('carga mcp-config.mjs del template con su API completa', async () => {
    const mod = await loadMcpConfig();
    expect(mod.MCP_TARGETS.map((target) => target.file)).toEqual([
      '.mcp.json',
      '.vscode/mcp.json',
      '.gemini/settings.json',
    ]);
    for (const name of ['readMcpConfig', 'containerState', 'planUpsert', 'planRemove', 'writeMcpConfig'] as const) {
      expect(typeof mod[name]).toBe('function');
    }
  });

  it('carga tucu-ui-common.mjs y expone la versión fijada y la entrada canónica', async () => {
    const mod = await loadTucuUiCommon();
    expect(mod.TUCU_UI_PINNED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(mod.TUCU_UI_SERVER_NAME).toBe('tucu-ui');
    const entry = mod.kitTucuEntry(mod.TUCU_UI_PINNED_VERSION, '.mcp.json');
    expect(entry).toEqual({
      command: 'npx',
      args: ['-y', `@e-burgos/tucu-ui-mcp@${mod.TUCU_UI_PINNED_VERSION}`],
    });
    expect(mod.isKitTucuEntry(entry)).toBe(true);
  });

  it('reutiliza el módulo cargado entre llamadas', async () => {
    expect(await loadMcpConfig()).toBe(await loadMcpConfig());
  });

  it('el helper cargado planifica un upsert sin tocar lo ajeno', async () => {
    const [mcp, common] = await Promise.all([loadMcpConfig(), loadTucuUiCommon()]);
    const entry = common.kitTucuEntry(common.TUCU_UI_PINNED_VERSION, '.mcp.json');
    const plan = mcp.planUpsert(
      { mcpServers: { other: { command: 'x' } }, extra: 1 },
      'mcpServers',
      'tucu-ui',
      entry,
      common.isKitTucuEntry,
    );
    expect(plan.outcome).toBe('created');
    expect(Object.keys(plan.doc['mcpServers'] as object)).toEqual(['other', 'tucu-ui']);
    expect(plan.doc['extra']).toBe(1);
  });
});
