# FIX-e-burgos-014-002 — El CI del kit corre en cualquier repo, sin depender de su package manager

> Tipo: BUGFIX · Severidad: medium · Spec: spec-e-burgos-014-github-integration · 2026-11-13

## Problema
La prueba real de `harness github connect` + `protect` (repo público de prueba, kit 0.21.0) falló
en CI: el workflow `sdd-validate.yml` usaba `pnpm/action-setup` sin versión y `pnpm install
--frozen-lockfile`. Un repo con el kit instalado por `configure sdd` sin `packageManager` en su
`package.json`, o con npm/yarn, o sin lockfile de pnpm, queda con el check `sdd:validate` en rojo
para siempre; y con `protect`, la rama por defecto bloqueada.

## Solución
El workflow ya no usa el package manager del repo: `actions/setup-node` y un `npm install --prefix
sdd --no-save --no-package-lock --ignore-scripts` de las dos únicas dependencias del validador
(`ajv`, `ajv-formats`), que Node resuelve desde `sdd/scripts/`. Test que impide volver a pnpm,
yarn, `npm ci` o lockfiles. Verificado en el repo de prueba: `sdd:validate` en verde con la rama
protegida.

## Archivos
- `apps/cli/templates/sdd/templates/github/workflows/sdd-validate.yml` (+ espejo en `sdd/`)
- `apps/cli/src/utils/__tests__/github-lib.spec.ts`
