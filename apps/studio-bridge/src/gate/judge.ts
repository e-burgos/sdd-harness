import type { WorkspaceSnapshot } from '@sdd-studio/protocol';

export type Verdict = { kind: 'allow' } | { kind: 'warn'; reason: string } | { kind: 'deny'; reason: string };

// Misma regla que sdd-mod (templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts): mantener en sincronía.
const EXEMPT_DIRS = new Set(['sdd', '.claude', '.github', '.gemini', '.agents', '.agent', '.vscode', '.idea']);
const OPEN_FIX = new Set(['pending', 'in-progress']);
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export function editTargetOf(toolName: string, input: Record<string, unknown>): string | null {
  if (!EDIT_TOOLS.has(toolName)) return null;
  const target = input.file_path ?? input.notebook_path;
  return typeof target === 'string' ? target : null;
}

/** Ruta relativa a la raíz con `/`, o null si cae fuera. */
export function relativeToRoot(root: string, filePath: string): string | null {
  const norm = (p: string) => p.replace(/\\/g, '/');
  const base = norm(root).replace(/\/+$/, '');
  const raw = norm(filePath);
  const isAbsolute = raw.startsWith('/') || /^[A-Za-z]:\//.test(raw);
  const parts: string[] = [];
  for (const part of (isAbsolute ? raw : `${base}/${raw}`).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  const full = (raw.startsWith('/') || base.startsWith('/') ? '/' : '') + parts.join('/');
  if (!full.startsWith(`${base}/`)) return null;
  return full.slice(base.length + 1);
}

export function isCodePath(rel: string): boolean {
  const [first, ...rest] = rel.split('/');
  if (rest.length === 0) return !/\.md$/i.test(first ?? '');
  return !EXEMPT_DIRS.has(first ?? '');
}

export function judgeEdit(snapshot: WorkspaceSnapshot, root: string, filePath: string): Verdict {
  if (snapshot.stale.includes('specs') || snapshot.stale.includes('fixes')) return { kind: 'allow' };
  const rel = relativeToRoot(root, filePath);
  if (rel === null || !isCodePath(rel)) return { kind: 'allow' };
  const active =
    snapshot.cycles.some((c) => c.status === 'in-progress') || snapshot.fixes.some((f) => OPEN_FIX.has(f.status));
  if (active) return { kind: 'allow' };
  const reason =
    `SPEC GATE: no hay ningún ciclo in-progress ni un fix abierto, así que todavía no se escribe ` +
    `código (${rel}). Abrí un ciclo (/gate <spec> → orchestrator) o registrá el cambio con ` +
    `[FIX]/[BUGFIX]/[HOTFIX]. Reglas: sdd/dual-harness/rules/sdd-gates.md.`;
  return snapshot.gateMode === 'block' ? { kind: 'deny', reason } : { kind: 'warn', reason };
}
