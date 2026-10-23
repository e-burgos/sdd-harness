import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { ClientCommand } from '@sdd-studio/protocol';
import type { AuthState } from '../auth-mode';
import type { CommandRunner } from '../commands/runner';
import { SessionError, type SessionManager } from '../sessions/session-manager';
import type { ThreadStore } from '../sessions/store';
import { resolveSddPath } from '../workspace/paths';
import type { WorkspaceWatcher } from '../workspace/watcher';
import type { BridgeHandlers } from './ws-server';

const MAX_READ_BYTES = 2 * 1024 * 1024;

export function createHandlers(d: {
  root: string;
  auth: Pick<AuthState, 'mode' | 'set'>;
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
        authMode: d.auth.mode(),
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
          // A single handle: fstat + read on the same fd (no TOCTOU between stat and read).
          // O_NONBLOCK: a FIFO cannot hang open(); isFile() is still enforced below.
          const handle = await open(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
          try {
            const info = await handle.stat();
            if (!info.isFile()) throw new SessionError('bad-request', 'not a regular file');
            if (info.size > MAX_READ_BYTES) throw new SessionError('bad-request', 'file too large');
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
        case 'auth.set':
          return { authMode: d.auth.set(command.apiKey) };
        case 'command.run':
          return { runId: d.runner.run(command.name, command.args) };
        default:
          throw new SessionError('bad-request', `unsupported: ${command.cmd}`);
      }
    },
  };
}
