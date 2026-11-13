import { describe, it, expect } from 'vitest';
import {
  FRONTEND_VERSIONS,
  DEFAULT_NX_MAJOR,
  NX_MAJORS,
  NX_PEER_OVERRIDES,
  NX_VERSIONS,
  nxMajorOfRange,
  nxVersionFor,
  parseNxMajor,
  PYTHON_VERSIONS,
  pythonRequirement,
} from '../versions.js';

describe('generators/versions', () => {
  it('pinea Next 16 (requisito de tucu-ui)', () => {
    expect(FRONTEND_VERSIONS.next).toMatch(/^\^16\./);
  });

  it('cada mayor de Nx tiene versión exacta de su línea y 24 es la default', () => {
    expect(NX_MAJORS).toEqual([22, 23, 24]);
    expect(DEFAULT_NX_MAJOR).toBe(24);
    for (const major of NX_MAJORS) {
      expect(NX_VERSIONS[major]).toMatch(new RegExp(`^${major}\\.\\d+\\.\\d+$`));
      expect(nxVersionFor(major)).toBe(NX_VERSIONS[major]);
    }
    expect(nxVersionFor()).toBe(NX_VERSIONS[24]);
  });

  it('los peers por mayor solo se sobrescriben donde la mayor no acepta el pin único', () => {
    expect(NX_PEER_OVERRIDES[23]).toEqual({});
    expect(NX_PEER_OVERRIDES[24]).toEqual({});
    expect(Object.keys(NX_PEER_OVERRIDES[22]).sort()).toEqual(['@vitest/coverage-v8', 'vitest']);
    expect(NX_PEER_OVERRIDES[22]['vitest']).toBe(NX_PEER_OVERRIDES[22]['@vitest/coverage-v8']);
    for (const name of Object.keys(NX_PEER_OVERRIDES[22])) {
      expect(NX_PEER_OVERRIDES[22][name]).not.toBe((FRONTEND_VERSIONS as Record<string, string>)[name]);
    }
  });

  it('parseNxMajor acepta 22|23|24 y rechaza el resto', () => {
    expect(parseNxMajor(undefined)).toBeUndefined();
    expect(parseNxMajor('22')).toBe(22);
    expect(parseNxMajor(23)).toBe(23);
    expect(() => parseNxMajor('21')).toThrow(/22 \| 23 \| 24/);
    expect(() => parseNxMajor('abc')).toThrow();
    expect(nxMajorOfRange('^23.1.1')).toBe(23);
    expect(nxMajorOfRange('19.0.0')).toBeUndefined();
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
    expect(merged['nx']).toBe(NX_VERSIONS[DEFAULT_NX_MAJOR]);
    for (const [name, version] of Object.entries(merged)) {
      if (name.startsWith('@nx/')) expect(version, name).toBe(NX_VERSIONS[DEFAULT_NX_MAJOR]);
    }
    for (const [name, version] of Object.entries(FRONTEND_VERSIONS)) {
      if (name in merged) expect(merged[name], name).toBe(version);
    }
  });
});
