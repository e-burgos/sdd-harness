import { describe, expect, it } from 'vitest';
import { KIT_SECTIONS, KitEntry, KitIndex, MAX_KIT_ENTRIES, RtkGain, ToolsChange, ToolsSetResult } from './index';

const entry = { section: 'docs', role: 'doc', group: 'es', path: 'sdd/documentation/es/a.md', size: 10, mtime: '2026-10-27T00:00:00.000Z' };
const tools = { status: 'ok', rtkEnabled: true, modEnabled: false, gate: 'block', modLinked: false, revision: 'a1b2c3d4e5f60718' };

describe('KitEntry and KitIndex', () => {
  it('lists the five known sections', () => {
    expect(KIT_SECTIONS).toEqual(['docs', 'schemas', 'context', 'memory', 'registries']);
  });
  it('accepts a section the web does not know yet', () => {
    const future = { ...entry, section: 'future-section', role: 'future-role' };
    expect(KitIndex.parse({ revision: 'r', entries: [entry, future], truncated: false }).entries).toHaveLength(2);
  });
  it('rejects paths outside sdd/ and negative sizes', () => {
    expect(KitEntry.safeParse({ ...entry, path: 'apps/x.md' }).success).toBe(false);
    expect(KitEntry.safeParse({ ...entry, path: '../sdd/x.md' }).success).toBe(false);
    expect(KitEntry.safeParse({ ...entry, size: -1 }).success).toBe(false);
    expect(KitEntry.parse({ ...entry, group: null })).toMatchObject({ group: null });
  });
  it('caps entries at MAX_KIT_ENTRIES', () => {
    const entries = Array.from({ length: MAX_KIT_ENTRIES + 1 }, () => entry);
    expect(KitIndex.safeParse({ revision: 'r', entries, truncated: true }).success).toBe(false);
    expect(KitIndex.safeParse({ revision: 'r', entries: entries.slice(1), truncated: true }).success).toBe(true);
  });
});

describe('ToolsChange', () => {
  it('accepts one tool at a time', () => {
    for (const change of [
      { tool: 'rtk', enabled: false },
      { tool: 'mod', enabled: true },
      { tool: 'gate', mode: 'warn' },
    ]) expect(ToolsChange.parse(change)).toEqual(change);
  });
  it('is closed: no other tool, mode or field', () => {
    expect(ToolsChange.safeParse({ tool: 'profile', value: 'solo' }).success).toBe(false);
    expect(ToolsChange.safeParse({ tool: 'gate', mode: 'off' }).success).toBe(false);
    expect(ToolsChange.safeParse({ tool: 'rtk' }).success).toBe(false);
    expect(ToolsChange.safeParse({ tool: 'mod', enabled: 'yes' }).success).toBe(false);
    expect(ToolsChange.parse({ tool: 'rtk', enabled: true, extra: 1 })).toEqual({ tool: 'rtk', enabled: true });
  });
});

describe('ToolsSetResult', () => {
  const result = { changed: true, tool: 'gate', from: 'block', to: 'warn', tools: { ...tools, gate: 'warn' }, warnings: ['mod-not-linked'] };
  it('parses boolean and gate values', () => {
    expect(ToolsSetResult.parse(result)).toEqual(result);
    expect(ToolsSetResult.parse({ ...result, tool: 'rtk', from: null, to: false })).toMatchObject({ from: null, to: false });
    expect(ToolsSetResult.safeParse({ ...result, to: 'off' }).success).toBe(false);
  });
  it('bounds warnings', () => {
    expect(ToolsSetResult.safeParse({ ...result, warnings: Array(9).fill('w') }).success).toBe(false);
    expect(ToolsSetResult.safeParse({ ...result, warnings: ['x'.repeat(41)] }).success).toBe(false);
  });
});

describe('RtkGain', () => {
  const gain = { status: 'ok', version: '0.30.0', gain: { total_saved: 10 }, readAt: '2026-10-27T00:00:00.000Z' };
  it('parses each status', () => {
    expect(RtkGain.parse(gain)).toEqual(gain);
    expect(RtkGain.parse({ ...gain, status: 'not-installed', version: null, gain: null })).toMatchObject({ status: 'not-installed' });
  });
  it('degrades an unknown status to error', () => {
    expect(RtkGain.parse({ ...gain, status: 'timeout' }).status).toBe('error');
  });
});
