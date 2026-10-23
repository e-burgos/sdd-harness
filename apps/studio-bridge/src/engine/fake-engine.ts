import path from 'node:path';
import type { Author } from '@sdd-studio/protocol';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput } from './types';

const marker = (text: string, name: string): boolean => new RegExp(`(^|\\s)#${name}(?=\\s|$)`).test(text);
const stepsOf = (text: string): number => Number(/#steps:(\d+)/.exec(text)?.[1] ?? 0);

/**
 * Scripted engine for tests and `--engine=fake`. Markers in the first prompt:
 * #sub, #tool (Bash approval), #edit (Write approval; skipped in acceptEdits), #slow (waits for interrupt), #fail,
 * #steps:N (N Read rounds with a cut point after each), #revert (interrupt reports the last cut-point batch as undelivered),
 * #mcp, #edit-tool, #bash-git, #bash-git2, #bash-chain (approvals that exercise Always rules).
 */
export class FakeEngine implements AgentEngine {
  readonly name = 'fake';
  private counter = 0;

  constructor(private readonly delayMs = 5) {}

  startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn {
    const firstText = input.prompts[0]?.prompt.text ?? '';
    let stopped = false;
    let lastCutPointBatch: string[] = [];
    const heard: string[] = [];
    const ac = new AbortController();
    const wait = (factor = 1) => new Promise((r) => setTimeout(r, this.delayMs * factor));
    const main: Author = { agent: input.options.agent, parentToolUseId: null };
    const say = (author: Author, text: string) => {
      const messageId = `fake-msg-${++this.counter}`;
      cb.emit({ type: 'message.start', messageId, author });
      cb.emit({ type: 'message.delta', messageId, text });
      cb.emit({ type: 'message.end', messageId });
    };
    const endTurn = () =>
      cb.emit({
        type: 'turn.end',
        usage: { model: 'fake', effort: input.options.effort, tokensIn: 10, tokensOut: 5, costUsd: 0 },
      });
    const askAndRun = async (toolName: string, toolInput: Record<string, unknown>, summary: string, isEdit = false) => {
      const toolUseId = `fake-tool-${++this.counter}`;
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
    const sayHeard = () => {
      for (const text of heard.splice(0)) say(main, `heard: ${text}`);
    };
    const runSteps = async (rounds: number) => {
      for (let round = 1; round <= rounds && !stopped; round++) {
        sayHeard();
        const toolUseId = `fake-tool-${++this.counter}`;
        cb.emit({ type: 'tool.start', toolUseId, author: main, tool: 'Read', summary: `step ${round}` });
        await wait(20);
        cb.emit({ type: 'tool.end', toolUseId, isError: false, summary: 'ok' });
        const batch = cb.collectPending('cut-point');
        if (batch.length === 0) continue;
        lastCutPointBatch = batch.map((message) => message.id);
        heard.push(...batch.map((message) => message.prompt.text));
      }
      if (!stopped) sayHeard();
    };
    const echoTurn = (text: string) => {
      say(main, `echo: ${text}`);
      endTurn();
    };
    const runFirstTurn = async () => {
      if (marker(firstText, 'sub')) {
        cb.emit({ type: 'subagent.start', agentId: 'fake-sub', agentType: 'sdd-planner' });
        await wait();
        if (stopped) return;
        say({ agent: 'sdd-planner', parentToolUseId: 'fake-agent-call' }, 'planned');
        cb.emit({ type: 'subagent.stop', agentId: 'fake-sub', agentType: 'sdd-planner' });
      }
      if (marker(firstText, 'tool')) await askAndRun('Bash', { command: 'echo hi' }, '$ echo hi');
      if (marker(firstText, 'edit')) {
        const file = path.join(input.cwd, 'apps', 'x.ts');
        await askAndRun('Write', { file_path: file, content: 'export {};' }, file, true);
      }
      if (marker(firstText, 'edit-tool')) {
        const file = path.join(input.cwd, 'apps', 'y.ts');
        await askAndRun('Edit', { file_path: file, old_string: 'a', new_string: 'b' }, file, true);
      }
      if (marker(firstText, 'mcp')) await askAndRun('mcp__fake__ping', {}, 'mcp__fake__ping');
      for (const [name, command] of [
        ['bash-git', 'git status --short'],
        ['bash-git2', 'git status'],
        ['bash-chain', 'git status && rm -rf x'],
      ] as const) {
        if (marker(firstText, name)) await askAndRun('Bash', { command }, `$ ${command}`);
      }
      await runSteps(stepsOf(firstText));
      if (stopped) return;
      echoTurn(firstText);
    };

    const done = (async () => {
      cb.onSessionId(input.resumeSessionId ?? `fake-${input.threadId}`);
      await wait();
      if (marker(firstText, 'fail')) throw new Error('fake failure');
      if (marker(firstText, 'slow')) {
        while (!stopped) await wait();
        return;
      }
      await runFirstTurn();
      for (const extra of input.prompts.slice(1)) {
        if (stopped) return;
        echoTurn(extra.prompt.text);
      }
      while (!stopped) {
        const next = cb.collectPending('turn-end');
        if (next.length === 0) return;
        for (const message of next) echoTurn(message.prompt.text);
      }
    })();

    return {
      done,
      interrupt: async () => {
        stopped = true;
        ac.abort();
        if (marker(firstText, 'revert') && lastCutPointBatch.length > 0) {
          cb.revertPending(lastCutPointBatch);
          lastCutPointBatch = [];
        }
      },
    };
  }
}
