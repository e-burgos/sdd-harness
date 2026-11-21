# spec-e-burgos-030-studio-kit-execution — cycle-01 · plan (lite)

> Módulo: studio-kit-execution | Subproyectos: libs/studio-protocol, apps/studio-bridge, apps/studio | 2026-11-20 · Rama `feat/studio-claude-tools`.
> Objetivo: bloques, consumo por task y verificación del kit visibles y operables en Studio. Fuera de alcance: `sdd:task` desde Studio (lo corren los agentes), editar `verify.json`.

## Historias
- US-1 — Bloques y consumo por task. CA: tasks agrupadas por `batches` (si existen) con app, rol, avance y tokens; cada task con tokens/modelo/agente si tiene `usage`.
- US-2 — Resultados de verify por ciclo. CA: último resultado por (app, nivel, unidad) leído de `artifacts/verify/*/*.json`, con comandos.
- US-3 — Correr verify. CA: botones por app y nivel de `verify.json`; salida en vivo; el snapshot se refresca al terminar.
- US-4 — Lease. CA: pill con dueño y estado (live/stale/dead) cuando existe el lock.

## Tasks (detalle en tasks.json)
- TASK-001 — Protocolo: `TaskSummary` + `usage?`/`batch?`/`dependsOn?`; `CycleSummary` + `batches?`/`verifyResults?`; snapshot + `verifyConfig?`/`verifyLease?`; comando `kit.verify.run {app, level, spec?, cycle?, unit?}` (respuesta `{runId}`, salida por los eventos `command.output/exit` existentes); feature `kit-execution`; specs.
- TASK-002 — Puente: snapshot lee batches/usage/depends_on, resultados de verify (sin logs) y `verify.json`; lease con `lib/verify-lease.mjs` del kit (import en runtime como `session-registry.mjs`, tolerante a su ausencia); handler `kit.verify.run` sobre el runner existente (`commands/runner.ts`) con app/nivel validados contra `verify.json` y `--spec/--cycle/--unit` opcionales; refresco del snapshot al salir; specs.
- TASK-003 — Studio: pestaña de tasks por bloque con consumo; panel «Verificación» por ciclo (resultados + correr quick/full con salida en vivo); pill del lease en el encabezado; i18n; specs.
- TASK-004 — Verificación real (puente temporal + headless) y cierre.

## Decisiones técnicas
- D-01 Contrato aditivo (`.optional()` / `.catch`) y feature `kit-execution`.
- D-02 `kit.verify.run` reusa el runner y sus eventos; un verify a la vez por proceso del puente; `full` puede quedar esperando el lease (exit 75 ⇒ mensaje).
- D-03 Lease: se lee el archivo que resuelve `resolveLockFile` del kit; estado con `judgeLease`. Sin la lib (kit viejo) ⇒ sin pill.
