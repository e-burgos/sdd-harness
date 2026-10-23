import { describe, expect, it } from 'vitest';
import { ClientCommand, defaultThreadOptions } from './index';

const base = { kind: 'command', id: 'c1' } as const;

describe('ClientCommand', () => {
  it('parses thread.create', () => {
    const cmd = { ...base, cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' };
    expect(ClientCommand.parse(cmd)).toEqual(cmd);
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
