# apps/studio — spec-e-burgos-009-studio-tucu-ui · cycle-04

## Estado
- Selectores descriptivos: `HelpSelect` acepta `icon`, `description` y `triggerLabel` por opción, más `searchable`; siempre `showCheck`. El menú se ajusta al contenido (`w-max`, mínimo 10rem, máximo 20rem) y la lista interna sube a `max-h-72`, porque el `max-h-44` de tucu-ui solo entra 4 opciones con descripción.
- Sidebar nuevo (mockup aprobado por el dev el 2026-10-27): encabezado compacto, buscador ⌘K que filtra el árbol, "En curso" con avatar y chip de estado (se oculta vacía), canales como chips con cantidad de conversaciones, specs con punto de estado, chip `cNN · flow` y progreso de tareas, fixes con severidad, agentes con anillo de presencia y tarea actual, encabezados con resumen y modo colapsado a íconos (persistido en `use-panel-state`, flag `sidebarIcons`).

## Estructura
- Nuevos: `workspace/NavParts.tsx` (chips, punto de estado, progreso, severidad, avatar con presencia), `workspace/NavSections.tsx`, `workspace/SidebarHeader.tsx`, `workspace/SidebarSearch.tsx`, `workspace/SidebarRail.tsx`, `lib/store/nav-filter.ts`, `lib/store/nav-summary.ts`. `NavNode` suma `progress` (spec y ciclo) y `severity` (fix).
- La escala tipográfica renombra `text-body` a `text-copy` (14px): tucu-ui define `--color-body` (el fondo), y `text-body` generaba también un color que dejaba el texto invisible en oscuro. El resto de la escala no choca con colores de tucu-ui.
- Los chips de estado dentro de filas-botón van `aria-hidden` y el estado se anuncia con un `sr-only` de `status.*`; si el chip forma parte del nombre accesible, rompe los `getByRole` del e2e (Playwright compara nombres por subcadena).

## Dependencias
- Sin cambios: `@e-burgos/tucu-ui` 3.5.0. Hay 3.6.0 publicada, pendiente de adopción.

## Qué sigue
- Adoptar tucu-ui 3.6.0: `ThemeModeScript` + `defaultMode="system"`, Modal con `overlayClassName`/`closeButtonProps`/`headerClassName`, Alert `density="compact"`, BasicTable `density="snug"`, Select `appearance="neutral"` y Escape que cierra el listbox.
- tucu-ui 3.7.0: `SplitModal` para `DocumentViewerModal` y `GateStatusModal`, y la API de Select (`menuWidth`, `wrapDescription`, `maxMenuHeight`, `triggerLabel`) que reemplaza los ajustes de `HelpSelect`.
