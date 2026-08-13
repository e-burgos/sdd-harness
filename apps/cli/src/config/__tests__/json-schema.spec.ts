import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { buildConfigJsonSchema } from '../json-schema.js';

describe('config json-schema', () => {
  const schema = buildConfigJsonSchema();

  it('es un JSON Schema compilable por ajv', () => {
    const ajv = new Ajv({ strict: false });
    expect(() => ajv.compile(schema)).not.toThrow();
  });

  it('acepta un config mínimo válido y rechaza tipos de app inválidos', () => {
    const ajv = new Ajv({ strict: false, useDefaults: true });
    const validate = ajv.compile(schema);

    const valid = {
      project: {
        name: 'shop',
        description: 'tienda',
        packageScope: '@shop',
      },
      apps: [{ name: 'api', type: 'nestjs' }],
    };
    expect(validate(valid)).toBe(true);

    const invalid = {
      project: { name: 'shop', description: 'x', packageScope: '@shop' },
      apps: [{ name: 'api', type: 'django' }],
    };
    expect(validate(invalid)).toBe(false);
  });

  it('expone los enums del contrato (modos, apps, services, libs)', () => {
    const json = JSON.stringify(schema);
    for (const token of [
      'standalone',
      'nestjs',
      'fastify',
      'nextjs',
      'springboot',
      'hono',
      'postgres',
      'rabbitmq',
      'shared-types',
      'ui-kit',
    ]) {
      expect(json).toContain(token);
    }
  });
});
