# spec-e-burgos-001-studio-session-ux cycle-01 — 2026-10-23

## Estado

- Mensajes encolados (HU-10): `thread.send` sobre un hilo ocupado devuelve `{ delivery: 'pending' }` en lugar de `conflict`; los pendientes se persisten en el hilo, se entregan en el punto de corte (`PostToolBatch`) o como siguiente turno, se pueden editar/quitar hasta su entrega y vuelven a pendientes si el interrupt no llegó a entregarlos.
- "Always" por alcance (HU-6): regla por herramienta, tool MCP exacta o prefijo Bash, en memoria y por hilo (se pierde al reiniciar el puente). El SPEC GATE se evalúa antes que cualquier regla: `deny` bloquea siempre y una tarjeta con `warn` nunca guarda regla.
- Vínculo hilo ↔ ciclo/fix: asignación automática al crear (ciclo in-progress del canal de la spec o fix abierto) y reasignación manual con `thread.setLink`.

## Estructura

- `engine/input-channel.ts` (nuevo): canal `AsyncIterable` con `pushAndFlush`; el engine usa prompt streaming (`prompt: AsyncIterable<SDKUserMessage>`) en lugar de `prompt: string`.
- `engine/prompt-content.ts` (nuevo): `toSdkUserMessage` (uuid = id del pendiente) y `toHookContext` (fallback).
- `claude-sdk-engine.ts`: hook `PostToolBatch` solo del hilo principal; `DeliveryMode = 'stream'` por defecto (evidencia: `cycle-01/artifacts/spike-posttoolbatch.md`), `hook-context` queda como alternativa interna; al `result` entrega pendientes como siguiente turno de la misma query; el recibo de `interrupt()` (`still_queued`) dispara `revertPending`.
- `EngineCallbacks` suma `collectPending(at)` y `revertPending(ids)`; `EngineTurnInput.prompts: OutgoingMessage[]` reemplaza a `text`.
- `sessions/always-rule.ts` (nuevo): `bashPrefixOf` (programa + hasta 2 subcomandos; rechaza wrappers, asignaciones de entorno y comandos compuestos), `alwaysOfferOf`, `matchesRule`.
- `sessions/thread-link.ts` (nuevo): `assignLink` puro y `linkTargetExists`.
- `sessions/store.ts`: `pending[]` y `link` persistidos con migración de hilos previos (`source: 'legacy'`); `toThreadInfo` exportado.
- `server/router.ts` / `ws-server.ts`: comandos nuevos, `unsupported` para los de cycle-02, `features` en el welcome, `maxPayload` = `MAX_FRAME_BYTES`.
- `gate/judge.ts`: solo exporta `OPEN_FIX` (reglas del gate sin cambios).
- `fake-engine.ts`: puntos de corte y marcadores (`#slow`, `#steps:N`, `#bash-git`, …) para tests y Playwright.

## Qué sigue

- cycle-02: adjuntos (re-encode de imágenes sin EXIF), `workspace.searchFiles` y descubrimiento de skills/agentes; hoy responden `unsupported`.
- El e2e real `post-tool-batch.e2e.spec.ts` se salta sin credenciales; correrlo al actualizar `@anthropic-ai/claude-agent-sdk` (pinneado 0.3.292).
