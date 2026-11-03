# spec-e-burgos-010-studio-dual-sidebar — cycle-02 · plan (lite)

> Módulo: studio-dual-sidebar | Subproyecto: apps/studio | Fecha: 2026-11-03
> Objetivo: cerrar los pendientes de Studio que dejó el cycle-01 y que no tocan el contrato con el
> puente: el contenido de una skill abierta se refresca cuando cambia en disco, Arquitectura relee
> solo el registro que cambió, y Actividad suma la actividad de las conversaciones.
> Fuera de alcance (requieren cambiar `libs/studio-protocol`, flow full): horas exactas de
> aprobaciones y preguntas, vista diff del visor de documentos e interruptor de tucu-ui en Kit.
> Sin PR: solo commits en `feat/studio-followups`.

## Historias
- US-11 — Como dev quiero que la skill que estoy leyendo en Kit se actualice cuando la edito en disco. CA: con la skill abierta, un `kit.changed`/`workspace.changed` que la incluye vuelve a pedir su contenido y lo muestra sin cerrar ni perder el scroll; si la skill se borra, se muestra el estado vacío del módulo; sin pedidos extra cuando el cambio es de otro archivo. Alcance: solo cambios que llegan al catálogo (frontmatter: descripción, modelo, ruta); el cuerpo de una skill no está en `KIT_WATCH_ROOTS` y no emite eventos, así que su refresco queda para un ciclo `full` que amplíe protocolo y puente (mtime/size en `SkillSummary` o una sección `skills`).
- US-12 — Como dev quiero que Arquitectura no relea todo ante cualquier cambio. CA: `use-registries` relee solo `schema.json`, `api.json` o `components.json` cuando el cambio los toca; un cambio ajeno a esos tres no dispara lecturas; el error de un registro no afecta a los otros dos.
- US-13 — Como dev quiero ver en Actividad cuándo arrancó y terminó cada conversación. CA: un origen nuevo «Conversaciones» en los filtros con su contador, derivado de los hilos del store (creación y paso a idle/interrupted/failed con su `lastActivity`), con el título del hilo y el vínculo a su spec/fix si lo tiene; el filtro se persiste como los demás; i18n es/en en paridad.

## Tasks
- TASK-001 — US-11 y US-12 (refresco de skill y lecturas selectivas de Arquitectura) con sus specs.
- TASK-002 — US-13 (origen «Conversaciones» en Actividad) con sus specs.
- TASK-003 — Verificación y cierre: build, typecheck, test, `build:local` → bridge → e2e y recorrida.

## Decisiones técnicas
- US-11 acotada a cambios de catálogo: refrescar por cambio del resumen de la propia skill (path, descripción, modelo), no por un contador global; borrar la skill abierta muestra aviso de eliminada; edición del cuerpo en disco queda fuera de este ciclo (requiere protocolo y puente).
- Solo `apps/studio`; sin cambios en el protocolo ni en el puente.
- Un implementador sonnet/medium hace TASK-001 y TASK-002 en secuencia; un reviewer opus/high revisa antes del commit.
