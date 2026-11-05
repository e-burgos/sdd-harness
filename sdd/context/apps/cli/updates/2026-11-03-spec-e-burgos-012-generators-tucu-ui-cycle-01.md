# apps/cli — spec-e-burgos-012-generators-tucu-ui · cycle-01

## Estado
Los generadores de frontend nacen con tucu-ui por defecto (`react`, `nextjs` y los tipos nuevos `next-bff`, `mfe-shell`, `mfe`); `--no-tucu-ui` genera apps planas. Prioridad: flag de la CLI > `apps[].tucuUi` > `sdd.tucu_ui` > encendido; la integración del kit (spec-011) se prende si alguna app termina con tucu-ui, o por `sdd.tucu_ui` cuando no hay frontend. `next-bff` (Next con rutas API frente a `<APP>_UPSTREAM_URL`) y los microfrontends por path (`mfe` con `base: '/<mfe>/'`, `mfe-shell` con proxy de desarrollo, nginx y Dockerfile conjunto) son solo monorepo. `python` es FastAPI + LangGraph con uv; `apps[].ml` suma TensorFlow (requires-python `<3.14`). `harness add app` mantiene la topología shell/mfe (registro `(shell: x)`, puertos leídos del disco, bloques `harness:mfe-start/end`) y `configure sdd` detecta los tipos nuevos.

## Estructura
- `generators/versions.ts`: única fuente de versiones (frontend, Python, uv); `templates/sdd/templates/nx-workspace/package.json` igualado por test.
- Nuevos: `tucu-ui-app.ts`, `app-types.ts` (topología, puertos, stack), `frontend-apps.ts` (next-bff, mfe, shell), `mfe-sync.ts`, `python-app.ts`, `utils/workspace-apps.ts` (registro + detección en disco).
- Puertos por defecto: `next-bff` 3001, `mfe-shell` 4300, `mfe` 4301+; `resolveAppPorts` evita choques (los explícitos ganan).

## Dependencias
- Proyectos generados: next ^16.4.4, react ^19.3.1, vite ^8.3.5, tailwindcss ^4.3.4, vitest ^5.1.0, @e-burgos/tucu-ui ^3.10.0; fastapi, uvicorn, langgraph, tensorflow (opcional), uv 0.13.7 / uv_build. Nx sigue en 23.1.1 y TypeScript sin cambios.

## Qué sigue
- Nx 24 y TypeScript 7 en una spec propia (afectan a todos los generadores).
- `context_prompt.md` global del proyecto generado sigue sin listar las apps (se copia verbatim del template).
- Warning de lint `no-non-null-assertion` en `main.tsx` del blueprint `react-app` (previo).
