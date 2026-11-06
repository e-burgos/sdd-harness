// Claude Code mod of the SDD kit. Off unless sdd/tools.json → claude_mod.enabled is true
// (`pnpm sdd:mod -- --enable`); the switch is re-read on every refresh, no reload needed.
// The rules stay in sdd/dual-harness/rules/sdd-gates.md: this only shows and applies them.
// Sources live in dot-directories on purpose: TypeScript's `**/*` globs skip them, so the host
// project's tsc / next build never tries to compile a module that imports 'claude-code'.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import type { Snapshot } from '../../.claude-plugin/contract';
import {
  bandLine,
  bindFromCommand,
  endSession,
  holderOf,
  inboxSection,
  judgeEdit,
  leaseEdit,
  leasesOf,
  loadSnapshot,
  markInboxSeen,
  progress,
  touchSession,
  unreadInbox,
} from './sdd';
import type { SessionStore } from './sdd';

const snapshot = atom({ plugin: 'sdd-mod', key: 'snapshot' } as const, null);
const PANE = 'sdd-status';
const OFF_HINT = 'El mod SDD está apagado. Prendelo con: pnpm sdd:mod -- --enable';

function storeOf($: EngineInterface): SessionStore {
  return {
    read: (path) => $.fs.read(path),
    write: (path, text) => $.fs.write(path, text),
    list: async (path) => (await $.fs.list(path)).map(({ name, kind }) => ({ name, kind })),
  };
}

async function sessionOf($: EngineInterface) {
  return { id: await $.session.id(), now: Date.now() };
}

async function refresh($: EngineInterface): Promise<Snapshot> {
  const root = await $.session.root();
  const next = await loadSnapshot(storeOf($), root, await sessionOf($));
  await update($, snapshot, () => next);
  return next;
}

async function touch($: EngineInterface) {
  await touchSession(storeOf($), await $.session.root(), await sessionOf($)).catch(() => undefined);
}

// A gate that cannot read sdd/ lets the edit through: sdd:validate and CI stay the safety net.
async function gate($: EngineInterface, filePath: string) {
  try {
    const current = await refresh($);
    const root = await $.session.root();
    const verdict = judgeEdit(current, root, filePath);
    if (verdict.kind === 'deny') return verdict;
    const session = await sessionOf($);
    const leased = await leaseEdit(storeOf($), current, root, filePath, session).catch(() => null);
    if (leased?.request) {
      await $.session
        .send({ to: { sessionId: leased.request.toSessionId }, text: leased.request.text })
        .catch(() => undefined);
    }
    const final = leased && leased.verdict.kind !== 'allow' ? leased.verdict : verdict;
    if (final.kind !== 'deny') await touch($);
    return final;
  } catch {
    return { kind: 'allow' } as const;
  }
}

function holderTag(holder: 'mine' | 'other' | null): string {
  if (holder === 'mine') return '  ◀ esta sesión';
  return holder === 'other' ? '  ● en otra sesión' : '';
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sdd',
      description: 'SDD: ciclos en curso, tareas, fixes abiertos y modo del gate',
    });
    await refresh($).catch(() => undefined);
    return next(e);
  });

  on('tool.call', async ($, e, next) => {
    const result = await next(e);
    if (result.deny !== undefined) return result;
    try {
      const current = await read($, snapshot);
      if (!current?.settings.enabled) return result;
      const root = await $.session.root();
      const session = await sessionOf($);
      const messages = await unreadInbox(storeOf($), root, session);
      const text = inboxSection(messages);
      if (text === null) return result;
      await markInboxSeen(storeOf($), root, session, messages.map((message) => message.id));
      return { ...result, context: [...(result.context ?? []), text] };
    } catch {
      return result;
    }
  });

  on('turn.complete', async ($, e, next) => {
    await touch($);
    await refresh($).catch(() => undefined);
    return next(e);
  });

  on('session.end', async ($, e, next) => {
    const sessionId = e.sessionId ?? (await $.session.id());
    await endSession(storeOf($), await $.session.root(), { id: sessionId, now: Date.now() }).catch(
      () => undefined,
    );
    return next(e);
  });

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e);
    try {
      const bound = await bindFromCommand(
        storeOf($),
        await $.session.root(),
        await sessionOf($),
        e.command,
        result,
      );
      if (bound) await refresh($);
    } catch {
      await Promise.resolve();
    }
    return result;
  });

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const verdict = await gate($, e.file_path);
    if (verdict.kind === 'deny') return { deny: verdict.reason };
    if (verdict.kind === 'warn') $.ui.toast(verdict.reason);
    return next(e);
  });

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const verdict = await gate($, e.file_path);
    if (verdict.kind === 'deny') return { deny: verdict.reason };
    if (verdict.kind === 'warn') $.ui.toast(verdict.reason);
    return next(e);
  });

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const verdict = await gate($, e.notebook_path);
    if (verdict.kind === 'deny') return { deny: verdict.reason };
    if (verdict.kind === 'warn') $.ui.toast(verdict.reason);
    return next(e);
  });

  on('command.run', { command: 'sdd' }, async ($) => {
    const current = await refresh($);
    if (!current.settings.enabled) return { text: OFF_HINT };
    await $.ui.open({ id: PANE, title: 'SDD' });
    return { text: bandLine(current) ?? 'SDD' };
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, snapshot);
    const line = current ? bandLine(current) : null;
    if (e.props.hasSurvey || line === null || current === null) return next(e);
    const { Text } = $.ui.resolve(e);
    const idle = current.openUnits.length === 0;
    const color = current.error ? 'warning' : idle ? 'suggestion' : 'success';
    return (
      <Text color={color} wrap="truncate-end">
        {line}
      </Text>
    );
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const current = await read($, snapshot);
    if (current === null || !current.settings.enabled) {
      return <Text dimColor>{OFF_HINT}</Text>;
    }
    const gateText =
      current.settings.gate === 'block'
        ? 'Gate: bloquea ediciones de código sin ciclo ni fix abierto'
        : 'Gate: solo avisa (claude_mod.gate = "warn")';
    return (
      <Box flexDirection="column">
        <Text dimColor>{gateText}</Text>
        {current.error && <Text color="warning">No pude leer sdd/: {current.error}</Text>}
        {current.cycles.length === 0 && <Text dimColor>Sin ciclos in-progress.</Text>}
        {current.cycles.map((cycle) => (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>
              {cycle.spec} · {cycle.cycle} · {cycle.flow} · {progress(cycle)}
              {holderTag(holderOf(current, { kind: 'cycle', spec: cycle.spec, cycle: cycle.cycle }))}
            </Text>
            {cycle.tasks.map((task) => (
              <Text dimColor={task.status === 'done' || task.status === 'skipped'}>
                {task.status === 'done' ? '✓' : task.status === 'in-progress' ? '▸' : '·'}{' '}
                {task.id} {task.title}
              </Text>
            ))}
          </Box>
        ))}
        {current.fixes.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Fixes abiertos</Text>
            {current.fixes.map((fix) => (
              <Text>
                {fix.id} · {fix.status} · {fix.title}
                {holderTag(holderOf(current, { kind: 'fix', fix: fix.id }))}
              </Text>
            ))}
          </Box>
        )}
        {current.sessionId && leasesOf(current, current.sessionId).length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Archivos reservados por esta sesión</Text>
            {leasesOf(current, current.sessionId).map((lease) => (
              <Text dimColor>{lease.path}</Text>
            ))}
          </Box>
        )}
        {current.mine === null && current.openUnits.length > 0 && (
          <Text color="warning">Esta sesión no está atada a ninguna unidad: pnpm sdd:use {'<spec>'} {'<cycle-XX>'} | {'<FIX-id>'}</Text>
        )}
        <Text dimColor>pnpm sdd:gate {'<spec>'} [cycle-XX] · pnpm sdd:release {'<archivo>'} · pnpm sdd:validate</Text>
      </Box>
    );
  });
};
