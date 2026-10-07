import path from 'node:path';
import type { Author } from '@sdd-studio/protocol';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput } from './types';

/**
 * Motor guionado para tests y `--engine=fake`. Marcadores en el texto del prompt:
 * #sub (habla sdd-planner como subagente), #tool (pide aprobación para Bash),
 * #edit (pide aprobación para Write en apps/x.ts; en acceptEdits no pregunta, como el SDK), #slow (no termina hasta interrupt), #fail.
 */
export class FakeEngine implements AgentEngine {
  readonly name = 'fake';
  private counter = 0;

  constructor(private readonly delayMs = 5) {}

  startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn {
    let stopped = false;
    const ac = new AbortController();
    const wait = () => new Promise((r) => setTimeout(r, this.delayMs));
    const main: Author = { agent: input.options.agent, parentToolUseId: null };
    const say = (author: Author, text: string) => {
      const messageId = `fake-msg-${++this.counter}`;
      cb.emit({ type: 'message.start', messageId, author });
      cb.emit({ type: 'message.delta', messageId, text });
      cb.emit({ type: 'message.end', messageId });
    };
    const askAndRun = async (toolName: string, toolInput: Record<string, unknown>, summary: string, isEdit = false) => {
      const toolUseId = `fake-tool-${++this.counter}`;
      // Mirrors the SDK: the gate hook runs first; acceptEdits skips the permission prompt for edit tools
      // (except when the hook asked, i.e. a gate warning).
      const verdict = cb.judgeTool(toolName, toolInput, { author: main, toolUseId });
      if (verdict.kind === 'deny') return;
      const skipPrompt = isEdit && input.options.permissionMode === 'acceptEdits' && verdict.kind === 'allow';
      if (!skipPrompt) {
        const decision = await cb.requestApproval({ toolName, input: toolInput, author: main, toolUseId }, ac.signal);
        if (stopped || decision.behavior !== 'allow') return;
      }
      cb.emit({ type: 'tool.start', toolUseId, author: main, tool: toolName, summary });
      cb.emit({ type: 'tool.end', toolUseId, isError: false, summary: 'ok' });
    };

    const done = (async () => {
      cb.onSessionId(input.resumeSessionId ?? `fake-${input.threadId}`);
      await wait();
      if (input.text.includes('#fail')) throw new Error('fake failure');
      if (input.text.includes('#slow')) {
        while (!stopped) await wait();
        return;
      }
      if (input.text.includes('#sub')) {
        cb.emit({ type: 'subagent.start', agentId: 'fake-sub', agentType: 'sdd-planner' });
        await wait();
        if (stopped) return;
        say({ agent: 'sdd-planner', parentToolUseId: 'fake-agent-call' }, 'planned');
        cb.emit({ type: 'subagent.stop', agentId: 'fake-sub', agentType: 'sdd-planner' });
      }
      if (input.text.includes('#tool')) await askAndRun('Bash', { command: 'echo hi' }, '$ echo hi');
      if (input.text.includes('#edit')) {
        const file = path.join(input.cwd, 'apps', 'x.ts');
        await askAndRun('Write', { file_path: file, content: 'export {};' }, file, true);
      }
      if (stopped) return;
      say(main, `echo: ${input.text}`);
      cb.emit({
        type: 'turn.end',
        usage: { model: 'fake', effort: input.options.effort, tokensIn: 10, tokensOut: 5, costUsd: 0 },
      });
    })();

    return {
      done,
      interrupt: async () => {
        stopped = true;
        ac.abort();
      },
    };
  }
}
