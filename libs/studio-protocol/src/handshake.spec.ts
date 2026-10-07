import { describe, expect, it } from 'vitest';
import { Hello, PROTOCOL_VERSION, Welcome } from './index';

describe('handshake', () => {
  it('parses hello', () => {
    const hello = { kind: 'hello', token: 't', protocolVersion: PROTOCOL_VERSION, clientVersion: '0.1.0' };
    expect(Hello.parse(hello)).toEqual(hello);
  });
  it('rejects an empty token', () => {
    expect(Hello.safeParse({ kind: 'hello', token: '', protocolVersion: 1, clientVersion: 'x' }).success).toBe(false);
  });
  it('parses welcome', () => {
    const welcome = {
      kind: 'welcome', protocolVersion: 1, bridgeVersion: '0.1.0',
      workspace: { root: '/r', project: 'p' }, kitVersion: '0.16.0', authMode: 'local-claude-login',
    };
    expect(Welcome.parse(welcome)).toEqual(welcome);
  });
});
