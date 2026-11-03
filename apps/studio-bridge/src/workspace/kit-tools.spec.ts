import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cp } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  KitToolsError,
  applyToolsChange,
  computeToolsRevision,
  effectiveToolsValues,
  setKitTool,
} from './kit-tools';

const repoSchema = path.resolve(__dirname, '../../../../sdd/schemas/tools.schema.json');

let root: string;
const toolsFile = () => path.join(root, 'sdd', 'tools.json');
const writeTools = (content: string) => writeFile(toolsFile(), content, 'utf8');
const revisionOnDisk = async () => computeToolsRevision(await readFile(toolsFile()));
const readDoc = async () => JSON.parse(await readFile(toolsFile(), 'utf8')) as Record<string, unknown>;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'kit-tools-'));
  await mkdir(path.join(root, 'sdd', 'schemas'), { recursive: true });
  await cp(repoSchema, path.join(root, 'sdd', 'schemas', 'tools.schema.json'));
});
afterEach(() => rm(root, { recursive: true, force: true }));

const baseDoc = { $schema: './schemas/tools.schema.json', rtk: { enabled: true, auto_install: true } };

describe('applyToolsChange', () => {
  it('merges rtk.enabled keeping sibling keys and key order', () => {
    const next = applyToolsChange({ rtk: { enabled: true, auto_install: false }, other: 1 }, { tool: 'rtk', enabled: false });
    expect(JSON.stringify(next)).toBe('{"rtk":{"enabled":false,"auto_install":false},"other":1}');
  });

  it('adds a missing claude_mod at the end with defaults', () => {
    const next = applyToolsChange({ rtk: { enabled: true } }, { tool: 'mod', enabled: true });
    expect(JSON.stringify(next)).toBe('{"rtk":{"enabled":true},"claude_mod":{"enabled":true,"gate":"block"}}');
  });

  it('patches only gate on an existing claude_mod', () => {
    const next = applyToolsChange({ claude_mod: { enabled: true } }, { tool: 'gate', mode: 'warn' });
    expect(next.claude_mod).toEqual({ enabled: true, gate: 'warn' });
  });

  it('does not mutate its input', () => {
    const doc = { rtk: { enabled: true } };
    applyToolsChange(doc, { tool: 'rtk', enabled: false });
    expect(doc).toEqual({ rtk: { enabled: true } });
  });
});

describe('effectiveToolsValues', () => {
  it('uses the script defaults', () => {
    expect(effectiveToolsValues({})).toEqual({ rtkEnabled: true, modEnabled: false, gate: 'block' });
    expect(effectiveToolsValues({ rtk: { enabled: false }, claude_mod: { enabled: true, gate: 'warn' } })).toEqual({
      rtkEnabled: false,
      modEnabled: true,
      gate: 'warn',
    });
    expect(effectiveToolsValues({ claude_mod: { gate: 'weird' } }).gate).toBe('block');
  });
});

describe('setKitTool', () => {
  it('writes rtk off with 2-space JSON, trailing newline and the new revision', async () => {
    await writeTools(JSON.stringify(baseDoc));
    const result = await setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk());
    const raw = await readFile(toolsFile(), 'utf8');
    expect(raw).toBe(`${JSON.stringify({ ...baseDoc, rtk: { enabled: false, auto_install: true } }, null, 2)}\n`);
    expect(result).toMatchObject({ changed: true, tool: 'rtk', from: true, to: false, warnings: [] });
    expect(result.tools).toMatchObject({ status: 'ok', rtkEnabled: false, revision: computeToolsRevision(raw) });
  });

  it('applies mod and gate changes', async () => {
    await writeTools(JSON.stringify(baseDoc));
    await setKitTool(root, { tool: 'mod', enabled: true }, await revisionOnDisk());
    const result = await setKitTool(root, { tool: 'gate', mode: 'warn' }, await revisionOnDisk());
    expect(result).toMatchObject({ changed: true, from: 'block', to: 'warn' });
    expect((await readDoc()).claude_mod).toEqual({ enabled: true, gate: 'warn' });
  });

  it('is a no-op without touching the file when the value already matches', async () => {
    const original = '{"rtk":{"enabled":true}}';
    await writeTools(original);
    const result = await setKitTool(root, { tool: 'rtk', enabled: true }, await revisionOnDisk());
    expect(result).toMatchObject({ changed: false, from: true, to: true, warnings: [] });
    expect(await readFile(toolsFile(), 'utf8')).toBe(original);
  });

  it('reports not-found and never creates the file', async () => {
    await expect(setKitTool(root, { tool: 'rtk', enabled: false }, 'a'.repeat(16))).rejects.toMatchObject({ code: 'not-found' });
    expect(await readdir(path.join(root, 'sdd'))).toEqual(['schemas']);
  });

  it('reports conflict when the revision differs and leaves the file alone', async () => {
    await writeTools(JSON.stringify(baseDoc));
    const before = await readFile(toolsFile(), 'utf8');
    await expect(setKitTool(root, { tool: 'rtk', enabled: false }, '0'.repeat(16))).rejects.toMatchObject({ code: 'conflict' });
    expect(await readFile(toolsFile(), 'utf8')).toBe(before);
  });

  it('refuses invalid JSON and non-objects', async () => {
    for (const content of ['not json', '[]', '"x"']) {
      await writeTools(content);
      await expect(setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk())).rejects.toMatchObject({
        code: 'bad-request',
      });
      expect(await readFile(toolsFile(), 'utf8')).toBe(content);
    }
  });

  it('refuses a document that violates the repo schema before changing it', async () => {
    const content = JSON.stringify({ rtk: { enabled: 'yes' } });
    await writeTools(content);
    const error = await setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk()).catch((e) => e);
    expect(error).toBeInstanceOf(KitToolsError);
    expect(error.code).toBe('bad-request');
    expect(error.message).toContain('rtk/enabled');
    expect(await readFile(toolsFile(), 'utf8')).toBe(content);
  });

  it('uses the repo schema, so an extra property is rejected', async () => {
    await writeTools(JSON.stringify({ ...baseDoc, surprise: true }));
    await expect(setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk())).rejects.toMatchObject({
      code: 'bad-request',
    });
  });

  it('accepts a tucu_ui section (even with an unknown key inside) and keeps it byte for byte', async () => {
    const tucu = { enabled: true, skill: true, mcp: false, version: '0.16.0', extra: 1 };
    await writeTools(JSON.stringify({ ...baseDoc, tucu_ui: tucu }));
    const result = await setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk());
    expect(result).toMatchObject({ changed: true, tool: 'rtk', to: false });
    const doc = await readDoc();
    expect(doc.tucu_ui).toEqual(tucu);
    expect(Object.keys(doc)).toEqual(['$schema', 'rtk', 'tucu_ui']);
  });

  it('still rejects an unknown root key next to tucu_ui', async () => {
    await writeTools(JSON.stringify({ ...baseDoc, tucu_ui: { enabled: false }, surprise: true }));
    await expect(setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk())).rejects.toMatchObject({
      code: 'bad-request',
    });
  });

  it('rejects a wrongly typed tucu_ui.enabled', async () => {
    await writeTools(JSON.stringify({ ...baseDoc, tucu_ui: { enabled: 'yes' } }));
    await expect(setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk())).rejects.toMatchObject({
      code: 'bad-request',
    });
  });

  it('falls back to a structural check when the repo has no schema', async () => {
    await rm(path.join(root, 'sdd', 'schemas'), { recursive: true });
    await writeTools(JSON.stringify({ rtk: { enabled: true }, extra: 1 }));
    const ok = await setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk());
    expect(ok.changed).toBe(true);

    await writeTools(JSON.stringify({ rtk: { enabled: true }, claude_mod: { gate: 'loud' } }));
    await expect(setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk())).rejects.toMatchObject({
      code: 'bad-request',
    });
    await writeTools(JSON.stringify({ rtk: { enabled: 'x' } }));
    await expect(setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk())).rejects.toMatchObject({
      code: 'bad-request',
    });
  });

  it('warns mod-not-linked only when the mod ends enabled without the plugin', async () => {
    await writeTools(JSON.stringify(baseDoc));
    const unlinked = await setKitTool(root, { tool: 'mod', enabled: true }, await revisionOnDisk());
    expect(unlinked.warnings).toEqual(['mod-not-linked']);
    expect(unlinked.tools.modLinked).toBe(false);

    await mkdir(path.join(root, '.claude', 'skills', 'sdd-mod', '.claude-plugin'), { recursive: true });
    await writeFile(path.join(root, '.claude', 'skills', 'sdd-mod', '.claude-plugin', 'plugin.json'), '{}');
    const linked = await setKitTool(root, { tool: 'gate', mode: 'warn' }, await revisionOnDisk());
    expect(linked.warnings).toEqual([]);
    expect(linked.tools.modLinked).toBe(true);

    const off = await setKitTool(root, { tool: 'mod', enabled: false }, await revisionOnDisk());
    expect(off.warnings).toEqual([]);
  });

  it('leaves no temporary file behind', async () => {
    await writeTools(JSON.stringify(baseDoc));
    await setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk());
    expect(await readdir(path.join(root, 'sdd'))).toEqual(['schemas', 'tools.json']);
  });

  it('serializes concurrent writes: a second write with a stale revision conflicts', async () => {
    await writeTools(JSON.stringify(baseDoc));
    const revision = await revisionOnDisk();
    const results = await Promise.allSettled([
      setKitTool(root, { tool: 'rtk', enabled: false }, revision),
      setKitTool(root, { tool: 'mod', enabled: true }, revision),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'conflict' } });
    const doc = await readDoc();
    expect(doc.claude_mod).toBeUndefined();
    expect((doc.rtk as { enabled: boolean }).enabled).toBe(false);
  });

  it('chains sequential writes that each carry the latest revision', async () => {
    await writeTools(JSON.stringify(baseDoc));
    const first = await setKitTool(root, { tool: 'rtk', enabled: false }, await revisionOnDisk());
    const second = await setKitTool(root, { tool: 'mod', enabled: true }, first.tools.revision as string);
    expect(second.changed).toBe(true);
    const doc = await readDoc();
    expect(doc).toMatchObject({ rtk: { enabled: false }, claude_mod: { enabled: true, gate: 'block' } });
  });
});
