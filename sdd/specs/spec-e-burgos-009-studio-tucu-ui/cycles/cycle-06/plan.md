# spec-e-burgos-009-studio-tucu-ui — cycle-06 · plan (lite)

> Módulo: studio-tucu-ui | Subproyecto: apps/studio | Fecha: 2026-10-27
> Objetivo: Studio pasa a `@e-burgos/tucu-ui@3.7.0`. Los dos modales pasan a `SplitModal` (contenido en el cuerpo y opciones en su barra lateral, pedido del dev), `HelpSelect` usa la API nueva de Select en lugar de sus ajustes, y se borran los workarounds que 3.7.0 resuelve (fricciones 60-75).
> Fuera de alcance: el sidebar y el riel (los reemplaza spec-e-burgos-010, que corre en paralelo solo con documentos). Sin PR: solo commits.

## Historias
- US-014 — Como usuario quiero que el visor de documentos y el modal de estado del enjambre usen un modal con barra lateral: el contenido en el cuerpo y las opciones, metadatos y navegación en la barra. CA: `DocumentViewerModal` muestra en la barra el tipo, estado, ruta, spec/ciclo, el selector de vista (renderizado/raw/diff), las acciones de copiar y los documentos relacionados para navegar sin cerrar; `GateStatusModal` muestra en la barra la lista de gates/secciones/agentes con su estado y el cuerpo el resumen del ítem elegido; Escape, foco atrapado y devuelto; en anchos chicos la barra pasa a pestañas; mismo aspecto en claro y oscuro.
- US-015 — Como dev de Studio quiero usar 3.7.0 sin los ajustes que ya resuelve. CA: `HelpSelect` usa `menuWidth`, `wrapDescription`/`descriptionClassName`, `maxMenuHeight` y `triggerLabel` sin variantes de descendiente ni `w-max!`; sin `src/types/tucu-ui-next.d.ts`; `Badge size="micro"` en chips densos; `Tooltip lazy` donde contamina el texto de filas; tablas con `--tucu-table-cell-*`; el `SegmentedControl` propio de Studio pasa al de tucu-ui si conserva roles, tamaño y test ids; fuera de los archivos del sidebar.

## Tasks
- TASK-001 — Base 3.7.0 y limpieza: dependencia exacta, borrar el `declare module`, Select/HelpSelect con la API nueva, Badge micro, Tooltip lazy, tokens de tabla, `SegmentedControl` de tucu-ui. Sin tocar Sidebar, NavTree, NavParts, NavSections, SidebarHeader, SidebarSearch ni SidebarRail. Valida: typecheck, vitest, e2e.
- TASK-002 — Modales a `SplitModal`: `DocumentViewerModal` y `GateStatusModal` según US-014, con sus specs. Valida: specs de ambos y recorrida en el navegador.
- TASK-003 — Verificación y cierre: build, typecheck, test, `build:local` → bridge → e2e, recorrida visual en los dos modos y fricciones nuevas a tucu-ui.

## Decisiones técnicas
- TASK-001 y TASK-002 en paralelo (subagentes sonnet/medium) sin archivos en común: TASK-002 es dueña de los dos modales y sus specs; TASK-001 del resto.
- Lo que 3.7.0 no resuelva igual se mantiene y se reporta.
