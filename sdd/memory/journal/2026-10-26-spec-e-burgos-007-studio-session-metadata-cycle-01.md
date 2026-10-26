# spec-e-burgos-007 cycle-01 — 2026-10-26

## Qué pasó
`apps/studio/e2e/studio.e2e.ts` tenía 4 de 6 tests rotos desde antes de spec-005 (nombres de persona de spec-003, comando de barra con un solo Enter, texto duplicado en el panel de recientes). `pnpm build && pnpm typecheck && pnpm test` no corre Playwright, así que nadie lo notó durante tres specs; apareció recién en la task de e2e de este ciclo y obligó a demostrar con un worktree en el estado previo que los fallos no eran de spec-007.

## Lección
Si un ciclo cambia textos, personas o flujos de la UI de Studio, correr `pnpm --filter sdd-studio-web e2e` además de la verificación fuerte: el e2e solo corre en el job de CI aparte y la suite local no lo cubre.

## Costo evitable
Un worktree con `pnpm install` y build para reconstruir el estado previo, y la duda sobre si las correcciones de selectores enmascaraban una regresión.
