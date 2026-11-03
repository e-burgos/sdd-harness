import { describe, it, expect } from 'vitest';
import { validateAppTopology } from '../app-types.js';

describe('validateAppTopology: option placement', () => {
  it('rejects ml on non-python apps', () => {
    const errors = validateAppTopology([{ name: 'api', type: 'nestjs', ml: true }], 'nx');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"ml"');
    expect(validateAppTopology([{ name: 'agent', type: 'python', ml: true }], 'nx')).toEqual([]);
  });

  it.each(['nestjs', 'fastify', 'hono', 'python', 'springboot'])('rejects tucuUi on %s', (type) => {
    const errors = validateAppTopology([{ name: 'svc', type, tucuUi: false }], 'nx');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"tucuUi"');
  });

  it.each(['react', 'nextjs', 'next-bff', 'mfe-shell', 'mfe'])('accepts tucuUi on %s', (type) => {
    const apps = [
      { name: 'portal', type: 'mfe-shell' },
      { name: 'ui', type, tucuUi: false, ...(type === 'mfe' ? { shell: 'portal' } : {}) },
    ].filter((app) => !(type === 'mfe-shell' && app.name === 'portal'));
    expect(validateAppTopology(type === 'mfe' ? [{ name: 'portal', type: 'mfe-shell' }, apps[1]] : apps, 'nx')).toEqual([]);
  });

  it('applies the same checks in standalone mode', () => {
    expect(validateAppTopology([{ name: 'api', type: 'nestjs', ml: true }], 'standalone')).toHaveLength(1);
  });
});
