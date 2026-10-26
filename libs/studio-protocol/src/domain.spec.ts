import { describe, expect, it } from 'vitest';
import {
  AlwaysOffer,
  AlwaysRule,
  ChannelId,
  DEFAULT_PROVIDER,
  EngineSessionId,
  KNOWN_PROVIDERS,
  MAX_LINK_TARGETS,
  MAX_PENDING_PER_THREAD,
  PermissionModeChoice,
  ProviderId,
  ThreadInfo,
  ThreadLink,
  ThreadLinkEntry,
  ThreadLinkRef,
  ThreadLinkTarget,
  ThreadOptions,
  WorkspaceSnapshot,
  channelForDm,
  channelForSpec,
  defaultThreadOptions,
  dmAgentOfChannel,
  isKnownProvider,
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

describe('ThreadInfo session and provider', () => {
  it('accepts the legacy shape without the new fields', () => {
    const parsed = ThreadInfo.parse(threadInfo);
    expect(parsed.engineSessionId).toBeUndefined();
    expect(parsed.provider).toBeUndefined();
  });
  it('accepts a null session, a session id and a provider', () => {
    expect(ThreadInfo.parse({ ...threadInfo, engineSessionId: null }).engineSessionId).toBeNull();
    expect(ThreadInfo.parse({ ...threadInfo, engineSessionId: 'abc-123', provider: 'claude' })).toMatchObject({
      engineSessionId: 'abc-123',
      provider: 'claude',
    });
  });
  it('accepts an unknown but well-formed provider', () => {
    expect(ThreadInfo.safeParse({ ...threadInfo, provider: 'gemini' }).success).toBe(true);
    expect(isKnownProvider('gemini')).toBe(false);
    expect(isKnownProvider('claude')).toBe(true);
  });
  it('rejects malformed providers and session ids', () => {
    for (const provider of ['', 'Claude', '1claude', 'a b', 'x'.repeat(33)]) {
      expect(ProviderId.safeParse(provider).success).toBe(false);
    }
    expect(EngineSessionId.safeParse('').success).toBe(false);
    expect(EngineSessionId.safeParse('s'.repeat(129)).success).toBe(false);
    expect(ThreadInfo.safeParse({ ...threadInfo, provider: 'Bad Id' }).success).toBe(false);
    expect(ThreadInfo.safeParse({ ...threadInfo, engineSessionId: '' }).success).toBe(false);
  });
  it('defaults to a known provider', () => {
    expect(KNOWN_PROVIDERS).toContain(DEFAULT_PROVIDER);
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

describe('ThreadLinkRef and ThreadLinkEntry', () => {
  const refs = [
    { kind: 'spec', specId: 'spec-a-001' },
    { kind: 'cycle', specId: 'spec-a-001', cycle: 'cycle-01' },
    { kind: 'fix', fixId: 'FIX-a-001' },
  ];

  it('accepts spec, cycle and fix references', () => {
    for (const ref of refs) expect(ThreadLinkRef.parse(ref)).toEqual(ref);
  });

  it('rejects unknown kinds and malformed ids', () => {
    expect(ThreadLinkRef.safeParse({ kind: 'none' }).success).toBe(false);
    expect(ThreadLinkRef.safeParse({ kind: 'cycle', specId: 'spec-a-001', cycle: 'c1' }).success).toBe(false);
    expect(ThreadLinkRef.safeParse({ kind: 'fix', fixId: 'bad' }).success).toBe(false);
  });

  it('requires an origin on entries', () => {
    for (const ref of refs) {
      expect(ThreadLinkEntry.parse({ ...ref, origin: 'detected' })).toEqual({ ...ref, origin: 'detected' });
      expect(ThreadLinkEntry.safeParse(ref).success).toBe(false);
      expect(ThreadLinkEntry.safeParse({ ...ref, origin: 'other' }).success).toBe(false);
    }
  });
});

describe('ThreadLink.targets', () => {
  const base = { target: { kind: 'none' }, source: 'legacy' } as const;
  const entry = { kind: 'spec', specId: 'spec-a-001', origin: 'manual' } as const;

  it('parses a v2 link without targets', () => {
    expect(ThreadLink.parse(base)).toEqual(base);
    expect(ThreadLink.parse(base).targets).toBeUndefined();
  });

  it('keeps valid targets', () => {
    expect(ThreadLink.parse({ ...base, targets: [entry] }).targets).toEqual([entry]);
  });

  it('degrades malformed targets to undefined without failing the link', () => {
    expect(ThreadLink.parse({ ...base, targets: 'nope' }).targets).toBeUndefined();
    expect(ThreadLink.parse({ ...base, targets: [{ kind: 'spec' }] }).targets).toBeUndefined();
    const tooMany = Array.from({ length: MAX_LINK_TARGETS + 1 }, () => entry);
    expect(ThreadLink.parse({ ...base, targets: tooMany }).targets).toBeUndefined();
  });
});

describe('ThreadInfo.sessionTitle', () => {
  it('stays absent for a v2 payload without the field', () => {
    expect(ThreadInfo.parse(threadInfo).sessionTitle).toBeUndefined();
  });

  it('accepts a title and null', () => {
    expect(ThreadInfo.parse({ ...threadInfo, sessionTitle: 'Refactor' }).sessionTitle).toBe('Refactor');
    expect(ThreadInfo.parse({ ...threadInfo, sessionTitle: null }).sessionTitle).toBeNull();
  });

  it('degrades a malformed title to null without failing the frame', () => {
    expect(ThreadInfo.parse({ ...threadInfo, sessionTitle: 42 }).sessionTitle).toBeNull();
    expect(ThreadInfo.parse({ ...threadInfo, sessionTitle: 'x'.repeat(301) }).sessionTitle).toBeNull();
  });

  it('degrades malformed link targets inside ThreadInfo', () => {
    const parsed = ThreadInfo.parse({ ...threadInfo, link: { ...threadInfo.link, targets: 7 } });
    expect(parsed.link.targets).toBeUndefined();
  });
});
