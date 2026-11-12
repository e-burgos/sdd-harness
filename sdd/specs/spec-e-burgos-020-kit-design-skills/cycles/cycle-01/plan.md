# spec-e-burgos-020-kit-design-skills — cycle-01 · plan (lite)

> Módulo: kit-design-skills | Subproyecto: apps/cli | Fecha: 2026-11-12 · Rama `feat/kit-design-skills`.
> Objetivo: que el agente de frontend del kit use tucu-ui como un profesional y replique lenguajes visuales.

## Historias y criterios
- US-1: skill `tucu-ui-pro` — montaje (Vite / Next / Tailwind propio), theming (ThemeProvider,
  presets, ThemeScope, tokens `--tucu-*` con su `-default`), catálogo por categoría con props
  clave, trampas que rompen en runtime, flujo con MCP y sin MCP.
- US-2: `design-languages/references/sky-console.md` — Display Ads.
- US-3: `design-languages/references/liquid-glass.md` — Cristal Líquido de ópticagestión.
- US-4: `design-languages/SKILL.md` + `references/method.md` — elegir o derivar un lenguaje y
  verificarlo (desktop y 375 px, light y dark, reduced-motion, contraste AA).
- US-5: agente `sdd-implementor-front` y su skill las referencian; catálogo regenerado; docs.

## Tasks
- TASK-001 — Skill `tucu-ui-pro` (SKILL.md + references).
- TASK-002 — Skill `design-languages` (SKILL.md + method, sky-console, liquid-glass).
- TASK-003 — Cableado (agente/skill front, espejo `sdd/`, catálogo, CHANGELOG, docs) y verificación.

## Decisiones técnicas
- Dos skills y no una: `tucu-ui-pro` es la librería (aplica a todo proyecto con tucu-ui);
  `design-languages` es el criterio visual (aplica con o sin tucu-ui). Las recetas usan los
  primitivos de tucu-ui 3.10 (`GlassPanel`, `StateBadge`, `StatCard`, `SegmentedControl`…) antes
  que CSS a medida.
- Flow lite (profile solo): un subproyecto, sin contratos que otro consuma.
