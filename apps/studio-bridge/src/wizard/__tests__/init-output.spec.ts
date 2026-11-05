import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyInitLine, type InitMode, type StageSignal } from '../init-output';

const FIXTURES = fileURLToPath(new URL('../__fixtures__/init-output/', import.meta.url));
const readFixture = (name: string) => readFileSync(`${FIXTURES}${name}`, 'utf8').split(/\r?\n/);
const manifest = JSON.parse(readFileSync(`${FIXTURES}manifest.json`, 'utf8')) as { cliVersion: string; fixtures: { file: string; mode: InitMode; exitCode: number }[] };

const signalsOf = (file: string, mode: InitMode): StageSignal[] =>
  readFixture(file)
    .map((line) => classifyInitLine(line, mode))
    .filter((signal): signal is StageSignal => signal !== null);

const stagesOf = (signals: StageSignal[]) => signals.filter((s) => s.type === 'stage').map((s) => (s as Extract<StageSignal, { type: 'stage' }>).stage);
const gatesOf = (signals: StageSignal[]) =>
  signals.filter((s): s is Extract<StageSignal, { type: 'gate' }> => s.type === 'gate').map((s) => `${s.check}.${s.result}`);
const problemsOf = (signals: StageSignal[]) => new Set(signals.filter((s) => s.type === 'problem').map((s) => (s as Extract<StageSignal, { type: 'problem' }>).problem));

describe('classifyInitLine over output recorded with the pinned CLI', () => {
  it('declares the CLI version the fixtures were recorded with', () => {
    expect(manifest.cliVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(manifest.fixtures.map((f) => f.file).sort()).toEqual([
      'nx-gate-red.txt',
      'nx-success.txt',
      'standalone-network-failure.txt',
      'standalone-pnpm-missing.txt',
      'standalone-success.txt',
    ]);
  });

  it('walks install, generate and validate on a successful nx init and passes both gate checks', () => {
    const signals = signalsOf('nx-success.txt', 'nx');
    const stages = stagesOf(signals);
    expect(stages[0]).toBe('install');
    expect(stages).toContain('generate');
    expect(stages.at(-1)).toBe('validate');
    expect([...stages].sort((a, b) => ['install', 'generate', 'validate'].indexOf(a) - ['install', 'generate', 'validate'].indexOf(b))).toEqual(stages);
    expect(gatesOf(signals)).toEqual(['validate.pass', 'build.pass']);
    expect(problemsOf(signals).size).toBe(0);
  });

  it('classifies a successful standalone init, where each pnpm script is a build mark', () => {
    const signals = signalsOf('standalone-success.txt', 'standalone');
    expect(stagesOf(signals)[0]).toBe('install');
    expect(stagesOf(signals).at(-1)).toBe('validate');
    expect(gatesOf(signals)).toEqual(['validate.pass', 'build.pass', 'build.pass']);
    expect(problemsOf(signals).size).toBe(0);
  });

  it('does not mistake the nx gate label for a standalone mark, nor the reverse', () => {
    expect(gatesOf(signalsOf('nx-success.txt', 'standalone'))).toEqual(['validate.pass']);
    expect(gatesOf(signalsOf('standalone-success.txt', 'nx'))).toEqual(['validate.pass']);
  });

  it('reports a red gate with the failing build check', () => {
    const signals = signalsOf('nx-gate-red.txt', 'nx');
    expect(gatesOf(signals)).toEqual(['validate.pass', 'build.fail']);
    expect(stagesOf(signals).at(-1)).toBe('validate');
  });

  it('detects a network failure during install', () => {
    const signals = signalsOf('standalone-network-failure.txt', 'standalone');
    expect(stagesOf(signals)).toEqual(['install']);
    expect(problemsOf(signals)).toEqual(new Set(['network']));
    expect(gatesOf(signals)).toEqual([]);
  });

  it('detects a missing pnpm', () => {
    const signals = signalsOf('standalone-pnpm-missing.txt', 'standalone');
    expect(stagesOf(signals)).toEqual(['install']);
    expect(problemsOf(signals)).toEqual(new Set(['pnpm-missing']));
  });
});

describe('classifyInitLine on synthetic lines', () => {
  it('ignores ANSI sequences and clack prefixes', () => {
    expect(classifyInitLine('\u001B[32m│  ◇ FASE 3 gate\u001B[0m', 'nx')).toEqual({ type: 'stage', stage: 'validate' });
    expect(classifyInitLine('\u001B[31m✗ [ ] sdd:validate — FAILED\u001B[0m', 'nx')).toEqual({ type: 'gate', check: 'validate', result: 'fail' });
  });

  it('classifies the pnpm-missing variants of other shells and platforms', () => {
    for (const line of ["'pnpm' is not recognized as an internal command", 'spawn pnpm ENOENT', 'sh: pnpm: command not found']) {
      expect(classifyInitLine(line, 'nx')).toEqual({ type: 'problem', problem: 'pnpm-missing' });
    }
  });

  it('classifies network error codes', () => {
    for (const line of ['ERR_PNPM_META_FETCH_FAIL', 'getaddrinfo EAI_AGAIN registry.npmjs.org', 'connect ETIMEDOUT 1.2.3.4:443', 'ENOTFOUND registry']) {
      expect(classifyInitLine(line, 'standalone')).toEqual({ type: 'problem', problem: 'network' });
    }
  });

  it('returns null for blank and unrelated lines', () => {
    expect(classifyInitLine('', 'nx')).toBeNull();
    expect(classifyInitLine('   ', 'nx')).toBeNull();
    expect(classifyInitLine('Progress: resolved 1, reused 0', 'nx')).toBeNull();
  });
});
