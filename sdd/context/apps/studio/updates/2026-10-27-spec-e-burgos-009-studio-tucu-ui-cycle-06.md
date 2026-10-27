# apps/studio — spec-e-burgos-009-studio-tucu-ui · cycle-06

## Estado
Studio usa `@e-burgos/tucu-ui` 3.7.0. `DocumentViewerModal` y `GateStatusModal` usan `SplitModal`: el contenido en el cuerpo y las opciones en la barra lateral. El visor muestra ruta, vista (renderizado / fuente) y "otros documentos" para navegar sin cerrar, con copiar contenido y ruta en `sidebarFooter`. El modal del enjambre lista Conversación, Gate (seleccionado al abrir), Tareas, Fixes, Agentes y Último evento con su estado. `HelpSelect` usa `menuWidth="content"`, `wrapDescription`, `descriptionClassName`, `maxMenuHeight` y `triggerLabel` de tucu-ui sin ajustes propios.

## Estructura
- Borrado `src/types/tucu-ui-next.d.ts` (el tipo de `ThemeModeScript` ya viene en `./next`).
- `RelatedDocuments` pasa al visor la lista de documentos y `onNavigate`.
- Chips densos con `Badge size="micro"`; tooltips dentro de filas con `Tooltip lazy`.
- `globals.css` define `--tucu-table-cell-px/-py/-font-size/-header-font-size` para la densidad de tablas de Studio.
- `SegmentedControl` sigue siendo de Studio: el de tucu-ui solo tiene semántica de radio (sin tabs ni nav, sin testId/ariaLabel por opción).

## Dependencias
- `@e-burgos/tucu-ui` 3.6.0 → 3.7.0 (exacta).

## Qué sigue
- spec-e-burgos-010 (sidebar doble estilo Slack) usa los componentes nuevos de 3.7.0: FilterBar/FilterPill, AnimatedTabs, EmptyState/ErrorState, StateBadge, StatCard.
- Vista diff en el visor de documentos: no hay fuente de datos de diff; requiere soporte del puente.
