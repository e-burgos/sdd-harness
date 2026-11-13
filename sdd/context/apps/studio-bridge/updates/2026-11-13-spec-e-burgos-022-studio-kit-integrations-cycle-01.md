# spec-e-burgos-022-studio-kit-integrations — cycle-01 — 2026-11-13

## Estado
El puente opera las integraciones del kit corriendo `sdd/scripts/sdd-tucu.mjs` y `sdd-video.mjs` del workspace (`execFile` de `process.execPath`, sin shell; status 15 s, enable/disable 180 s) y normaliza su `--status`. Sin el script → `unavailable`. Tras un `set` exitoso refresca el watcher y emite `integration.changed` en #general (oculto del historial salvo `includeKitEvents`).

## Estructura
- `src/workspace/kit-integrations.ts` (`createKitIntegrations`, `normalizeIntegrationStatus`; reusa `Exec` de `github/exec.ts`) + spec; handlers en `server/router.ts`; `sessions/store.ts` trata `integration.changed` como `tools.changed`.

## Dependencias
- Ninguna nueva.

## Qué sigue
- Nada pendiente de esta spec.
