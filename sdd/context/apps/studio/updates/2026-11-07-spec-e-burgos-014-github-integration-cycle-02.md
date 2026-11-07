# spec-e-burgos-014-github-integration — cycle-02 — 2026-11-07

## Estado
Studio muestra GitHub: indicador en el header (repo enlazado o «Conectar GitHub» con diálogo), panel de conexión reutilizable (gh no instalado / sin login / conectado / formulario privado por defecto y protección apagada) y, en la lista «en curso», PR y CI de cada ciclo.

## Estructura
- `components/github/GithubConnectPanel.tsx` (COMP-125), `GithubHeaderStatus.tsx` (COMP-126); `lib/open-units.ts` `githubOfUnit`; i18n `modules/github.ts`; `OpenUnitsList` y `StudioHeader` actualizados.

## Dependencias
- Ninguna nueva (usa `gh` del dev a través de la CLI del kit).

## Qué sigue
- spec 018 reusa `GithubConnectPanel` tras la generación.
- A 800 px el header se aprieta (píldora en dos líneas).
