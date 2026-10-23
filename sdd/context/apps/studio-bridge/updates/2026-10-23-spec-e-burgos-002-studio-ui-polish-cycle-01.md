# spec-e-burgos-002-studio-ui-polish cycle-01 — 2026-10-23

## Estado

- Dedupe de eventos bot consecutivos idénticos a nivel de almacenamiento de sesión en el puente.
- Índice de archivos optimizado: no puntúa ni devuelve subsecuencias débiles en búsquedas cortas.
- Re-escaneo periódico de workspace en el watcher para asegurar convergencia del snapshot en macOS.

## Estructura

- `sessions/store.ts`: filtro deduplicador de eventos de bot antes de la escritura en `.jsonl`.
- `workspace/file-index.ts`: refinamiento de matching descartando subsecuencias ruidosas.
- `workspace/watcher.ts`: temporizador de refresco periódico para mitigar eventos perdidos del sistema de archivos.

## Dependencias

- Sin dependencias externas añadidas.

## Qué sigue

- Monitoreo de performance del índice en workspaces de gran tamaño (>50k archivos).
