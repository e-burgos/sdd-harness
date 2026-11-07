import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const select = vi.fn();
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(), message: vi.fn() },
  select: (...a: unknown[]) => select(...a),
  isCancel: () => false,
  text: vi.fn(),
  confirm: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}));

import { chooseOnboardingRoute, initCommand } from '../init.js';
import { setStudioSpawner } from '../../utils/studio-launch.js';
import { logger } from '../../utils/logger.js';

class ExitSignal extends Error {
  constructor(public code: number) {
    super(`exit ${code}`);
  }
}

describe('init: oferta de Studio', () => {
  let dir: string;
  let originalCwd: string;
  let isTty: boolean | undefined;

  beforeEach(() => {
    select.mockReset();
    originalCwd = process.cwd();
    dir = mkdtempSync(resolve(tmpdir(), 'init-studio-'));
    process.chdir(dir);
    isTty = process.stdin.isTTY;
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new ExitSignal(code ?? 0);
    }) as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.stdin.isTTY = isTty as boolean;
    setStudioSpawner();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  const runInit = async (args: Record<string, unknown>, rawArgs: string[] = []) => {
    try {
      await (initCommand.run as (ctx: unknown) => Promise<void>)({
        args: { yes: false, here: false, skipVerify: false, studio: false, terminal: false, ...args },
        rawArgs,
      });
    } catch (err) {
      if (err instanceof ExitSignal) return err.code;
      throw err;
    }
    return undefined;
  };

  it('declara --studio y --terminal', () => {
    const args = initCommand.args as Record<string, { type: string }>;
    expect(args['studio'].type).toBe('boolean');
    expect(args['terminal'].type).toBe('boolean');
  });

  it('--studio lanza npx -y @e-burgos/sdd-studio@latest en el cwd y propaga el código', async () => {
    const spawner = vi.fn().mockResolvedValue(3);
    setStudioSpawner(spawner);
    const code = await runInit({ studio: true });
    expect(code).toBe(3);
    expect(select).not.toHaveBeenCalled();
    const request = spawner.mock.calls[0][0];
    expect(request.args).toEqual(['-y', '@e-burgos/sdd-studio@latest']);
    expect(request.command).toBe(process.platform === 'win32' ? 'npx.cmd' : 'npx');
    expect(request.cwd).toBe(process.cwd());
  });

  it('--studio con --dir crea la carpeta y corre ahí', async () => {
    const spawner = vi.fn().mockResolvedValue(0);
    setStudioSpawner(spawner);
    const code = await runInit({ studio: true, dir: 'nuevo' });
    expect(code).toBe(0);
    expect(existsSync(resolve(dir, 'nuevo'))).toBe(true);
    expect(spawner.mock.calls[0][0].cwd).toBe(resolve(process.cwd(), 'nuevo'));
  });

  it('ENOENT sale con 1 e indica cómo correrlo a mano', async () => {
    setStudioSpawner(() => Promise.reject(Object.assign(new Error('x'), { code: 'ENOENT' })));
    const errors = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const code = await runInit({ studio: true });
    expect(code).toBe(1);
    expect(String(errors.mock.calls[0][0])).toContain('npx -y @e-burgos/sdd-studio@latest');
  });

  it('interactivo sin flags pregunta y Studio lanza el spawner', async () => {
    select.mockResolvedValue('studio');
    const spawner = vi.fn().mockResolvedValue(0);
    setStudioSpawner(spawner);
    process.stdin.isTTY = true;
    const code = await runInit({});
    expect(select).toHaveBeenCalledTimes(1);
    expect(select.mock.calls[0][0].message).toBe('¿Dónde querés armar el proyecto?');
    expect(code).toBe(0);
    expect(spawner).toHaveBeenCalledTimes(1);
  });
});

describe('chooseOnboardingRoute', () => {
  beforeEach(() => select.mockReset());

  it('--terminal no pregunta', async () => {
    expect(await chooseOnboardingRoute({ terminal: true }, [], true)).toBe('terminal');
    expect(select).not.toHaveBeenCalled();
  });

  it.each([
    [{ config: 'c.json' }],
    [{ yes: true }],
    [{ name: 'x' }],
    [{ standalone: true }],
    [{ profile: 'solo' }],
  ])('con %j no pregunta', async (args) => {
    expect(await chooseOnboardingRoute(args, [], true)).toBe('terminal');
    expect(select).not.toHaveBeenCalled();
  });

  it('--no-tucu-ui cuenta como pre-respuesta y no-TTY nunca pregunta', async () => {
    expect(await chooseOnboardingRoute({}, ['--no-tucu-ui'], true)).toBe('terminal');
    expect(await chooseOnboardingRoute({}, [], false)).toBe('terminal');
    expect(select).not.toHaveBeenCalled();
  });

  it('--dir y --here no evitan la pregunta', async () => {
    select.mockResolvedValue('terminal');
    expect(await chooseOnboardingRoute({ dir: 'x', here: true } as never, [], true)).toBe('terminal');
    expect(select).toHaveBeenCalledTimes(1);
  });
});
