import {
  canAdvance,
  checkAuthor,
  checkDescription,
  checkPackageScope,
  checkPort,
  checkProjectName,
  checkWizardFields,
  stepErrors,
} from '../field-checks';
import { catalogFixture, idOf, run, scoped } from './fixtures';

describe('instant field checks', () => {
  it('validates project names with the catalog pattern', () => {
    expect(checkProjectName('mi-proyecto', catalogFixture)).toBeNull();
    expect(checkProjectName('', catalogFixture)?.code).toBe('required');
    expect(checkProjectName('Mi Proyecto', catalogFixture)?.code).toBe('pattern');
    expect(checkProjectName('1abc', catalogFixture)?.code).toBe('pattern');
  });

  it('does not correct the scope silently', () => {
    expect(checkPackageScope('@mi-proyecto', catalogFixture)).toBeNull();
    expect(checkPackageScope('mi-proyecto', catalogFixture)?.code).toBe('pattern');
    expect(checkPackageScope('', catalogFixture)?.code).toBe('required');
  });

  it('rejects empty and whitespace-only descriptions', () => {
    expect(checkDescription('   ')?.code).toBe('required');
    expect(checkDescription('hola')).toBeNull();
  });

  it('treats the author as optional', () => {
    expect(checkAuthor('', catalogFixture)).toBeNull();
    expect(checkAuthor('jdoe', catalogFixture)).toBeNull();
    expect(checkAuthor('J Doe', catalogFixture)?.code).toBe('pattern');
  });

  it.each([
    ['', null],
    ['3000', null],
    ['1000', null],
    ['65535', null],
    ['999', 'out-of-range'],
    ['65536', 'out-of-range'],
    ['30.5', 'not-integer'],
    ['abc', 'not-integer'],
    ['-3000', 'not-integer'],
  ])('checks port %j', (text, code) => {
    expect(checkPort(text, catalogFixture)?.code ?? null).toBe(code);
  });

  it('includes the range in the port error', () => {
    expect(checkPort('1', catalogFixture)?.params).toEqual({ min: 1000, max: 65535 });
  });

  it('ignores a catalog pattern that does not compile', () => {
    const broken = { ...catalogFixture, patterns: { ...catalogFixture.patterns, name: '(' } };
    expect(checkProjectName('Anything', broken)).toBeNull();
  });
});

describe('state checks', () => {
  const ready = () =>
    run(
      [
        { type: 'project', patch: { name: 'demo', description: 'desc' } },
        { type: 'app-add', appType: 'react' },
        { type: 'app-add', appType: 'nestjs' },
      ],
      scoped('fullstack', 'nx'),
    );

  it('reports no errors for a complete state', () => {
    expect(checkWizardFields(ready(), catalogFixture)).toEqual([]);
  });

  it('requires the scope, the mode and the project fields', () => {
    const fields = checkWizardFields(run([]), catalogFixture).map((e) => `${e.step}:${e.field}:${e.code}`);
    expect(fields).toEqual([
      'scope:scope:choice-required',
      'shape:mode:choice-required',
      'shape:project.name:required',
      'shape:project.description:required',
      'shape:project.packageScope:required',
    ]);
  });

  it('requires an app per applicable side', () => {
    const state = run([{ type: 'project', patch: { name: 'demo', description: 'd' } }], scoped('fullstack', 'nx'));
    expect(checkWizardFields(state, catalogFixture).map((e) => `${e.step}:${e.code}`)).toEqual(['front:app-required', 'back:app-required']);
    const frontOnly = run([{ type: 'project', patch: { name: 'demo', description: 'd' } }], scoped('front', 'nx'));
    expect(checkWizardFields(frontOnly, catalogFixture).map((e) => e.step)).toEqual(['front']);
  });

  it('marks duplicate app names on both rows with the app index in the field', () => {
    let state = ready();
    state = run([{ type: 'app-set', id: idOf(state, 'api'), patch: { name: 'web' } }], state);
    const duplicates = checkWizardFields(state, catalogFixture).filter((e) => e.code === 'duplicate');
    expect(duplicates.map((e) => [e.step, e.field])).toEqual([
      ['front', 'apps.0.name'],
      ['back', 'apps.1.name'],
    ]);
  });

  it('marks an explicit port conflict on both rows naming the other app', () => {
    let state = ready();
    state = run([
      { type: 'app-set', id: idOf(state, 'web'), patch: { portText: '3000' } },
      { type: 'app-set', id: idOf(state, 'api'), patch: { portText: '3000' } },
    ], state);
    const conflicts = checkWizardFields(state, catalogFixture).filter((e) => e.code === 'port-conflict');
    expect(conflicts.map((e) => [e.field, e.params.other])).toEqual([
      ['apps.0.port', 'api'],
      ['apps.1.port', 'web'],
    ]);
  });

  it('does not flag a default port as a conflict', () => {
    expect(checkWizardFields(ready(), catalogFixture).some((e) => e.code === 'port-conflict')).toBe(false);
  });

  it('checks lib names only where libs apply', () => {
    let state = run([{ type: 'lib-toggle', libType: 'config' }, { type: 'lib-toggle', libType: 'ui-kit' }], ready());
    state = run([{ type: 'lib-rename', libType: 'ui-kit', name: 'config' }], state);
    expect(checkWizardFields(state, catalogFixture).filter((e) => e.step === 'extras').map((e) => e.field)).toEqual(['libs.0.name', 'libs.1.name']);
  });

  it('scopes errors and Siguiente to the step', () => {
    const state = run([]);
    expect(stepErrors(state, catalogFixture, 'scope')).toHaveLength(1);
    expect(canAdvance(state, catalogFixture, 'scope')).toMatchObject({ ok: false });
    expect(canAdvance(ready(), catalogFixture, 'summary')).toEqual({ ok: true });
  });

  it('never blocks a step that does not apply to the scope', () => {
    const state = run([{ type: 'project', patch: { name: 'demo', description: 'd' } }], scoped('front', 'nx'));
    expect(stepErrors(state, catalogFixture, 'back')).toEqual([]);
  });
});
