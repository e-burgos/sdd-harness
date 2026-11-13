import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from '../../utils/logger.js';
import {
  addAppScriptsToRootPkg,
  addAppTypeDepsToRootPkg,
} from '../root-package.js';
import { FRONTEND_VERSIONS, NX_PEER_OVERRIDES, NX_VERSIONS } from '../versions.js';

const emptyPkg = () => ({
  scripts: {} as Record<string, string>,
  dependencies: {} as Record<string, string>,
  devDependencies: {} as Record<string, string>,
});

describe('generators/root-package', () => {
  afterEach(() => vi.restoreAllMocks());

  it('registra los cuatro scripts nx de una app', () => {
    const pkg = emptyPkg();
    addAppScriptsToRootPkg(pkg, 'orders-api');
    expect(pkg.scripts).toEqual({
      'orders-api': 'nx serve orders-api',
      'build:orders-api': 'nx build orders-api',
      'test:orders-api': 'nx test orders-api',
      'lint:orders-api': 'nx lint orders-api',
    });
  });

  it('hono y fastify aportan sus deps de runtime', () => {
    const pkg = emptyPkg();
    addAppTypeDepsToRootPkg(pkg, 'hono');
    expect(pkg.dependencies).toHaveProperty('hono');
    expect(pkg.dependencies).toHaveProperty('@hono/node-server');
    addAppTypeDepsToRootPkg(pkg, 'fastify');
    expect(pkg.dependencies).toHaveProperty('fastify');
    expect(pkg.devDependencies).toHaveProperty('@nx/esbuild');
  });

  // springboot integra por Maven y python por pyproject: el package.json raíz
  // no debe recibir nada de ellos.
  it('springboot y python no tocan dependencias', () => {
    const pkg = emptyPkg();
    addAppTypeDepsToRootPkg(pkg, 'springboot');
    addAppTypeDepsToRootPkg(pkg, 'python');
    expect(pkg.dependencies).toEqual({});
    expect(pkg.devDependencies).toEqual({});
  });

  it('react restaura la familia podada desde el template de referencia', () => {
    const pkg = emptyPkg();
    const reference = {
      scripts: {},
      dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', 'react-router-dom': '^7.0.0' },
      devDependencies: { '@nx/react': '22.7.12', vite: '^8.0.0', vitest: '^4.1.10' },
    };
    addAppTypeDepsToRootPkg(pkg, 'react', reference);
    expect(pkg.dependencies['react']).toBe(FRONTEND_VERSIONS.react);
    expect(pkg.devDependencies['vite']).toBe(FRONTEND_VERSIONS.vite);
    expect(pkg.devDependencies['@nx/react']).toBe(NX_VERSIONS[24]);
  });

  it('react y nextjs agregan tucu-ui por defecto y respetan tucuUi=false', () => {
    const react = emptyPkg();
    addAppTypeDepsToRootPkg(react, 'react');
    expect(react.dependencies['@e-burgos/tucu-ui']).toBe(FRONTEND_VERSIONS['@e-burgos/tucu-ui']);

    const next = emptyPkg();
    addAppTypeDepsToRootPkg(next, 'nextjs');
    expect(next.dependencies['@e-burgos/tucu-ui']).toBe(FRONTEND_VERSIONS['@e-burgos/tucu-ui']);
    expect(next.devDependencies['@tailwindcss/postcss']).toBe(
      FRONTEND_VERSIONS['@tailwindcss/postcss'],
    );
    expect(next.devDependencies['tailwindcss']).toBe(FRONTEND_VERSIONS.tailwindcss);

    const plainReact = emptyPkg();
    addAppTypeDepsToRootPkg(plainReact, 'react', undefined, { tucuUi: false });
    expect(plainReact.dependencies).not.toHaveProperty('@e-burgos/tucu-ui');

    const plainNext = emptyPkg();
    addAppTypeDepsToRootPkg(plainNext, 'nextjs', undefined, { tucuUi: false });
    expect(plainNext.dependencies).not.toHaveProperty('@e-burgos/tucu-ui');
    expect(plainNext.devDependencies).not.toHaveProperty('@tailwindcss/postcss');
  });

  it('nextjs usa Next 16 desde versions.ts', () => {
    const pkg = emptyPkg();
    addAppTypeDepsToRootPkg(pkg, 'nextjs');
    expect(pkg.dependencies['next']).toBe(FRONTEND_VERSIONS.next);
    expect(pkg.dependencies['next']).toMatch(/^\^16\./);
  });

  it('next existente no se pisa y avisa si es menor a 16 con tucu-ui', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const old = emptyPkg();
    old.dependencies['next'] = '^15.2.0';
    addAppTypeDepsToRootPkg(old, 'nextjs');
    expect(old.dependencies['next']).toBe('^15.2.0');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Next 16');

    warn.mockClear();
    const plain = emptyPkg();
    plain.dependencies['next'] = '^15.2.0';
    addAppTypeDepsToRootPkg(plain, 'nextjs', undefined, { tucuUi: false });
    expect(warn).not.toHaveBeenCalled();

    const current = emptyPkg();
    current.dependencies['next'] = '^16.1.0';
    addAppTypeDepsToRootPkg(current, 'nextjs');
    expect(warn).not.toHaveBeenCalled();
  });

  it('es aditivo: nunca pisa una versión ya presente', () => {
    const pkg = emptyPkg();
    pkg.devDependencies['vite'] = '^7.0.0';
    addAppTypeDepsToRootPkg(pkg, 'hono');
    expect(pkg.devDependencies['vite']).toBe('^7.0.0');

    const reference = {
      scripts: {},
      dependencies: { react: '^19.0.0' },
      devDependencies: {},
    };
    pkg.dependencies['react'] = '^18.3.0';
    addAppTypeDepsToRootPkg(pkg, 'react', reference);
    expect(pkg.dependencies['react']).toBe('^18.3.0');
  });

  it('nxMajor elige la versión de @nx/* y los peers por mayor', () => {
    const pkg = emptyPkg();
    addAppTypeDepsToRootPkg(pkg, 'nestjs', undefined, { nxMajor: 22 });
    addAppTypeDepsToRootPkg(pkg, 'hono', undefined, { nxMajor: 22 });
    expect(pkg.devDependencies['@nx/nest']).toBe(NX_VERSIONS[22]);
    expect(pkg.devDependencies['vitest']).toBe(NX_PEER_OVERRIDES[22]['vitest']);
    const latest = emptyPkg();
    addAppTypeDepsToRootPkg(latest, 'hono', undefined, { nxMajor: 24 });
    expect(latest.devDependencies['vitest']).toBe(FRONTEND_VERSIONS.vitest);
  });

  it('nxVersion explícito manda sobre la tabla y sobre la referencia', () => {
    const pkg = emptyPkg();
    const reference = {
      scripts: {},
      dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', 'react-router-dom': '^7.0.0' },
      devDependencies: { '@nx/react': '24.0.6', '@nx/vite': '24.0.6' },
    };
    addAppTypeDepsToRootPkg(pkg, 'react', reference, { nxMajor: 23, nxVersion: '23.1.1' });
    expect(pkg.devDependencies['@nx/react']).toBe('23.1.1');
    expect(pkg.devDependencies['@nx/vite']).toBe('23.1.1');
  });
});
