# SPEC-e-burgos-012: Generadores — frontends listos con tucu-ui, BFF y microfrontends por path

> Estado: **draft** (2026-11-03). Sin ciclo abierto: faltan decisiones del dev (abajo).
> Sucesora de spec-e-burgos-011 (tucu-ui en el kit). Paso 2 del plan del dev: tucu-ui en el kit →
> **generadores** → wizard en Studio → GitHub.

## Resumen ejecutivo
`harness init` / `harness add app` ya generan apps `react` (Vite + React 19) y `nextjs`, además de
nestjs, fastify, hono, python y springboot. Pero una app frontend nace sin sistema de diseño: el dev
tiene que instalar tucu-ui, Tailwind v4 y el theme provider a mano. Esta spec hace que los
generadores de frontend produzcan una app que ya arranca con tucu-ui (y prende la integración de
spec-011), y suma las dos formas de frontend que pide el wizard: **BFF** (Next con API propia frente
a los servicios) y **microfrontends por path** (apps Vite con `base` + proxy, que es el modelo de
tucu-ui, no Module Federation). Del lado back, suma la variante Python FastAPI con LangGraph para
trabajo de agentes/CPU pesado.

## Historias de usuario
- US-1 — Como dev, al generar una app `react` o `nextjs` quiero que arranque con `@e-burgos/tucu-ui`
  (versión fijada), Tailwind v4, el provider correcto (`ThemeProvider` en Vite, `NextThemeProvider`
  + `ThemeModeScript` en Next) y una pantalla de ejemplo, con `tucu_ui` prendido.
- US-2 — Como dev, quiero un tipo de app `next-bff`: Next App Router con rutas API que hablan con los
  servicios del monorepo y comparten tipos con `libs/shared-types`.
- US-3 — Como dev, quiero generar un **shell** y N **microfrontends por path** (apps Vite con
  `base: '/<mfe>/'`) con el proxy de desarrollo y el ruteo del shell ya cableados.
- US-4 — Como dev, quiero una variante `python` con FastAPI + LangGraph (y opcionalmente TensorFlow)
  para servicios de agentes o cómputo pesado, con su `pyproject`, tests y Docker.
- US-5 — Todo lo generado pasa el gate de cierre de `init` (lint, test, build) y queda registrado en
  `sdd/global.json` y `context_prompt.md`.

## Restricciones
- `apps/cli/templates/` se publica en npm: cada plantilla nueva se prueba con una generación real en
  `examples/`.
- Versiones de dependencias fijadas en `apps/cli/src/generators/versions.ts`.
- tucu-ui es SPA-first; en Next solo vía el entry `./next` (Next 16+, App Router).

## Preguntas abiertas (decisión del dev)
1. ¿tucu-ui por defecto en toda app `react`/`nextjs` o solo si se prende `--tucu-ui`?
2. BFF: ¿Next con rutas API o un servicio Node aparte (fastify/hono) delante del front?
3. Microfrontends: ¿alcanza el modelo por path de tucu-ui o hace falta Module Federation?
4. Python: ¿LangGraph por defecto y TensorFlow opcional, o ambos opcionales? ¿gestor `uv` o `poetry`?
5. ¿Standalone y monorepo Nx los dos, o los patrones BFF/MFE solo en monorepo?

## Fuera de alcance
- El wizard en Studio (spec-e-burgos-013) y la conexión a GitHub (spec-e-burgos-014).
