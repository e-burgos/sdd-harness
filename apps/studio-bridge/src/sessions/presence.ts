import { specIdOfChannel, type Presence, type ThreadEvent, type ThreadInfo } from '@sdd-studio/protocol';

interface ThreadPresence {
  main: string;
  specId: string | null;
  status: ThreadInfo['status'];
  tools: Map<string, string>;
  subagents: Map<string, string>;
  approvals: Map<string, string>;
}

export class PresenceTracker {
  private readonly threads = new Map<string, ThreadPresence>();

  constructor(private readonly knownAgents: () => string[]) {}

  onThread(thread: ThreadInfo): void {
    const entry = this.threads.get(thread.id) ?? {
      main: thread.agent,
      specId: specIdOfChannel(thread.channelId),
      status: thread.status,
      tools: new Map<string, string>(),
      subagents: new Map<string, string>(),
      approvals: new Map<string, string>(),
    };
    entry.status = thread.status;
    // Clear subagents, tools, and approvals when thread ends (idle/interrupted/error).
    if (thread.status === 'idle' || thread.status === 'interrupted' || thread.status === 'error') {
      entry.subagents.clear();
      entry.tools.clear();
      entry.approvals.clear();
    }
    this.threads.set(thread.id, entry);
  }

  onEvent(threadId: string, event: ThreadEvent): void {
    const t = this.threads.get(threadId);
    if (!t) return;
    switch (event.type) {
      case 'tool.start':
        t.tools.set(event.author.agent, event.tool);
        break;
      case 'subagent.start':
        t.subagents.set(event.agentId, event.agentType);
        break;
      case 'subagent.stop':
        t.subagents.delete(event.agentId);
        t.tools.delete(event.agentType);
        break;
      case 'approval.requested':
        t.approvals.set(event.approvalId, event.author.agent);
        break;
      case 'approval.resolved':
        t.approvals.delete(event.approvalId);
        break;
      case 'turn.end':
        // Sólo las herramientas: las aprobaciones pendientes se limpian con approval.resolved o al salir de running.
        t.tools.clear();
        break;
      default:
        break;
    }
  }

  compute(): Presence[] {
    const names = new Set(this.knownAgents());
    for (const t of this.threads.values()) {
      names.add(t.main);
      for (const sub of t.subagents.values()) names.add(sub);
    }
    return [...names].sort().map((agent) => this.presenceOf(agent));
  }

  private presenceOf(agent: string): Presence {
    const at = (id: string, t: ThreadPresence, state: Presence['state']): Presence => ({
      agent, state, threadId: id, specId: t.specId, tool: t.tools.get(agent) ?? null,
    });
    const entries = [...this.threads.entries()];
    for (const [id, t] of entries) {
      if (t.status === 'waiting-approval' && [...t.approvals.values()].includes(agent)) return at(id, t, 'waiting');
    }
    for (const [id, t] of entries) {
      const active = t.main === agent || [...t.subagents.values()].includes(agent);
      if ((t.status === 'running' || t.status === 'waiting-approval') && active) return at(id, t, 'working');
    }
    for (const [id, t] of entries) if (t.main === agent) return { ...at(id, t, 'open'), tool: null };
    return { agent, state: 'idle', threadId: null, specId: null, tool: null };
  }
}
