# spec-e-burgos-028-studio-ui-polish · cycle-01 — 2026-11-20

## Estructura
- `workspace/Markdown.tsx` es el único renderizador de markdown (densidad `doc`/`chat`, estilos completos, `splitFrontmatter` muestra el frontmatter como ficha); lo usan Kit, `DocumentViewerModal`, `ChatDialogueCard` y el timeline.
- Planificación: ciclos colapsables (in-progress abierto por defecto) con estado persistido vía `use-collapsed-state`.
- `DocumentViewerModal`: la ruta va en `sidebarFooter` (truncada con `title`), `maxHeight="min(82vh, 52rem)"`.
- Mapa: `SegmentedControl size="xs"` en la topología y en el panel del enjambre.
