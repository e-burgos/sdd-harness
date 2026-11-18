import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), success: vi.fn(), step: vi.fn(), error: vi.fn(), title: vi.fn() },
}));

import { exec } from '../../utils/exec.js';
import { logger } from '../../utils/logger.js';
import { seedVerifyEntries, VERIFY_INIT_COMMAND } from '../sdd.generator.js';

describe('seedVerifyEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("corre el script del propio kit desde la raíz del workspace", () => {
    seedVerifyEntries('/tmp/ws');
    expect(VERIFY_INIT_COMMAND).toBe('node sdd/scripts/sdd-verify.mjs --init');
    expect(exec).toHaveBeenCalledWith(VERIFY_INIT_COMMAND, { cwd: '/tmp/ws', silent: true });
  });

  it('si el script falla no lanza y deja un aviso con el comando manual', () => {
    vi.mocked(exec).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => seedVerifyEntries('/tmp/ws')).not.toThrow();
    expect(vi.mocked(logger.warn).mock.calls[0][0]).toContain('pnpm sdd:verify --init');
  });
});
