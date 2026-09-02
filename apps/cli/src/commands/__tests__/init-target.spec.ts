import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { resolveInitTarget } from '../init.js';

// BUG-1 (2026-09-02): `init --config ./harness.config.json` dentro de ypf-platform-catalog/
// creaba ypf-platform-catalog/ypf-platform-catalog/. El destino ahora es el cwd cuando el
// config vive ahí, cuando el directorio ya se llama como el proyecto, o con --here / --dir .
describe('init: resolución del directorio destino', () => {
  const cwd = resolve('/work/ypf-platform-catalog');
  const flags = { here: false, dir: undefined, skipVerify: false };

  it('por defecto crea <cwd>/<name>', () => {
    expect(resolveInitTarget(resolve('/work'), 'shop', flags)).toEqual({
      targetDir: resolve('/work/shop'),
      inPlace: false,
    });
  });

  it('genera en el cwd si el config indicado vive ahí', () => {
    expect(resolveInitTarget(cwd, 'other-name', flags, './harness.config.json')).toEqual({
      targetDir: cwd,
      inPlace: true,
    });
    expect(
      resolveInitTarget(cwd, 'other-name', flags, 'configs/harness.config.json').inPlace,
    ).toBe(false);
  });

  it('genera en el cwd si basename(cwd) == project.name', () => {
    expect(resolveInitTarget(cwd, 'ypf-platform-catalog', flags)).toEqual({
      targetDir: cwd,
      inPlace: true,
    });
  });

  it('--here y --dir . fuerzan el cwd; --dir <path> lo redirige', () => {
    expect(resolveInitTarget(cwd, 'shop', { ...flags, here: true }).inPlace).toBe(true);
    expect(resolveInitTarget(cwd, 'shop', { ...flags, dir: '.' }).inPlace).toBe(true);
    expect(resolveInitTarget(cwd, 'shop', { ...flags, dir: '../elsewhere' })).toEqual({
      targetDir: resolve('/work/elsewhere'),
      inPlace: false,
    });
  });
});
