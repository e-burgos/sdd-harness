# spec-e-burgos-031-studio-session-context — cycle-01 · plan (lite)

> Módulo: studio-session-context | Subproyectos: libs/studio-protocol, apps/studio-bridge, apps/studio | 2026-11-20 · Rama `feat/studio-claude-tools`.
> Objetivo: las sesiones de Studio cargan el paquete de su unidad y el kit muestra núcleo, reglas y paquetes. Fuera de alcance: correr `harness update sdd --split-project` desde Studio (se muestra la receta), editar reglas.

## Historias
- US-1 — Paquete por unidad. CA: hilo atado a un ciclo + agente con rol en `packs.json` ⇒ el prefijo lleva lessons + línea de unidad + paquete (`sdd-pack --stdout`); sin rol/paquete ⇒ prefijo de hoy.
- US-2 — Contexto visible. CA: `ThreadInfo.contextSource` (pack con unidad/rol/bytes, o base) y chip en el encabezado.
- US-3 — Arnés en Kit. CA: sección «Arnés» con `CLAUDE.md`/`AGENTS.md` (bytes vs 6 KB), `project.md` (existe/tamaño), reglas (`trigger`, `description`, bytes) con visor; aviso + receta si el núcleo supera 6 KB o falta `project.md`.
- US-4 — Stats de paquetes. CA: `kit.pack.stats {spec, cycle}` ⇒ filas, totales y pack-miss; se muestran en el ciclo.

## Tasks (detalle en tasks.json)
- TASK-001 — Protocolo: `ThreadInfo.contextSource?`; kinds del índice del kit para núcleo/reglas/project (con `trigger`, `description`, `bytes`); comando `kit.pack.stats` y su resultado; feature `session-context`; specs.
- TASK-002 — Puente: prefijo por paquete (rol del agente → rol de `packs.json`; unidad batch = primer bloque del rol con tasks pendientes; `sdd-pack.mjs … --stdout` con timeout 15 s y caché por spec/ciclo/rol/unidad + mtime de `tasks.json`/`packs.json`; fallback al prefijo de hoy en código 2/3 o error), línea de unidad y `contextSource`; índice del arnés en `KitIndexer`; handler `kit.pack.stats` (`--stats --json`); specs.
- TASK-003 — Studio: chip de contexto en el encabezado de la conversación; sección «Arnés» en Kit (núcleo, project.md, reglas con visor, aviso de split con receta); stats de paquetes en el ciclo; i18n; specs.
- TASK-004 — Verificación real (puente temporal + headless) y cierre.

## Decisiones técnicas
- D-01 Mapa de roles: `sdd-implementor-back→implementor-back`, `sdd-implementor-front→implementor-front`, `sdd-reviewer→reviewer`, `sdd-functional→functional`, `sdd-planner→planner`, `sdd-architect→architect`; el resto (orquestador, steward, hermes, default) ⇒ prefijo base.
- D-02 El paquete reemplaza a `context_prompt.md` + `constitution.md`; `lessons.md` se mantiene (MEMORIA GATE). El núcleo `CLAUDE.md` (reglas cero y uno) ya llega por `settingSources: project`.
- D-03 Prefijo estable por unidad (caché) para no romper el caché de prompts entre turnos.
