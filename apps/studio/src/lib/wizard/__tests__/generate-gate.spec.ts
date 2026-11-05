import { targetCheck, readyPreflight } from '../../../components/modules/new-project/__tests__/summary-fixtures';
import { generateBlock, preflightCauses, type GenerateGateInput } from '../generate-gate';
import { isGeneratableTarget, targetStatusView } from '../target-status';

const ready: GenerateGateInput = {
  fieldsReady: true,
  targetPath: '/home/dev/acme',
  target: { status: 'ready', check: targetCheck(), error: null },
  preflight: { status: 'ready', data: readyPreflight, error: null },
  starting: false,
};

describe('generateBlock', () => {
  it('lets generate when everything is ready', () => {
    expect(generateBlock(ready)).toBeNull();
  });

  it.each<[string, Partial<GenerateGateInput>, string]>([
    ['starting', { starting: true }, 'starting'],
    ['fields', { fieldsReady: false }, 'fields'],
    ['no target', { targetPath: '  ' }, 'no-target'],
    ['checking', { target: { status: 'checking', check: null, error: null } }, 'checking'],
    ['idle', { target: { status: 'idle', check: null, error: null } }, 'checking'],
    ['target error', { target: { status: 'error', check: null, error: 'x' } }, 'target-error'],
    ['blocked target', { target: { status: 'ready', check: targetCheck({ state: 'conflicting' }), error: null } }, 'target'],
    ['preflight pending', { preflight: { status: 'loading', data: null, error: null } }, 'preflight-pending'],
    ['preflight error', { preflight: { status: 'error', data: null, error: 'x' } }, 'preflight'],
    ['preflight not ready', { preflight: { status: 'ready', data: { ...readyPreflight, ready: false }, error: null } }, 'preflight'],
  ])('blocks on %s', (_label, overrides, block) => {
    expect(generateBlock({ ...ready, ...overrides })).toBe(block);
  });
});

describe('preflightCauses', () => {
  it('has no cause when ready', () => {
    expect(preflightCauses(readyPreflight)).toEqual([]);
  });

  it('lists pnpm and registry causes, or a generic one', () => {
    expect(preflightCauses({ ...readyPreflight, ready: false, pnpm: { found: false, version: null }, registry: { url: null, reachable: 'no' } })).toEqual(['pnpm', 'registry']);
    expect(preflightCauses({ ...readyPreflight, ready: false })).toEqual(['other']);
  });
});

describe('targetStatusView', () => {
  it('only the confirmable states can generate', () => {
    expect(isGeneratableTarget(targetCheck({ state: 'missing' }))).toBe(true);
    expect(isGeneratableTarget(targetCheck({ state: 'empty' }))).toBe(true);
    expect(isGeneratableTarget(targetCheck({ state: 'tolerated' }))).toBe(true);
    expect(isGeneratableTarget(targetCheck({ state: 'conflicting' }))).toBe(false);
    expect(isGeneratableTarget(targetCheck({ state: 'invalid', reason: 'unc' }))).toBe(false);
  });

  it('falls back to a generic invalid text for unknown reasons', () => {
    expect(targetStatusView(targetCheck({ state: 'invalid', reason: 'weird' })).textKey).toBe('wizard.target.invalid.other');
    expect(targetStatusView(targetCheck({ state: 'invalid', reason: null })).textKey).toBe('wizard.target.invalid.other');
  });
});
