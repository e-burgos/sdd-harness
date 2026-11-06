export type GateMode = 'block' | 'warn';

export type ModSettings = { enabled: boolean; gate: GateMode };

export type CycleTask = { id: string; title: string; status: string };

export type ActiveCycle = {
  spec: string;
  title: string;
  cycle: string;
  flow: string;
  tasks: CycleTask[];
};

export type OpenFix = { id: string; title: string; status: string };

export type UnitRef =
  | { kind: 'cycle'; spec: string; cycle: string }
  | { kind: 'fix'; fix: string };

export type SessionBinding = {
  session_id: string;
  unit: UnitRef;
  worktree: string;
  harness: 'claude-code' | 'studio' | 'manual';
  source: 'gate-b' | 'sdd-use' | 'single-unit' | 'branch' | 'studio';
  bound_at: string;
  updated_at: string;
  ended_at: string | null;
};

export type Snapshot = {
  settings: ModSettings;
  cycles: ActiveCycle[];
  fixes: OpenFix[];
  openUnits: UnitRef[];
  mine: SessionBinding | null;
  others: SessionBinding[];
  registryError?: string;
  /** Set when sdd/ could not be read: the gate stays open and the band says why. */
  error?: string;
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-mod': { snapshot: Snapshot | null };
  }
}
