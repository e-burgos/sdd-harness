import { checkWizardFields } from '../field-checks';
import { fieldDomId, fieldKind, pairingBlockers, stepBlockers } from '../step-gate';
import type { MappedIssue } from '../issues';
import { catalogFixture, run, scoped } from './fixtures';

const issue = (patch: Partial<MappedIssue>): MappedIssue => ({
  severity: 'error',
  code: 'x',
  step: 'front',
  field: null,
  text: 'x',
  translated: false,
  blocking: true,
  ...patch,
});

describe('fieldKind', () => {
  it.each([
    ['scope', 'scope'],
    ['mode', 'mode'],
    ['apps', 'apps'],
    ['project.name', 'name'],
    ['apps.2.name', 'name'],
    ['libs.0.name', 'name'],
    ['project.description', 'description'],
    ['project.packageScope', 'package-scope'],
    ['sdd.author', 'author'],
    ['apps.1.port', 'port'],
    ['whatever', 'other'],
  ])('classifies %s as %s', (field, kind) => {
    expect(fieldKind(field)).toBe(kind);
  });

  it('builds dom ids safe for ids', () => {
    expect(fieldDomId('apps.1.port')).toBe('wizard-field-apps-1-port');
  });
});

describe('pairingBlockers', () => {
  it('flags an mfe without shell and a shell without mfe', () => {
    const withMfe = run([{ type: 'app-add', appType: 'mfe' }], scoped('front', 'nx'));
    expect(pairingBlockers(withMfe)).toEqual([{ source: 'pairing', field: 'apps', code: 'mfe-needs-shell' }]);
    const withShell = run([{ type: 'app-add', appType: 'mfe-shell' }], scoped('front', 'nx'));
    expect(pairingBlockers(withShell)).toEqual([{ source: 'pairing', field: 'apps', code: 'shell-needs-mfe' }]);
    const both = run([{ type: 'app-add', appType: 'mfe-shell' }, { type: 'app-add', appType: 'mfe' }], scoped('front', 'nx'));
    expect(pairingBlockers(both)).toEqual([]);
  });
});

describe('stepBlockers', () => {
  it('returns nothing for a step the scope hides', () => {
    expect(stepBlockers(scoped('front', 'nx'), catalogFixture, 'back')).toEqual([]);
  });

  it('merges field errors with blocking issues of the step and skips covered fields', () => {
    const state = run([{ type: 'app-add', appType: 'react', name: 'Bad' }], scoped('front', 'nx'));
    const blockers = stepBlockers(state, catalogFixture, 'front', [
      issue({ field: 'apps.0.name', code: 'schema' }),
      issue({ field: 'apps.0.port', code: 'port-conflict' }),
      issue({ blocking: false, code: 'warn' }),
      issue({ step: 'back', code: 'other-step' }),
    ]);
    expect(blockers.map((blocker) => (blocker.source === 'issue' ? `issue:${blocker.issue.code}` : `${blocker.source}:${blocker.field}`))).toEqual([
      'field:apps.0.name',
      'issue:port-conflict',
    ]);
  });

  it('does not repeat shell-missing when the pairing blocker already says it', () => {
    const state = run([{ type: 'app-add', appType: 'mfe' }], scoped('front', 'nx'));
    const blockers = stepBlockers(state, catalogFixture, 'front', [issue({ code: 'shell-missing' })]);
    expect(blockers.map((blocker) => blocker.source)).toEqual(['pairing']);
  });

  it('agrees with checkWizardFields on the shape step', () => {
    const state = scoped('back', 'standalone');
    const expected = checkWizardFields(state, catalogFixture).filter((error) => error.step === 'shape').map((error) => error.field);
    expect(stepBlockers(state, catalogFixture, 'shape').map((blocker) => blocker.field)).toEqual(expected);
  });
});
