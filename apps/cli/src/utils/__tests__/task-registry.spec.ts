import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

type Json = any;
type Parsed = { ok: boolean; message?: string; request?: Json };
type Lib = {
  parseTaskRequest(argv: string[]): Parsed;
  buildUsage(request: Json, now?: Date): Json;
  splitTokens(total: number): { tokens_in: number; tokens_out: number };
  mergeFiles(...lists: string[][]): string[];
  filesFromShow(output: string, prefix?: string): string[];
  applyStart(doc: Json, id: string, options?: Json): Json;
  applyDone(doc: Json, id: string, input: Json): Json;
  parseTasksText(text: string): Json;
  serializeTasks(doc: Json): string;
  resolveSpecRef(specs: Json[], query: string): Json;
  normalizeCycleRef(raw: string): string | null;
};

let lib: Lib;
beforeAll(async () => {
  lib = (await import(pathToFileURL(resolve(__dirname, '../../../templates/sdd/scripts/lib/task-registry.mjs')).href)) as Lib;
});

const base = ['spec', 'cycle-01', 'TASK-001', 'done'];
const identity = ['--model', 'claude/sonnet', '--effort', 'medium', '--agent', 'implementor-back'];
const doneArgs = (...extra: string[]) => [...base, '--files', 'a.ts', '--tokens', '1000', ...identity, ...extra];

describe('parseTaskRequest', () => {
  it('parses start and done with defaults', () => {
    expect(lib.parseTaskRequest(['spec', 'cycle-01', 'TASK-001', 'start']).request).toMatchObject({ action: 'start', force: false });
    const done = lib.parseTaskRequest(doneArgs());
    expect(done.request).toMatchObject({ approx: false, source: 'agent-usage-notification', files: ['a.ts'], tokens: 1000 });
    expect(lib.parseTaskRequest(doneArgs('--approx')).request?.source).toBe('declared-estimate');
    expect(lib.parseTaskRequest(doneArgs('--approx', '--source', 'stats-command')).request?.source).toBe('stats-command');
  });

  it('rejects invalid input with a one-line message', () => {
    const bad = [
      doneArgs('--source', 'declared-estimate'),
      doneArgs('--batch', 'B-01', '--batch-tokens', '5'),
      doneArgs('--model', 'gpt-4'),
      doneArgs('--effort', 'Ultra High'),
      doneArgs('--agent', 'wizard'),
      doneArgs(...Array.from({ length: 6 }, (_, i) => ['--pack-miss', `p${i}`]).flat()),
      [...base, '--files', 'a', ...identity],
      [...base, ...identity, '--tokens', '5'],
      doneArgs('--tokens-in', '1', '--tokens-out', '2'),
      doneArgs('--tokens', '-4'),
      ['spec', 'cycle-01', 'T1', 'start'],
      ['spec', 'cycle-01', 'TASK-001', 'finish'],
      doneArgs('--nope'),
    ];
    for (const argv of bad) {
      const parsed = lib.parseTaskRequest(argv);
      expect(parsed.ok, argv.join(' ')).toBe(false);
      expect(parsed.message).toBeTruthy();
    }
  });
});

describe('buildUsage', () => {
  const now = new Date('2026-09-10T12:00:00Z');
  it('splits a total 85/15 and keeps tokens_total', () => {
    expect(lib.splitTokens(41200)).toEqual({ tokens_in: 35020, tokens_out: 6180 });
    const usage = lib.buildUsage(lib.parseTaskRequest(doneArgs('--duration', '12.5')).request!, now);
    expect(usage).toEqual({
      provider_model: 'claude/sonnet',
      effort: 'medium',
      agent: 'implementor-back',
      tokens_in: 850,
      tokens_out: 150,
      tokens_total: 1000,
      duration_minutes: 12.5,
      approx: false,
      source: 'agent-usage-notification',
      recorded_at: '2026-09-10',
    });
  });

  it('uses explicit in/out without tokens_total and adds allocation and pack_misses', () => {
    const request = lib.parseTaskRequest([
      ...base, '--files', 'a', '--tokens-in', '10', '--tokens-out', '2', ...identity,
      '--approx', '--batch', 'B-02', '--batch-tokens', '99', '--pack-miss', 'x.ts', '--pack-miss', 'y.ts',
    ]).request!;
    const usage = lib.buildUsage(request, now);
    expect(usage).toMatchObject({ tokens_in: 10, tokens_out: 2, approx: true, source: 'declared-estimate' });
    expect(usage.tokens_total).toBeUndefined();
    expect(usage.allocation).toEqual({ batch: 'B-02', batch_tokens: 99 });
    expect(usage.pack_misses).toEqual(['x.ts', 'y.ts']);
  });
});

describe('document helpers', () => {
  const doc = () => ({ tasks: [{ id: 'TASK-001', status: 'pending', files: [], title: 't' }, { id: 'TASK-002', status: 'done', files: ['z'], usage: { tokens_in: 1 } }] });

  it('merges files stably without duplicates and drops sdd/ paths from git output', () => {
    expect(lib.mergeFiles(['b', 'a'], ['a', 'c'])).toEqual(['b', 'a', 'c']);
    expect(lib.filesFromShow('src/a.ts\nsdd/x.md\n\nsrc/b.ts\n')).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('start and done mutate in place, usage lands after files, done on done needs force', () => {
    const d = doc();
    expect(lib.applyStart(d, 'TASK-001').ok).toBe(true);
    expect(d.tasks[0].status).toBe('in-progress');
    expect(lib.applyDone(d, 'TASK-001', { files: ['f'], usage: { u: 1 } }).ok).toBe(true);
    expect(Object.keys(d.tasks[0])).toEqual(['id', 'status', 'files', 'usage', 'title']);
    expect(lib.applyDone(d, 'TASK-001', { files: ['g'], usage: { u: 2 } }).ok).toBe(false);
    expect(lib.applyDone(d, 'TASK-001', { files: ['g'], usage: { u: 2 }, force: true }).ok).toBe(true);
    expect(d.tasks[0].files).toEqual(['g']);
    expect(lib.applyDone(d, 'TASK-009', { files: [], usage: {} }).ok).toBe(false);
  });

  it('tolerates BOM and CRLF and serializes LF with trailing newline', () => {
    const parsed = lib.parseTasksText('﻿{\r\n  "a": 1\r\n}\r\n');
    expect(lib.serializeTasks(parsed)).toBe('{\n  "a": 1\n}\n');
  });

  it('resolves specs by id, slug and normalizes cycles', () => {
    const specs = [{ id: 'spec-a-001-orders' }, { id: 'spec-a-002-billing' }];
    expect(lib.resolveSpecRef(specs, 'orders').spec).toEqual(specs[0]);
    expect(lib.resolveSpecRef(specs, 'spec-a-002-billing').spec).toEqual(specs[1]);
    expect(lib.resolveSpecRef(specs, 'spec-a').error).toContain('ambiguous');
    expect(lib.resolveSpecRef(specs, 'zzz').error).toContain('not in');
    expect(lib.normalizeCycleRef('1')).toBe('cycle-01');
    expect(lib.normalizeCycleRef('x')).toBeNull();
  });
});
