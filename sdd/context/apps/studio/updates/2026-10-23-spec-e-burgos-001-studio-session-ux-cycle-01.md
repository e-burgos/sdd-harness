# spec-e-burgos-001-studio-session-ux cycle-01 — 2026-10-23

## Estado

- Corrección del base: el framework es **Next.js 16** (`next` 16.4.3 en `package.json`), no 15 (resuelve: § 2 Stack Tecnológico).
- Sidebar como árbol: HILOS ACTIVOS (waiting-approval primero, badge de pendientes, aviso de estado desactualizado sin conexión), CANALES (sin canales `spec:*`, resuelve: § 3.2 `Sidebar.tsx` que los listaba), SPECS (spec → ciclo → hilos, "Sin ciclo"), FIXES (abiertos + 5 cerrados + "anteriores") y AGENTES; todo colapsable con teclado y estado persistido.
- Hilo: selector "Linked to" (reasignar a ciclo/fix), bandeja "Pending messages" con editar/quitar, botón Queue mientras la sesión trabaja, "Send pending" tras un interrupt, rótulo "Delivered as the next turn", borrador de texto por hilo (se pierde al recargar).
- ApprovalCard muestra la regla que recordaría "Always (thread)" (herramienta, tool MCP o prefijo Bash) y la oculta cuando no es segura (aviso del gate o comando no calculable).
- Indicadores animados (running / waiting-approval / queued) en hilo, fila y avatar, estáticos con `prefers-reduced-motion`; scroll corregido (S1–S6 de `architect.md`).

## Estructura

- `components/workspace/NavTree.tsx` (nuevo): `SectionView`, `NavNodeView`, `ActiveThreads`; el caret colapsa y el nombre abre el canal.
- `lib/store/nav-tree.ts` (nuevo): `buildNavTree(snapshot, threads, view)` puro; ids de nodo = claves de colapso.
- `lib/use-collapsed-state.ts` (`localStorage` `sdd-studio.sidebar.v1:<project>`, overrides podados) y `lib/use-stick-to-bottom.ts` (ResizeObserver, umbral 48 px) — viven en `src/lib/`, no en `src/hooks/`.
- `ActivityIndicator.tsx`, `PendingMessages.tsx`, `ThreadLinkPicker.tsx` nuevos; `Sidebar.tsx` queda como `SidebarView` (header y pie fijos, árbol con scroll único).
- Store: slice `drafts` (`draftKey`/`setDraft` en `state.ts`), pendientes y `remembered` en `timeline.ts`, selector `activeThreads`.
- `bridge/client.ts`: guarda de tamaño de frame (`FRAME_BUDGET_BYTES`) y textos de error de versión (`error-text.ts`).

## Qué sigue

- cycle-02: adjuntos en el Composer, menú `@` (archivos y agentes) y `/` (skills), borrador con adjuntos.
- No operar el Studio de uso diario con `next dev` desde una rama que cambia el protocolo: el HMR carga el protocolo nuevo y rompe el handshake con el puente publicado.
