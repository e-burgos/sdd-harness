# apps/studio — spec-e-burgos-010-studio-dual-sidebar · cycle-02

## Estado
Kit relee la skill o el agente abierto solo cuando cambia su propio resumen en el catálogo (ruta, descripción, modelo) y muestra un aviso si se borra; el cuerpo editado en disco todavía no se refresca (no emite eventos). Arquitectura carga cada registro por separado y, con `kit-index`, relee solo el que cambió de `size:mtime` (índice truncado o ilegible → relee los tres). Actividad suma el origen «Conversaciones» (inicio y fin de cada hilo) y migra filtros guardados con los seis orígenes anteriores.

## Estructura
- `components/modules/kit/KitCapabilitiesView.tsx`: `revision` del visor derivada del ítem abierto.
- `components/modules/architecture/use-registries.tsx`: huellas por registro y relectura selectiva.
- `components/modules/activity/activity-model.ts`: entradas `conversation`; `lib/nav/use-nav.ts`: `migrateActivityFilter`.

## Dependencias
- Sin cambios.

## Qué sigue
- Refresco del cuerpo de una skill (mtime/size en `SkillSummary` o sección `skills` en el índice): requiere protocolo y puente.
- Horas exactas de aprobaciones y preguntas, vista diff del visor e interruptor de tucu-ui en Kit (ciclos full).
