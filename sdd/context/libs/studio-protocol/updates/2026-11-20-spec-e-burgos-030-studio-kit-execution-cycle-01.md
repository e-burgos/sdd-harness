# spec-e-burgos-030-studio-kit-execution · cycle-01 — 2026-11-20

## Estructura
- `TaskSummary` + `usage?`/`batch?`/`dependsOn?`; `CycleSummary` + `batches?`/`verifyResults?`; snapshot + `verifyConfig?`/`verifyLease?`; comando `kit.verify.run {app, level, spec?, cycle?, unit?}` → `{runId}` (salida por `command.output/exit`); feature `kit-execution`.
