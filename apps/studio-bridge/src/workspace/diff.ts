import { channelForSpec, type BotEvent, type WorkspaceSnapshot } from '@sdd-studio/protocol';

export function diffSnapshots(prev: WorkspaceSnapshot, next: WorkspaceSnapshot): BotEvent[] {
  const events: BotEvent[] = [];

  const prevSpecs = new Map(prev.specs.map((s) => [s.id, s]));
  for (const spec of next.specs) {
    const before = prevSpecs.get(spec.id);
    const channelId = channelForSpec(spec.id);
    if (!before) {
      events.push({ channelId, botKind: 'spec.created', payload: { specId: spec.id, title: spec.title, status: spec.status } });
    } else if (before.status !== spec.status) {
      events.push({ channelId, botKind: 'spec.status', payload: { specId: spec.id, from: before.status, to: spec.status } });
    }
  }

  const prevCycles = new Map(prev.cycles.map((c) => [`${c.specId}/${c.cycle}`, c]));
  for (const cycle of next.cycles) {
    const before = prevCycles.get(`${cycle.specId}/${cycle.cycle}`);
    const channelId = channelForSpec(cycle.specId);
    const ids = { specId: cycle.specId, cycle: cycle.cycle };
    if (!before) {
      events.push({ channelId, botKind: 'cycle.opened', payload: { ...ids, flow: cycle.flow, status: cycle.status } });
      continue;
    }
    if (before.status !== cycle.status) {
      events.push({ channelId, botKind: 'cycle.status', payload: { ...ids, from: before.status, to: cycle.status } });
    }
    const prevTasks = new Map(before.tasks.map((t) => [t.id, t]));
    for (const task of cycle.tasks) {
      const was = prevTasks.get(task.id);
      if (was && was.status !== task.status) {
        events.push({
          channelId,
          botKind: 'task.status',
          payload: { ...ids, taskId: task.id, title: task.title, from: was.status, to: task.status },
        });
      }
    }
  }

  const prevFixes = new Map(prev.fixes.map((f) => [f.id, f]));
  for (const fix of next.fixes) {
    const before = prevFixes.get(fix.id);
    if (!before) {
      events.push({
        channelId: 'fixes',
        botKind: 'fix.created',
        payload: { fixId: fix.id, title: fix.title, severity: fix.severity, specId: fix.specId },
      });
    } else if (before.status !== fix.status) {
      events.push({ channelId: 'fixes', botKind: 'fix.status', payload: { fixId: fix.id, from: before.status, to: fix.status } });
    }
  }
  return events;
}
