import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { MODEL_IDS } from './claude-sdk-engine';

const FIRST_UUID = '11111111-1111-4111-8111-111111111111';
const LATE_UUID = '22222222-2222-4222-8222-222222222222';

function userMessage(text: string, uuid: `${string}-${string}-${string}-${string}-${string}`): SDKUserMessage {
  return { type: 'user', message: { role: 'user', content: [{ type: 'text', text }] }, parent_tool_use_id: null, session_id: '', uuid };
}

function openChannel() {
  const queue: SDKUserMessage[] = [];
  let wake: (() => void) | null = null;
  let ended = false;
  let flushWaiters: Array<() => void> = [];
  const iterable: AsyncIterable<SDKUserMessage> = {
    async *[Symbol.asyncIterator]() {
      for (;;) {
        while (queue.length) {
          yield queue.shift() as SDKUserMessage;
          const waiters = flushWaiters;
          flushWaiters = [];
          waiters.forEach((resolve) => resolve());
        }
        if (ended) return;
        await new Promise<void>((resolve) => (wake = resolve));
      }
    },
  };
  return {
    iterable,
    push(message: SDKUserMessage) {
      queue.push(message);
      wake?.();
    },
    pushAndFlush(message: SDKUserMessage) {
      const flushed = new Promise<void>((resolve) => flushWaiters.push(resolve));
      queue.push(message);
      wake?.();
      return flushed;
    },
    end() {
      ended = true;
      wake?.();
    },
  };
}

describe.skipIf(!process.env.SDD_STUDIO_E2E)('PostToolBatch delivery (real SDK)', () => {
  it('folds a message pushed in the first PostToolBatch into the running turn', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'sdd-studio-spike-'));
    try {
      const channel = openChannel();
      channel.push(userMessage('Use the Bash tool to run `echo one`. Then use the Bash tool again to run `echo two`. Then reply "DONE-TWO". Be terse.', FIRST_UUID));
      let injected = false;
      const q = query({
        prompt: channel.iterable,
        options: {
          cwd,
          model: MODEL_IDS.haiku,
          effort: 'low',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          tools: ['Bash'],
          settingSources: [],
          hooks: {
            PostToolBatch: [
              {
                hooks: [
                  async (input) => {
                    if (injected || input.hook_event_name !== 'PostToolBatch' || input.agent_id) return {};
                    injected = true;
                    await channel.pushAndFlush(userMessage('Change of plan from the user: do NOT run any more commands. Reply only with the single word PINEAPPLE.', LATE_UUID));
                    return {};
                  },
                ],
              },
            ],
          },
        },
      });
      let uuids: string[] = [];
      let answer = '';
      for await (const message of q) {
        if (message.type !== 'result') continue;
        if (message.subtype === 'success') {
          uuids = message.user_message_uuids ?? [];
          answer = message.result;
        }
        channel.end();
      }
      expect(uuids).toEqual([FIRST_UUID, LATE_UUID]);
      expect(answer).toContain('PINEAPPLE');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }, 120_000);
});
