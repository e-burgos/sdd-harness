import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveInitInfo } from './claude-init';
import type { SdkMessageLike } from './sdk-mapper';

const initOf = (name: string): SdkMessageLike => {
  const records = readFileSync(new URL(`./__fixtures__/${name}.jsonl`, import.meta.url), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { kind: string; data: SdkMessageLike });
  const init = records.find((r) => r.kind === 'message' && r.data.type === 'system' && r.data.subtype === 'init');
  if (!init) throw new Error('fixture without init');
  return init.data;
};

describe('deriveInitInfo', () => {
  it('derives counts, plugins and servers from a recorded init', () => {
    const raw = initOf('simple') as Record<string, unknown>;
    const info = deriveInitInfo(initOf('simple'));
    expect(info.counts.skills).toBe((raw.skills as unknown[]).length);
    expect(info.counts.agents).toBe((raw.agents as unknown[]).length);
    expect(info.counts.mcpTools).toBe(0);
    expect(info.plugins).toEqual([{ id: 'cc-plugin-telemetry@builtin', name: 'cc-plugin-telemetry', scope: 'builtin' }]);
    expect(info.mcpServers).toEqual([]);
  });
  it('counts only mcp__ tools and keeps server states', () => {
    const info = deriveInitInfo({
      type: 'system',
      subtype: 'init',
      tools: ['Read', 'mcp__chrome-devtools__click', 'mcp__chrome-devtools__navigate_page'],
      mcp_servers: [{ name: 'chrome-devtools', status: 'failed', source: 'user' }, { name: 'x' }],
    } as SdkMessageLike);
    expect(info.counts).toMatchObject({ mcpTools: 2, mcpServers: 2, skills: 0, agents: 0 });
    expect(info.mcpServers).toEqual([
      { name: 'chrome-devtools', status: 'failed', source: 'user' },
      { name: 'x', status: 'unknown', source: 'unknown' },
    ]);
  });
  it('tolerates a malformed message', () => {
    expect(deriveInitInfo({ type: 'system', subtype: 'init', plugins: 'x', tools: null } as unknown as SdkMessageLike).counts.plugins).toBe(0);
  });
});
