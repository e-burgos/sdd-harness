# spec-e-burgos-023-nx-versions-and-migration — cycle-01 · plan (lite)

> Módulo: nx-versions-and-migration | Subproyectos: apps/cli, apps/studio | 2026-11-13 · Rama `feat/studio-kit-integrations` (PR #82).

## Diseño
- **Matriz** (`apps/cli/src/generators/versions.ts`): `NX_MAJORS = [22, 23, 24]`, `DEFAULT_NX_MAJOR = 24`,
  `NX_VERSIONS = { 22: '22.7.12', 23: '23.3.2', 24: '24.0.6' }` y, por mayor, los peers que cambian
  (los que no cambian siguen únicos). Reemplaza `NX_VERSION`.
- **Generadores**: `workspace.generator.ts`, `root-package.ts`, `app.generator.ts` y el template
  `nx-workspace/package.json` toman la versión de la mayor elegida.
- **CLI y config**: `harness init --nx <22|23|24>`; `nx` en el schema de `harness.config.json`;
  `config catalog` expone las mayores y la por defecto (contrato con el wizard de Studio).
- **Studio**: el wizard de Nuevo proyecto muestra la versión de Nx (solo monorepo) desde el catálogo.
- **Skill** `templates/sdd/skills/nx-migration/` (SKILL.md + references por salto) y **comando**
  `templates/sdd/scripts/sdd-nx-migrate.mjs` (`pnpm sdd:nx-migrate -- --to <major> [--yes]`):
  detecta la mayor actual de `nx` en `package.json`, arma el plan de saltos, sin `--yes` imprime el
  plan; con `--yes`, por salto: `npx nx migrate <latest de esa mayor>` → `pnpm install` →
  `npx nx migrate --run-migrations` (si hay `migrations.json`) → borra `migrations.json`; frena al
  primer fallo. No commitea ni pushea.
- **Verificación**: generación real de un monorepo por mayor (react + nest + lib) con build,
  typecheck y test.

## Tasks
- TASK-001 — Matriz y generadores (CLI, config, catálogo, template, tests).
- TASK-002 — Skill `nx-migration` y comando `sdd:nx-migrate` (+ tests, catálogo, docs).
- TASK-003 — Opción de versión de Nx en el wizard de Studio.
- TASK-004 — Generación real por mayor y cierre.
