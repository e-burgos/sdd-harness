export type GateMode = 'block' | 'warn';

export type ModSettings = { enabled: boolean; gate: GateMode; exempt?: string[] };

export type CycleTask = { id: string; title: string; status: string };

export type ActiveCycle = {
  worktree: string;
  spec: string;
  title: string;
  cycle: string;
  flow: string;
  tasks: CycleTask[];
};

export type OpenFix = { id: string; title: string; status: string; type: string | null; worktree: string };

export type OpenSpec = { spec: string; title: string; worktree: string };

export type UnitRef =
  | { kind: 'cycle'; spec: string; cycle: string }
  | { kind: 'fix'; fix: string }
  | { kind: 'spec'; spec: string };

export type SessionBinding = {
  session_id: string;
  unit: UnitRef;
  worktree: string;
  harness: 'claude-code' | 'studio' | 'manual';
  source:
    | 'gate-a'
    | 'gate-b'
    | 'sdd-use'
    | 'single-unit'
    | 'branch'
    | 'studio'
    | 'document'
    | 'worktree'
    | 'spec-cycle';
  bound_at: string;
  updated_at: string;
  ended_at: string | null;
};

export type FileLease = {
  path: string;
  session_id: string;
  unit: UnitRef | null;
  worktree: string;
  harness: 'claude-code' | 'studio' | 'manual';
  acquired_at: string;
  updated_at: string;
  released_at: string | null;
};

export type Snapshot = {
  settings: ModSettings;
  cycles: ActiveCycle[];
  fixes: OpenFix[];
  openUnits: UnitRef[];
  specs: OpenSpec[];
  root: string;
  worktrees: string[];
  mine: SessionBinding | null;
  others: SessionBinding[];
  sessionId?: string;
  leases?: FileLease[];
  registryError?: string;
  /** Set when sdd/ could not be read: the gate stays open and the band says why. */
  error?: string;
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-mod': { snapshot: Snapshot | null };
  }
}
