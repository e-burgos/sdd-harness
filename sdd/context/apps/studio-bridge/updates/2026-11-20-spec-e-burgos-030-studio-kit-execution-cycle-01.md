# spec-e-burgos-030-studio-kit-execution · cycle-01 — 2026-11-20

## Estructura
- Snapshot lee `batches`, `usage` y `depends_on` de cada `tasks.json`, los resultados de `artifacts/verify/*/*.json` (el más reciente por app/nivel/unidad; sin `logs/`) y `sdd/verify.json`; el watcher ignora `artifacts/verify/logs`.
- `workspace/verify-lease.ts` importa en runtime `sdd/scripts/lib/verify-lease.mjs` (`resolveLockFile` + `judgeLease`) ⇒ `verifyLease` (área `kit`).
- `kit.verify.run`: app/nivel validados contra `verify.json`, `CommandRunner.verify` (uno a la vez ⇒ `conflict` busy), refresco del snapshot al salir.
