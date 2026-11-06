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

export type Harness = 'claude-code' | 'studio' | 'manual';

export type FileLease = {
  path: string;
  session_id: string;
  unit: UnitRef | null;
  worktree: string;
  harness: Harness;
  acquired_at: string;
  updated_at: string;
  released_at: string | null;
};

export type InboxMessage = {
  id: string;
  kind: 'lease-request' | 'lease-released';
  path: string;
  from_session: string;
  from_unit: UnitRef | null;
  to_session: string;
  created_at: string;
  read_at: string | null;
};

export type LeaseVerdict =
  | { kind: 'allow' }
  | { kind: 'warn' | 'deny'; code: string; reason: string; lease?: FileLease };

export const LEASE_TTL_MS: number;
export function normalizeRel(rel: string): string;
export function leaseKey(rel: string): string;
export function isLeaseLive(lease: FileLease | null | undefined, now: number): boolean;
export function readLease(fs: Pick<RegistryFs, 'read'>, dir: string, rel: string): Promise<FileLease | null>;
export function listLiveLeases(fs: Pick<RegistryFs, 'read' | 'list'>, dir: string, now: number): Promise<FileLease[]>;
export function acquireLease(
  fs: RegistryFs,
  dir: string,
  input: { rel: string; sessionId: string; unit: UnitRef | null; worktree: string; harness: Harness; now: number },
): Promise<{ acquired: boolean; lease: FileLease }>;
export function releaseLease(
  fs: RegistryFs,
  dir: string,
  rel: string,
  now: number,
  options?: { sessionId?: string },
): Promise<FileLease | null>;
export function releaseSessionLeases(fs: RegistryFs, dir: string, sessionId: string, now: number): Promise<FileLease[]>;
export function judgeFileLease(input: {
  gate: 'block' | 'warn';
  lease: FileLease | null;
  sessionId: string;
  worktree: string;
  now: number;
}): LeaseVerdict;
export function requestLease(
  fs: RegistryFs,
  dir: string,
  input: { lease: FileLease; fromSessionId: string; fromUnit: UnitRef | null; now: number },
): Promise<{ created: boolean; message: InboxMessage }>;
export function listInbox(
  fs: Pick<RegistryFs, 'read' | 'list'>,
  dir: string,
  sessionId: string,
  options?: { unreadOnly?: boolean },
): Promise<InboxMessage[]>;
export function markInboxRead(fs: RegistryFs, dir: string, sessionId: string, ids: string[], now: number): Promise<void>;
export function notifyRequesters(fs: RegistryFs, dir: string, released: FileLease, now: number): Promise<string[]>;
export function inboxText(messages: InboxMessage[]): string;
