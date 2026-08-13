import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseListFlag } from '../flags.js';

const ALLOWED = ['postgres', 'redis', 'rabbitmq', 'minio'] as const;

describe('utils/flags parseListFlag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** process.exit corta el flujo real; acá lo convertimos en throw para poder afirmarlo. */
  const expectExit = (fn: () => unknown) => {
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(fn).toThrow('process.exit');
    expect(exit).toHaveBeenCalledWith(1);
  };

  it('parsea una lista separada por comas', () => {
    expect(parseListFlag('postgres,redis', ALLOWED, '--services')).toEqual([
      'postgres',
      'redis',
    ]);
  });

  it('tolera espacios y entradas vacías, y deduplica', () => {
    expect(
      parseListFlag(' postgres , redis ,, postgres', ALLOWED, '--services'),
    ).toEqual(['postgres', 'redis']);
  });

  it('acepta un solo valor', () => {
    expect(parseListFlag('minio', ALLOWED, '--services')).toEqual(['minio']);
  });

  it('corta con valores desconocidos', () => {
    expectExit(() => parseListFlag('postgres,mongo', ALLOWED, '--services'));
  });

  it('corta cuando el flag viene vacío', () => {
    expectExit(() => parseListFlag('  ,  ', ALLOWED, '--services'));
  });
});
