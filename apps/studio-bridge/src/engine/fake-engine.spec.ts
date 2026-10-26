import type { ThreadEvent } from '@sdd-studio/protocol';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { FakeEngine } from './fake-engine';
import { plainPrompt, type ApprovalDecision, type EngineCallbacks } from './types';

type Judge = EngineCallbacks['judgeTool'];

function harness(decision: ApprovalDecision = { behavior: 'allow' }, requestApprovalOverride?: (r: any, signal: AbortSignal) => Promise<ApprovalDecision>, judge: Judge = () => ({ kind: 'allow' })) {
  const events: ThreadEvent[] = [];
  const sessions: string[] = [];
  const approvals: string[] = [];
  const cb: EngineCallbacks = {
    emit: (e) => events.push(e),
    onSessionId: (id) => sessions.push(id),
    judgeTool: judge,
    collectPending: () => [],
    revertPending: () => {},
    readAttachment: async () => new Uint8Array([1]),
    requestApproval: requestApprovalOverride || (async (r) => (approvals.push(r.toolName), decision)),
  };
  return { events, sessions, approvals, cb };
}
const input = (text: string, mode: 'default' | 'acceptEdits' = 'default') => ({ threadId: 't', prompts: [{ id: 'u-1', prompt: plainPrompt(text) }], options: { ...defaultThreadOptions(), permissionMode: mode }, resumeSessionId: null, cwd: '/repo' });

describe('FakeEngine', () => {
  it('declares the claude provider and records the system prefix of each turn', async () => {
    const engine = new FakeEngine(1);
    expect(engine.provider).toBe('claude');
    await engine.startTurn({ ...input('hola'), systemPrefix: 'PREFIX' }, harness().cb).done;
    await engine.startTurn(input('otra'), harness().cb).done;
    expect(engine.receivedSystemPrefixes).toEqual(['PREFIX', undefined]);
  });
  it('echoes and ends the turn', async () => {
    const h = harness();
    await new FakeEngine(1).startTurn(input('hola'), h.cb).done;
    expect(h.sessions).toEqual(['fake-t']);
    expect(h.events.find((e) => e.type === 'message.delta')).toMatchObject({ text: 'echo: hola' });
    expect(h.events.at(-1)?.type).toBe('turn.end');
  });

  it('runs a subagent with #sub', async () => {
    const h = harness();
    await new FakeEngine(1).startTurn(input('#sub'), h.cb).done;
    expect(h.events.map((e) => e.type)).toContain('subagent.start');
    expect(h.events.find((e) => e.type === 'message.start' && e.author.agent === 'sdd-planner')).toBeTruthy();
  });

  it('asks for approval with #tool and skips the tool when denied', async () => {
    const h = harness({ behavior: 'deny', message: 'no' });
    await new FakeEngine(1).startTurn(input('#tool'), h.cb).done;
    expect(h.approvals).toEqual(['Bash']);
    expect(h.events.some((e) => e.type === 'tool.start')).toBe(false);
  });

  it('stops a #slow turn on interrupt', async () => {
    const h = harness();
    const turn = new FakeEngine(1).startTurn(input('#slow'), h.cb);
    await turn.interrupt();
    await turn.done;
    expect(h.events.some((e) => e.type === 'turn.end')).toBe(false);
  });

  it('rejects with #fail', async () => {
    const h = harness();
    await expect(new FakeEngine(1).startTurn(input('#fail'), h.cb).done).rejects.toThrow('fake failure');
  });

  it('aborts requestApproval on interrupt', async () => {
    let signalAborted = false;
    const h = harness(
      undefined,
      async (r, signal) => {
        await new Promise<void>((resolve) => {
          if (signal.aborted) {
            signalAborted = true;
            resolve();
          } else {
            signal.addEventListener('abort', () => {
              signalAborted = true;
              resolve();
            });
          }
        });
        return { behavior: 'deny', message: 'aborted' };
      },
    );
    const turn = new FakeEngine(10).startTurn(input('#tool'), h.cb);
    await new Promise((r) => setTimeout(r, 5));
    await turn.interrupt();
    await turn.done;
    expect(signalAborted).toBe(true);
    expect(h.events.some((e) => e.type === 'tool.start')).toBe(false);
  });

  it('consults judgeTool before an edit and skips the tool on deny', async () => {
    const h = harness({ behavior: 'allow' }, undefined, () => ({ kind: 'deny', reason: 'SPEC GATE' }));
    await new FakeEngine(1).startTurn(input('#edit', 'acceptEdits'), h.cb).done;
    expect(h.approvals).toEqual([]);
    expect(h.events.some((e) => e.type === 'tool.start')).toBe(false);
  });

  it('in acceptEdits mode an allowed edit runs without requestApproval (mirrors the SDK)', async () => {
    const h = harness();
    await new FakeEngine(1).startTurn(input('#edit', 'acceptEdits'), h.cb).done;
    expect(h.approvals).toEqual([]);
    expect(h.events.some((e) => e.type === 'tool.start')).toBe(true);
  });

  it('a gate warning still asks for approval in acceptEdits mode', async () => {
    const h = harness({ behavior: 'deny', message: 'no' }, undefined, () => ({ kind: 'warn', reason: 'w' }));
    await new FakeEngine(1).startTurn(input('#edit', 'acceptEdits'), h.cb).done;
    expect(h.approvals).toEqual(['Write']);
  });
});

describe('FakeEngine cut points and markers', () => {
  const message = (id: string, text: string) => ({ id, prompt: plainPrompt(text) });
  const texts = (events: ThreadEvent[]) => events.flatMap((e) => (e.type === 'message.delta' ? [e.text] : []));

  it('runs #steps:N rounds and hears a message collected at a cut point', async () => {
    const h = harness();
    const queue = [message('p-1', 'look at b.ts')];
    const calls: string[] = [];
    h.cb.collectPending = (at) => {
      calls.push(at);
      return at === 'cut-point' ? queue.splice(0) : [];
    };
    await new FakeEngine(1).startTurn(input('#steps:3'), h.cb).done;
    expect(h.events.filter((e) => e.type === 'tool.start')).toHaveLength(3);
    expect(calls.filter((c) => c === 'cut-point')).toHaveLength(3);
    expect(calls.at(-1)).toBe('turn-end');
    expect(texts(h.events)).toEqual(['heard: look at b.ts', 'echo: #steps:3']);
  });

  it('runs another echo turn inside the same turn for messages collected at turn end', async () => {
    const h = harness();
    const queue = [message('p-1', 'next one')];
    h.cb.collectPending = (at) => (at === 'turn-end' ? queue.splice(0) : []);
    await new FakeEngine(1).startTurn(input('hola'), h.cb).done;
    expect(texts(h.events)).toEqual(['echo: hola', 'echo: next one']);
    expect(h.events.filter((e) => e.type === 'turn.end')).toHaveLength(2);
  });

  it('echoes the extra initial prompts after the first turn', async () => {
    const h = harness();
    const prompts = [message('a', 'one'), message('b', 'two')];
    await new FakeEngine(1).startTurn({ ...input('x'), prompts }, h.cb).done;
    expect(texts(h.events)).toEqual(['echo: one', 'echo: two']);
  });

  it('#revert reports the last cut-point batch as undelivered on interrupt', async () => {
    const h = harness();
    const reverted: string[][] = [];
    const queue = [message('p-1', 'late')];
    h.cb.collectPending = (at) => (at === 'cut-point' ? queue.splice(0) : []);
    h.cb.revertPending = (ids) => reverted.push(ids);
    const turn = new FakeEngine(1).startTurn(input('#steps:5 #revert'), h.cb);
    await new Promise((r) => setTimeout(r, 40));
    await turn.interrupt();
    await turn.done;
    expect(reverted).toEqual([['p-1']]);
  });

  it('does not revert without the #revert marker', async () => {
    const h = harness();
    const reverted: string[][] = [];
    const queue = [message('p-1', 'late')];
    h.cb.collectPending = (at) => (at === 'cut-point' ? queue.splice(0) : []);
    h.cb.revertPending = (ids) => reverted.push(ids);
    const turn = new FakeEngine(1).startTurn(input('#steps:5'), h.cb);
    await new Promise((r) => setTimeout(r, 40));
    await turn.interrupt();
    await turn.done;
    expect(reverted).toEqual([]);
  });

  it.each([
    ['#mcp', 'mcp__fake__ping', {}],
    ['#edit-tool', 'Edit', undefined],
    ['#bash-git', 'Bash', { command: 'git status --short' }],
    ['#bash-git2', 'Bash', { command: 'git status' }],
    ['#bash-chain', 'Bash', { command: 'git status && rm -rf x' }],
  ] as const)('%s asks approval for its tool and only for it', async (flag, tool, toolInput) => {
    const h = harness();
    const asked: Array<{ toolName: string; input: unknown }> = [];
    h.cb.requestApproval = async (request) => (asked.push(request), { behavior: 'allow' });
    await new FakeEngine(1).startTurn(input(flag), h.cb).done;
    expect(asked).toHaveLength(1);
    expect(asked[0]?.toolName).toBe(tool);
    if (toolInput) expect(asked[0]?.input).toEqual(toolInput);
  });

  it('#edit does not trigger the #edit-tool approval and vice versa', async () => {
    const h = harness();
    await new FakeEngine(1).startTurn(input('#edit-tool'), h.cb).done;
    expect(h.approvals).toEqual(['Edit']);
  });

  describe('attachment and ref markers', () => {
    const attachmentRef = (name: string) => ({ sha256: 'a'.repeat(64), kind: 'image' as const, mime: 'image/png' as const, name, size: 1 });
    const promptWith = (text: string, names: string[], preamble: string[] = []) => ({
      text, preamble, blocks: names.map((name) => ({ kind: 'attachment' as const, ref: attachmentRef(name) })),
    });
    const inputOf = (prompt: ReturnType<typeof promptWith>) => ({ ...input(prompt.text), prompts: [{ id: 'u-1', prompt }] });
    const lastEcho = (events: ThreadEvent[]) => events.filter((e) => e.type === 'message.delta').map((e) => (e as { text: string }).text).at(-1);

    it('lists attachment names in order and marks the unreadable ones as missing', async () => {
      const h = harness();
      h.cb.readAttachment = async (ref) => (ref.name === 'gone.png' ? null : new Uint8Array([1]));
      await new FakeEngine(1).startTurn(inputOf(promptWith('look', ['a.png', 'gone.png'])), h.cb).done;
      expect(lastEcho(h.events)).toBe('echo: look [attachments: a.png, gone.png (missing)]');
    });

    it('lists the refs resolved in the preamble', async () => {
      const h = harness();
      const preamble = [
        'Delegate this task to the subagent "sdd-planner" using the Agent tool.',
        'Use the skill "commit" (.claude/skills/commit/SKILL.md) for this task.',
        'Follow the instructions in sdd/prompts/review-cycle.prompt.md.',
      ];
      await new FakeEngine(1).startTurn(inputOf(promptWith('go', ['a.png'], preamble)), h.cb).done;
      expect(lastEcho(h.events)).toBe('echo: go [attachments: a.png] [refs: @sdd-planner /commit /review-cycle]');
    });

    it('keeps the plain echo when nothing is attached or referenced', async () => {
      const h = harness();
      await new FakeEngine(1).startTurn(input('plain'), h.cb).done;
      expect(lastEcho(h.events)).toBe('echo: plain');
    });

    it('appends the markers to what a cut-point message is heard as', async () => {
      const h = harness();
      const queue = [{ id: 'p-1', prompt: promptWith('look', ['b.png'], ['Use the skill "commit" (p) for this task.']) }];
      h.cb.collectPending = (at) => (at === 'cut-point' ? queue.splice(0) : []);
      await new FakeEngine(1).startTurn(input('#steps:3'), h.cb).done;
      const texts = h.events.filter((e) => e.type === 'message.delta').map((e) => (e as { text: string }).text);
      expect(texts).toContain('heard: look [attachments: b.png] [refs: /commit]');
    });

    it('fails like #fail with the attachment rejected message', async () => {
      const h = harness();
      await expect(new FakeEngine(1).startTurn(inputOf(promptWith('#bad-attachment', ['a.png'])), h.cb).done).rejects.toThrow('attachment rejected');
      expect(h.events.some((e) => e.type === 'turn.end')).toBe(false);
    });
  });
});

describe('FakeEngine session title', () => {
  it('answers null until a title is simulated', async () => {
    const engine = new FakeEngine(1);
    expect(await engine.readSessionTitle('fake-t')).toBeNull();
  });

  it('simulates a title from the #title marker of the first prompt', async () => {
    const engine = new FakeEngine(1);
    const { sessions, cb } = harness();
    await engine.startTurn(input('hola #title:Refactor_billing'), cb).done;
    expect(await engine.readSessionTitle(sessions[0] as string)).toBe('Refactor billing');
  });

  it('lets a test change or clear the title of a session', async () => {
    const engine = new FakeEngine(1);
    engine.setSessionTitle('s1', 'Renamed');
    expect(await engine.readSessionTitle('s1')).toBe('Renamed');
    engine.setSessionTitle('s1', null);
    expect(await engine.readSessionTitle('s1')).toBeNull();
  });
});
