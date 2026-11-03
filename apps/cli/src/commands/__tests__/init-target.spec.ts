import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { initCommand, planTucuUi, resolveInitTarget } from '../init.js';

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

describe('init: oferta de tucu-ui', () => {
  const base = { here: false, dir: undefined, skipVerify: false };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const captureLogs = () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
      lines.push(parts.join(' '));
    });
    return lines;
  };

  it('declara el flag --tucu-ui en la ayuda con su efecto', () => {
    const args = initCommand.args as Record<string, { type: string; description?: string }>;
    expect(args['tucu-ui'].type).toBe('boolean');
    expect(args['tucu-ui'].description).toContain('--no-tucu-ui');
  });

  it('--tucu-ui arma el gancho aunque no haya frontend', async () => {
    const plan = await planTucuUi({ ...base, tucuUi: true, interactive: false }, ['nestjs']);
    expect(plan.beforeGate).toBeTypeOf('function');
  });

  it('el gancho no lanza si el kit no tiene el script y deja el aviso de reintento', async () => {
    const lines = captureLogs();
    const dir = mkdtempSync(resolve(tmpdir(), 'init-tucu-'));
    try {
      const plan = await planTucuUi({ ...base, tucuUi: true, interactive: false }, ['react']);
      expect(() => plan.beforeGate?.(dir)).not.toThrow();
      plan.report();
      const output = lines.join('\n');
      expect(output).toContain('could not be turned on');
      expect(output).toContain('pnpm sdd:tucu -- --enable');
      expect(output).not.toContain('tucu-ui: on');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('con frontend y sin flags la integración se prende sin preguntar', async () => {
    const plan = await planTucuUi({ ...base, interactive: true }, ['nextjs']);
    expect(plan.beforeGate).toBeTypeOf('function');
  });

  it('una app con tucuUi=false no prende la integración', async () => {
    const lines = captureLogs();
    const plan = await planTucuUi({ ...base, interactive: true }, [
      { type: 'react', tucuUi: false },
    ]);
    plan.report();
    expect(plan.beforeGate).toBeUndefined();
    expect(lines).toEqual([]);
  });

  it('basta una app frontend con tucuUi para prender la integración', async () => {
    const plan = await planTucuUi({ ...base, interactive: false }, [
      { type: 'react', tucuUi: false },
      { type: 'nextjs' },
    ]);
    expect(plan.beforeGate).toBeTypeOf('function');
  });

  it('sin frontend no menciona tucu-ui', async () => {
    const lines = captureLogs();
    const plan = await planTucuUi({ ...base, interactive: true }, ['nestjs', 'python']);
    plan.report();
    expect(plan.beforeGate).toBeUndefined();
    expect(lines).toEqual([]);
  });

  it('--no-tucu-ui no menciona nada aunque haya frontend', async () => {
    const lines = captureLogs();
    const plan = await planTucuUi({ ...base, tucuUi: false, interactive: true }, ['react']);
    plan.report();
    expect(plan.beforeGate).toBeUndefined();
    expect(lines).toEqual([]);
  });
});
