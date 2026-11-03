import type { SessionStatus, ThreadInfo } from '@sdd-studio/protocol';
import { associationLabels, countByFilter, filterConversations, groupByCycle } from './map-filters';

const thread = (id: string, status: SessionStatus, link: ThreadInfo['link'] = { target: { kind: 'none' }, source: 'legacy' }): ThreadInfo => ({
  id,
  channelId: 'general',
  title: id,
  agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status,
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-01T00:00:00Z',
  link,
  pendingCount: 0,
});

const cycleLink = (specId: string, cycle: string): ThreadInfo['link'] => ({ target: { kind: 'cycle', specId, cycle }, source: 'manual' });

const list = [
  thread('free', 'idle'),
  thread('c1', 'running', cycleLink('spec-a', 'cycle-01')),
  thread('c2', 'idle', cycleLink('spec-a', 'cycle-02')),
  thread('fx', 'waiting-approval', { target: { kind: 'fix', fixId: 'FIX-1' }, source: 'manual' }),
  thread('spec-only', 'queued', { target: { kind: 'none' }, source: 'manual', targets: [{ kind: 'spec', specId: 'spec-a', origin: 'manual' }] }),
];

describe('map conversation filters', () => {
  it('treats threads without cycle or fix (spec-only included) as transversal', () => {
    expect(filterConversations(list, 'transversal').map((i) => i.id)).toEqual(['free', 'spec-only']);
  });

  it('keeps cycle-linked threads under By cycle', () => {
    expect(filterConversations(list, 'cycle').map((i) => i.id)).toEqual(['c1', 'c2']);
  });

  it('maps running to in-progress sessions and ready to idle ones', () => {
    expect(filterConversations(list, 'running').map((i) => i.id)).toEqual(['c1', 'fx', 'spec-only']);
    expect(filterConversations(list, 'ready').map((i) => i.id)).toEqual(['free', 'c2']);
  });

  it('counts every filter', () => {
    expect(countByFilter(list)).toEqual({ all: 5, transversal: 2, cycle: 2, running: 3, ready: 2 });
  });

  it('groups by spec and cycle', () => {
    const groups = groupByCycle(filterConversations(list, 'cycle'));
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['spec-a/cycle-01', ['c1']],
      ['spec-a/cycle-02', ['c2']],
    ]);
  });

  it('lists the associated entities for search', () => {
    expect(associationLabels(list[1])).toEqual(['spec-a · cycle-01']);
    expect(associationLabels(list[0])).toEqual([]);
  });
});
