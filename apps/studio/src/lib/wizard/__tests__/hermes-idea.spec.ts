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

  it('uses the project description when no module was defined', () => {
    const state = { ...run([{ type: 'modules', modules: [] }], withApps), project: { ...withApps.project, name: 'tienda', description: 'Catálogo con carrito y pagos.' } };
    expect(buildHermesIdea(state, 'es')).toBe('Arrancamos tienda: Catálogo con carrito y pagos. ¿Cuál es la primera funcionalidad para web, api?');
    expect(buildHermesIdea(state, 'en')).toBe('We are starting tienda: Catálogo con carrito y pagos. What is the first feature for web, api?');
  });

  it('falls back to the open question when there is neither a module nor a description', () => {
    const base = run([{ type: 'modules', modules: [] }], withApps);
    const state = { ...base, project: { ...base.project, description: '  ' } };
    expect(buildHermesIdea(state, 'es')).toBe('¿Por dónde empezamos? Describí la primera funcionalidad.');
    expect(buildHermesIdea(state, 'en')).toBe('Where do we start? Describe the first feature.');
  });
});
