import { describe, expect, it } from 'vitest';
import { ClientCommand, FileSearchResult, SendResult, defaultThreadOptions } from './index';

const base = { kind: 'command', id: 'c1' } as const;

describe('ClientCommand', () => {
  it('parses thread.create', () => {
    const cmd = { ...base, cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' };
    expect(ClientCommand.parse(cmd)).toEqual({ ...cmd, attachments: [], refs: { agents: [], skills: [] } });
  });
  it('rejects unsafe or too many command.run args', () => {
    for (const args of [['a b'], ['a;b'], ['$(x)'], ['../x/..', 'a', 'b', 'c', 'd']]) {
      expect(ClientCommand.safeParse({ ...base, cmd: 'command.run', name: 'gate', args }).success).toBe(false);
    }
    expect(ClientCommand.safeParse({ ...base, cmd: 'command.run', name: 'gate', args: ['spec-dev-001-x', 'cycle-01'] }).success).toBe(true);
  });
  it('parses presence.get', () => {
    const cmd = { ...base, cmd: 'presence.get' };
    expect(ClientCommand.parse(cmd)).toEqual(cmd);
  });
  it('auth.set accepts a key or null and rejects malformed keys', () => {
    expect(ClientCommand.safeParse({ ...base, cmd: 'auth.set', apiKey: 'sk-ant-' + 'a'.repeat(30) }).success).toBe(true);
    expect(ClientCommand.safeParse({ ...base, cmd: 'auth.set', apiKey: null }).success).toBe(true);
    for (const apiKey of ['short', 'has space ' + 'a'.repeat(30), 'a'.repeat(513)]) {
      expect(ClientCommand.safeParse({ ...base, cmd: 'auth.set', apiKey }).success).toBe(false);
    }
  });
  it('rejects commands outside the allowlist', () => {
    expect(ClientCommand.safeParse({ ...base, cmd: 'command.run', name: 'rm', args: [] }).success).toBe(false);
  });
  it('rejects a text over 100k chars', () => {
    const cmd = { ...base, cmd: 'thread.send', threadId: 't', text: 'x'.repeat(100_001) };
    expect(ClientCommand.safeParse(cmd).success).toBe(false);
  });
  it('caps channel.botHistory limit at 200', () => {
    expect(ClientCommand.safeParse({ ...base, cmd: 'channel.botHistory', channelId: 'fixes', limit: 201 }).success).toBe(false);
  });
});

const image = { kind: 'image', name: 'a.png', mime: 'image/png', data: 'aGVsbG8=', width: 10, height: 10 };
const sha = 'b'.repeat(64);

describe('thread.send and thread.create message body', () => {
  it('defaults attachments and refs to empty', () => {
    const parsed = ClientCommand.parse({ ...base, cmd: 'thread.send', threadId: 't', text: 'hola' });
    expect(parsed).toMatchObject({ attachments: [], refs: { agents: [], skills: [] } });
  });
  it('accepts attachments without text and rejects neither', () => {
    expect(ClientCommand.safeParse({ ...base, cmd: 'thread.send', threadId: 't', text: '', attachments: [image] }).success).toBe(true);
    expect(ClientCommand.safeParse({ ...base, cmd: 'thread.send', threadId: 't', text: '   ' }).success).toBe(false);
    const create = { ...base, cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: '' };
    expect(ClientCommand.safeParse(create).success).toBe(false);
    expect(ClientCommand.safeParse({ ...create, attachments: [image] }).success).toBe(true);
  });
  it('caps attachments at 5', () => {
    const attachments = Array(6).fill(image);
    expect(ClientCommand.safeParse({ ...base, cmd: 'thread.send', threadId: 't', text: 'x', attachments }).success).toBe(false);
    expect(ClientCommand.safeParse({ ...base, cmd: 'thread.send', threadId: 't', text: 'x', attachments: attachments.slice(0, 5) }).success).toBe(true);
  });
  it('accepts an optional link on thread.create', () => {
    const create = { ...base, cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'x' };
    const link = { kind: 'fix', fixId: 'FIX-e-burgos-002' };
    expect(ClientCommand.parse({ ...create, link })).toMatchObject({ link });
    expect(ClientCommand.safeParse({ ...create, link: { kind: 'fix', fixId: 'x' } }).success).toBe(false);
  });
  it('rejects refs over the limit', () => {
    const refs = { agents: Array(6).fill('sdd-planner'), skills: [] };
    expect(ClientCommand.safeParse({ ...base, cmd: 'thread.send', threadId: 't', text: 'x', refs }).success).toBe(false);
  });
});

describe('pending, link, search and attachment commands', () => {
  it('parses thread.pending.edit, remove and flush', () => {
    const commands = [
      { ...base, cmd: 'thread.pending.edit', threadId: 't', pendingId: 'p', text: 'nuevo' },
      { ...base, cmd: 'thread.pending.remove', threadId: 't', pendingId: 'p' },
      { ...base, cmd: 'thread.pending.flush', threadId: 't' },
    ];
    for (const cmd of commands) expect(ClientCommand.parse(cmd)).toEqual(cmd);
  });
  it('parses thread.setLink with every target', () => {
    for (const link of [{ kind: 'none' }, { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-02' }, { kind: 'fix', fixId: 'FIX-001' }]) {
      const cmd = { ...base, cmd: 'thread.setLink', threadId: 't', link };
      expect(ClientCommand.parse(cmd)).toEqual(cmd);
    }
    expect(ClientCommand.safeParse({ ...base, cmd: 'thread.setLink', threadId: 't' }).success).toBe(false);
  });
  it('workspace.searchFiles defaults limit to 30 and caps it at 50', () => {
    expect(ClientCommand.parse({ ...base, cmd: 'workspace.searchFiles', query: 'src' })).toMatchObject({ limit: 30 });
    expect(ClientCommand.safeParse({ ...base, cmd: 'workspace.searchFiles', query: 'x', limit: 51 }).success).toBe(false);
    expect(ClientCommand.safeParse({ ...base, cmd: 'workspace.searchFiles', query: 'x', limit: 0 }).success).toBe(false);
    expect(ClientCommand.safeParse({ ...base, cmd: 'workspace.searchFiles', query: 'x'.repeat(201) }).success).toBe(false);
  });
  it('attachment.get requires a sha256 and a supported mime', () => {
    const cmd = { ...base, cmd: 'attachment.get', sha256: sha, mime: 'image/png' };
    expect(ClientCommand.parse(cmd)).toEqual(cmd);
    expect(ClientCommand.safeParse({ ...cmd, sha256: 'short' }).success).toBe(false);
    expect(ClientCommand.safeParse({ ...cmd, mime: 'image/svg+xml' }).success).toBe(false);
  });
});

describe('result schemas', () => {
  it('SendResult discriminates started and pending', () => {
    expect(SendResult.parse({ delivery: 'started' })).toEqual({ delivery: 'started' });
    expect(SendResult.parse({ delivery: 'pending', pendingId: 'p1' })).toEqual({ delivery: 'pending', pendingId: 'p1' });
    expect(SendResult.safeParse({ delivery: 'pending' }).success).toBe(false);
    expect(SendResult.safeParse({ delivery: 'pending', pendingId: '' }).success).toBe(false);
  });
  it('FileSearchResult bounds the file list', () => {
    const result = { query: 'src', files: [{ path: 'a/b.ts' }], truncated: false, source: 'git' };
    expect(FileSearchResult.parse(result)).toEqual(result);
    expect(FileSearchResult.safeParse({ ...result, files: Array(51).fill({ path: 'a' }) }).success).toBe(false);
    expect(FileSearchResult.safeParse({ ...result, source: 'find' }).success).toBe(false);
  });
});
