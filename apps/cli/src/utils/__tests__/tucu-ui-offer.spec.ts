import { describe, it, expect } from 'vitest';
import {
  hasConflictingTucuUiFlags,
  hasFrontendApp,
  resolveTucuUiChoice,
  type TucuUiState,
} from '../tucu-ui-offer.js';

const base = { flag: undefined, hasFrontend: true, interactive: true, current: 'off' as TucuUiState };

describe('resolveTucuUiChoice', () => {
  it('--tucu-ui enciende aunque no haya frontend ni terminal', () => {
    expect(resolveTucuUiChoice({ ...base, flag: true, hasFrontend: false, interactive: false })).toBe('enable');
    expect(resolveTucuUiChoice({ ...base, flag: true, current: 'complete' })).toBe('enable');
  });

  it('--no-tucu-ui deja apagado aunque haya frontend', () => {
    expect(resolveTucuUiChoice({ ...base, flag: false })).toBe('skip');
  });

  it('sin frontend no pregunta', () => {
    expect(resolveTucuUiChoice({ ...base, hasFrontend: false })).toBe('skip');
  });

  it('ya completo no pregunta de nuevo', () => {
    expect(resolveTucuUiChoice({ ...base, current: 'complete' })).toBe('skip');
  });

  it('sin terminal interactiva y sin flags no pregunta', () => {
    expect(resolveTucuUiChoice({ ...base, interactive: false })).toBe('skip');
    expect(resolveTucuUiChoice({ ...base, interactive: false, current: 'incomplete' })).toBe('skip');
  });

  it('incompleto ofrece reparar', () => {
    expect(resolveTucuUiChoice({ ...base, current: 'incomplete' })).toBe('ask-repair');
  });

  it('apagado con frontend y terminal ofrece encender', () => {
    expect(resolveTucuUiChoice(base)).toBe('ask-enable');
  });
});

describe('hasFrontendApp', () => {
  it('reconoce react y nextjs', () => {
    expect(hasFrontendApp(['nestjs', 'react'])).toBe(true);
    expect(hasFrontendApp(['nextjs'])).toBe(true);
  });

  it('no reconoce backends ni listas vacías', () => {
    expect(hasFrontendApp(['nestjs', 'python', 'springboot'])).toBe(false);
    expect(hasFrontendApp([])).toBe(false);
  });
});

describe('hasConflictingTucuUiFlags', () => {
  it('detecta ambos flags en cualquier orden', () => {
    expect(hasConflictingTucuUiFlags(['--tucu-ui', '--no-tucu-ui'])).toBe(true);
    expect(hasConflictingTucuUiFlags(['--no-tucu-ui', 'x', '--tucu-ui'])).toBe(true);
  });

  it('un solo flag o ninguno no es conflicto', () => {
    expect(hasConflictingTucuUiFlags(['--tucu-ui'])).toBe(false);
    expect(hasConflictingTucuUiFlags(['--no-tucu-ui', '--yes'])).toBe(false);
    expect(hasConflictingTucuUiFlags([])).toBe(false);
  });
});
