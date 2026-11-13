# spec-e-burgos-023-nx-versions-and-migration — cycle-01 — 2026-11-13

## Estado
Los generadores soportan Nx 22, 23 y 24 (24 por defecto): `harness init --nx <22|23|24>`, `nx.version` en `harness.config.json`, `config catalog` expone `nx { majors, default, versions }` y `add app` respeta la mayor del repo. En Nx ≥ 24 no hay executors de eslint/jest/vite/node/nest/react/esbuild: se registran plugins inferidos en `nx.json` y esbuild/vitest van por run-commands. El kit trae la skill `nx-migration` y `pnpm sdd:nx-migrate -- --to <n> [--yes] [--json]` (rama `chore/nx-<n>` si se está en la por defecto, `--no-agentic` desde Nx 24, frena si nx no arranca la corrida, lista los prompts de `tools/ai-migrations/`). TypeScript sigue en `~6.0.3`.

## Estructura
- `src/generators/versions.ts` (`NX_MAJORS`, `NX_VERSIONS` 22.7.12/23.3.2/24.0.6, `NX_PEER_OVERRIDES` — Nx 22 usa vitest `^4.1.12`), `src/generators/nx-inferred.ts` (plugins y limpieza de executors eliminados), `root-package.ts`, `workspace.generator.ts`, `app.generator.ts`, `lib.generator.ts`, `commands/init.ts`, `config/{schema,catalog}.ts`.
- Kit: `skills/nx-migration/` (SKILL.md + `references/22-to-23.md`, `23-to-24.md`, `typescript-7.md`), `scripts/sdd-nx-migrate.mjs` + `scripts/lib/nx-migrate.mjs`, script `sdd:nx-migrate` en el template `nx-workspace/package.json`.

## Dependencias
- Nx 24.0.6 por defecto (antes 23.1.1). `esbuild ^0.28.2` en repos Nx 24 con fastify/hono.

## Qué sigue
- Al salir Nx 25: entra en la matriz y sale Nx 22; generación real por mayor antes de publicar.
- TypeScript 7 cuando typescript-eslint, @nestjs/cli, ts-jest y Nx abran el rango (lista de cambios en la skill).
- `serve-static` inferido apunta a `@nx/web:file-server`, que no se instala.
