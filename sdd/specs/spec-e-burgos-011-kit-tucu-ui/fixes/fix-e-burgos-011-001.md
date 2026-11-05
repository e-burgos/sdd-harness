# FIX-e-burgos-011-001 — En Windows `--sync` no reconoce el link de tucu-ui-design como del kit

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-011-001 |
| **Tipo**      | BUGFIX |
| **Severidad** | medium |
| **Fecha**     | 2026-11-03 |
| **Autor**     | e-burgos |
| **Estado**    | validated |
| **Spec**      | spec-e-burgos-011-kit-tucu-ui |

## Problema

En el CI de Windows (PR #63), `setup-agents.ps1` corre `sdd-tucu.mjs --sync` y marca los tres links `tucu-ui-design` como «not the kit's link». El junction se creó con la ruta corta del temp (`RUNNER~1`) y el script, invocado desde PowerShell, resuelve la raíz con la ruta larga; `realpathSync` (implementación JS) no expande nombres 8.3, así que las dos rutas no coinciden.

## Solución

`kitLinkState` y `prepareLinkParent` comparan con `realpathSync.native`, que devuelve la ruta canónica larga en Windows. Sin cambios de contrato.

## Archivos

- `apps/cli/templates/sdd/scripts/tucu-ui-common.mjs`, `apps/cli/templates/sdd/scripts/sdd-tucu.mjs` (y su copia en `sdd/scripts/`)
- Prueba: `apps/cli/src/generators/__tests__/sdd.generator.windows.spec.ts` (solo corre en Windows; lo valida el CI)

## Validación

CI de PR #63 en verde en `ubuntu-latest` y `windows-latest` (head 36bb829), mergeado a main el 2026-11-03.
