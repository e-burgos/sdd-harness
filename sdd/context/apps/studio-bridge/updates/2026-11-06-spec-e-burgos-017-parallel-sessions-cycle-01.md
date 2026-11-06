# spec-e-burgos-017-parallel-sessions — cycle-01 — 2026-11-06

## Estado
El puente ata cada conversación de Studio a su unidad (arnés `studio`, fuente por conversación) y renueva el latido cada 60 s; el gate (`judge.ts`) decide por sesión igual que el mod. El snapshot incluye `sessions` con las ataduras del registro del kit; con un kit viejo el puente cae al comportamiento previo. El mensaje de denegación de Studio pide vincular la conversación, no usar `pnpm sdd:use`.

## Estructura
- `src/sessions/session-bindings.ts` (`SessionBindings`, `sessionIdOfThread`), `src/workspace/sessions-feed.ts` (`createSessionsFeed`, `withSessions`, refresco cada 30 s).
- Cambios en `session-manager.ts`, `gate/judge.ts` y `project/runtime.ts`.

## Dependencias
- Ninguna nueva; lee el registro del kit vía `sdd/scripts/lib/session-registry.mjs` del workspace.

## Qué sigue
- cycle-02: reservas de archivo y avisos entre sesiones.
