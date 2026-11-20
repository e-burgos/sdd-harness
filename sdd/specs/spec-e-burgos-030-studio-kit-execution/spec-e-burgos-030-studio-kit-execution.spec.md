# SPEC-e-burgos-030: Studio muestra y opera la ejecución por bloques y la verificación del kit

> Estado: **in-progress** (2026-11-20). cycle-01 abierto (flow lite). Auditoría kit ↔ Studio (pedido del dev: «arrancá con la auditoría del kit de
> punta a punta»). Brecha 1 y 2: ejecución por bloques (`batches`, `sdd:task`, `usage`) y `sdd:verify`.

## Resumen ejecutivo
El kit 0.23 ejecuta los ciclos por bloques (`tasks.json → batches`), registra `usage` por task con
`sdd:task` y verifica con `sdd:verify` (resultados en `artifacts/verify/<app>/<unidad>-<nivel>.json`, lease
global en `~/.sdd-harness/locks/verify-full.lock`). Studio solo lee `id/title/status/storyPoints` de cada task:
no muestra bloques, ni consumo por task/bloque, ni resultados de verificación, ni quién tiene el lease, ni
deja correr una verificación.

## Historias de usuario
- US-1 — Bloques. En la pestaña de tasks de un ciclo veo las tasks agrupadas por bloque (app, rol, avance y tokens del bloque) y cada task con su consumo (tokens, modelo, agente).
- US-2 — Verificación. Por ciclo veo el último resultado de `sdd:verify` por subproyecto y nivel (ok/falló, commit, cuándo, duración) con el detalle de comandos.
- US-3 — Correr verify. Desde el ciclo corro `quick` o `full` de un subproyecto (los niveles que declara `sdd/verify.json`) y veo la salida en vivo; al terminar el resultado se actualiza.
- US-4 — Lease. Si una verificación `full` tiene el lease global, Studio muestra quién (repo, app, desde cuándo) y si está vivo o vencido.

## Restricciones
- Contrato aditivo con campos opcionales; sin bump de `PROTOCOL_VERSION`; feature nueva.
- El puente ejecuta solo `sdd/scripts/sdd-verify.mjs` con argumentos validados contra `verify.json`; sin shell.
- Los resultados se leen del disco (fuente única: los archivos del kit).

## Ciclos propuestos
- cycle-01 — Contrato, puente (snapshot + lease + runner) y UI.
