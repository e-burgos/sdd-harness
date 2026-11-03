import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

type Doc = Record<string, unknown>;
type Plan = { doc: Doc; outcome: string };
type McpConfig = {
  MCP_TARGETS: { file: string; container: string; harnesses: string[]; stdioType?: boolean }[];
  readMcpConfig: (path: string) => { state: string; doc?: Doc; reason?: string };
  containerState: (doc: Doc, container: string) => string;
  planUpsert: (doc: Doc, container: string, name: string, entry: unknown, isOwn: (e: unknown) => boolean) => Plan;
  planRemove: (doc: Doc, container: string, name: string, isOwn: (e: unknown) => boolean) => Plan;
  writeMcpConfig: (path: string, doc: Doc) => boolean;
};

let mod: McpConfig;

beforeAll(async () => {
  const file = resolve(__dirname, '../../../templates/sdd/scripts/mcp-config.mjs');
  mod = (await import(pathToFileURL(file).href)) as McpConfig;
});

const own = (entry: unknown) => (entry as { own?: boolean })?.own === true;
const entry = { own: true, command: 'npx' };

describe('mcp-config', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'harness-mcp-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('declara los tres archivos con su contenedor', () => {
    expect(mod.MCP_TARGETS.map((t) => [t.file, t.container])).toEqual([
      ['.mcp.json', 'mcpServers'],
      ['.vscode/mcp.json', 'servers'],
      ['.gemini/settings.json', 'mcpServers'],
    ]);
    expect(mod.MCP_TARGETS[1]?.stdioType).toBe(true);
  });

  describe('readMcpConfig', () => {
    it('distingue missing, broken y ok', () => {
      const file = resolve(dir, 'a.json');
      expect(mod.readMcpConfig(file)).toEqual({ state: 'missing' });
      writeFileSync(file, '{ nope');
      expect(mod.readMcpConfig(file).state).toBe('broken');
      writeFileSync(file, '[1]');
      expect(mod.readMcpConfig(file).state).toBe('broken');
      writeFileSync(file, '{"a":1}');
      expect(mod.readMcpConfig(file)).toEqual({ state: 'ok', doc: { a: 1 } });
    });

    it('un archivo con comentarios explica que el merge del kit no los soporta', () => {
      const file = resolve(dir, 'c.json');
      writeFileSync(file, '{\n  // note\n  "a": 1\n}');
      const result = mod.readMcpConfig(file);
      expect(result.state).toBe('broken');
      expect(result.reason).toContain('comments or trailing commas are not supported');
      writeFileSync(file, '{ nope');
      expect(mod.readMcpConfig(file).reason).not.toContain('comments');
    });

    it('tolera un BOM inicial', () => {
      const file = resolve(dir, 'bom.json');
      writeFileSync(file, '﻿{"mcpServers":{}}');
      expect(mod.readMcpConfig(file)).toEqual({ state: 'ok', doc: { mcpServers: {} } });
    });
  });

  describe('containerState', () => {
    it('absent, ok e invalid', () => {
      expect(mod.containerState({}, 'servers')).toBe('absent');
      expect(mod.containerState({ servers: {} }, 'servers')).toBe('ok');
      expect(mod.containerState({ servers: [] }, 'servers')).toBe('invalid');
      expect(mod.containerState({ servers: null }, 'servers')).toBe('invalid');
      expect(mod.containerState({ servers: 'x' }, 'servers')).toBe('invalid');
    });
  });

  describe('planUpsert', () => {
    it('agrega al final conservando orden y claves ajenas', () => {
      const doc = { other: 1, mcpServers: { a: { command: 'a' }, b: { command: 'b' } }, tail: true };
      const plan = mod.planUpsert(doc, 'mcpServers', 'tucu-ui', entry, own);
      expect(plan.outcome).toBe('created');
      expect(Object.keys(plan.doc)).toEqual(['other', 'mcpServers', 'tail']);
      expect(Object.keys(plan.doc['mcpServers'] as object)).toEqual(['a', 'b', 'tucu-ui']);
      expect(doc.mcpServers).not.toHaveProperty('tucu-ui');
    });

    it('crea el contenedor ausente', () => {
      const plan = mod.planUpsert({ keep: 1 }, 'servers', 'x', entry, own);
      expect(plan.outcome).toBe('created');
      expect(plan.doc).toEqual({ keep: 1, servers: { x: entry } });
    });

    it('contenedor que no es objeto: no modifica nada', () => {
      const doc = { servers: [] };
      const plan = mod.planUpsert(doc, 'servers', 'x', entry, own);
      expect(plan).toEqual({ doc, outcome: 'invalid-container' });
    });

    it('reemplaza en el mismo lugar una entrada propia distinta', () => {
      const doc = { mcpServers: { a: 1, x: { own: true, command: 'old' }, z: 3 } };
      const plan = mod.planUpsert(doc, 'mcpServers', 'x', entry, own);
      expect(plan.outcome).toBe('updated');
      expect(Object.keys(plan.doc['mcpServers'] as object)).toEqual(['a', 'x', 'z']);
      expect((plan.doc['mcpServers'] as Doc)['x']).toEqual(entry);
    });

    it('unchanged cuando la entrada propia ya es igual en profundidad', () => {
      const doc = { mcpServers: { x: { own: true, command: 'npx' } } };
      const plan = mod.planUpsert(doc, 'mcpServers', 'x', { ...entry }, own);
      expect(plan).toEqual({ doc, outcome: 'unchanged' });
    });

    it('custom: una entrada ajena no se toca', () => {
      const doc = { mcpServers: { x: { command: 'mine' } } };
      const plan = mod.planUpsert(doc, 'mcpServers', 'x', entry, own);
      expect(plan).toEqual({ doc, outcome: 'custom' });
    });
  });

  describe('planRemove', () => {
    it('quita solo la entrada propia y deja el contenedor vacío como {}', () => {
      const doc = { top: 1, mcpServers: { x: { own: true } } };
      const plan = mod.planRemove(doc, 'mcpServers', 'x', own);
      expect(plan.outcome).toBe('removed');
      expect(plan.doc).toEqual({ top: 1, mcpServers: {} });
    });

    it('conserva los demás servidores', () => {
      const doc = { mcpServers: { a: 1, x: { own: true }, b: 2 } };
      expect(mod.planRemove(doc, 'mcpServers', 'x', own).doc).toEqual({ mcpServers: { a: 1, b: 2 } });
    });

    it('custom, absent e invalid-container no modifican', () => {
      const custom = { mcpServers: { x: { command: 'mine' } } };
      expect(mod.planRemove(custom, 'mcpServers', 'x', own)).toEqual({ doc: custom, outcome: 'custom' });
      expect(mod.planRemove({}, 'mcpServers', 'x', own).outcome).toBe('absent');
      expect(mod.planRemove({ mcpServers: {} }, 'mcpServers', 'x', own).outcome).toBe('absent');
      expect(mod.planRemove({ mcpServers: 3 }, 'mcpServers', 'x', own).outcome).toBe('invalid-container');
    });
  });

  describe('writeMcpConfig', () => {
    it('crea directorios, escribe con 2 espacios y salto final, sin dejar temporales', () => {
      const file = resolve(dir, 'nested/.vscode/mcp.json');
      expect(mod.writeMcpConfig(file, { servers: { x: 1 } })).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe('{\n  "servers": {\n    "x": 1\n  }\n}\n');
      expect(readdirSync(resolve(dir, 'nested/.vscode'))).toEqual(['mcp.json']);
    });

    it('idempotente: una segunda escritura igual no cambia bytes ni reescribe', () => {
      const file = resolve(dir, 'a.json');
      expect(mod.writeMcpConfig(file, { a: 1 })).toBe(true);
      const before = readFileSync(file);
      expect(mod.writeMcpConfig(file, { a: 1 })).toBe(false);
      expect(readFileSync(file).equals(before)).toBe(true);
    });

    it('no deja el temporal si el destino es un directorio', () => {
      const file = resolve(dir, 'conflict');
      mkdirSync(file);
      expect(() => mod.writeMcpConfig(file, { a: 1 })).toThrow();
      expect(readdirSync(dir)).toEqual(['conflict']);
    });
  });
});
