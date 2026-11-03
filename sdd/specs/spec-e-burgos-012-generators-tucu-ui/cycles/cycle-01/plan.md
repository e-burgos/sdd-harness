# spec-e-burgos-012-generators-tucu-ui — cycle-01 · plan (lite)

> Módulo: generators-tucu-ui | Subproyecto: apps/cli | Fecha: 2026-11-03
> Objetivo: que los generadores de frontend produzcan apps que arrancan con tucu-ui y sumar los
> tipos `next-bff`, `mfe-shell`/`mfe` y la variante Python FastAPI + LangGraph, todo con versiones
> estables al día y verificado con una generación real en `examples/`.
> Sin PR: solo commits en `chore/sdd-prep-next-specs`.

## Historias
- US-1 — tucu-ui por defecto en `react` y `nextjs` (monorepo y standalone). CA: deps `@e-burgos/tucu-ui` fijada, Tailwind v4 con `@import` de los estilos de tucu-ui, `ThemeProvider` en Vite y `NextThemeProvider` (entry `./next`) en Next, una pantalla de ejemplo con componentes de tucu-ui, y la integración `tucu_ui` del kit prendida (skill + MCP de spec-011). `--no-tucu-ui` genera la app como hoy. `nx run-many -t lint test build` en verde.
- US-2 — Tipo `next-bff` (solo monorepo). CA: Next App Router con tucu-ui, rutas `app/api/*` que llaman a un servicio por URL de entorno (`<APP>_UPSTREAM_URL`), tipos compartidos desde `libs/shared-types` si existe, y un test de la ruta API.
- US-3 — Tipos `mfe-shell` y `mfe` (solo monorepo). CA: cada `mfe` es una app Vite con `base: '/<mfe>/'` y tucu-ui; el shell enruta por path y su dev server hace proxy de `/<mfe>/` al puerto de cada mfe declarado en el config (`apps[].shell`); build de todos en verde.
- US-4 — Python FastAPI + LangGraph con uv. CA: `pyproject.toml` (uv) con FastAPI, uvicorn y LangGraph; TensorFlow como extra opcional (`apps[].ml: true` lo agrega); un grafo LangGraph de ejemplo detrás de un endpoint; pytest y ruff en verde; Dockerfile con uv.
- US-5 — Registro y documentación. CA: los tipos nuevos en schema/tipos del config, `harness add app` e `init`, `DEFAULT_APP_PORTS`, Docker, `configure sdd` (detección), `global.json`/`context_prompt.md` del proyecto generado, docs bilingües del kit y README de la CLI.

## Tasks
- TASK-001 — Versiones: `versions.ts` como única fuente de las versiones de frontend y Python; Next 16 en `root-package.ts`.
- TASK-002 — US-1 tucu-ui por defecto en `react` (blueprint `react-app` + standalone) y `nextjs` (monorepo + standalone), flag `--no-tucu-ui`.
- TASK-003 — US-2 tipo `next-bff`.
- TASK-004 — US-3 tipos `mfe-shell` y `mfe`.
- TASK-005 — US-4 Python FastAPI + LangGraph + uv.
- TASK-006 — US-5 cableado de config, comandos, Docker, detección, docs y tests unitarios.
- TASK-007 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, generación real en `examples/` (monorepo con react, nextjs, next-bff, mfe-shell + 2 mfe, python; standalone react y nextjs) con el gate de `init` en verde.

## Decisiones técnicas
- Versiones consultadas el 2026-11-03 (últimas estables): next 16.4.4, react/react-dom 19.3.1, react-router-dom 7.18.5, vite 8.3.5, @vitejs/plugin-react 6.2.1, tailwindcss/@tailwindcss/vite 4.3.4, vitest 5.1.0, @e-burgos/tucu-ui 3.10.0, @e-burgos/tucu-ui-mcp 0.16.0; fastapi 0.162.0, uvicorn 0.54.0, langgraph 1.2.19, tensorflow 2.21.0, pytest 9.2.0, ruff 0.17.3, httpx 0.28.1.
- Fuera de este ciclo: Nx 24 (el kit fija 23.1.1) y TypeScript 7 afectan a todos los generadores existentes; van en una spec propia.
- tucu-ui pide `next >= 16`: el tipo `nextjs` sube de Next 15 a 16 (cambio para todos los proyectos nuevos).
- El config gana campos opcionales: `apps[].tucuUi` (default true en react/nextjs/next-bff/mfe*), `apps[].shell` (mfe → su shell) y `apps[].ml` (python → TensorFlow). Nada pasa a `required`.
- Flow lite por perfil `solo`. Los tipos nuevos del config los consumirá spec-e-burgos-013 (wizard); si `sdd:validate` lo marca, el ciclo siguiente va `full`.
- Implementadores sonnet/medium en secuencia (comparten `app.generator.ts`); revisión opus/high antes de cerrar.
