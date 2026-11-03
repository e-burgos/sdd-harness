# spec-e-burgos-009-studio-tucu-ui — cycle-03 · plan (lite)

> Módulo: studio-tucu-ui | Subproyecto: apps/studio | Fecha: 2026-10-27
> Objetivo: Studio pasa a `@e-burgos/tucu-ui@3.5.0`, que trae resueltas las fricciones reportadas en los cycle-01 y 02 (puntos 1-43 y `issues_found` de spec-009). Studio borra los wrappers, overrides y arreglos provisorios que esas fricciones obligaron a escribir, y migra los dos modales a `Modal`. La distribución de las pantallas y el aspecto visual se mantienen.
> Fuera de alcance: `SegmentedControl` (llega en el cycle-03 de tucu-ui), el skill de diseño del kit, rediseños.

## Historias
- US-009 — Como dev de Studio quiero que Studio use tucu-ui sin wrappers ni overrides propios para que cada mejora de la librería llegue sin tocar Studio. CA: no quedan `Tip`, `StatusPill`, `HelpSelect` ni `ColorModeBootstrap`; `globals.css` no tiene reglas `[data-tucu=button]`; no quedan overrides `!` sobre componentes de tucu-ui; vitest no necesita `server.deps.inline`.
- US-010 — Como usuario quiero que los modales de documentos y de estado de gates se comporten como el resto (Escape, foco atrapado, scroll interno). CA: `GateStatusModal` y `DocumentViewerModal` usan `Modal` de tucu-ui y sus specs pasan.

## Tasks
- TASK-001 — Base 3.5.0: dependencia exacta `3.5.0`; provider con `layout="clean"` y `defaultMode` en lugar de `ColorModeBootstrap` (se conserva el script anti-flash si sigue haciendo falta); `@source` a `**/*.mjs`; quitar `server.deps.inline` de vitest; tokens propios de la escala tipográfica registrados con `extendClassMergeTokens`. Valida: typecheck, vitest, persistencia de modo en el navegador.
- TASK-002 — Wrappers y overrides: `Tip` → `Tooltip` con `size`; `StatusPill` → `Badge` con `tone`; `HelpSelect` → `Select` con `native`/`id`/`aria-describedby` (la guarda `no-native-select` se ajusta a lo que permita la API); borrar las reglas `[data-tucu=button]` de `globals.css` y los overrides `!`; revisar si las reglas de select y tabla siguen haciendo falta. Valida: specs de los componentes tocados, e2e del Composer, capturas en claro y oscuro.
- TASK-003 — Modales: `GateStatusModal` y `DocumentViewerModal` a `Modal` de tucu-ui, sin cambiar su contenido ni su tamaño. Valida: specs de ambos modales y recorrida en el navegador.
- TASK-004 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, `build:local` → build del bridge → e2e, recorrida visual de todas las vistas en los dos modos, fricciones nuevas a la sesión de tucu-ui y cierre.

## Decisiones técnicas
- Lo que 3.5.0 no resuelva igual que el workaround se mantiene y se reporta a tucu-ui en vez de forzarlo.
- Implementación por subagentes sonnet/medium; TASK-002 y TASK-003 en paralelo (sin archivos en común) después de TASK-001; revisión visual y cierre en el main loop.
