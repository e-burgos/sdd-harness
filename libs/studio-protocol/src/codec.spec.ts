import { describe, expect, it } from 'vitest';
import { decodeClientMessage, decodeServerMessage, encodeMessage } from './index';

describe('codec', () => {
  it('reports invalid JSON', () => {
    expect(decodeClientMessage('{')).toEqual({ ok: false, error: 'invalid JSON' });
  });
  it('decodes hello and commands', () => {
    const hello = decodeClientMessage(JSON.stringify({ kind: 'hello', token: 't', protocolVersion: 1, clientVersion: 'x' }));
    expect(hello.ok && hello.value.kind).toBe('hello');
    const cmd = decodeClientMessage(JSON.stringify({ kind: 'command', id: '1', cmd: 'workspace.snapshot' }));
    expect(cmd.ok).toBe(true);
  });
  it('rejects a well-formed but unknown message with a path in the error', () => {
    const r = decodeClientMessage(JSON.stringify({ kind: 'command', id: '1', cmd: 'nope' }));
    expect(r.ok).toBe(false);
  });
  it('round-trips a server event', () => {
    const msg = { kind: 'command.output', runId: 'r', stream: 'stdout', chunk: 'x' } as const;
    expect(decodeServerMessage(encodeMessage(msg))).toEqual({ ok: true, value: msg });
  });
});
