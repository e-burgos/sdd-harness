# Copilot instructions — @e-burgos/sdd-harness

Reglas completas en [`AGENTS.md`](../AGENTS.md) (fuente única). Resumen mínimo para review:

- Este repo **no es un workspace Nx**: es la fuente del kit (CLI `harness`) sobre pnpm
  workspaces y usa el kit SDD solo para sus propios flujos de desarrollo. Nx aparece únicamente
  en lo que la CLI genera para otros repos.
- `apps/cli/templates/sdd/` es el kit SDD portable canónico: se copia **verbatim** a los repos
  generados y se publica en npm. Ningún archivo del kit puede contener el nombre del proyecto
  (`sdd/global.json` es la única fuente; `validate-sdd.mjs` lo verifica).
- Schemas del kit estrictos (`additionalProperties: false`) — la salida de los generadores
  debe matchear la forma exacta.
- En los repos Nx que genera la CLI, targets de test: `nx:run-commands` + vitest (`@nx/vite:test` no existe en Nx 23).
  Spring Boot integra por Maven vía `nx:run-commands`, sin Gradle.
- Skills siempre como `SKILL.md` en minúscula (Linux es case-sensitive).
- Cambios en generadores exigen suite verde (`pnpm test`, incluye integración real) y
  prueba de generación en `examples/`.
