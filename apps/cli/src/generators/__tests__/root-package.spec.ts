import { describe, it, expect } from 'vitest';
import {
  addAppScriptsToRootPkg,
  addAppTypeDepsToRootPkg,
} from '../root-package.js';

const emptyPkg = () => ({
  scripts: {} as Record<string, string>,
  dependencies: {} as Record<string, string>,
  devDependencies: {} as Record<string, string>,
});

describe('generators/root-package', () => {
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
      devDependencies: { '@nx/react': '23.1.1', vite: '^8.0.0', vitest: '^4.1.10' },
    };
    addAppTypeDepsToRootPkg(pkg, 'react', reference);
    expect(pkg.dependencies['react']).toBe('^19.0.0');
    expect(pkg.devDependencies['@nx/react']).toBe('23.1.1');
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
});
