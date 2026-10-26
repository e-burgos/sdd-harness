import path from 'node:path';
import type { Author } from '@sdd-studio/protocol';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput, TurnPrompt } from './types';

const marker = (text: string, name: string): boolean => new RegExp(`(^|\\s)#${name}(?=\\s|$)`).test(text);
const refMarkerOf = (line: string): string | null => {
  const agent = /^Delegate this task to the subagent "([^"]+)"/.exec(line);
  if (agent) return `@${agent[1]}`;
  const skill = /^Use the skill "([^"]+)"/.exec(line);
  if (skill) return `/${skill[1]}`;
  const prompt = /^Follow the instructions in .*?([^/]+)\.prompt\.md\.$/.exec(line);
  return prompt ? `/${prompt[1]}` : null;
};
const titleOf = (text: string): string | null => /#title:(\S+)/.exec(text)?.[1]?.replace(/_/g, ' ') ?? null;
const stepsOf = (text: string): number => Number(/#steps:(\d+)/.exec(text)?.[1] ?? 0);

/**
 * Scripted engine for tests and `--engine=fake`. Markers in the first prompt:
 * #sub, #tool (Bash approval), #edit (Write approval; skipped in acceptEdits), #slow (waits for interrupt), #fail,
 * #steps:N (N Read rounds with a cut point after each), #revert (interrupt reports the last cut-point batch as undelivered),
 * #mcp, #edit-tool, #bash-git, #bash-git2, #bash-chain (approvals that exercise Always rules),
 * #bad-attachment (fails like #fail with 'attachment rejected'),
 * #title:Some_title (readSessionTitle answers 'Some title' for that session; setSessionTitle changes it later).
 * Echoes append ' [attachments: a, b (missing)]' and ' [refs: @agent /skill]' when the prompt carries them.
 */
export class FakeEngine implements AgentEngine {
  readonly name = 'fake';
  readonly provider = 'claude' as const;
  readonly receivedSystemPrefixes: (string | undefined)[] = [];
  private counter = 0;
  private readonly titles = new Map<string, string>();

  constructor(private readonly delayMs = 5) {}

  setSessionTitle(sessionId: string, title: string | null): void {
    if (title === null) this.titles.delete(sessionId);
    else this.titles.set(sessionId, title);
  }

  async readSessionTitle(sessionId: string): Promise<string | null> {
    return this.titles.get(sessionId) ?? null;
  }

  startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn {
    this.receivedSystemPrefixes.push(input.systemPrefix);
    const firstPrompt = input.prompts[0]?.prompt ?? { text: '', preamble: [], blocks: [] };
    const firstText = firstPrompt.text;
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
    const describeAttachments = async (prompt: TurnPrompt): Promise<string> => {
      const names = await Promise.all(
        prompt.blocks.map(async (block) => {
          if (block.kind !== 'attachment') return null;
          return (await cb.readAttachment(block.ref)) === null ? `${block.ref.name} (missing)` : block.ref.name;
        }),
      );
      const present = names.filter((name): name is string => name !== null);
      return present.length > 0 ? ` [attachments: ${present.join(', ')}]` : '';
    };
    const describeRefs = (prompt: TurnPrompt): string => {
      const refs = prompt.preamble.flatMap((line) => refMarkerOf(line) ?? []);
      return refs.length > 0 ? ` [refs: ${refs.join(' ')}]` : '';
    };
    const withMarkers = async (prompt: TurnPrompt): Promise<string> =>
      `${prompt.text}${await describeAttachments(prompt)}${describeRefs(prompt)}`;
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
        heard.push(...(await Promise.all(batch.map((message) => withMarkers(message.prompt)))));
      }
      if (!stopped) sayHeard();
    };
    const echoTurn = async (prompt: TurnPrompt) => {
      say(main, `echo: ${await withMarkers(prompt)}`);
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
      await echoTurn(firstPrompt);
    };

    const done = (async () => {
      const sessionId = input.resumeSessionId ?? `fake-${input.threadId}`;
      const title = titleOf(firstText);
      if (title) this.titles.set(sessionId, title);
      cb.onSessionId(sessionId);
      await wait();
      if (marker(firstText, 'fail')) throw new Error('fake failure');
      if (marker(firstText, 'bad-attachment')) throw new Error('attachment rejected');
      if (marker(firstText, 'slow')) {
        while (!stopped) await wait();
        return;
      }
      await runFirstTurn();
      for (const extra of input.prompts.slice(1)) {
        if (stopped) return;
        await echoTurn(extra.prompt);
      }
      while (!stopped) {
        const next = cb.collectPending('turn-end');
        if (next.length === 0) return;
        for (const message of next) await echoTurn(message.prompt);
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
