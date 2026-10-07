import { describe, expect, it } from 'vitest';
import {
  ChannelId,
  ThreadOptions,
  WorkspaceSnapshot,
  channelForDm,
  channelForSpec,
  defaultThreadOptions,
  dmAgentOfChannel,
  specIdOfChannel,
} from './index';

describe('ChannelId', () => {
  it('accepts dm channels and maps them to agents', () => {
    expect(ChannelId.safeParse('dm:sdd-planner').success).toBe(true);
    expect(ChannelId.safeParse('dm:').success).toBe(false);
    expect(ChannelId.safeParse('dm:../x').success).toBe(false);
    expect(channelForDm('sdd-planner')).toBe('dm:sdd-planner');
    expect(dmAgentOfChannel('dm:sdd-planner')).toBe('sdd-planner');
    expect(dmAgentOfChannel('general')).toBeNull();
  });
  it('accepts general, fixes and spec channels (mixed-case authors included)', () => {
    for (const id of ['general', 'fixes', 'spec:spec-dev-001-pagos', 'spec:spec-EBurgos-002-x']) {
      expect(ChannelId.safeParse(id).success).toBe(true);
    }
  });
  it('rejects anything else', () => {
    for (const id of ['', 'random', 'spec:', 'spec:../x', 'spec:a b', 'general2']) {
      expect(ChannelId.safeParse(id).success).toBe(false);
    }
  });
  it('round-trips spec ids', () => {
    expect(specIdOfChannel(channelForSpec('spec-dev-001-pagos'))).toBe('spec-dev-001-pagos');
    expect(specIdOfChannel('general')).toBeNull();
  });
});

describe('ThreadOptions', () => {
  it('defaults to the orchestrator with kit model', () => {
    expect(defaultThreadOptions()).toEqual({
      agent: 'sdd-orchestrator',
      model: 'kit',
      effort: null,
      permissionMode: 'default',
    });
  });
  it('rejects bypassPermissions', () => {
    const r = ThreadOptions.safeParse({ ...defaultThreadOptions(), permissionMode: 'bypassPermissions' });
    expect(r.success).toBe(false);
  });
});

describe('WorkspaceSnapshot', () => {
  it('parses a minimal snapshot', () => {
    const snap = {
      project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [],
      agents: [], gateMode: 'block', pricing: null, stale: ['specs'],
    };
    expect(WorkspaceSnapshot.parse(snap)).toEqual(snap);
  });
});
