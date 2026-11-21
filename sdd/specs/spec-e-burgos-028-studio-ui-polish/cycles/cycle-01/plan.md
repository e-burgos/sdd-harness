# spec-e-burgos-028-studio-ui-polish — cycle-01 · plan (lite)

> Módulo: studio-ui-polish | Subproyectos: apps/studio | 2026-11-20 · Rama `feat/studio-claude-tools`.
> Objetivo: las cuatro mejoras visuales de la spec. Fuera de alcance: rediseño de módulos, cambios en tucu-ui.

## Historias
- US-1 — Ciclos colapsables persistidos. CA: chevron + `aria-expanded` por ciclo; in-progress abierto por defecto; recargar conserva.
- US-2 — Modal de documentos sin encimado ni hueco. CA: la ruta se lee completa (truncada con title) y el cuerpo ocupa el alto del modal.
- US-3 — Markdown con formato en todo Studio. CA: Kit, modal y chat usan el mismo componente; tablas con bordes; frontmatter como ficha clave/valor.
- US-4 — Controles del Mapa compactos. CA: «Ciclo/Transversales/Todas» y «Enjambre/<agente>» en `size="xs"`.

## Tasks (detalle en tasks.json)
- TASK-001 — `components/workspace/Markdown.tsx` único (estilos del modal: h1–h4, p, listas, tablas con borde y padding, blockquote, code/pre, hr, links) con densidad `doc`/`chat` y frontmatter YAML extraído y mostrado como ficha; `DocumentViewerModal` y `ChatDialogueCard` dejan sus copias inline; Kit lo usa con densidad `doc`; specs.
- TASK-002 — `metrics/PlanningView.tsx`: `CycleBlock` colapsable (encabezado-botón con chevron, in-progress abierto por defecto) con estado persistido vía `lib/use-collapsed-state.ts`; specs.
- TASK-003 — `mission-control/DocumentViewerModal.tsx`: la ruta sale del ítem `info` y va al `sidebarFooter` (truncada, `title`, junto a Copiar ruta); alto del modal acorde (`size`/`maxHeight`) sin hueco; specs.
- TASK-004 — `AgentMapCanvas.tsx` y `AgentInspectorDrawer.tsx`: `SegmentedControl size="xs"`; specs del mapa; verificación en el navegador (claro/oscuro) de las cuatro mejoras y cierre.

## Decisiones técnicas
- D-01 Markdown: se conserva `react-markdown` + `remark-gfm`; el frontmatter se separa con una función pura (bloque `---` inicial, pares `clave: valor` de una línea) sin agregar `remark-frontmatter`. Registro: `components.json` actualiza Markdown y deprecia nada (las copias inline no son componentes registrados).
- D-02 Props de tucu-ui verificadas contra `node_modules/@e-burgos/tucu-ui` (3.10.1), no contra el MCP (que describe la última versión).
- D-03 Estado de ciclos con la misma clave-prefijo de `use-collapsed-state` (por proyecto), ids `planning-cycle:<spec>:<cycle>`.
