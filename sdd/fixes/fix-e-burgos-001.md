# FIX-e-burgos-001 — Run pnpm sdd:validate in CI

| Campo         | Valor                |
| ------------- | -------------------- |
| **ID**        | FIX-e-burgos-001     |
| **Tipo**      | IMPROVEMENT          |
| **Severidad** | low                  |
| **Keyword**   | [IMPROVEMENT]        |
| **Fecha**     | 2026-10-23           |
| **Autor**     | e-burgos             |
| **Estado**    | validated            |
| **Spec**      | N/A (repo-level)     |

## Problema

Ningún workflow ejecuta `pnpm sdd:validate`, aunque el kit lo exige como check obligatorio de cada commit.

## Justificación del bypass

Cambio de un solo archivo de CI, sin contratos ni entidades nuevas; el gate tiene que estar activo desde que se instala el kit.

## Solución aplicada

Se agregó el job `sdd-validate` (ubuntu, Node 22, `pnpm install --frozen-lockfile` + `pnpm sdd:validate`) a `ci.yml`. Sin cambios de contexto.

### Archivos modificados

- `.github/workflows/ci.yml` — job `sdd-validate`

### Test de validación

- **Referencia:** `pnpm sdd:validate` local en verde; el job de CI ejecuta el mismo comando.

### Decisión del Reviewer

- **Validado:** verificado que pnpm sdd:validate corre exitosamente y el job está configurado en .github/workflows/ci.yml.
