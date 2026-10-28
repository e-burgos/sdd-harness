# apps/studio-bridge — spec-e-burgos-010-studio-dual-sidebar · cycle-01

## Estado
El puente anuncia las features `kit-index`, `kit-tools` y `rtk-gain`. Indexa el kit (`KitIndexer`, comando `kit.index`, evento `kit.changed`), escribe `sdd/tools.json` (`kit.tools.set` con `expectedRevision` sha256-16, validación ajv y escritura atómica, con test de paridad contra los scripts del kit) y expone el ahorro de rtk (`kit.rtkGain`). Cada cambio de herramientas emite el evento de bot `tools.changed` con `at`.

## Estructura
- `src/workspace/kit-index.ts`, `kit-tools.ts`, `rtk-gain.ts`; cableado en router, main, store, watcher y snapshot.
- `sessions/store.ts`: `tools.changed` nunca se deduplica; `channel.botHistory` acepta `includeKitEvents`.

## Dependencias
- `ajv` (externa en `build.js`).

## Qué sigue
- Exponer la hora exacta de aprobaciones y preguntas para Actividad.
