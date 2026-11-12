# spec-e-burgos-020-kit-design-skills — cycle-01 — 2026-11-12

## Estado
El kit trae dos skills de diseño para el agente de frontend, disponibles aunque la integración tucu-ui esté apagada: `tucu-ui-pro` (montaje Vite/Next/Tailwind propio, theming, catálogo con props válidos de tucu-ui 3.10 y trampas que rompen en runtime, con o sin MCP) y `design-languages` (método para derivar un lenguaje visual + recetas replicables de Sky Console —Display Ads— y Cristal Líquido —ópticagestión—). El agente y la skill `sdd-implementor-front` las cargan cuando el subproyecto usa tucu-ui o la task diseña UI.

## Estructura
- `templates/sdd/skills/tucu-ui-pro/` (SKILL.md + `references/01-montaje.md`, `02-theming.md`, `03-componentes.md`, `04-trampas.md`).
- `templates/sdd/skills/design-languages/` (SKILL.md + `references/metodo.md`, `sky-console.md`, `liquid-glass.md`).
- `sdd-implementor-front` (agente y skill), catálogos y README es/en actualizados.

## Dependencias
- Ninguna nueva. Base verificada: tucu-ui 3.10.0, tucu-ui-mcp 0.16.0 (el pin `TUCU_UI_PINNED_VERSION` no cambió).

## Qué sigue
- Al subir tucu-ui de versión: re-verificar props y tokens citados (sobre todo `GlassPanel`, `Button`, `--color-accent`, familia `--tucu-table-*`).
- Opcional: llevar el contenido de `tucu-ui-pro` a la skill upstream `tucu-ui-design` del repo de tucu-ui.
