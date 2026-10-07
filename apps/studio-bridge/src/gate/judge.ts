import type { WorkspaceSnapshot } from '@sdd-studio/protocol';

export type Verdict = { kind: 'allow' } | { kind: 'warn'; reason: string } | { kind: 'deny'; reason: string };

// Misma regla que sdd-mod (templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts): mantener en sincronía.
const EXEMPT_DIRS = new Set(['sdd', '.claude', '.github', '.gemini', '.agents', '.agent', '.vscode', '.idea']);
const CLOSED_SPEC = new Set(['completed', 'cancelled']);
const OPEN_FIX = new Set(['pending', 'in-progress']);
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export function editTargetOf(toolName: string, input: Record<string, unknown>): string | null {
  if (!EDIT_TOOLS.has(toolName)) return null;
  const target = toolName === 'NotebookEdit' ? input.notebook_path : input.file_path;
  return typeof target === 'string' ? target : null;
}

const DRIVE = /^[A-Za-z]:$/;

function segmentsOf(p: string): string[] {
  const parts: string[] = [];
  for (const part of p.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts;
}

/** Ruta relativa a la raíz con `/`, o null si cae fuera. */
export function relativeToRoot(root: string, filePath: string): string | null {
  const raw = filePath.replace(/\\/g, '/');
  const isAbsolute = raw.startsWith('/') || /^[A-Za-z]:\//.test(raw);
  const base = segmentsOf(root);
  const full = isAbsolute ? segmentsOf(raw) : segmentsOf(`${root}/${raw}`);
  if (full.length <= base.length) return null;
  const foldAll = process.platform === 'darwin' || process.platform === 'win32';
  for (let i = 0; i < base.length; i++) {
    const a = base[i]!;
    const b = full[i]!;
    const fold = foldAll || (i === 0 && DRIVE.test(a));
    if (fold ? a.toLowerCase() !== b.toLowerCase() : a !== b) return null;
  }
  return full.slice(base.length).join('/');
}

export function isCodePath(rel: string): boolean {
  const [first, ...rest] = rel.split('/');
  if (rest.length === 0) return !/\.md$/i.test(first ?? '');
  return !EXEMPT_DIRS.has(first ?? '');
}

export function judgeEdit(snapshot: WorkspaceSnapshot, root: string, filePath: string): Verdict {
  // Sin datos buenos de specs (nunca se pudieron leer) no hay base para juzgar; con datos previos se juzga sobre lo último bueno.
  if (snapshot.stale.includes('specs') && snapshot.specs.length === 0) return { kind: 'allow' };
  const rel = relativeToRoot(root, filePath);
  if (rel === null || !isCodePath(rel)) return { kind: 'allow' };
  const closedSpecs = new Set(snapshot.specs.filter((sp) => CLOSED_SPEC.has(sp.status)).map((sp) => sp.id));
  const active =
    snapshot.cycles.some((c) => c.status === 'in-progress' && !closedSpecs.has(c.specId)) || snapshot.fixes.some((f) => OPEN_FIX.has(f.status));
  if (active) return { kind: 'allow' };
  const reason =
    `SPEC GATE: no hay ningún ciclo in-progress ni un fix abierto, así que todavía no se escribe ` +
    `código (${rel}). Abrí un ciclo (pnpm sdd:gate <spec> → sdd-orchestrator) o registrá el cambio con ` +
    `[FIX]/[BUGFIX]/[HOTFIX]. Reglas: sdd/dual-harness/rules/sdd-gates.md.`;
  return snapshot.gateMode === 'block' ? { kind: 'deny', reason } : { kind: 'warn', reason };
}
