# spec-e-burgos-017-parallel-sessions — cycle-02 — 2026-11-06

## Estado
Con el mod prendido, el primer `Edit`/`Write`/`NotebookEdit` permitido sobre un archivo de código lo reserva para la sesión (`<git-common-dir>/sdd-sessions/locks/`). Otra sesión en la misma carpeta recibe `SDD reserva: …` (deny, o aviso con `warn`); desde otro worktree solo aviso. El choque deja un pedido en el buzón de la dueña (`inbox/<sesión>/`), que el mod entrega como `context` del resultado de su próxima herramienta (no por `prompt.compose`: el motor no lo vuelve a pedir). `pnpm sdd:release <archivo…>` libera y avisa; `--list` muestra las reservas. Vencen a los 30 min sin edición y se liberan en `session.end`.

## Estructura
- `templates/sdd/scripts/lib/session-registry.mjs`: `leaseKey` (FNV-1a 64 bits), `acquireLease` (escribe y relee), `releaseLease`, `releaseSessionLeases`, `listLiveLeases`, `judgeFileLease`, `requestLease`, `listInbox`, `markInboxRead`, `notifyRequesters`, `inboxText`.
- `scripts/sdd-release.mjs` (`pnpm sdd:release`), schemas `file-lease.schema.json` y `session-request.schema.json`.
- Mod: `leaseEdit`, `unreadInbox`, `markInboxSeen`, `leasesOf` en `sdd.ts`; hook genérico `tool.call` para el buzón y `session.send` como bonus en `register.tsx`; `Snapshot.sessionId`/`leases` en el contrato.
- Docs: `sdd-gates.md`, `dual-harness/CLAUDE.md`, implementores, steward, data-schemas, file-structure, README y HOW-TO es/en.

## Dependencias
- Ninguna nueva.

## Qué sigue
- El `tsconfig.json` del mod no chequea `hooks/.src` (tsc saltea carpetas con punto): para type-checkear el mod, lista explícita de archivos contra los tipos del motor.
