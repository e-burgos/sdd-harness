# spec-e-burgos-022-studio-kit-integrations — cycle-01 · plan (lite)

> Módulo: studio-kit-integrations | Subproyectos: libs/studio-protocol, apps/studio-bridge, apps/studio | 2026-11-13 · Rama `feat/studio-kit-integrations`.

## Diseño
- **Protocolo** (`libs/studio-protocol/src/kit.ts`, `commands.ts`, `limits.ts`): `KitIntegrationId`
  (`tucu-ui` | `video-maker`); `KitIntegrationStatus` normalizado (`available`, `enabled`, `state`
  off|complete|incomplete|unavailable, `parts` {id→bool}, `version`, `kitVersion`,
  `updateAvailable`, `nodeOk`, `harnesses` {claude, copilot, gemini, antigravity →
  complete|incomplete}, `repair` nullable); comandos `kit.integration.status {integration}` →
  `KitIntegrationStatus` y `kit.integration.set {integration, enabled}` →
  `{ ok, exitCode, output (≤ 8 KiB, recortada), status }`; feature `kit-integrations`.
- **Puente** (`src/workspace/kit-integrations.ts` + router): resuelve el script del workspace,
  `execFile(process.execPath, [script, flag])` con timeout (status 15 s, enable/disable 180 s),
  normaliza el JSON de `--status`; tras `set` refresca el watcher y emite un bot event
  `integration.changed`. Sin script → `available: false`.
- **Studio** (módulo Kit, vista de herramientas): sección «Integraciones» con una tarjeta por
  integración (descripción, requisitos, interruptor, estado por arnés, versión, «Reparar» si está
  incompleta, salida del último intento si falló). i18n es/en. Sin la feature, no se muestra.
- **Flow lite** pese a tocar un contrato: los tres consumidores (protocolo, puente y Studio) cambian
  en el mismo ciclo y por el mismo actor, como en spec-e-burgos-014 cycle-02 y 017.

## Tasks
- TASK-001 — Protocolo y puente (contrato, ejecución de scripts, tests).
- TASK-002 — UI en el módulo Kit (tarjetas, interruptor, estado por arnés, reparar, i18n, tests).
- TASK-003 — Verificación real en el navegador con `--local-ui` (prender y apagar tucu-ui y
  video-maker en un workspace de `examples/`) y cierre.
