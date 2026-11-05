import { buildHermesIdea } from '../hermes-idea';
import { run, scoped } from './fixtures';

describe('buildHermesIdea', () => {
  const withApps = run(
    [
      { type: 'app-add', appType: 'react' },
      { type: 'app-add', appType: 'nestjs' },
      { type: 'modules', modules: ['billing', 'auth'] },
    ],
    scoped('fullstack', 'nx'),
  );

  it('names the first module and the apps in Spanish', () => {
    expect(buildHermesIdea(withApps, 'es')).toBe('Armá la primera spec del módulo billing para web, api.');
  });

  it('speaks English when asked', () => {
    expect(buildHermesIdea(withApps, 'en')).toBe('Draft the first spec for the billing module for web, api.');
  });

  it('falls back to the open question when no module was defined', () => {
    const state = run([{ type: 'modules', modules: [] }], withApps);
    expect(buildHermesIdea(state, 'es')).toBe('¿Por dónde empezamos? Describí la primera funcionalidad.');
    expect(buildHermesIdea(state, 'en')).toBe('Where do we start? Describe the first feature.');
  });
});
