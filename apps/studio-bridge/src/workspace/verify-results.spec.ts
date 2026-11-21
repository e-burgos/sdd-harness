import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readVerifyConfig } from './verify-config';
import { loadVerifyResults } from './verify-results';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'verify-results-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const result = (over: Record<string, unknown> = {}) => ({
  app: 'libs/x', level: 'quick', unit: 'TASK-001', ok: true, commit: 'abc', dirty: [],
  started_at: '2026-11-20T10:00:00.000Z', duration_ms: 500,
  commands: [{ command: 'pnpm test', exit_code: 0, duration_ms: 400, skipped: false }], ...over,
});
const loadVerifyConfig = async (root: string, doc: unknown) => {
  if (doc !== null) {
    await mkdir(path.join(root, 'sdd'), { recursive: true });
    await writeFile(path.join(root, 'sdd', 'verify.json'), JSON.stringify(doc));
  }
  return readVerifyConfig(root);
};
const put = async (rel: string, content: unknown) => {
  const file = path.join(dir, 'artifacts', 'verify', ...rel.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof content === 'string' ? content : JSON.stringify(content));
};

describe('loadVerifyResults', () => {
  it('keeps the most recent result per app, level and unit and sorts by startedAt desc', async () => {
    await put('libs-x/TASK-001-quick.json', result());
    await put('libs-x/TASK-001-quick-2.json', result({ ok: false, started_at: '2026-11-20T11:00:00.000Z' }));
    await put('libs-x/B-01-full.json', result({ level: 'full', unit: 'B-01', started_at: '2026-11-20T12:00:00.000Z', reused: true }));
    const results = await loadVerifyResults(dir);
    expect(results.map((r) => [r.unit, r.level, r.ok])).toEqual([['B-01', 'full', true], ['TASK-001', 'quick', false]]);
    expect(results[0]).toMatchObject({ reused: true, commit: 'abc', durationMs: 500 });
    expect(results[1]?.commands).toEqual([{ command: 'pnpm test', exitCode: 0, durationMs: 400, skipped: false }]);
  });

  it('ignores broken files, invalid shapes and the logs directory', async () => {
    await put('libs-x/ok.json', result());
    await put('libs-x/broken.json', '{ nope');
    await put('libs-x/shape.json', { app: 1 });
    await put('logs/libs-x/TASK-009-quick.json', result({ unit: 'TASK-009' }));
    expect((await loadVerifyResults(dir)).map((r) => r.unit)).toEqual(['TASK-001']);
  });

  it('is empty without an artifacts/verify directory', async () => {
    expect(await loadVerifyResults(dir)).toEqual([]);
  });

  it('caps the list at 30 results', async () => {
    for (let i = 0; i < 35; i++) await put(`libs-x/u${i}.json`, result({ unit: `TASK-${String(i).padStart(3, '0')}` }));
    expect(await loadVerifyResults(dir)).toHaveLength(30);
  });
});

describe('readVerifyConfig', () => {
  it('lists apps with their non-empty levels and skips reserved keys', async () => {
    const config = await loadVerifyConfig(dir, {
      $schema: 's', _note: 'n',
      'libs/a': { quick: ['c'], full: ['c'], full_exclusive: true },
      'apps/b': { quick: [], full: ['c'] },
      'apps/c': { quick: [] },
    });
    expect(config).toEqual([{ app: 'libs/a', levels: ['quick', 'full'] }, { app: 'apps/b', levels: ['full'] }]);
  });

  it('is empty when verify.json is missing', async () => {
    expect(await loadVerifyConfig(dir, null)).toEqual([]);
  });
});
