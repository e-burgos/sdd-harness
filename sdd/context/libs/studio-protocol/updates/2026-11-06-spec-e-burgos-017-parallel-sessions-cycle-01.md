# spec-e-burgos-017-parallel-sessions — cycle-01 — 2026-11-06

## Estado
El snapshot suma `sessions` (opcional): ataduras `SessionBinding` (`sessionId`, `unit` ciclo o fix, `harness`, `source`, `worktree`, `boundAt`, `updatedAt`), con tope `MAX_SESSION_BINDINGS` (64) y `.catch(undefined)` para tolerar puentes o kits viejos. `PROTOCOL_VERSION` no cambia.

## Estructura
- `src/snapshot.ts`: `SessionUnit`, `SessionBinding`, `MAX_SESSION_BINDINGS`, `WorkspaceSnapshot.sessions`; tests en `snapshot.spec.ts`.

## Dependencias
- Ninguna nueva.

## Qué sigue
- cycle-02: eventos o campos para reservas de archivo si hacen falta.
