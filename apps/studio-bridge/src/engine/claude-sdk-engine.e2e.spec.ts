import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThreadEvent } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { ClaudeAgentSdkEngine } from './claude-sdk-engine';

const kitAgents = fileURLToPath(new URL('../../../cli/templates/sdd/agents', import.meta.url));

// Gasta tokens reales: SDD_STUDIO_E2E=1 pnpm --filter @e-burgos/sdd-studio test -- e2e
describe.skipIf(!process.env.SDD_STUDIO_E2E)('ClaudeAgentSdkEngine (real)', () => {
  it('answers a trivial prompt with haiku/low', async () => {
    const { root, cleanup } = await copyFixture();
    try {
      await mkdir(path.join(root, '.claude/agents'), { recursive: true });
      for (const f of await readdir(kitAgents)) await cp(path.join(kitAgents, f), path.join(root, '.claude/agents', f));
      const events: ThreadEvent[] = [];
      const turn = new ClaudeAgentSdkEngine().startTurn(
        { threadId: 'e2e', text: 'Reply with exactly the word OK.', cwd: root, resumeSessionId: null,
          options: { agent: 'sdd-orchestrator', model: 'haiku', effort: 'low', permissionMode: 'plan' } },
        { emit: (e) => events.push(e), onSessionId: () => {}, requestApproval: async () => ({ behavior: 'deny', message: 'e2e' }) },
      );
      await turn.done;
      const text = events.flatMap((e) => (e.type === 'message.delta' ? [e.text] : [])).join('');
      expect(text).toContain('OK');
      expect(events.some((e) => e.type === 'turn.end')).toBe(true);
    } finally {
      await cleanup();
    }
  }, 120_000);
});
