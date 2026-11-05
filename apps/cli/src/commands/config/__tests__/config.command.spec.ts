import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runCommand } from 'citty';
import { configCommand } from '../index.js';

const project = { name: 'shop', description: 'tienda', packageScope: '@shop' };
const validConfig = { project, apps: [{ name: 'api', type: 'nestjs' }] };
const invalidConfig = { project, apps: [{ name: 'm', type: 'mfe' }] };

describe('harness config catalog / validate', () => {
  let dir: string;
  let out: string;
  let err: string;
  const originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin')!;

  const run = (...rawArgs: string[]) => runCommand(configCommand, { rawArgs });
  const useStdin = (text: string) =>
    Object.defineProperty(process, 'stdin', { value: Readable.from([text]), configurable: true });
  const write = (name: string, content: unknown) => {
    const path = resolve(dir, name);
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
    return path;
  };

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'harness-config-cmd-'));
    out = '';
    err = '';
    process.exitCode = undefined;
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      out += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      err += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'stdin', originalStdin);
    process.exitCode = undefined;
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('catalog --json prints the catalog and exits 0', async () => {
    await run('catalog', '--json');
    expect(JSON.parse(out)).toMatchObject({ format: 1, appTypes: expect.any(Array) });
    expect(process.exitCode).toBeUndefined();
  });

  it('catalog without --json prints a readable table', async () => {
    await run('catalog');
    expect(out).toContain('App types:');
  });

  it('validate exits 0 for a valid file and prints the resolved preview as JSON', async () => {
    await run('validate', write('ok.json', validConfig), '--json');
    expect(JSON.parse(out)).toMatchObject({ ok: true, resolved: { mode: 'nx' } });
    expect(process.exitCode).toBe(0);
  });

  it('validate exits 1 when the config has errors', async () => {
    await run('validate', write('bad.json', invalidConfig), '--json');
    const result = JSON.parse(out);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ severity: 'error', code: 'shell-missing', path: ['apps', 0, 'shell'] });
    expect(process.exitCode).toBe(1);
  });

  it('validate exits 0 with warnings only', async () => {
    const warn = { project, apps: [{ name: 'a', type: 'nestjs', port: 4000 }, { name: 'b', type: 'hono', port: 4000 }] };
    await run('validate', write('warn.json', warn), '--json');
    expect(JSON.parse(out).issues.every((i: { severity: string }) => i.severity === 'warning')).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('validate reads JSON from stdin with "-"', async () => {
    useStdin(JSON.stringify(validConfig));
    await run('validate', '-', '--json');
    expect(JSON.parse(out).ok).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('validate prints a human list without --json', async () => {
    await run('validate', write('bad.json', invalidConfig));
    expect(out).toContain('shell-missing');
    expect(out).toContain('Config has errors.');
    expect(process.exitCode).toBe(1);
  });

  it.each([
    ['missing file', () => ['validate', resolve(dir, 'nope.json')]],
    ['unsupported extension', () => ['validate', write('c.yaml', 'a: 1')]],
    ['invalid JSON file', () => ['validate', write('broken.json', '{nope')]],
    ['no argument', () => ['validate']],
  ])('validate exits 2 on %s', async (_label, args) => {
    await run(...args());
    expect(process.exitCode).toBe(2);
    expect(err.length).toBeGreaterThan(0);
    expect(out).toBe('');
  });

  it('validate --json exits 2 with an error payload on stdout', async () => {
    await run('validate', resolve(dir, 'nope.json'), '--json');
    expect(process.exitCode).toBe(2);
    expect(JSON.parse(out)).toMatchObject({ format: 1, ok: false, error: { code: 'unreadable', message: expect.stringContaining('not found') } });
    expect(err.length).toBeGreaterThan(0);
  });

  it('validate --json without a source reports a usage error payload', async () => {
    await run('validate', '--json');
    expect(process.exitCode).toBe(2);
    expect(JSON.parse(out)).toMatchObject({ ok: false, error: { code: 'usage' } });
  });

  it('validate exits 2 on invalid JSON from stdin', async () => {
    useStdin('not json');
    await run('validate', '-', '--json');
    expect(process.exitCode).toBe(2);
  });
});
