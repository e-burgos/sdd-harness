# spec-e-burgos-017-parallel-sessions — cycle-02 — 2026-11-06

## Estado
El snapshot suma `leases` (opcional, `.catch(undefined)`): `FileLeaseSummary` (`path`, `sessionId`, `unit` nullable, `harness`, `worktree`, `acquiredAt`, `updatedAt`, `requestedBy` ≤ 16), con tope `MAX_FILE_LEASES` (256). `PROTOCOL_VERSION` no cambia.

## Estructura
- `src/snapshot.ts`: `FileLeaseSummary`, `MAX_FILE_LEASES`, `WorkspaceSnapshot.leases`; test en `snapshot.spec.ts`.

## Dependencias
- Ninguna nueva.

## Qué sigue
- Nada pendiente de esta spec.
