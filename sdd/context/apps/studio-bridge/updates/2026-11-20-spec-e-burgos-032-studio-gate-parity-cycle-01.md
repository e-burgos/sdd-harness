# spec-e-burgos-032-studio-gate-parity · cycle-01 — 2026-11-20

## Estructura
- `gate/judge.ts` `isCodePath(rel, exempt)` = port de la regla del mod (EXEMPT_DIRS, globs `exempt` con `gate/glob.ts`, code roots apps/libs/tools, `.md`/`.mdx` fuera de code roots no son código) con tabla de paridad; `exempt` desde `snapshot.tools.exempt`.
- `workspace/gate-runner.ts`: `spec-gate.mjs <spec> [cycle] --json` (exit 0/1 ⇒ resultado, 2 ⇒ bad-request, JSON inválido ⇒ internal).
