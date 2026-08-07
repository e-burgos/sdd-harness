# Copilot instructions — @e-burgos/sdd-harness

Reglas completas en [`AGENTS.md`](../AGENTS.md) (fuente única). Resumen mínimo para review:

- `apps/cli/templates/sdd/` es el kit SDD portable canónico: se copia **verbatim** a los repos
  generados y se publica en npm. Ningún archivo del kit puede contener el nombre del proyecto
  (`sdd/global.json` es la única fuente; `validate-sdd.mjs` lo verifica).
- Schemas del kit estrictos (`additionalProperties: false`) — la salida de los generadores
  debe matchear la forma exacta.
- Targets de test Nx: `nx:run-commands` + vitest (`@nx/vite:test` no existe en Nx 23).
  Spring Boot integra por Maven vía `nx:run-commands`, sin Gradle.
- Skills siempre como `skill.md` en minúscula (Linux es case-sensitive).
- Cambios en generadores exigen suite verde (`npx vitest run`, incluye integración real) y
  prueba de generación en `examples/`.
