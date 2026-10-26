import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { applyFlowChoice, effectiveFlow, fullExceptionOf, profileOf } from './flow-choice';

const spec = (id: string, dependsOn: string[] = []) => ({ id, title: id, status: 'in-progress', folder: 'f', module: null, app: null, dependsOn });
const snapshot = (profile: string, specs = [spec('a'), spec('b', ['a']), spec('c')]) => ({ profile, specs }) as unknown as WorkspaceSnapshot;

describe('flow choice', () => {
  it('reads the profile from the snapshot and defaults to team', () => {
    expect(profileOf(snapshot('solo'))).toBe('solo');
    expect(profileOf(snapshot('team'))).toBe('team');
    expect(profileOf(snapshot('weird'))).toBe('team');
    expect(profileOf(null)).toBe('team');
  });

  it('opens lite for solo and full for team unless the dev chooses', () => {
    expect(effectiveFlow('solo', 'auto')).toBe('lite');
    expect(effectiveFlow('team', 'auto')).toBe('full');
    expect(effectiveFlow('solo', 'full')).toBe('full');
    expect(effectiveFlow('team', 'lite')).toBe('lite');
  });

  it('prefixes the request only for an explicit choice that has no prefix yet', () => {
    expect(applyFlowChoice('abrí el ciclo', 'auto')).toBe('abrí el ciclo');
    expect(applyFlowChoice('abrí el ciclo', 'lite')).toBe('[LITE] abrí el ciclo');
    expect(applyFlowChoice('abrí el ciclo', 'full')).toBe('[FULL] abrí el ciclo');
    expect(applyFlowChoice('[full] ya viene', 'lite')).toBe('[full] ya viene');
    expect(applyFlowChoice('', 'lite')).toBe('[LITE]');
  });

  it('flags a spec that depends on others or that others depend on', () => {
    expect(fullExceptionOf('b', snapshot('solo'))).toBe('depends-on');
    expect(fullExceptionOf('a', snapshot('solo'))).toBe('depended-on');
    expect(fullExceptionOf('c', snapshot('solo'))).toBeNull();
    expect(fullExceptionOf(null, snapshot('solo'))).toBeNull();
    expect(fullExceptionOf('b', null)).toBeNull();
    expect(fullExceptionOf('zzz', snapshot('solo'))).toBeNull();
  });
});
