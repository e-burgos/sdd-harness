import { describe, expect, it, vi } from 'vitest';
import { createHostHandlers } from '../server/router';

describe('github commands in the host router', () => {
  it('route to the host commands, also with no project open', async () => {
    const hostCommands = vi.fn(async () => ({ routed: true }));
    const handlers = createHostHandlers({
      bridgeVersion: '0',
      auth: { mode: () => 'none', set: () => 'none' } as never,
      login: {} as never,
      runtime: () => null,
      hostCommands,
    });
    const result = await handlers.handle({ kind: 'command', id: '1', cmd: 'github.status', generationId: 'g1' });
    expect(result).toEqual({ routed: true });
    expect(hostCommands).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'github.status', generationId: 'g1' }));
    expect(handlers.welcome().features).toContain('github');
  });
});
