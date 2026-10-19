import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { AuthMode, ClientCommand } from '@sdd-studio/protocol';
import type { CommandRunner } from '../commands/runner';
import { SessionError, type SessionManager } from '../sessions/session-manager';
import type { ThreadStore } from '../sessions/store';
import { resolveSddPath } from '../workspace/paths';
import type { WorkspaceWatcher } from '../workspace/watcher';
import type { BridgeHandlers } from './ws-server';

const MAX_READ_BYTES = 2 * 1024 * 1024;

export function createHandlers(d: {
  root: string;
  authMode: AuthMode;
  bridgeVersion: string;
  sessions: SessionManager;
  watcher: Pick<WorkspaceWatcher, 'current'>;
  runner: Pick<CommandRunner, 'run'>;
  store: Pick<ThreadStore, 'botHistory'>;
}): BridgeHandlers {
  return {
    welcome: () => {
      const snapshot = d.watcher.current();
      return {
        bridgeVersion: d.bridgeVersion,
        workspace: { root: d.root, project: snapshot.project },
        kitVersion: snapshot.kitVersion,
        authMode: d.authMode,
      };
    },
    handle: async (command: ClientCommand) => {
      switch (command.cmd) {
        case 'workspace.snapshot':
          return d.watcher.current();
        case 'presence.get':
          return d.sessions.presence();
        case 'workspace.readFile': {
          const file = await resolveSddPath(d.root, command.path);
          // Un único handle: fstat + lectura sobre el mismo fd (sin TOCTOU entre stat y read).
          // O_NONBLOCK: un FIFO no puede colgar el open(); igual se exige isFile() abajo.
          const handle = await open(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
          try {
            const info = await handle.stat();
            if (!info.isFile()) throw new SessionError('bad-request', 'no es un archivo regular');
            if (info.size > MAX_READ_BYTES) throw new SessionError('bad-request', 'archivo demasiado grande');
            return { path: command.path, content: await handle.readFile('utf8') };
          } finally {
            await handle.close();
          }
        }
        case 'thread.create':
          return d.sessions.createThread(command);
        case 'thread.send':
          await d.sessions.send(command.threadId, command.text);
          return null;
        case 'thread.interrupt':
          await d.sessions.interrupt(command.threadId);
          return null;
        case 'thread.setOptions':
          return d.sessions.setOptions(command.threadId, command.options);
        case 'thread.list':
          return d.sessions.list(command.channelId);
        case 'thread.history':
          return d.sessions.history(command.threadId, command.sinceSeq);
        case 'channel.botHistory':
          return d.store.botHistory(command.channelId, command.limit);
        case 'approval.respond':
          d.sessions.respondApproval(command.approvalId, command.decision, command.reason, command.scope);
          return null;
        case 'command.run':
          return { runId: d.runner.run(command.name, command.args) };
      }
    },
  };
}
