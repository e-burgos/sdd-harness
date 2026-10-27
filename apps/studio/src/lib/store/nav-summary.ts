import type { Presence } from '@sdd-studio/protocol';
import { OPEN_FIX_STATUSES, type NavSection, type NavThread } from './nav-tree';

const IN_PROGRESS = 'in-progress';

export interface NavSummary {
  active: number;
  specsActive: number;
  specsTotal: number;
  fixesOpen: number;
  agentsWorking: number;
}

const sectionOf = (tree: NavSection[], key: NavSection['key']) => tree.find((s) => s.key === key);

export function summarizeNavTree(tree: NavSection[], presence: Presence[]): NavSummary {
  const specs = sectionOf(tree, 'specs')?.children ?? [];
  const fixes = sectionOf(tree, 'fixes')?.children ?? [];
  return {
    active: sectionOf(tree, 'active')?.threads.length ?? 0,
    specsActive: specs.filter((s) => s.status === IN_PROGRESS).length,
    specsTotal: specs.length,
    fixesOpen: fixes.filter((f) => f.kind === 'fix' && f.status !== null && OPEN_FIX_STATUSES.has(f.status)).length,
    agentsWorking: new Set(presence.filter((p) => p.state === 'working').map((p) => p.agent)).size,
  };
}

export function currentTaskOf(tree: NavSection[], agent: string): string | null {
  const threads: NavThread[] = sectionOf(tree, 'active')?.threads ?? [];
  const thread = threads.find((t) => t.workingAgents.includes(agent));
  return thread ? (thread.tool ?? thread.title) : null;
}
