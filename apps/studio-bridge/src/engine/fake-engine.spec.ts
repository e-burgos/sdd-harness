import type { ThreadEvent } from '@sdd-studio/protocol';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { FakeEngine } from './fake-engine';
import type { ApprovalDecision, EngineCallbacks } from './types';

function harness(decision: ApprovalDecision = { behavior: 'allow' }, requestApprovalOverride?: (r: any, signal: AbortSignal) => Promise<ApprovalDecision>) {
  const events: ThreadEvent[] = [];
  const sessions: string[] = [];
  const approvals: string[] = [];
  const cb: EngineCallbacks = {
    emit: (e) => events.push(e),
    onSessionId: (id) => sessions.push(id),
    requestApproval: requestApprovalOverride || (async (r) => (approvals.push(r.toolName), decision)),
  };
  return { events, sessions, approvals, cb };
}
const input = (text: string) => ({ threadId: 't', text, options: defaultThreadOptions(), resumeSessionId: null, cwd: '/repo' });

describe('FakeEngine', () => {
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
});
