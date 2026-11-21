import { describe, expect, it } from 'vitest';
import { GateCheckError, readGateCheck, type GateRunner } from './gate-runner';

const passed = { spec: 's-a', gate: 'B', passed: true, checks: [{ id: 'cycle', label: 'Cycle', ok: true, detail: '' }], flow: 'lite', cycle: 'cycle-01', marker: 'SDD-BIND x' };

const runnerOf = (code: number, stdout: string, calls: string[][] = []): GateRunner => async (args) => {
  calls.push(args);
  return { code, stdout };
};

describe('readGateCheck', () => {
  it('passes the spec, the cycle and --json to the script and maps an approved gate', async () => {
    const calls: string[][] = [];
    const result = await readGateCheck('/r', 's-a', 'cycle-01', runnerOf(0, JSON.stringify(passed), calls));
    expect(calls).toEqual([['s-a', 'cycle-01', '--json']]);
    expect(result).toMatchObject({ spec: 's-a', gate: 'B', passed: true, flow: 'lite', cycle: 'cycle-01' });
    expect(result).not.toHaveProperty('marker');
  });

  it('omits the cycle when absent and keeps a blocked result (exit 1)', async () => {
    const calls: string[][] = [];
    const blocked = { ...passed, gate: 'A', passed: false, checks: [{ id: 'spec', label: 'Spec', ok: false, detail: 'missing' }] };
    const result = await readGateCheck('/r', 's-a', undefined, runnerOf(1, JSON.stringify(blocked), calls));
    expect(calls).toEqual([['s-a', '--json']]);
    expect(result.passed).toBe(false);
    expect(result.checks[0]).toMatchObject({ ok: false, detail: 'missing' });
  });

  it('maps exit 2 to bad-request with the script message', async () => {
    await expect(readGateCheck('/r', 'x', undefined, runnerOf(2, JSON.stringify({ error: 'unknown spec x' })))).rejects.toMatchObject({
      code: 'bad-request',
      message: 'unknown spec x',
    });
  });

  it('maps invalid JSON, a shape mismatch and other exits to internal', async () => {
    await expect(readGateCheck('/r', 's-a', undefined, runnerOf(0, 'nope'))).rejects.toMatchObject({ code: 'internal' });
    await expect(readGateCheck('/r', 's-a', undefined, runnerOf(0, '{"gate":"Z"}'))).rejects.toBeInstanceOf(GateCheckError);
    await expect(readGateCheck('/r', 's-a', undefined, runnerOf(-1, ''))).rejects.toMatchObject({ code: 'internal' });
  });
});
