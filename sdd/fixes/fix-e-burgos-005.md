# FIX-e-burgos-005 — Next.js 16.4.6 en Studio y piso de los generadores

| Campo         | Valor                 |
| ------------- | --------------------- |
| **ID**        | FIX-e-burgos-005      |
| **Tipo**      | IMPROVEMENT           |
| **Severidad** | medium                |
| **Keyword**   | [IMPROVEMENT]         |
| **Fecha**     | 2026-11-18            |
| **Autor**     | e-burgos              |
| **Spec**      | N/A (repo-level)      |

## Problema

`apps/studio` fijaba `next` 16.4.3, afectada por una vulnerabilidad conocida: `next build` se
detenía con `SecurityFatalError` y pasaba solo al reintentar. Los generadores del kit pedían
`^16.4.4`.

## Solución aplicada

`next` 16.4.6 (última estable) en `apps/studio/package.json` y `pnpm-lock.yaml`; piso `^16.4.6`
en `apps/cli/src/generators/versions.ts`.

## Validación

`pnpm build && pnpm typecheck && pnpm test` en verde.
