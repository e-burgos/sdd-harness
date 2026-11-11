# FIX-e-burgos-004 — CI verificado en local (ci:local) y Windows fuera del CI de cada PR

| Campo         | Valor                          |
| ------------- | ------------------------------ |
| **ID**        | FIX-e-burgos-004               |
| **Tipo**      | IMPROVEMENT                    |
| **Severidad** | low                            |
| **Keyword**   | [IMPROVEMENT]                  |
| **Fecha**     | 2026-11-11                     |
| **Autor**     | e-burgos                       |
| **Spec**      | N/A (repo-level / CI)          |

## Problema

La cuenta superó los 3000 minutos de GitHub Actions del plan. En sdd-harness cada push a una PR
facturaba unos 21 minutos (14 de ellos de Windows, que factura x2) y el merge a `main` repetía el
mismo CI.

## Solución aplicada

1. `pnpm ci:local` (`scripts/ci/ci-local.sh`): corre en local `sdd:validate`, build, typecheck,
   test y e2e, pushea la rama y publica el commit status `ci-local=success` sobre el SHA.
2. `ci.yml`: un job `local` busca ese status (`scripts/ci/wait-ci-local-status.sh`); si está, los
   jobs pesados se saltean. Deja de correr en push a `main` y cancela corridas viejas de la misma PR.
3. Windows sale de la matriz de `ci.yml` y pasa a `windows.yml`: corre solo en PRs que tocan
   archivos sensibles a Windows y a mano (`workflow_dispatch`) antes de un release.
4. Guía en `docs/ci.md`.

## Validación

`pnpm ci:local` sobre la rama del fix: status publicado y CI de la PR salteado.
