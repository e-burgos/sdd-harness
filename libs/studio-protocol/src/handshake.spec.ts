import { describe, expect, it } from 'vitest';
import { BRIDGE_FEATURES, FRAME_BUDGET_BYTES, HandshakeError, Hello, MAX_FRAME_BYTES, PROTOCOL_VERSION, Welcome } from './index';

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

describe('handshake v2 additions', () => {
  const welcome = {
    kind: 'welcome', protocolVersion: PROTOCOL_VERSION, bridgeVersion: '0.2.0',
    workspace: { root: '/r', project: 'p' }, kitVersion: null, authMode: 'api-key',
  };
  it('exposes PROTOCOL_VERSION 2', () => {
    expect(PROTOCOL_VERSION).toBe(2);
  });
  it('parses welcome with and without features', () => {
    expect(Welcome.parse(welcome)).toEqual(welcome);
    const withFeatures = { ...welcome, features: ['pending-messages', 'future-feature'] };
    expect(Welcome.parse(withFeatures)).toEqual(withFeatures);
    expect(Welcome.safeParse({ ...welcome, features: ['x'.repeat(41)] }).success).toBe(false);
    expect(Welcome.safeParse({ ...welcome, features: Array(33).fill('a') }).success).toBe(false);
  });
  it('keeps the v1 HandshakeError shape valid and accepts bridge versions', () => {
    const v1 = { kind: 'handshake.error', code: 'protocol-mismatch', message: 'm' };
    expect(HandshakeError.parse(v1)).toEqual(v1);
    const v2 = { ...v1, bridgeProtocolVersion: 2, bridgeVersion: '0.2.0' };
    expect(HandshakeError.parse(v2)).toEqual(v2);
  });
  it('hello keeps its v1 shape', () => {
    const hello = { kind: 'hello', token: 't', protocolVersion: 1, clientVersion: '0.1.0' };
    expect(Hello.parse(hello)).toEqual(hello);
  });
  it('BRIDGE_FEATURES lists the bridge spec features', () => {
    expect(BRIDGE_FEATURES).toEqual(['pending-messages', 'thread-link', 'always-rules', 'attachments', 'file-search', 'catalog', 'auth-subscription', 'conversation-sessions', 'session-title', 'link-targets', 'document-touched', 'questions', 'context-usage', 'profile-set']);
    expect(PROTOCOL_VERSION).toBe(2);
    for (const feature of BRIDGE_FEATURES) expect(feature.length).toBeLessThanOrEqual(40);
    expect(BRIDGE_FEATURES.length).toBeLessThanOrEqual(32);
    expect(FRAME_BUDGET_BYTES).toBe(MAX_FRAME_BYTES - 8_192);
  });
});
