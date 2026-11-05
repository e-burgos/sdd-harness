import { describe, it, expect } from 'vitest';
import {
  FRONTEND_VERSIONS,
  NX_VERSION,
  PYTHON_VERSIONS,
  pythonRequirement,
} from '../versions.js';

describe('generators/versions', () => {
  it('mantiene Nx 23 y pinea Next 16 (requisito de tucu-ui)', () => {
    expect(NX_VERSION).toBe('23.1.1');
    expect(FRONTEND_VERSIONS.next).toMatch(/^\^16\./);
  });

  it('los pins de frontend son rangos caret y los de Python versiones exactas', () => {
    for (const version of Object.values(FRONTEND_VERSIONS)) {
      expect(version).toMatch(/^\^\d+\.\d+\.\d+$/);
    }
    for (const version of Object.values(PYTHON_VERSIONS)) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('pythonRequirement arma el pin de uv con piso en la versión', () => {
    expect(pythonRequirement('fastapi')).toBe('fastapi>=0.162.0');
  });

  it('vitest y su cobertura comparten versión', () => {
    expect(FRONTEND_VERSIONS['@vitest/coverage-v8']).toBe(FRONTEND_VERSIONS.vitest);
  });

  it('el package.json base del kit coincide con versions.ts', async () => {
    const { default: fs } = await import('fs-extra');
    const { resolve } = await import('node:path');
    const { getTemplatesDir } = await import('../../utils/fs.js');
    const kit = await fs.readJSON(resolve(getTemplatesDir(), 'sdd/templates/nx-workspace/package.json'));
    const merged = { ...kit.dependencies, ...kit.devDependencies } as Record<string, string>;
    for (const [name, version] of Object.entries(FRONTEND_VERSIONS)) {
      if (name in merged) expect(merged[name], name).toBe(version);
    }
  });
});
