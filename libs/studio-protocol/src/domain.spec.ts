import { describe, expect, it } from 'vitest';
import {
  AlwaysOffer,
  AlwaysRule,
  ChannelId,
  MAX_PENDING_PER_THREAD,
  PermissionModeChoice,
  ThreadInfo,
  ThreadLink,
  ThreadLinkTarget,
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
  it('accepts bypassPermissions as an opt-in mode', () => {
    expect(ThreadOptions.safeParse({ ...defaultThreadOptions(), permissionMode: 'bypassPermissions' }).success).toBe(true);
  });
  it('rejects unknown permission modes', () => {
    expect(ThreadOptions.safeParse({ ...defaultThreadOptions(), permissionMode: 'yolo' }).success).toBe(false);
  });
});

describe('WorkspaceSnapshot', () => {
  it('parses a minimal snapshot', () => {
    const snap = {
      project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [],
      agents: [], skills: [], gateMode: 'block', pricing: null, stale: ['specs'],
    };
    expect(WorkspaceSnapshot.parse(snap)).toEqual(snap);
  });
});

const threadInfo = {
  id: 't1',
  channelId: 'general',
  title: 'x',
  agent: 'sdd-planner',
  options: defaultThreadOptions('sdd-planner'),
  status: 'idle',
  createdAt: '2026-10-23T00:00:00Z',
  lastActivity: '2026-10-23T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
};

describe('ThreadLink', () => {
  it('parses cycle, fix and none targets with every source', () => {
    const targets = [
      { kind: 'cycle', specId: 'spec-e-burgos-001-x', cycle: 'cycle-01' },
      { kind: 'fix', fixId: 'FIX-e-burgos-002' },
      { kind: 'none' },
    ];
    for (const target of targets) {
      for (const source of ['auto', 'manual', 'legacy']) {
        const link = { target, source };
        expect(ThreadLink.parse(link)).toEqual(link);
      }
    }
  });
  it('rejects malformed targets', () => {
    for (const target of [
      { kind: 'cycle', specId: '../x', cycle: 'cycle-01' },
      { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-1' },
      { kind: 'fix', fixId: 'fix-001' },
      { kind: 'fix', fixId: 'FIX-' },
      { kind: 'other' },
    ]) {
      expect(ThreadLinkTarget.safeParse(target).success).toBe(false);
    }
  });
});

describe('ThreadInfo', () => {
  it('requires link and a bounded pendingCount', () => {
    expect(ThreadInfo.parse(threadInfo)).toEqual(threadInfo);
    const { link, ...withoutLink } = threadInfo;
    expect(link).toBeDefined();
    expect(ThreadInfo.safeParse(withoutLink).success).toBe(false);
    const { pendingCount, ...withoutCount } = threadInfo;
    expect(pendingCount).toBe(0);
    expect(ThreadInfo.safeParse(withoutCount).success).toBe(false);
    expect(ThreadInfo.safeParse({ ...threadInfo, pendingCount: MAX_PENDING_PER_THREAD }).success).toBe(true);
    expect(ThreadInfo.safeParse({ ...threadInfo, pendingCount: MAX_PENDING_PER_THREAD + 1 }).success).toBe(false);
    expect(ThreadInfo.safeParse({ ...threadInfo, pendingCount: -1 }).success).toBe(false);
  });
});

describe('AlwaysRule and AlwaysOffer', () => {
  it('parses tool, mcp and bash-prefix rules', () => {
    for (const rule of [
      { kind: 'tool', tool: 'Edit' },
      { kind: 'mcp', tool: 'mcp__github__create_issue' },
      { kind: 'bash-prefix', prefix: 'git status' },
    ]) {
      expect(AlwaysRule.parse(rule)).toEqual(rule);
      expect(AlwaysOffer.parse(rule)).toEqual(rule);
    }
  });
  it('rejects an mcp rule that is not a full tool name and empty prefixes', () => {
    expect(AlwaysRule.safeParse({ kind: 'mcp', tool: 'mcp__github' }).success).toBe(false);
    expect(AlwaysRule.safeParse({ kind: 'bash-prefix', prefix: '' }).success).toBe(false);
  });
  it('offers none only with a known reason', () => {
    for (const reason of ['gate-warning', 'not-calculable']) {
      expect(AlwaysOffer.safeParse({ kind: 'none', reason }).success).toBe(true);
    }
    expect(AlwaysOffer.safeParse({ kind: 'none', reason: 'other' }).success).toBe(false);
    expect(AlwaysOffer.safeParse({ kind: 'none' }).success).toBe(false);
    expect(AlwaysRule.safeParse({ kind: 'none', reason: 'gate-warning' }).success).toBe(false);
  });
});

describe('PermissionModeChoice', () => {
  it('keeps the four modes including bypassPermissions', () => {
    expect(PermissionModeChoice.options).toEqual(['default', 'acceptEdits', 'bypassPermissions', 'plan']);
  });
});
