export type UnitRef =
  | { kind: 'cycle'; spec: string; cycle: string }
  | { kind: 'fix'; fix: string };

export type BindSource = 'gate-b' | 'sdd-use' | 'single-unit' | 'branch' | 'studio';

export type SessionBinding = {
  session_id: string;
  unit: UnitRef;
  worktree: string;
  harness: 'claude-code' | 'studio' | 'manual';
  source: BindSource;
  bound_at: string;
  updated_at: string;
  ended_at: string | null;
};

export type RegistryFs = {
  read: (path: string) => Promise<string>;
  write: (path: string, text: string) => Promise<void>;
  list: (path: string) => Promise<{ name: string; kind?: string }[]>;
};

export type EditVerdict =
  | { kind: 'allow' }
  | { kind: 'warn' | 'deny'; code: string; reason: string };

export function resolveRegistryDir(fs: Pick<RegistryFs, 'read'>, repoRoot: string): Promise<string>;
export function readBranch(fs: Pick<RegistryFs, 'read'>, repoRoot: string): Promise<string | null>;
export function unitKey(unit: UnitRef): string;
export function sameUnit(a: UnitRef | null | undefined, b: UnitRef | null | undefined): boolean;
export function formatBindMarker(unit: UnitRef): string;
export function parseBindMarker(text: unknown): UnitRef | null;
export function openUnitsOf(
  cycles: { spec: string; cycle: string }[],
  fixes: { id: string }[],
): UnitRef[];
export function isBindingLive(binding: SessionBinding | null | undefined, now: number): boolean;
export function readBinding(fs: Pick<RegistryFs, 'read'>, dir: string, sessionId: string): Promise<SessionBinding | null>;
export function writeBinding(
  fs: RegistryFs,
  dir: string,
  input: { sessionId: string; unit: UnitRef; worktree: string; harness: 'claude-code' | 'studio' | 'manual'; source: BindSource; now: number },
): Promise<SessionBinding>;
export function touchBinding(fs: RegistryFs, dir: string, sessionId: string, now: number): Promise<SessionBinding | null>;
export function endBinding(fs: RegistryFs, dir: string, sessionId: string, now: number): Promise<SessionBinding | null>;
export function listLiveBindings(fs: Pick<RegistryFs, 'read' | 'list'>, dir: string, now: number): Promise<SessionBinding[]>;
export function autoBindUnit(input: {
  binding: SessionBinding | null;
  openUnits: UnitRef[];
  branch: string | null;
  now: number;
}): { unit: UnitRef; source: BindSource } | null;
export function judgeSessionEdit(input: {
  gate: 'block' | 'warn';
  binding: SessionBinding | null;
  openUnits: UnitRef[];
  rel: string;
  now: number;
}): EditVerdict;
