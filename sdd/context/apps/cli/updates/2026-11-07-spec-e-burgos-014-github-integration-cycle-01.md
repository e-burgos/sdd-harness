# spec-e-burgos-014-github-integration — cycle-01 — 2026-11-07

## Estado
La CLI conecta un proyecto a GitHub con el `gh` del dev: `harness github connect | status | protect` (sin tokens propios; acciones hacia afuera solo con `--yes` o confirmación). El kit trae por primera vez un workflow de CI (`sdd/templates/github/workflows/sdd-validate.yml`, job `sdd-validate` con `name: sdd:validate`) que `connect` copia a `.github/workflows/`. Los ciclos pueden vivir en su rama y cerrar con PR: `pnpm sdd:branch` y `pnpm sdd:pr` (rama por ciclo según perfil, override `global.json → github.branch_per_cycle`).

## Estructura
- `src/commands/github/` (`index`, `status`, `connect`, `protect`, `shared`) y `src/utils/github.ts` (`Runner` inyectable con execFile, `ghStatus`, `gitStatus`, `parseRemoteUrl`, `createRepo`, `protectBranch`).
- Kit: `scripts/lib/github.mjs` (pura: `branchNameFor`, `branchPolicy`, `prTitleFor`, `prBodyFor`, `parseRemoteUrl`), `scripts/sdd-branch.mjs`, `scripts/sdd-pr.mjs`, `templates/github/workflows/sdd-validate.yml`; bloque `github` opcional en `global.schema.json`.
- Docs: orquestador (rama al abrir), reviewer (PR al cerrar con confirmación), `sdd-gates.md` § Ramas y PRs por ciclo, data-schemas, README y HOW-TO es/en.

## Dependencias
- `gh` CLI del dev (opcional: sin él los comandos explican qué falta).

## Qué sigue
- cycle-02 (Studio): `github.status` / `github.connect` en el puente y estado de PR/CI por ciclo.
- Los ids de job de GitHub no admiten `:`; el test de `github-lib.spec.ts` lo cubre.
